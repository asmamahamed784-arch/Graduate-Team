import React, { useEffect, useMemo, useState } from 'react';
import { FiShield, FiDownload, FiInfo } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';
import DataTable from '../components/ui/DataTable';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
};

const filterField = 'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200';

const AntiCorruptionLogs = () => {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/audits', { params: { limit: 500 } });
        if (res.data.success) {
          setAllLogs((res.data.data || []).map((log) => ({
            id: log._id || log.id,
            timestamp: log.timestamp,
            user: typeof log.user === 'object' ? (log.user?.name || log.user?.email || log.user?._id) : log.user,
            role: log.role,
            action: log.action,
            details: log.details,
            ip: log.ipAddress
          })));
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Unable to load audit logs.');
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  const actionOptions = useMemo(() => (
    ['All', ...Array.from(new Set(allLogs.map((log) => log.action).filter(Boolean)))]
  ), [allLogs]);

  const roleOptions = useMemo(() => (
    ['All', ...Array.from(new Set(allLogs.map((log) => log.role).filter(Boolean)))]
  ), [allLogs]);

  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (actionFilter !== 'All' && log.action !== actionFilter) return false;
      if (roleFilter !== 'All' && log.role !== roleFilter) return false;
      const logDate = log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 10) : '';
      if (dateFrom && logDate < dateFrom) return false;
      if (dateTo && logDate > dateTo) return false;
      return true;
    });
  }, [actionFilter, allLogs, dateFrom, dateTo, roleFilter]);

  const handleExport = () => {
    const rows = [
      ['Timestamp', 'User', 'Role', 'Action', 'Details', 'IP Address'],
      ...filtered.map((log) => [
        formatDate(log.timestamp), log.user, log.role, log.action, log.details, log.ip
      ])
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nqs-audit-logs.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Activity logs exported.');
  };

  const columns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      sortValue: (row) => new Date(row.timestamp || 0).getTime(),
      render: (row) => <span className="whitespace-nowrap font-mono text-xs">{formatDate(row.timestamp)}</span>,
    },
    {
      header: 'User',
      accessor: 'user',
      render: (row) => <span className="whitespace-nowrap font-medium">{row.user || '—'}</span>,
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (row) => (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {row.role || '—'}
        </span>
      ),
    },
    { header: 'Action', accessor: 'action' },
    {
      header: 'Details',
      accessor: 'details',
      render: (row) => <span className="block min-w-[250px] whitespace-normal text-xs leading-relaxed text-slate-600 dark:text-slate-400">{row.details}</span>,
    },
    {
      header: 'IP Address',
      accessor: 'ip',
      render: (row) => <span className="whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400">{row.ip || '—'}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 pb-12 sm:p-4">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2.5 dark:bg-blue-900/40">
            <FiShield className="text-xl text-blue-700 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Logs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Recent actions recorded by the system</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800"
        >
          <FiDownload size={15} />
          Export CSV
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-900/20">
        <FiInfo className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" size={18} />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          This page lists recent account, booking, and queue actions. Use it to review what changed and who made the change.
        </p>
      </div>

      {/* Domain filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterField} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterField} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Action Type</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={filterField}>
              {actionOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">User Role</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterField}>
              {roleOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchPlaceholder="Search user, action, or details..."
        emptyTitle="No logs match the current filters"
        emptyText="Adjust the filters above or wait for new activity to be recorded."
      />
    </div>
  );
};

export default AntiCorruptionLogs;
