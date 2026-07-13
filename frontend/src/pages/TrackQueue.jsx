import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiHash,
  FiHelpCircle,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrendingUp,
  FiUserCheck,
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import serviceCenterImage from '../assets/images/service center.png';

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const statusProgress = (status) => {
  if (status === 'Completed') return 100;
  if (status === 'Being Served') return 78;
  if (status === 'On Hold') return 45;
  if (status === 'Cancelled') return 100;
  return 35;
};

const statusClass = (status) => {
  if (status === 'Completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Being Served') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'On Hold') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Cancelled') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const TrackQueue = () => {
  const location = useLocation();
  const [refInput, setRefInput] = useState('');
  const [searchedRef, setSearchedRef] = useState('');
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState('');

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
        setQueueData(normalizeQueueData(res.data.data));
        setSearchedRef(reference.trim().toUpperCase());
        setLastUpdated(new Date());
        setError('');
      }
    } catch (err) {
      setQueueData(null);
      setError(
        err.response?.data?.message ||
          'Unable to check this ticket right now. Please confirm the reference number or try again later.'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [normalizeQueueData]);

  const handleSearch = () => {
    fetchQueueStatus(refInput);
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

  const activeStepIndex = queueData?.status === 'Completed'
    ? 4
    : queueData?.status === 'Being Served'
      ? 3
      : queueData
        ? 2
        : 0;

  const progressSteps = [
    { label: 'Booked', detail: queueData?.appointmentDate ? formatDate(queueData.appointmentDate) : 'After booking' },
    { label: 'Confirmed', detail: queueData?.requestStatus || 'Pending' },
    { label: 'In Queue', detail: queueData?.position > 0 ? `Position ${queueData.position}` : 'Waiting' },
    { label: 'Being Served', detail: 'Position 1' },
    { label: 'Completed', detail: 'Service done' },
  ];

  return (
    <section className="min-h-screen bg-white px-4 py-8 pt-28 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.07)] dark:border-blue-900/60 dark:bg-[#071b34] sm:p-8 lg:min-h-[360px]">
          <div className="absolute inset-y-0 right-0 hidden w-[48%] lg:block">
            <div className="relative h-full w-full overflow-hidden rounded-r-[28px]">
              <img
                src={serviceCenterImage}
                alt="Banaadir National ID service center"
                className="h-full w-full object-cover object-center opacity-45 dark:opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-white/10 dark:from-[#071b34] dark:via-[#071b34]/70 dark:to-[#071b34]/10" />
            </div>
          </div>
          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div>
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-5 py-2 text-sm font-black uppercase tracking-[0.16em] text-blue-700">
                Queue Tracking
              </span>
              <h1 className="mt-7 text-4xl font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                Track Your Queue
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-200 sm:text-xl">
                Enter your ticket reference to check your National ID queue position, waiting time, and current status.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
                {[
                  ['Real-time Updates', 'Get live status instantly', FiRefreshCw, 'blue'],
                  ['Track Progress', 'See your position', FiTrendingUp, 'green'],
                  ['Status Alerts', 'Review current status', FiShield, 'blue'],
                ].map(([title, text, Icon, tone]) => {
                  const isSelected = selectedFeature === title;
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => {
                        setSelectedFeature(title);
                        handleSearch();
                      }}
                      disabled={loading || !refInput.trim()}
                      className={`group flex items-center gap-4 rounded-2xl text-left transition focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed ${
                        isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-950 dark:text-white'
                      } ${loading || !refInput.trim() ? 'opacity-80' : 'hover:text-blue-700 dark:hover:text-blue-300'}`}
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tone === 'green' ? 'bg-emerald-600' : 'bg-blue-600'} text-white shadow-sm transition group-hover:shadow-md`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-base font-black leading-5">{title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-300">{text}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] bg-white/70 p-1 backdrop-blur-sm dark:bg-[#071b34]/50 lg:bg-transparent lg:p-0">
              <label htmlFor="ticket-reference" className="mb-3 block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-200">
                Ticket Reference
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100 dark:border-blue-900/60 dark:bg-[#08213d] dark:focus-within:ring-blue-900/40">
                  <FiHash className="h-8 w-8 shrink-0 text-blue-600" />
                  <input
                    id="ticket-reference"
                    type="text"
                    value={refInput}
                    onChange={(event) => setRefInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                    placeholder="Enter your ticket reference (e.g. NQS-1023)"
                    className="w-full bg-transparent text-lg font-bold text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={loading || !refInput.trim()}
                  className="inline-flex items-center justify-center gap-3 rounded-[22px] bg-blue-600 px-8 py-5 text-base font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {loading ? <FiRefreshCw className="h-5 w-5 animate-spin" /> : <FiSearch className="h-5 w-5" />}
                  Check Status
                </button>
              </div>
              <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-300">
                You can find your ticket reference on your QR ticket after booking.
              </p>
              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {queueData ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_390px]">
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <FiTrendingUp className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-black text-slate-950">Your Queue Status</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ticket Reference</p>
                    <p className="mt-3 font-mono text-2xl font-black text-blue-700">{queueData.reference}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Booking Date: {formatDate(queueData.appointmentDate)}
                      {queueData.timeSlot ? ` • ${queueData.timeSlot}` : ''}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Service: {queueData.service || 'National ID Service'}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${statusClass(queueData.status)}`}>
                    <p className="text-xs font-black uppercase tracking-wide">Status</p>
                    <div className="mt-3 flex items-center gap-3">
                      <FiCheckCircle className="h-6 w-6" />
                      <div>
                        <p className="text-xl font-black">{queueData.status}</p>
                        <p className="text-sm opacity-80">You will be served soon</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Your Position', queueData.position > 0 ? queueData.position : '--', 'in queue', FiUserCheck],
                    ['Estimated Wait Time', queueData.estimatedWait, 'minutes', FiClock],
                    ['People Ahead', queueData.peopleAhead, 'people', FiUserCheck],
                    ['Service Center', queueData.center, queueData.counter || 'Center', FiMapPin],
                  ].map(([label, value, helper, Icon]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-black text-blue-700">{value || '--'}</p>
                      <p className="text-sm text-slate-600">{helper}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-7">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Queue Progress</p>
                    <button
                      type="button"
                      onClick={() => fetchQueueStatus(queueData.reference)}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                    >
                      <FiRefreshCw />
                      Refresh
                    </button>
                  </div>
                  <div className="relative grid grid-cols-1 gap-4 md:grid-cols-5">
                    <div className="absolute left-8 right-8 top-5 hidden h-0.5 bg-slate-200 md:block" />
                    <div
                      className="absolute left-8 top-5 hidden h-0.5 bg-emerald-500 md:block"
                      style={{ width: `calc(${Math.min(progress, 100)}% - 4rem)` }}
                    />
                    {progressSteps.map((step, index) => {
                      const isActive = index === activeStepIndex;
                      const isDone = index < activeStepIndex;
                      return (
                        <div key={step.label} className="relative text-center">
                          <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                            isDone ? 'border-emerald-500 bg-emerald-500 text-white' : isActive ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-400'
                          }`}>
                            <FiCheckCircle className="h-5 w-5" />
                          </div>
                          <p className={`mt-3 text-sm font-black ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{step.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{step.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {lastUpdated && (
                  <p className="mt-6 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                    Last updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                )}
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-700">
                    <FiShield className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black text-slate-950">Important Information</h2>
                </div>
                <ul className="space-y-3 text-sm leading-6 text-slate-700">
                  <li>Please arrive at the center at least 10 minutes before your estimated time.</li>
                  <li>Have your original documents ready.</li>
                  <li>Your queue position may change if there are cancellations or new bookings.</li>
                  <li>This page updates automatically.</li>
                </ul>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <FiAlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Get Notified</h2>
                    <p className="mt-1 text-sm text-slate-600">Check this page regularly for queue updates.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <FiHelpCircle className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black text-slate-950">Need Help?</h2>
                </div>
                <div className="space-y-3 text-sm text-slate-700">
                  <p className="flex items-center gap-2">
                    <FiPhone className="h-4 w-4 text-blue-700" />
                    +252 61 000 1000
                  </p>
                  <p className="flex items-center gap-2">
                    <FiMail className="h-4 w-4 text-blue-700" />
                    info@nqs.gov.so
                  </p>
                </div>
                <Link
                  to="/contact"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100"
                >
                  Contact Support
                </Link>
              </section>
            </aside>
          </div>
        ) : (
          <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
              <FiShield className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-950">Enter your ticket reference</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Your ticket reference is printed on your QR ticket after booking. Use it to check your current queue status.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default TrackQueue;
