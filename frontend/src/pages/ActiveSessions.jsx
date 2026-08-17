import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiActivity,
  FiClock,
  FiMonitor,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiXCircle,
  FiEye,
  FiX,
  FiHash,
  FiMapPin,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import api from '../api/axiosInstance';

const STATUS_FILTERS = new Set(['all', 'active', 'inactive']);
const ROWS_PER_PAGE = 10;

/** Login tokens are signed with a 30-day expiry (backend/services/authService.js).
 *  Used only to label a still-"active" DB row whose underlying JWT must have
 *  expired by now — no backend change, just an honest read of a known constant. */
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

const ROLE_TABS = [
  { key: 'all', label: 'All Sessions', detailTitle: 'All Login Sessions', icon: <FiActivity />, tone: 'blue' },
  { key: 'admin', label: 'Admins', detailTitle: 'Admin Login Sessions', icon: <FiShield />, tone: 'purple' },
  { key: 'operator', label: 'Operators', detailTitle: 'Operator Login Sessions', icon: <FiUserCheck />, tone: 'green' },
  { key: 'citizen', label: 'Citizens', detailTitle: 'Citizen Login Sessions', icon: <FiUsers />, tone: 'orange' },
];

const VALID_SESSION_PAGES = new Set(ROLE_TABS.map((tab) => tab.key));

const ROLE_ALIASES = {
  admins: 'admin',
  operators: 'operator',
  users: 'citizen',
  citizens: 'citizen',
};

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getRoleKey = (session) => {
  const rawRole = String(session.role || session.user?.role || '').toLowerCase();

  if (rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'user_manager') return 'admin';
  if (rawRole.includes('operator') || rawRole.includes('center')) return 'operator';
  if (rawRole === 'citizen' || rawRole === 'user') return 'citizen';

  return 'citizen';
};

const getRoleLabel = (session) => {
  const roleKey = getRoleKey(session);
  if (roleKey === 'admin') return 'Admin';
  if (roleKey === 'operator') return 'Operator';
  if (roleKey === 'citizen') return 'Citizen';
  return roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
};

const getUsername = (session) => session.username || session.user?.username || '--';
const getFullName = (session) => session.user?.name || getUsername(session);
const getSessionId = (session) => String(session._id || session.id || '--');

/** Real fields only: status + loggedOutAt (explicit logout/invalidate) + loginTime
 *  vs the known 30-day token TTL (auto-expiry) + lastActiveTime (idle). No
 *  fabricated state — every label traces back to a real column. */
const getSessionStatusMeta = (session) => {
  const isActiveFlag = String(session.status || '').toLowerCase() === 'active';
  const loginTime = session.loginTime ? new Date(session.loginTime).getTime() : null;
  const lastActive = session.lastActiveTime ? new Date(session.lastActiveTime).getTime() : null;
  const now = Date.now();
  const tokenExpired = loginTime !== null && now - loginTime > TOKEN_TTL_MS;

  if (isActiveFlag && tokenExpired) {
    return { key: 'expired', label: 'Expired', badgeClass: 'is-expired', online: false, dotClass: 'is-offline' };
  }
  if (isActiveFlag) {
    const isIdle = lastActive !== null && now - lastActive > IDLE_THRESHOLD_MS;
    return isIdle
      ? { key: 'idle', label: 'Idle', badgeClass: 'is-idle', online: true, dotClass: 'is-idle' }
      : { key: 'online', label: 'Online', badgeClass: 'is-active', online: true, dotClass: 'is-online' };
  }
  if (session.loggedOutAt) {
    return { key: 'loggedOut', label: 'Logged Out', badgeClass: 'is-inactive', online: false, dotClass: 'is-offline' };
  }
  return { key: 'inactive', label: 'Inactive', badgeClass: 'is-inactive', online: false, dotClass: 'is-offline' };
};

/** Mirrors the backend's isSessionOnline (sessionService.js) — a session only
 *  counts as online when its row is still active AND its login has not
 *  outlived the 30-day token TTL. Card totals use this; getSessionStatusMeta
 *  above separately labels idle vs fully-expired for the table's badges. */
const isSessionOnline = (session) => {
  if (String(session.status || '').toLowerCase() !== 'active') return false;
  const loginTime = session.loginTime ? new Date(session.loginTime).getTime() : null;
  if (loginTime === null) return true;
  return Date.now() - loginTime <= TOKEN_TTL_MS;
};

const getSessionDuration = (session) => {
  const start = session.loginTime ? new Date(session.loginTime).getTime() : null;
  if (!start) return '--';
  const isOpenEnded = String(session.status || '').toLowerCase() === 'active' && !session.loggedOutAt;
  const end = isOpenEnded
    ? Date.now()
    : session.loggedOutAt
      ? new Date(session.loggedOutAt).getTime()
      : session.lastActiveTime
        ? new Date(session.lastActiveTime).getTime()
        : Date.now();
  const diffMinutes = Math.max(0, Math.round((end - start) / 60000));
  const days = Math.floor(diffMinutes / 1440);
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const minutes = diffMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

/** Real userAgent string, parsed into a friendlier browser/device/OS summary. */
const parseUserAgent = (ua = '') => {
  if (!ua || ua === 'Unknown device') return { browser: 'Unknown', device: 'Unknown', os: '', raw: ua };
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const device = /Mobile|Android(?!.*Tablet)|iPhone/.test(ua) ? 'Mobile'
    : /iPad|Tablet/.test(ua) ? 'Tablet'
    : 'Desktop';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return { browser, device, os, raw: ua };
};

const sessionMatchesQuery = (session, query) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    getUsername(session),
    session.user?.name,
    session.ipAddress,
    session.userAgent,
    getRoleLabel(session),
    session.status,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
};

const ActiveSessions = () => {
  const navigate = useNavigate();
  const { role } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [operators, setOperators] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const statusFromUrl = STATUS_FILTERS.has(searchParams.get('status'))
    ? searchParams.get('status')
    : 'all';
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [query, setQuery] = useState('');
  const [highlightSessionId, setHighlightSessionId] = useState(null);
  const [page, setPage] = useState(1);
  const [detailsSession, setDetailsSession] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const applyStatusFilter = (nextStatus, options = {}) => {
    const value = STATUS_FILTERS.has(nextStatus) ? nextStatus : 'all';
    setStatusFilter(value);
    setHighlightSessionId(options.highlightId || null);
    const nextParams = new URLSearchParams(searchParams);
    if (value === 'all') nextParams.delete('status');
    else nextParams.set('status', value);
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    setStatusFilter(statusFromUrl);
  }, [statusFromUrl]);

  const normalizedRole = ROLE_ALIASES[role] || role;
  const pageRole = VALID_SESSION_PAGES.has(normalizedRole) ? normalizedRole : null;
  const isOverview = !pageRole;
  // On the bare overview route, a clicked card sets this locally so the table
  // expands in place instead of navigating to a separate page.
  const activeCategory = pageRole || selectedCategory;
  const roleFilter = activeCategory || 'all';

  const loadSessions = async () => {
    try {
      setLoading(true);
      const [sessionsRes, operatorsRes] = await Promise.all([
        api.get('/api/sessions'),
        api.get('/api/operators').catch(() => ({ data: { data: [] } })),
      ]);
      setSessions(sessionsRes.data.data || []);
      setServerStats(sessionsRes.data.stats || null);
      setOperators(operatorsRes.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load active sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, statusFilter, query]);

  useEffect(() => {
    if (!isOverview || !selectedCategory) return;
    window.requestAnimationFrame(() => {
      document.getElementById('session-list-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [isOverview, selectedCategory]);

  const invalidate = async (sessionId, event) => {
    event?.stopPropagation();
    try {
      await api.put(`/api/sessions/${sessionId}/invalidate`);
      toast.success('Session marked inactive.');
      await loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to invalidate session.');
    }
  };

  const operatorCenterById = useMemo(() => {
    const map = new Map();
    operators.forEach((operator) => {
      const centerName = typeof operator.center === 'object' ? operator.center?.name : null;
      const id = operator.id || operator._id;
      if (id && centerName) map.set(String(id), centerName);
    });
    return map;
  }, [operators]);

  const getCenterName = (session) => {
    if (getRoleKey(session) !== 'operator') return null;
    const userId = session.userId || session.user?.id;
    return operatorCenterById.get(String(userId)) || null;
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const roleMatches = activeCategory === 'all' || !activeCategory || getRoleKey(session) === activeCategory;
      const statusMatches = statusFilter === 'all' || session.status === statusFilter;
      return roleMatches && statusMatches && sessionMatchesQuery(session, query);
    });
  }, [activeCategory, query, sessions, statusFilter]);

  const roleScopedSessions = useMemo(() => (
    sessions.filter((session) => {
      const roleMatches = activeCategory === 'all' || !activeCategory || getRoleKey(session) === activeCategory;
      return roleMatches && sessionMatchesQuery(session, query);
    })
  ), [activeCategory, query, sessions]);

  const detailStats = useMemo(() => {
    // Keep card totals stable while status filter changes the table below.
    const latest = [...roleScopedSessions].sort(
      (a, b) => new Date(b.lastActiveTime || 0) - new Date(a.lastActiveTime || 0)
    )[0];
    const activeCount = roleScopedSessions.filter(isSessionOnline).length;

    return {
      total: roleScopedSessions.length,
      active: activeCount,
      inactive: roleScopedSessions.length - activeCount,
      latestActive: latest?.lastActiveTime,
      latestSessionId: latest?._id || latest?.id || null,
    };
  }, [roleScopedSessions]);

  const counts = useMemo(() => {
    const hasLocalFilter = Boolean(query.trim()) || statusFilter !== 'all';
    const onlineSessions = sessions.filter(isSessionOnline);

    // Prefer server stats when no local filter is active — they're computed
    // from the full, uncapped dataset rather than just this client's fetch.
    if (!hasLocalFilter && serverStats) {
      return {
        all: serverStats.totalRecords ?? sessions.length,
        admin: serverStats.byRole?.admin ?? 0,
        operator: serverStats.byRole?.operator ?? 0,
        citizen: serverStats.byRole?.citizen ?? 0,
        active: serverStats.activeSessions ?? onlineSessions.length,
        inactive: serverStats.inactiveSessions ?? Math.max(0, sessions.length - onlineSessions.length),
        totalRecords: serverStats.totalRecords ?? sessions.length,
      };
    }

    const queryMatched = sessions.filter((session) => sessionMatchesQuery(session, query));
    const onlineMatched = queryMatched.filter(isSessionOnline);
    const byRole = { admin: 0, operator: 0, citizen: 0 };
    onlineMatched.forEach((session) => {
      const roleKey = getRoleKey(session);
      if (byRole[roleKey] !== undefined) byRole[roleKey] += 1;
    });

    return {
      all: queryMatched.length,
      admin: byRole.admin,
      operator: byRole.operator,
      citizen: byRole.citizen,
      active: onlineMatched.length,
      inactive: Math.max(0, queryMatched.length - onlineMatched.length),
      totalRecords: sessions.length,
    };
  }, [query, serverStats, sessions, statusFilter]);

  const visibleGroup = useMemo(() => {
    const tab = ROLE_TABS.find((item) => item.key === roleFilter) || ROLE_TABS[0];
    return {
      key: roleFilter,
      title: tab.detailTitle,
      description: roleFilter === 'all'
        ? 'All admin, operator, and citizen login sessions in one list.'
        : `Only ${tab.label.toLowerCase()} login sessions.`,
      icon: tab.icon,
    };
  }, [roleFilter]);

  const tableSessions = filteredSessions;
  const totalPages = Math.max(1, Math.ceil(tableSessions.length / ROWS_PER_PAGE));
  const pagedSessions = useMemo(
    () => tableSessions.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [tableSessions, page]
  );

  const renderSessionTable = (items, group) => (
    <div key={group.key} className="nqs-active-card overflow-hidden rounded-2xl border shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border-light)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#2563EB]/10 text-xl text-[#2563EB]">
            {group.icon}
          </div>
          <div>
            <h2 className="text-lg font-black">{group.title}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{group.description}</p>
          </div>
        </div>
        <span className="rounded-full bg-[#2563EB]/10 px-4 py-2 text-sm font-black text-[#2563EB]">
          {tableSessions.length} {tableSessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="nqs-active-table w-full min-w-[1400px] text-left text-[13px]">
          <thead className="nqs-active-thead text-xs uppercase">
            <tr>
              {['Session ID', 'Username', 'Full Name', 'Role', 'Center', 'Login Time', 'Last Active', 'IP Address', 'Device / Browser', 'Status', 'Actions'].map((heading) => (
                <th key={heading} className="px-3 py-3 font-black tracking-wide">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="nqs-active-tbody divide-y">
            {loading ? (
              <tr><td colSpan="11" className="px-4 py-10 text-center font-semibold">
                <span className="nqs-active-spinner" aria-hidden="true" /> Loading sessions...
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="11" className="px-4 py-14 text-center">
                <FiMonitor className="mx-auto mb-2 text-3xl text-[var(--text-muted)]" />
                <p className="font-semibold">No {group.title.toLowerCase()} found.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Try a different search term or status filter.</p>
              </td></tr>
            ) : items.map((session) => {
              const sessionId = session._id || session.id;
              const isHighlighted = highlightSessionId && String(highlightSessionId) === String(sessionId);
              const statusMeta = getSessionStatusMeta(session);
              const device = parseUserAgent(session.userAgent);
              const centerName = getCenterName(session);
              return (
              <tr
                key={sessionId}
                id={sessionId ? `session-row-${sessionId}` : undefined}
                onClick={() => setDetailsSession(session)}
                className={`nqs-active-row cursor-pointer ${isHighlighted ? 'bg-[#2563EB]/10 ring-2 ring-inset ring-[#2563EB]/40' : ''}`}
              >
                <td className="px-3 py-3 font-mono text-xs text-[var(--text-muted)]" title={getSessionId(session)}>
                  {getSessionId(session).slice(0, 8)}…
                </td>
                <td className="nqs-active-username px-3 py-3 font-mono font-bold">{getUsername(session)}</td>
                <td className="px-3 py-3 font-semibold">{getFullName(session)}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-black text-[#2563EB]">
                    {getRoleLabel(session)}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs">{centerName || '--'}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(session.loginTime)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(session.lastActiveTime)}</td>
                <td className="px-3 py-3 font-mono text-xs">{session.ipAddress || '--'}</td>
                <td className="max-w-[220px] px-3 py-3 text-xs leading-5">
                  <span className="block font-bold">{device.browser}{device.os ? ` · ${device.os}` : ''}</span>
                  <span className="block text-[var(--text-muted)]">{device.device}</span>
                </td>
                <td className="px-3 py-3">
                  <span className={`nqs-session-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${statusMeta.badgeClass}`}>
                    <span className={`nqs-status-dot ${statusMeta.dotClass}`} aria-hidden="true" />
                    {statusMeta.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-nowrap items-center gap-2">
                    <button
                      onClick={(event) => { event.stopPropagation(); setDetailsSession(session); }}
                      className="nqs-view-details-btn inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black"
                    >
                      <FiEye /> View
                    </button>
                    <button
                      disabled={session.status !== 'active'}
                      onClick={(event) => invalidate(sessionId, event)}
                      className="nqs-invalidate-btn inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FiXCircle /> Invalidate
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-light)] px-4 py-3 text-xs font-bold text-[var(--text-muted)]">
          <span>
            Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, items.length)} of {items.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-light)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiChevronLeft /> Prev
            </button>
            <span className="px-1">Page {page} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-light)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderDetailStats = () => (
    <div className="grid gap-3 md:grid-cols-4">
      {[
        {
          key: 'all',
          label: 'Total',
          value: detailStats.total,
          tone: 'blue',
          icon: <FiMonitor />,
          onClick: () => applyStatusFilter('all'),
        },
        {
          key: 'active',
          label: 'Active',
          value: detailStats.active,
          tone: 'green',
          icon: <FiActivity />,
          onClick: () => applyStatusFilter('active'),
        },
        {
          key: 'inactive',
          label: 'Inactive',
          value: detailStats.inactive,
          tone: 'orange',
          icon: <FiClock />,
          onClick: () => applyStatusFilter('inactive'),
        },
        {
          key: 'latest',
          label: 'Last Activity',
          value: formatDate(detailStats.latestActive),
          valueClass: 'text-sm',
          tone: 'purple',
          icon: <FiRefreshCw />,
          onClick: () => {
            applyStatusFilter('all', { highlightId: detailStats.latestSessionId });
            if (detailStats.latestSessionId) {
              window.requestAnimationFrame(() => {
                document
                  .getElementById(`session-row-${detailStats.latestSessionId}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }
          },
        },
      ].map((card) => {
        const selected = card.key !== 'latest' && statusFilter === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md nqs-card-tone-${card.tone} ${
              selected ? 'ring-4 ring-blue-500/15' : ''
            }`}
          >
            <span className={`nqs-card-tone-icon-${card.tone} grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl`}>
              {card.icon}
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--text-muted)]">{card.label}</p>
              <p className={`${card.valueClass || 'text-xl'} font-black text-[var(--text-main)]`}>{card.value}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  const detailMeta = ROLE_TABS.find((tab) => tab.key === roleFilter) || ROLE_TABS[0];

  return (
    <div className="nqs-active-sessions min-h-screen p-3 sm:p-5">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="nqs-active-card rounded-2xl border p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#2563EB]">Admin Security</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                {isOverview ? 'Active Sessions' : detailMeta.detailTitle}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {isOverview
                  ? 'Choose a session category to open its own page. Passwords are never shown.'
                  : 'Filtered login sessions for this category. Passwords are never shown.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!isOverview && (
                <button
                  onClick={() => navigate('/active-sessions')}
                  className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-black text-[var(--text-main)]"
                >
                  Back to overview
                </button>
              )}
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search username, IP, role..."
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] py-2.5 pl-10 pr-4 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/20 sm:w-72"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => applyStatusFilter(event.target.value)}
                className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-bold text-[var(--text-main)] outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/20"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <button
                onClick={loadSessions}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {!isOverview && (
          <div className="nqs-active-card rounded-2xl border p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Open page
              </span>
              {ROLE_TABS.map((tab) => {
                const active = roleFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => navigate(`/active-sessions/${tab.key}`)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition ${
                      active
                        ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm'
                        : 'border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[#2563EB] hover:text-[#2563EB]'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isOverview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`group flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md nqs-card-tone-${tab.tone} ${
                    selectedCategory === tab.key ? 'ring-4 ring-blue-500/20' : ''
                  }`}
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl nqs-card-tone-icon-${tab.tone}`}>
                    {tab.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-2xl font-black text-[var(--text-main)]">{counts[tab.key]}</span>
                    <span className="block truncate text-sm font-bold text-[var(--text-muted)]">{tab.label}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-[var(--text-muted)]">
                      {tab.key === 'all' ? 'All session records' : 'Online now'}
                    </span>
                  </span>
                  <span className="ml-auto text-xl text-[var(--color-primary)]">-&gt;</span>
                </button>
              ))}
            </div>

            {selectedCategory && (
              <div id="session-list-inline" className="space-y-4">
                {renderDetailStats()}
                {renderSessionTable(pagedSessions, visibleGroup)}
              </div>
            )}
          </>
        ) : (
          <>
            {renderDetailStats()}
            <div className="space-y-4">
              {renderSessionTable(pagedSessions, visibleGroup)}
            </div>
          </>
        )}
      </div>

      {detailsSession && (
        <SessionDetailsModal
          session={detailsSession}
          centerName={getCenterName(detailsSession)}
          onClose={() => setDetailsSession(null)}
          onInvalidate={(event) => {
            invalidate(detailsSession._id || detailsSession.id, event);
            setDetailsSession(null);
          }}
        />
      )}
    </div>
  );
};

function SessionDetailsModal({ session, centerName, onClose, onInvalidate }) {
  const statusMeta = getSessionStatusMeta(session);
  const device = parseUserAgent(session.userAgent);
  const rows = [
    ['Full Name', getFullName(session)],
    ['Username', getUsername(session)],
    ['Role', getRoleLabel(session)],
    ...(centerName ? [['Center', centerName]] : []),
    ['Session ID', getSessionId(session)],
    ['IP Address', session.ipAddress || '--'],
    ['Browser', device.browser],
    ['Device', device.device],
    ...(device.os ? [['Operating System', device.os]] : []),
    ['Login Time', formatDate(session.loginTime)],
    ['Last Activity', formatDate(session.lastActiveTime)],
    ['Session Duration', getSessionDuration(session)],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="nqs-active-card max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#2563EB]">Session Details</p>
            <h2 className="mt-1 text-xl font-black">{getFullName(session)}</h2>
            <span className={`nqs-session-badge mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${statusMeta.badgeClass}`}>
              <span className={`nqs-status-dot ${statusMeta.dotClass}`} aria-hidden="true" />
              {statusMeta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border-light)] p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--border-light)] p-3">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
                {label === 'Session ID' && <FiHash />}
                {label === 'Center' && <FiMapPin />}
                {label}
              </span>
              <span className="mt-1 block break-words font-bold">{value || '--'}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-5 py-3 text-sm font-black text-[var(--text-main)]"
          >
            Close
          </button>
          <button
            type="button"
            disabled={session.status !== 'active'}
            onClick={onInvalidate}
            className="nqs-invalidate-btn inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiXCircle /> Invalidate Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActiveSessions;
