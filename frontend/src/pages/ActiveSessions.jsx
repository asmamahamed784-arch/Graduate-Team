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
} from 'react-icons/fi';
import api from '../api/axiosInstance';

const STATUS_FILTERS = new Set(['all', 'active', 'inactive']);

const ROLE_TABS = [
  { key: 'all', label: 'All Sessions', detailTitle: 'All Login Sessions', icon: <FiActivity /> },
  { key: 'admin', label: 'Admins', detailTitle: 'Admin Login Sessions', icon: <FiShield /> },
  { key: 'operator', label: 'Operators', detailTitle: 'Operator Login Sessions', icon: <FiUserCheck /> },
  { key: 'citizen', label: 'Citizens', detailTitle: 'Citizen Login Sessions', icon: <FiUsers /> },
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

const getSessionUserKey = (session) => {
  if (session.userId) return String(session.userId);
  if (session.user && typeof session.user === 'object') {
    return String(session.user.id || session.username || session._id || session.id || '');
  }
  if (typeof session.user === 'string' && session.user && session.user !== '[object Object]') {
    return session.user;
  }
  return String(session.username || session._id || session.id || '');
};

const getRoleLabel = (session) => {
  const roleKey = getRoleKey(session);
  if (roleKey === 'admin') return 'Admin';
  if (roleKey === 'operator') return 'Operator';
  if (roleKey === 'citizen') return 'Citizen';
  return roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
};

const getUsername = (session) => session.username || session.user?.username || '--';

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
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const statusFromUrl = STATUS_FILTERS.has(searchParams.get('status'))
    ? searchParams.get('status')
    : 'all';
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [query, setQuery] = useState('');
  const [highlightSessionId, setHighlightSessionId] = useState(null);

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
  const roleFilter = pageRole || 'all';
  const isOverview = !pageRole;

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/sessions');
      setSessions(res.data.data || []);
      setServerStats(res.data.stats || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load active sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const invalidate = async (sessionId) => {
    try {
      await api.put(`/api/sessions/${sessionId}/invalidate`);
      toast.success('Session marked inactive.');
      await loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to invalidate session.');
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const roleMatches = pageRole === 'all' || !pageRole || getRoleKey(session) === pageRole;
      const statusMatches = statusFilter === 'all' || session.status === statusFilter;
      return roleMatches && statusMatches && sessionMatchesQuery(session, query);
    });
  }, [pageRole, query, sessions, statusFilter]);

  const roleScopedSessions = useMemo(() => (
    sessions.filter((session) => {
      const roleMatches = pageRole === 'all' || !pageRole || getRoleKey(session) === pageRole;
      return roleMatches && sessionMatchesQuery(session, query);
    })
  ), [pageRole, query, sessions]);

  const detailStats = useMemo(() => {
    // Keep card totals stable while status filter changes the table below.
    const latest = [...roleScopedSessions].sort(
      (a, b) => new Date(b.lastActiveTime || 0) - new Date(a.lastActiveTime || 0)
    )[0];

    return {
      total: roleScopedSessions.length,
      active: roleScopedSessions.filter((session) => session.status === 'active').length,
      inactive: roleScopedSessions.filter((session) => session.status === 'inactive').length,
      latestActive: latest?.lastActiveTime,
      latestSessionId: latest?._id || latest?.id || null,
    };
  }, [roleScopedSessions]);

  const counts = useMemo(() => {
    const hasLocalFilter = Boolean(query.trim()) || statusFilter !== 'all';
    const activeSessions = sessions.filter((session) => String(session.status || '').toLowerCase() === 'active');

    // Prefer server stats when filters are clear; otherwise count active rows by role.
    if (!hasLocalFilter && serverStats?.byRole && (serverStats.byRole.all || 0) > 0) {
      return {
        all: serverStats.byRole.all,
        admin: serverStats.byRole.admin ?? 0,
        operator: serverStats.byRole.operator ?? 0,
        citizen: serverStats.byRole.citizen ?? 0,
        active: serverStats.activeSessions ?? activeSessions.length,
        inactive: serverStats.inactiveSessions ?? Math.max(0, sessions.length - activeSessions.length),
        totalRecords: serverStats.totalRecords ?? sessions.length,
      };
    }

    const scopedActive = activeSessions.filter((session) => sessionMatchesQuery(session, query));
    const uniqueByRole = { all: new Set(), admin: new Set(), operator: new Set(), citizen: new Set() };
    const fallbackByRole = { all: 0, admin: 0, operator: 0, citizen: 0 };

    scopedActive.forEach((session) => {
      const roleKey = getRoleKey(session);
      fallbackByRole.all += 1;
      if (fallbackByRole[roleKey] !== undefined) fallbackByRole[roleKey] += 1;

      const key = getSessionUserKey(session);
      if (!key || key === '[object Object]') return;
      uniqueByRole.all.add(key);
      if (uniqueByRole[roleKey]) uniqueByRole[roleKey].add(key);
    });

    const useUnique = uniqueByRole.all.size > 0;
    return {
      all: useUnique ? uniqueByRole.all.size : fallbackByRole.all,
      admin: useUnique ? uniqueByRole.admin.size : fallbackByRole.admin,
      operator: useUnique ? uniqueByRole.operator.size : fallbackByRole.operator,
      citizen: useUnique ? uniqueByRole.citizen.size : fallbackByRole.citizen,
      active: activeSessions.length,
      inactive: sessions.filter((session) => String(session.status || '').toLowerCase() !== 'active').length,
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
          {items.length} {items.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="nqs-active-table w-full min-w-[1120px] text-left text-[13px]">
          <thead className="nqs-active-thead text-xs uppercase">
            <tr>
              {['Username', 'Role', 'Login Time', 'Last Active', 'IP Address', 'Device / Browser', 'Status', 'Actions'].map((heading) => (
                <th key={heading} className="px-3 py-3 font-black tracking-wide">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="nqs-active-tbody divide-y">
            {loading ? (
              <tr><td colSpan="8" className="px-4 py-10 text-center font-semibold">Loading sessions...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="8" className="px-4 py-10 text-center font-semibold">No {group.title.toLowerCase()} found.</td></tr>
            ) : items.map((session) => {
              const sessionId = session._id || session.id;
              const isHighlighted = highlightSessionId && String(highlightSessionId) === String(sessionId);
              return (
              <tr
                key={sessionId}
                id={sessionId ? `session-row-${sessionId}` : undefined}
                className={`nqs-active-row ${isHighlighted ? 'bg-[#2563EB]/10 ring-2 ring-inset ring-[#2563EB]/40' : ''}`}
              >
                <td className="nqs-active-username px-3 py-3 font-mono font-bold">{getUsername(session)}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-black text-[#2563EB]">
                    {getRoleLabel(session)}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(session.loginTime)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(session.lastActiveTime)}</td>
                <td className="px-3 py-3 font-mono text-xs">{session.ipAddress || '--'}</td>
                <td className="max-w-[420px] px-3 py-3 text-xs leading-5">
                  <span className="line-clamp-2 break-words">{session.userAgent || 'Unknown device'}</span>
                </td>
                <td className="px-3 py-3">
                  <span className={`nqs-session-badge rounded-full px-3 py-1 text-xs font-black ${session.status === 'active' ? 'is-active' : 'is-inactive'}`}>
                    {session.status || 'inactive'}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <button
                    disabled={session.status !== 'active'}
                    onClick={() => invalidate(sessionId)}
                    className="nqs-invalidate-btn inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiXCircle /> Invalidate
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
                <FiRefreshCw /> Refresh
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
                  onClick={() => navigate(`/active-sessions/${tab.key}`)}
                  className="nqs-active-card group flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:ring-4 hover:ring-blue-500/15"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#2563EB]/10 text-xl text-[#2563EB]">
                    {tab.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-2xl font-black">{counts[tab.key]}</span>
                    <span className="block truncate text-sm font-bold text-[var(--text-muted)]">{tab.label}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-[var(--text-muted)]">
                      {tab.key === 'all' ? 'Online users now' : 'Online now'}
                    </span>
                  </span>
                  <span className="ml-auto text-xl text-[#2563EB]">-&gt;</span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate('/active-sessions/all')}
                className="nqs-active-card flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:ring-4 hover:ring-blue-500/15"
              >
                <FiMonitor className="text-2xl text-[#2563EB]" />
                <div>
                  <p className="text-sm font-bold text-[var(--text-muted)]">Total Records</p>
                  <p className="text-xl font-black">{counts.totalRecords ?? sessions.length} records</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/active-sessions/all?status=active')}
                className="nqs-active-card flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-500/15"
              >
                <FiActivity className="text-2xl text-emerald-500" />
                <div>
                  <p className="text-sm font-bold text-[var(--text-muted)]">Active Sessions</p>
                  <p className="text-xl font-black">{counts.active}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/active-sessions/all?status=inactive')}
                className="nqs-active-card flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-500 hover:ring-4 hover:ring-amber-500/15"
              >
                <FiClock className="text-2xl text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-[var(--text-muted)]">Inactive Sessions</p>
                  <p className="text-xl font-black">{counts.inactive}</p>
                </div>
              </button>
            </div>

          </>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                {
                  key: 'all',
                  label: 'Total',
                  value: detailStats.total,
                  icon: <FiMonitor className="text-2xl text-[#2563EB]" />,
                  onClick: () => applyStatusFilter('all'),
                },
                {
                  key: 'active',
                  label: 'Active',
                  value: detailStats.active,
                  icon: <FiActivity className="text-2xl text-emerald-500" />,
                  onClick: () => applyStatusFilter('active'),
                },
                {
                  key: 'inactive',
                  label: 'Inactive',
                  value: detailStats.inactive,
                  icon: <FiClock className="text-2xl text-amber-500" />,
                  onClick: () => applyStatusFilter('inactive'),
                },
                {
                  key: 'latest',
                  label: 'Last Activity',
                  value: formatDate(detailStats.latestActive),
                  valueClass: 'text-sm',
                  icon: <FiRefreshCw className="text-2xl text-[#2563EB]" />,
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
                    className={`nqs-active-card flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:ring-4 hover:ring-blue-500/15 ${
                      selected ? 'border-[#2563EB] ring-4 ring-blue-500/15' : ''
                    }`}
                  >
                    {card.icon}
                    <div>
                      <p className="text-sm font-bold text-[var(--text-muted)]">{card.label}</p>
                      <p className={`${card.valueClass || 'text-xl'} font-black`}>{card.value}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {renderSessionTable(tableSessions, visibleGroup)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActiveSessions;
