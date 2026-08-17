import prisma from '../config/prisma.js';

/** Must mirror the JWT `expiresIn: '30d'` in authService.js — once a token has
 *  outlived this window it can no longer authenticate, even if its ActiveSession
 *  row was never explicitly logged out or invalidated. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Rows returned for the browsable table. Stats below are always computed from
 *  a true, uncapped count/query, so this only bounds how far back the table can
 *  be searched — it never affects the accuracy of any card total. */
const BROWSABLE_LIMIT = 2000;

const classifySessionRole = (role = '') => {
  const value = String(role || '').toLowerCase();
  if (value === 'admin' || value === 'super_admin' || value === 'user_manager') return 'admin';
  if (value.includes('operator') || value.includes('center')) return 'operator';
  if (value === 'citizen' || value === 'user') return 'citizen';
  return 'other';
};

/** A session only counts as online when its row is still flagged active AND its
 *  login has not outlived the token's real expiry — an account's own status has
 *  no bearing on this. */
const isSessionOnline = (session) => {
  if (String(session.status || '').toLowerCase() !== 'active') return false;
  const loginTime = session.loginTime ? new Date(session.loginTime).getTime() : null;
  if (loginTime === null || Number.isNaN(loginTime)) return true;
  return Date.now() - loginTime <= TOKEN_TTL_MS;
};

/** Keep only the newest active session per user; mark older duplicates inactive. */
const healDuplicateActiveSessions = async (sessions = []) => {
  const newestByUser = new Map();
  const staleIds = [];

  for (const session of sessions) {
    if (String(session.status || '').toLowerCase() !== 'active') continue;
    const userKey = String(session.user || session.username || session.id);
    const current = newestByUser.get(userKey);
    if (!current) {
      newestByUser.set(userKey, session);
      continue;
    }
    const currentTime = new Date(current.lastActiveTime || current.loginTime || 0).getTime();
    const nextTime = new Date(session.lastActiveTime || session.loginTime || 0).getTime();
    if (nextTime >= currentTime) {
      staleIds.push(current.id);
      newestByUser.set(userKey, session);
    } else {
      staleIds.push(session.id);
    }
  }

  if (staleIds.length) {
    const now = new Date();
    await prisma.activeSession.updateMany({
      where: { id: { in: staleIds } },
      data: { status: 'inactive', loggedOutAt: now, lastActiveTime: now }
    });
    const staleSet = new Set(staleIds);
    return sessions.map((session) => (
      staleSet.has(session.id)
        ? { ...session, status: 'inactive', loggedOutAt: now, lastActiveTime: now }
        : session
    ));
  }

  return sessions;
};

const sessionUserKey = (session = {}) => {
  if (session.user && typeof session.user === 'object') {
    return String(session.user.id || session.username || session.id || '');
  }
  return String(session.user || session.username || session.id || '');
};

/** onlineSessions must already be narrowed to rows that pass isSessionOnline(). */
const buildSessionStats = (onlineSessions = [], totalRecords = 0) => {
  const stats = {
    totalRecords,
    activeSessions: onlineSessions.length,
    inactiveSessions: Math.max(0, totalRecords - onlineSessions.length),
    onlineUsers: 0,
    byRole: { all: 0, admin: 0, operator: 0, citizen: 0 }
  };
  const onlineUsers = new Set();

  for (const session of onlineSessions) {
    const userKey = sessionUserKey(session);
    if (userKey) onlineUsers.add(userKey);

    const roleKey = classifySessionRole(session.role || session.user?.role);
    stats.byRole.all += 1;
    if (stats.byRole[roleKey] !== undefined) {
      stats.byRole[roleKey] += 1;
    }
  }

  stats.onlineUsers = onlineUsers.size;
  return stats;
};

export class SessionService {
  static async listActiveSessions() {
    let activeSessions = await prisma.activeSession.findMany({
      where: { status: 'active' },
      orderBy: { lastActiveTime: 'desc' }
    });
    activeSessions = await healDuplicateActiveSessions(activeSessions);

    const [totalRecords, sessions] = await Promise.all([
      prisma.activeSession.count(),
      prisma.activeSession.findMany({ orderBy: { lastActiveTime: 'desc' }, take: BROWSABLE_LIMIT })
    ]);

    // The dedup-healing pass above may have just flipped some rows to inactive;
    // reconcile the browsable list so it reflects that instead of stale data.
    const healedById = new Map(activeSessions.map((session) => [session.id, session]));
    const reconciledSessions = sessions.map((session) => healedById.get(session.id) || session);

    const userIds = [...new Set([
      ...activeSessions.map((session) => session.user),
      ...reconciledSessions.map((session) => session.user)
    ].filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true, email: true, role: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const onlineSessions = activeSessions
      .map((session) => ({ ...session, role: session.role || usersById.get(session.user)?.role || '' }))
      .filter(isSessionOnline);

    const stats = buildSessionStats(onlineSessions, totalRecords);

    const data = reconciledSessions.map((session) => ({
      ...session,
      _id: session.id,
      userId: session.user,
      user: usersById.get(session.user) || session.user
    }));

    return { count: data.length, stats, data };
  }

  static async invalidateSession(id) {
    try {
      const session = await prisma.activeSession.update({
        where: { id },
        data: { status: 'inactive', loggedOutAt: new Date(), lastActiveTime: new Date() }
      });
      return session;
    } catch (error) {
      if (error.code === 'P2025') {
        throw { statusCode: 404, message: 'Session not found.' };
      }
      throw error;
    }
  }
}
