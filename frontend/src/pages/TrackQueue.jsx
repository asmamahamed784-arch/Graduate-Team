import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiFlag,
  FiInfo,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUserCheck,
  FiUsers,
  FiVolume2,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';

const RECENT_SEARCHES_KEY = 'nqs_recent_queue_searches';
const MAX_RECENT_SEARCHES = 5;

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusProgress = (status) => {
  if (status === 'Completed' || status === 'Cancelled') return 100;
  if (status === 'Being Served') return 78;
  if (status === 'On Hold') return 45;
  return 30;
};

const progressSteps = [
  { key: 'booked', label: 'Booked', icon: FiCheckCircle },
  { key: 'waiting', label: 'Waiting', icon: FiUsers },
  { key: 'serving', label: 'Now Serving', icon: FiVolume2 },
  { key: 'completed', label: 'Completed', icon: FiFlag },
];

const activeStepKey = (status) => {
  if (status === 'Completed') return 'completed';
  if (status === 'Being Served') return 'serving';
  return 'waiting';
};

const getRecentSearches = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveRecentSearch = (entry) => {
  try {
    const existing = getRecentSearches().filter((item) => item.reference !== entry.reference);
    const next = [entry, ...existing].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecentSearches();
  }
};

const TrackQueue = () => {
  const location = useLocation();
  const [refInput, setRefInput] = useState('');
  const [searchedRef, setSearchedRef] = useState('');
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches());

  const normalizeQueueData = useCallback((payload) => ({
    reference: payload.reference,
    service: payload.service,
    requestType: payload.requestType || 'new_national_id',
    requestStatus: payload.requestStatus || 'Pending',
    center: payload.center,
    appointmentDate: payload.appointmentDate,
    timeSlot: payload.timeSlot,
    status: payload.status,
    position: Number(payload.position || 0),
    peopleAhead: Number(payload.peopleAhead ?? Math.max(Number(payload.position || 0) - 1, 0)),
    estimatedWait: payload.estimatedWait || '0 min',
    counter: payload.counter || '--',
    nowServing: payload.nowServing || null,
  }), []);

  const fetchQueueStatus = useCallback(async (reference, silent = false) => {
    if (!reference.trim()) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const res = await api.get(`/api/queue/track/${reference.trim().toUpperCase()}`);
      if (res.data.success) {
        const data = normalizeQueueData(res.data.data);
        setQueueData(data);
        setSearchedRef(reference.trim().toUpperCase());
        setLastUpdated(new Date());
        setError('');
        if (!silent) {
          setRecentSearches(saveRecentSearch({
            reference: data.reference,
            center: data.center,
            service: data.service,
            appointmentDate: data.appointmentDate,
            timeSlot: data.timeSlot,
          }));
        }
      }
    } catch (err) {
      setQueueData(null);
      setError(
        err.response?.data?.message ||
          'Unable to check this request right now. Please confirm the reference number or try again later.'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [normalizeQueueData]);

  const handleSearch = () => {
    fetchQueueStatus(refInput);
  };

  const handleCopyReference = async () => {
    if (!queueData?.reference) return;
    try {
      await navigator.clipboard.writeText(queueData.reference);
      toast.success('Request reference copied.');
    } catch {
      toast.error('Could not copy the reference.');
    }
  };

  const clearRecentSearches = () => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore storage errors — clearing the in-memory list is still correct.
    }
    setRecentSearches([]);
  };

  useEffect(() => {
    const ticketRef = new URLSearchParams(location.search).get('ref');
    if (!ticketRef) return;
    const normalizedRef = ticketRef.trim().toUpperCase();
    setRefInput(normalizedRef);
    fetchQueueStatus(normalizedRef);
  }, [fetchQueueStatus, location.search]);

  useEffect(() => {
    if (!searchedRef || !queueData?.reference) return undefined;

    const socket = io(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || undefined);
    socket.on('connect', () => {
      socket.emit('joinTicket', queueData.reference);
    });
    socket.on('ticketUpdate', () => {
      fetchQueueStatus(queueData.reference, true);
    });

    const interval = window.setInterval(() => {
      fetchQueueStatus(queueData.reference, true);
    }, 15000);

    return () => {
      socket.disconnect();
      window.clearInterval(interval);
    };
  }, [fetchQueueStatus, searchedRef, queueData?.reference]);

  const progress = useMemo(() => statusProgress(queueData?.status), [queueData?.status]);
  const activeStep = activeStepKey(queueData?.status);
  const activeStepIndex = progressSteps.findIndex((step) => step.key === activeStep);

  return (
    <div className="nqs-track-queue-mobile mx-auto min-h-screen max-w-lg space-y-4 bg-[#F5F8FC] px-4 pb-10 pt-4">
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-black text-[#0B3A75]">
          <FiUsers className="text-blue-700" /> Track Queue
        </h1>
        <p className="mt-1 text-sm text-slate-600">Check your live queue status</p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <FiSearch className="shrink-0 text-slate-400" />
          <input
            id="ticket-reference"
            type="text"
            value={refInput}
            onChange={(event) => setRefInput(event.target.value.toUpperCase())}
            onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
            placeholder="Enter your request reference"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !refInput.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B2E59] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123A6B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiSearch className="h-4 w-4" />}
          Search
        </button>
        <p className="text-center text-xs text-slate-500">You can find your request reference on your QR Request.</p>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </section>

      {queueData && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-700">Current Queue</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-2xl font-black text-[#0B2E59]">{queueData.reference}</span>
                  <button type="button" onClick={handleCopyReference} className="text-slate-400 hover:text-slate-700" aria-label="Copy request reference">
                    <FiCopy className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{queueData.status}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{queueData.center || 'Center not assigned'}</span>
              <span>{queueData.service || 'National ID Service'}</span>
              {queueData.timeSlot && <span>Joined at {queueData.timeSlot}</span>}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {progressSteps.map((step, index) => {
                const isDone = index < activeStepIndex || (queueData.status === 'Completed' && index <= activeStepIndex);
                const isActive = index === activeStepIndex && queueData.status !== 'Completed';
                const Icon = step.icon;
                return (
                  <div key={step.key} className="text-center">
                    <div
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                        isDone
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isActive
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className={`mt-1.5 text-[11px] font-black ${isDone || isActive ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                    <p className="text-[10px] text-slate-400">{index === 0 ? (queueData.timeSlot || '--') : '--'}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black text-[#0B3A75]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                </span>
                Live Queue Status
              </h2>
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    Last updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fetchQueueStatus(queueData.reference)}
                  className="text-slate-400 hover:text-blue-700"
                  aria-label="Refresh queue status"
                >
                  <FiRefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <FiUserCheck className="mx-auto h-4 w-4 text-purple-500" />
                <p className="mt-1 text-sm font-black text-slate-900">{queueData.nowServing?.reference || '--'}</p>
                <p className="text-[11px] text-slate-500">Now Serving</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <FiUsers className="mx-auto h-4 w-4 text-purple-500" />
                <p className="mt-1 text-sm font-black text-slate-900">{queueData.peopleAhead}</p>
                <p className="text-[11px] text-slate-500">People Ahead</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <FiClock className="mx-auto h-4 w-4 text-emerald-600" />
                <p className="mt-1 text-sm font-black text-emerald-700">~{queueData.estimatedWait}</p>
                <p className="text-[11px] text-slate-500">Estimated Wait</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <FiUserCheck className="mx-auto h-4 w-4 text-amber-600" />
                <p className="mt-1 text-sm font-black text-amber-700">{queueData.counter}</p>
                <p className="text-[11px] text-slate-500">Current Counter</p>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-semibold text-[#0B2E59]">
              <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p>Queue status is updated in real-time. Please check the counter display at the center for your turn.</p>
            </div>
          </section>
        </>
      )}

      {!queueData && !loading && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <FiUsers className="mx-auto h-8 w-8 text-blue-200" />
          <h2 className="mt-3 text-base font-black text-[#0B3A75]">Enter your request reference</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
            Your request reference is printed on your QR Request after booking.
          </p>
        </section>
      )}

      {recentSearches.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#0B3A75]">Recent Searches</h2>
            <button type="button" onClick={clearRecentSearches} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800">
              <FiTrash2 className="h-3.5 w-3.5" /> Clear All
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {recentSearches.map((item) => (
              <li key={item.reference}>
                <button
                  type="button"
                  onClick={() => { setRefInput(item.reference); fetchQueueStatus(item.reference); }}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <FiClock className="shrink-0 text-slate-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{item.reference}</p>
                    <p className="truncate text-xs text-slate-500">
                      {item.center || 'Center'} &middot; {item.service || 'National ID Service'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{item.timeSlot || formatDate(item.appointmentDate)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        to="/contact"
        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm hover:border-blue-200"
      >
        Need help? Contact Support
      </Link>
    </div>
  );
};

export default TrackQueue;
