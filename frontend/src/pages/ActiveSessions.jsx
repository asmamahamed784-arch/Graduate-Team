import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiXCircle } from 'react-icons/fi';
import api from '../api/axiosInstance';

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
    <div className="nqs-active-sessions min-h-screen p-3 sm:p-5">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="nqs-active-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black sm:text-2xl">Active Sessions</h1>
            <p className="mt-1 text-sm">View current and recent logged-in users. Passwords are never shown.</p>
          </div>
          <button onClick={loadSessions} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white">
            <FiRefreshCw /> Refresh
          </button>
        </div>

        <div className="nqs-active-card overflow-hidden rounded-2xl border shadow-sm">
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
                ) : sessions.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center font-semibold">No sessions found.</td></tr>
                ) : sessions.map((session) => (
                  <tr key={session._id} className="nqs-active-row">
                    <td className="nqs-active-username px-3 py-3 font-mono font-bold">{session.username || session.user?.username || '--'}</td>
                    <td className="px-3 py-3 capitalize">{session.role}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(session.loginTime)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(session.lastActiveTime)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{session.ipAddress}</td>
                    <td className="max-w-[420px] px-3 py-3 text-xs leading-5">
                      <span className="line-clamp-2 break-words">{session.userAgent}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`nqs-session-badge rounded-full px-3 py-1 text-xs font-black ${session.status === 'active' ? 'is-active' : 'is-inactive'}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        disabled={session.status !== 'active'}
                        onClick={() => invalidate(session._id)}
                        className="nqs-invalidate-btn inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
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
