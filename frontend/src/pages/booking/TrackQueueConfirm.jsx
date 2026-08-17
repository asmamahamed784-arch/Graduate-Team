import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiMapPin, FiRefreshCw, FiUsers } from 'react-icons/fi';
import api from '../../api/axiosInstance';

const asName = (value, fallback = 'National ID Service') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || fallback;
};

/** Real-time queue confirmation screen shown right after booking. Uses the
 *  same /api/queue/track endpoint as the citizen Track Queue page — this is
 *  a differently-styled entry point into the same live data, not a mock. */
const TrackQueueConfirm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ref: refParam } = useParams();
  const ticketRef = refParam || location.state?.ticket?.ref;
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!ticketRef) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/api/queue/track/${ticketRef.trim().toUpperCase()}`);
      if (res.data.success) {
        setQueueData(res.data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      if (!silent) toast.error(error.response?.data?.message || 'Unable to load your queue status.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ticketRef]);

  useEffect(() => {
    if (!ticketRef) {
      navigate('/dashboard/user/my-appointments', { replace: true });
      return undefined;
    }
    fetchStatus();
    const interval = window.setInterval(() => fetchStatus(true), 15000);
    return () => window.clearInterval(interval);
  }, [fetchStatus, navigate, ticketRef]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  if (!queueData) return null;

  const isWaiting = queueData.status === 'Waiting';

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-10 pt-4 text-slate-900">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label="Go back"
        >
          <FiChevronLeft />
        </button>

        <h1 className="text-2xl font-black text-[#0B3A75]">Track Your Queue</h1>

        <div className="mt-5 rounded-2xl bg-[#0B2E59] p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-blue-200">Your Request</p>
          <p className="mt-1 font-mono text-2xl font-black">{queueData.reference}</p>
          <p className="mt-1 text-sm text-blue-100">{asName(queueData.service)}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Current Status</p>
          <p className="mt-1 text-base font-black text-slate-900">
            {isWaiting ? 'You are in the queue' : queueData.status}
          </p>

          {isWaiting && (
            <>
              <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl font-black text-blue-700">
                <FiUsers className="mr-1" size={18} />{queueData.peopleAhead ?? 0}
              </div>
              <p className="mt-2 text-xs font-bold text-slate-500">People ahead of you</p>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Estimated Waiting Time</p>
                <p className="mt-1 text-lg font-black text-emerald-600">{queueData.estimatedWait}</p>
              </div>
            </>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <FiMapPin className="text-blue-600" /> {asName(queueData.center, 'Center')}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
          <button type="button" onClick={() => fetchStatus()} className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
            <FiRefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackQueueConfirm;
