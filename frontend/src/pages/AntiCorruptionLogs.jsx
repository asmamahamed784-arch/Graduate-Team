import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiActivity,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiXCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';

const ROWS_PER_PAGE = 10;

const ROLE_TABS = [
  { key: 'all', label: 'All Accounts', detailTitle: 'All Accounts', icon: <FiActivity /> },
  { key: 'admin', label: 'Admins', detailTitle: 'Admin Accounts', icon: <FiShield /> },
  { key: 'operator', label: 'Operators', detailTitle: 'Operator Accounts', icon: <FiUserCheck /> },
  { key: 'citizen', label: 'Citizens', detailTitle: 'Citizen Accounts', icon: <FiUsers /> }
];

const VALID_LOG_PAGES = new Set(ROLE_TABS.map((tab) => tab.key));

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getRoleKey = (role = '') => {
  const value = String(role || '').toLowerCase();
  if (value === 'admin' || value === 'super_admin' || value === 'user_manager') return 'admin';
  if (value.includes('operator') || value.includes('center')) return 'operator';
  if (value === 'citizen' || value === 'user') return 'citizen';
  return 'other';
};

const roleLabel = (role = '') => {
  const value = String(role || 'system').replace(/_/g, ' ');
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const compactPages = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
};

const mapAccount = (user = {}) => ({
  id: user._id || user.id,
  name: user.name || '--',
  username: user.username || '--',
  phone: user.phone || '--',
  email: user.email || '--',
  nationalId: user.nationalId || '--',
  role: user.role || '',
  roleKey: getRoleKey(user.role),
  status: user.status || 'active',
  center: typeof user.center === 'object' ? (user.center?.name || '--') : (user.center || '--'),
  district: user.district || '--',
  createdAt: user.createdAt,
  lastActiveAt: user.lastActiveAt
});

const AntiCorruptionLogs = () => {
  const navigate = useNavigate();
  const { role } = useParams();
  const normalizedRole = String(role || '').toLowerCase();
  const pageRole = VALID_LOG_PAGES.has(normalizedRole) ? normalizedRole : null;
  const roleFilter = pageRole || 'all';
  const isOverview = !pageRole;

  const [accounts, setAccounts] = useState([]);
  const [accountStats, setAccountStats] = useState({ all: 0, admin: 0, operator: 0, citizen: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const [citizensRes, adminsRes, operatorsRes, auditsRes] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/users', { params: { role: 'system' } }),
        api.get('/api/operators'),
        api.get('/api/audits', { params: { limit: 1 } }).catch(() => null)
      ]);

      const citizens = (citizensRes.data?.data || []).map(mapAccount);
      const admins = (adminsRes.data?.data || [])
        .map(mapAccount)
        .filter((user) => user.roleKey === 'admin');
      const operators = (operatorsRes.data?.data || []).map(mapAccount);

      const merged = [...admins, ...operators, ...citizens];
      const unique = [];
      const seen = new Set();
      merged.forEach((user) => {
        const key = String(user.id || user.username);
        if (!key || seen.has(key)) return;
        seen.add(key);
        unique.push(user);
      });

      setAccounts(unique);

      if (auditsRes?.data?.accountStats) {
        setAccountStats({
          all: auditsRes.data.accountStats.all ?? unique.length,
          admin: auditsRes.data.accountStats.admin ?? admins.length,
          operator: auditsRes.data.accountStats.operator ?? operators.length,
          citizen: auditsRes.data.accountStats.citizen ?? citizens.length
        });
      } else {
        setAccountStats({
          all: unique.length,
          admin: unique.filter((user) => user.roleKey === 'admin').length,
          operator: unique.filter((user) => user.roleKey === 'operator').length,
          citizen: unique.filter((user) => user.roleKey === 'citizen').length
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setStatusFilter('all');
    setSearchQuery('');
  }, [pageRole]);

  const roleCounts = accountStats;
  const detailMeta = ROLE_TABS.find((tab) => tab.key === roleFilter) || ROLE_TABS[0];

  const filtered = useMemo(() => {
    return accounts.filter((user) => {
      if (pageRole && pageRole !== 'all' && user.roleKey !== pageRole) return false;
      if (statusFilter !== 'all' && String(user.status || '').toLowerCase() !== statusFilter) return false;

      const search = searchQuery.toLowerCase().trim();
      if (search) {
        const haystack = [
          user.name,
          user.username,
          user.phone,
          user.email,
          user.nationalId,
          user.role,
          user.center,
          user.district,
          user.status
        ].join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [accounts, pageRole, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  const visiblePages = compactPages(currentPage, totalPages);

  const setFilter = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleExport = () => {
    const rows = [
      ['Name', 'Username', 'Role', 'Phone', 'National ID', 'Status', 'Center', 'District', 'Created', 'Last Active'],
      ...filtered.map((user) => [
        user.name,
        user.username,
        roleLabel(user.role),
        user.phone,
        user.nationalId,
        user.status,
        user.center,
        user.district,
        formatDate(user.createdAt),
        formatDate(user.lastActiveAt)
      ])
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `nqs-accounts-${roleFilter}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Accounts exported.');
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] px-4 py-5 text-[var(--text-main)]">
      <div className="mx-auto max-w-[1540px] space-y-5">
        <section className="rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-900/25">
                {isOverview ? <FiShield /> : detailMeta.icon}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-500">System Audit</p>
                <h1 className="mt-1 text-3xl font-black">
                  {isOverview ? 'Activity Logs' : detailMeta.detailTitle}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
                  {isOverview
                    ? 'Account counts from your system. Click a role to open its account list.'
                    : `${filtered.length} ${detailMeta.label.toLowerCase()} shown.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isOverview && (
                <button
                  type="button"
                  onClick={() => navigate('/logs')}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-black text-[var(--text-main)]"
                >
                  Back to overview
                </button>
              )}
              <button
                type="button"
                onClick={loadAccounts}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-black text-[var(--text-main)]"
              >
                <FiRefreshCw /> Refresh
              </button>
              {!isOverview && (
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20"
                >
                  <FiDownload /> Export CSV
                </button>
              )}
            </div>
          </div>
        </section>

        {isOverview ? (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(`/logs/${tab.key}`)}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500 hover:ring-4 hover:ring-blue-500/15"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600/10 text-xl text-blue-500">
                  {tab.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-black">{roleCounts[tab.key] ?? 0}</span>
                  <span className="block truncate text-sm font-bold text-[var(--text-muted)]">{tab.label}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-[var(--text-muted)]">
                    Accounts in system
                  </span>
                </span>
                <span className="ml-auto text-xl text-blue-500">-&gt;</span>
              </button>
            ))}
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Open page
                </span>
                {ROLE_TABS.map((tab) => {
                  const active = roleFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => navigate(`/logs/${tab.key}`)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                          : 'border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] hover:border-blue-500 hover:text-blue-500'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-4">
              {ROLE_TABS.map((tab) => {
                const selected = roleFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => navigate(`/logs/${tab.key}`)}
                    className={`flex items-center gap-3 rounded-2xl border bg-[var(--bg-card)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-500 hover:ring-4 hover:ring-blue-500/15 ${
                      selected ? 'border-blue-500 ring-4 ring-blue-500/15' : 'border-[var(--border-light)]'
                    }`}
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600/10 text-xl text-blue-500">
                      {tab.icon}
                    </span>
                    <div>
                      <p className="text-3xl font-black">{roleCounts[tab.key] ?? 0}</p>
                      <p className="text-sm font-bold text-[var(--text-muted)]">{tab.label}</p>
                    </div>
                  </button>
                );
              })}
            </section>

            <section className="rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black">
                  <FiFilter className="text-blue-400" />
                  Filters
                </div>
                <button type="button" onClick={resetFilters} className="text-sm font-black text-blue-400">
                  Clear filters
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setFilter(setStatusFilter)(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] px-3 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="locked">Locked</option>
                    <option value="pending_approval">Pending approval</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Search</span>
                  <div className="relative">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setFilter(setSearchQuery)(event.target.value)}
                      placeholder="Name, username, phone, national ID..."
                      className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] py-3 pl-10 pr-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-[var(--bg-elevated)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      {['Name', 'Username', 'Role', 'Phone', 'National ID', 'Status', 'Center / District', 'Created'].map((heading) => (
                        <th key={heading} className="px-5 py-4 font-black">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {loading ? (
                      <tr><td colSpan={8} className="px-5 py-16 text-center font-bold text-[var(--text-muted)]">Loading accounts...</td></tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center">
                          <FiXCircle className="mx-auto mb-3 text-3xl text-[var(--text-muted)]" />
                          <p className="font-black">No accounts found</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">Try another filter or refresh the page.</p>
                        </td>
                      </tr>
                    ) : (
                      paginated.map((user) => (
                        <tr key={user.id} className="transition hover:bg-blue-500/5">
                          <td className="px-5 py-4 font-black">{user.name}</td>
                          <td className="px-5 py-4 font-mono text-xs font-bold">{user.username}</td>
                          <td className="px-5 py-4">
                            <span className="rounded-full border border-[var(--border-light)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-black">
                              {roleLabel(user.role)}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs">{user.phone}</td>
                          <td className="px-5 py-4 font-mono text-xs">{user.nationalId}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${
                              String(user.status).toLowerCase() === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}
                            >
                              {user.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--text-muted)]">
                            <p className="font-bold text-[var(--text-main)]">{user.center}</p>
                            <p className="text-xs">{user.district}</p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-[var(--text-muted)]">
                            {formatDate(user.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--border-light)] bg-[var(--bg-elevated)] px-5 py-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm font-bold text-[var(--text-muted)]">
                  Showing {filtered.length ? Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filtered.length) : 0}-{Math.min(currentPage * ROWS_PER_PAGE, filtered.length)} of {filtered.length} accounts
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] disabled:opacity-40"
                  >
                    <FiChevronLeft />
                  </button>
                  {visiblePages.map((page, index) => (
                    <React.Fragment key={page}>
                      {index > 0 && page - visiblePages[index - 1] > 1 && (
                        <span className="px-2 text-sm font-black text-[var(--text-muted)]">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`h-9 min-w-9 rounded-lg px-3 text-sm font-black ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)]'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] disabled:opacity-40"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default AntiCorruptionLogs;
