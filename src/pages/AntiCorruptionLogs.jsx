import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiShield,
  FiDownload,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiAlertCircle,
  FiSearch,
  FiInfo
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';

const ROWS_PER_PAGE = 5;

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
};

const AntiCorruptionLogs = () => {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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

  const actionOptions = useMemo(() => {
    return ['All', ...Array.from(new Set(allLogs.map((log) => log.action).filter(Boolean)))];
  }, [allLogs]);

  const roleOptions = useMemo(() => {
    return ['All', ...Array.from(new Set(allLogs.map((log) => log.role).filter(Boolean)))];
  }, [allLogs]);

  const filtered = useMemo(() => {
    return allLogs.filter((log) => {
      if (actionFilter !== 'All' && log.action !== actionFilter) return false;
      if (roleFilter !== 'All' && log.role !== roleFilter) return false;

      const search = searchQuery.toLowerCase().trim();
      if (
        search &&
        !log.user?.toLowerCase().includes(search) &&
        !log.details?.toLowerCase().includes(search) &&
        !log.action?.toLowerCase().includes(search)
      ) {
        return false;
      }

      const logDate = log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 10) : '';
      if (dateFrom && logDate < dateFrom) return false;
      if (dateTo && logDate > dateTo) return false;
      return true;
    });
  }, [actionFilter, allLogs, dateFrom, dateTo, roleFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const handleExport = () => {
    const rows = [
      ['Timestamp', 'User', 'Role', 'Action', 'Details', 'IP Address'],
      ...filtered.map((log) => [
        formatDate(log.timestamp),
        log.user,
        log.role,
        log.action,
        log.details,
        log.ip
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

  return (
    <div className="min-h-screen pb-12">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
              <FiShield className="text-blue-700 dark:text-blue-400 text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Logs</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recent actions recorded by the system</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <FiDownload size={15} />
            Export CSV
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4 mb-6 flex items-start gap-3"
      >
        <FiInfo className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={18} />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          This page lists recent account, booking, and queue actions. Use it to review what changed and who made the change.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-6"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          <FiFilter size={15} />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
            >
              {actionOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">User Role</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
            >
              {roleOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="User, action, or details..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                {['Timestamp', 'User', 'Role', 'Action', 'Details', 'IP Address'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-500">
                    Loading activity logs...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <FiAlertCircle className="mx-auto mb-2" size={24} />
                    No logs match the current filters.
                  </td>
                </tr>
              ) : (
                paginated.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium whitespace-nowrap">
                      {log.user}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full font-medium">
                        {log.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs font-medium">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs leading-relaxed min-w-[250px]">
                      {log.details}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                      {log.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filtered.length ? Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filtered.length) : 0}-{Math.min(currentPage * ROWS_PER_PAGE, filtered.length)} of {filtered.length} logs
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FiChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-blue-700 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AntiCorruptionLogs;
