import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiXCircle } from 'react-icons/fi';
import api from '../api/axiosInstance';

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black">Active Sessions</h1>
            <p className="mt-1 text-sm text-slate-400">View current and recent logged-in users. Passwords are never shown.</p>
          </div>
          <button onClick={loadSessions} className="inline-flex items-center gap-2 rounded-xl bg-[#4189DD] px-4 py-2 text-sm font-bold text-white">
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                <tr>
                  {['Username', 'Role', 'Login Time', 'Last Active', 'IP Address', 'Device / Browser', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-400">Loading sessions...</td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-400">No sessions found.</td></tr>
                ) : sessions.map((session) => (
                  <tr key={session._id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-[#7CB8FF]">{session.username || session.user?.username || '--'}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{session.role}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(session.loginTime)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(session.lastActiveTime)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{session.ipAddress}</td>
                    <td className="max-w-sm truncate px-4 py-3 text-xs text-slate-400">{session.userAgent}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${session.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={session.status !== 'active'}
                        onClick={() => invalidate(session._id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FiXCircle /> Invalidate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSessions;
