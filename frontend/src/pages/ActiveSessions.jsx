import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiXCircle } from 'react-icons/fi';
import api from '../api/axiosInstance';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/sessions');
      setSessions(res.data.data || []);
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

  const tabs = useMemo(() => ([
    { key: 'all', label: 'All Sessions', count: sessions.length },
    { key: 'active', label: 'Active', count: sessions.filter((s) => s.status === 'active').length },
    { key: 'inactive', label: 'Ended', count: sessions.filter((s) => s.status !== 'active').length },
  ]), [sessions]);

  const visibleSessions = useMemo(() => {
    if (activeTab === 'active') return sessions.filter((s) => s.status === 'active');
    if (activeTab === 'inactive') return sessions.filter((s) => s.status !== 'active');
    return sessions;
  }, [sessions, activeTab]);

  const columns = [
    {
      header: 'Username',
      accessor: 'username',
      sortValue: (row) => row.username || row.user?.username || '',
      render: (row) => (
        <span className="font-mono font-semibold text-blue-700 dark:text-[#7CB8FF]">
          {row.username || row.user?.username || '—'}
        </span>
      ),
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (row) => <span className="capitalize">{(row.role || '—').replace('_', ' ')}</span>,
    },
    {
      header: 'Login Time',
      accessor: 'loginTime',
      sortValue: (row) => new Date(row.loginTime || 0).getTime(),
      render: (row) => <span className="whitespace-nowrap">{formatDate(row.loginTime)}</span>,
    },
    {
      header: 'Last Active',
      accessor: 'lastActiveTime',
      sortValue: (row) => new Date(row.lastActiveTime || 0).getTime(),
      render: (row) => <span className="whitespace-nowrap">{formatDate(row.lastActiveTime)}</span>,
    },
    {
      header: 'IP Address',
      accessor: 'ipAddress',
      render: (row) => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.ipAddress || '—'}</span>,
    },
    {
      header: 'Device / Browser',
      accessor: 'userAgent',
      sortable: false,
      render: (row) => (
        <span className="block max-w-xs truncate text-xs text-slate-500 dark:text-slate-400" title={row.userAgent}>
          {row.userAgent || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
          row.status === 'active'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
        }`}>
          {row.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_actions',
      sortable: false,
      render: (row) => (
        <button
          disabled={row.status !== 'active'}
          onClick={(e) => { e.stopPropagation(); invalidate(row._id); }}
          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <FiXCircle /> Invalidate
        </button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Active Sessions</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            View current and recent logged-in users. Passwords are never shown.
          </p>
        </div>
        <button
          onClick={loadSessions}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <DataTable
        columns={columns}
        data={visibleSessions}
        loading={loading}
        searchPlaceholder="Search by user, role, or IP..."
        emptyTitle="No sessions found"
        emptyText="Login sessions will appear here as users sign in."
      />
    </div>
  );
};

export default ActiveSessions;
