import { useEffect, useMemo, useState } from 'react';
import { FiMail, FiPhone, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';

const statusBadge = (status) => {
  const base = 'inline-flex rounded-full px-2.5 py-1 text-xs font-bold';
  if (status === 'Resolved') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  if (status === 'In Review') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const STATUS_TABS = ['All', 'New', 'In Review', 'Resolved'];

function ContactMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/contact');
      setMessages(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load contact messages.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const tabs = useMemo(() => STATUS_TABS.map((status) => ({
    key: status,
    label: status,
    count: status === 'All' ? messages.length : messages.filter((m) => m.status === status).length,
  })), [messages]);

  const visibleMessages = useMemo(() => (
    activeTab === 'All' ? messages : messages.filter((m) => m.status === activeTab)
  ), [messages, activeTab]);

  const columns = [
    {
      header: 'Sender',
      accessor: 'fullName',
      render: (row) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{row.fullName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <FiMail className="h-3 w-3" /> {row.email}
          </p>
        </div>
      ),
    },
    {
      header: 'Phone',
      accessor: 'phone',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
          <FiPhone className="h-3.5 w-3.5 text-slate-400" /> {row.phone || '—'}
        </span>
      ),
    },
    {
      header: 'Message',
      accessor: 'message',
      render: (row) => (
        <p className="max-w-md whitespace-normal text-sm leading-6 text-slate-700 dark:text-slate-300">{row.message}</p>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <span className={statusBadge(row.status)}>{row.status}</span>,
    },
    {
      header: 'Received',
      accessor: 'createdAt',
      sortValue: (row) => new Date(row.createdAt || 0).getTime(),
      render: (row) => <span className="whitespace-nowrap text-slate-600 dark:text-slate-400">{formatDate(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Contact Messages</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Messages submitted from the public contact form. Records are read-only and retained for audit.
          </p>
        </div>
        <button
          type="button"
          onClick={loadMessages}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#1d355f] dark:bg-[#071a33] dark:text-slate-200 dark:hover:bg-white/5"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <DataTable
        columns={columns}
        data={visibleMessages}
        loading={loading}
        searchPlaceholder="Search by name, email, phone, or message..."
        emptyTitle="No contact messages"
        emptyText="New public contact form submissions will appear here."
      />
    </div>
  );
}

export default ContactMessages;
