import prisma from '../config/prisma.js';

const classifySessionRole = (role = '') => {
  const value = String(role || '').toLowerCase();
  if (value === 'admin' || value === 'super_admin' || value === 'user_manager') return 'admin';
  if (value.includes('operator') || value.includes('center')) return 'operator';
  if (value === 'citizen' || value === 'user') return 'citizen';
  return 'other';
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

const buildSessionStats = (sessions = []) => {
  const stats = {
    totalRecords: sessions.length,
    activeSessions: 0,
    inactiveSessions: 0,
    onlineUsers: 0,
    byRole: { all: 0, admin: 0, operator: 0, citizen: 0 }
  };
  const onlineUsers = new Set();

  for (const session of sessions) {
    const isActive = String(session.status || '').toLowerCase() === 'active';
    if (!isActive) {
      stats.inactiveSessions += 1;
      continue;
    }

    stats.activeSessions += 1;
    const userKey = sessionUserKey(session);
    if (!userKey || onlineUsers.has(userKey)) continue;

    onlineUsers.add(userKey);
    const roleKey = classifySessionRole(session.role || session.user?.role);
    stats.byRole.all += 1;
    if (stats.byRole[roleKey] !== undefined) {
      stats.byRole[roleKey] += 1;
    }
  }

  stats.onlineUsers = onlineUsers.size;
  return stats;
};

export const listActiveSessions = async (req, res) => {
  try {
    let sessions = await prisma.activeSession.findMany({
      orderBy: { lastActiveTime: 'desc' },
      take: 300
    });
    sessions = await healDuplicateActiveSessions(sessions);

    const userIds = [...new Set(sessions.map((session) => session.user).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true, email: true, role: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    // Fill missing roles from users, but keep session.user as the raw id for unique counts.
    const forStats = sessions.map((session) => {
      const user = usersById.get(session.user);
      return {
        ...session,
        role: session.role || user?.role || ''
      };
    });
    const stats = buildSessionStats(forStats);

    const data = forStats.map((session) => ({
      ...session,
      _id: session.id,
      userId: session.user,
      user: usersById.get(session.user) || session.user
    }));

    return res.json({ success: true, count: data.length, stats, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const invalidateSession = async (req, res) => {
  try {
    const session = await prisma.activeSession.update({
      where: { id: req.params.id },
      data: { status: 'inactive', loggedOutAt: new Date(), lastActiveTime: new Date() }
    });

    return res.json({ success: true, data: session });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

