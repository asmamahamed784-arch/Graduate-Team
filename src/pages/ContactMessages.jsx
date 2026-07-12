import { useEffect, useMemo, useState } from 'react';
import {
  FiClock,
  FiInbox,
  FiMail,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiUser
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';

const statusClass = (status) => {
  const base = 'inline-flex rounded-full px-2.5 py-1 text-xs font-bold';
  if (status === 'Resolved') return `${base} bg-emerald-500/15 text-emerald-300`;
  if (status === 'In Review') return `${base} bg-amber-500/15 text-amber-300`;
  return `${base} bg-blue-500/15 text-blue-300`;
};

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function ContactMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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

  const filteredMessages = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((message) => (
      message.fullName?.toLowerCase().includes(term) ||
      message.email?.toLowerCase().includes(term) ||
      message.phone?.toLowerCase().includes(term) ||
      message.message?.toLowerCase().includes(term)
    ));
  }, [messages, query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Contact Messages</h1>
              <p className="mt-1 text-sm text-slate-300">
                Review messages submitted from the National ID contact form.
              </p>
              <p className="mt-2 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Read-only records • messages are retained for audit
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block sm:w-80">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search messages"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
                />
              </label>
              <button
                type="button"
                onClick={loadMessages}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#4189DD]/35 bg-[#4189DD]/10 px-4 py-2.5 text-sm font-bold text-[#7CB8FF] transition hover:bg-[#4189DD]/20"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 shadow-xl shadow-black/10 backdrop-blur">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-slate-400">
              Loading contact messages...
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center text-slate-400">
              <FiInbox className="mb-3 h-10 w-10 text-slate-600" />
              <p className="font-semibold text-slate-300">No contact messages found</p>
              <p className="mt-1 text-sm">New public contact form submissions will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredMessages.map((message) => (
                <article key={message._id} className="p-5 transition hover:bg-slate-800/45">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-bold text-white">{message.fullName}</h2>
                        <span className={statusClass(message.status)}>{message.status}</span>
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{message.message}</p>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:w-96 lg:grid-cols-1">
                      <p className="flex items-center gap-2">
                        <FiMail className="text-[#7CB8FF]" />
                        {message.email}
                      </p>
                      <p className="flex items-center gap-2">
                        <FiPhone className="text-[#7CB8FF]" />
                        {message.phone}
                      </p>
                      <p className="flex items-center gap-2">
                        <FiClock className="text-[#7CB8FF]" />
                        {formatDate(message.createdAt)}
                      </p>
                      <p className="flex items-center gap-2">
                        <FiUser className="text-[#7CB8FF]" />
                        Public contact form
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactMessages;
