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
    <section className="nqs-track-queue min-h-screen px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto max-w-[1420px] space-y-4">
        <div className="track-hero overflow-hidden rounded-[28px] border shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="track-hero-copy p-5 sm:p-6 lg:p-8">
              <span className="track-badge inline-flex rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em]">
                Queue Tracking
              </span>

              <h1 className="mt-5 max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[3.45rem]">
                Track Your Queue
              </h1>

              <p className="mt-4 max-w-xl text-base leading-7 sm:text-lg">
                Enter your ticket reference to check your National ID queue position, waiting time, and current status.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  ['Real-time Updates', 'Get live status instantly', FiRefreshCw, 'blue'],
                  ['Track Progress', 'See your position', FiTrendingUp, 'green'],
                  ['Status Alerts', 'Review current status', FiShield, 'blue'],
                ].map(([title, text, Icon, tone]) => (
                  <div key={title} className="track-feature flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${tone === 'green' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black leading-5">{title}</p>
                      <p className="mt-1 text-xs leading-5">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="track-hero-visual relative min-h-[300px] overflow-hidden lg:min-h-[380px]">
              <img
                src={serviceCenterImage}
                alt="Banaadir National ID service center"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <div className="track-image-overlay absolute inset-0" />

              <div className="relative z-10 flex h-full items-center px-4 py-6 sm:px-6 lg:px-8">
                <div className="track-search-card ml-auto w-full max-w-[610px] rounded-[24px] p-4 shadow-2xl sm:p-5">
                  <label htmlFor="ticket-reference" className="mb-3 block text-xs font-black uppercase tracking-[0.16em]">
                    Ticket Reference
                  </label>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px]">
                    <div className="track-input-wrap flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-4">
                      <FiHash className="h-8 w-8 shrink-0 text-blue-600" />
                      <input
                        id="ticket-reference"
                        type="text"
                        value={refInput}
                        onChange={(event) => setRefInput(event.target.value.toUpperCase())}
                        onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                        placeholder="Enter ticket reference (e.g. NQS-1023)"
                        className="min-w-0 flex-1 bg-transparent text-lg font-black outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSearch}
                      disabled={loading || !refInput.trim()}
                      className="track-submit inline-flex min-h-[62px] items-center justify-center gap-2 rounded-[20px] px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? <FiRefreshCw className="h-5 w-5 animate-spin" /> : <FiSearch className="h-5 w-5" />}
                      Check Status
                    </button>
                  </div>

                  <p className="mt-4 text-center text-sm leading-6">
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
          </div>
        </div>

        {queueData ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <section className="track-card rounded-[26px] border p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="track-icon flex h-10 w-10 items-center justify-center rounded-lg">
                    <FiTrendingUp className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-black">Your Queue Status</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="track-inner-card rounded-2xl border p-4">
                    <p className="text-xs font-black uppercase tracking-wide">Ticket Reference</p>
                    <p className="mt-3 font-mono text-2xl font-black text-blue-700">{queueData.reference}</p>
                    <p className="mt-2 text-sm">
                      Booking Date: {formatDate(queueData.appointmentDate)}
                      {queueData.timeSlot ? ` - ${queueData.timeSlot}` : ''}
                    </p>
                    <p className="mt-1 text-sm font-semibold">Service: {queueData.service || 'National ID Service'}</p>
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

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                  {[
                    ['Your Position', queueData.position > 0 ? queueData.position : '--', 'in queue', FiUserCheck],
                    ['Estimated Wait Time', queueData.estimatedWait, 'minutes', FiClock],
                    ['People Ahead', queueData.peopleAhead, 'people', FiUserCheck],
                    ['Service Center', queueData.center, queueData.counter || 'Center', FiMapPin],
                  ].map(([label, value, helper, Icon]) => {
                    const isLongValue = label === 'Service Center';
                    return (
                      <div key={label} className="track-inner-card track-stat-card rounded-2xl border p-4">
                        <div className="track-icon mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="track-stat-label text-xs font-black uppercase tracking-wide">{label}</p>
                        <p className={`track-stat-value mt-2 font-black ${isLongValue ? 'text-base leading-6' : 'text-xl'}`}>
                          {value || '--'}
                        </p>
                        <p className="track-stat-helper mt-1 text-sm">{helper}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-7">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wide">Queue Progress</p>
                    <button
                      type="button"
                      onClick={() => fetchQueueStatus(queueData.reference)}
                      className="track-light-button inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black"
                    >
                      <FiRefreshCw />
                      Refresh
                    </button>
                  </div>
                  <div className="track-progress-bar mb-5 h-3 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>

                  <div className="track-progress-list grid grid-cols-1 gap-3 md:grid-cols-5">
                    {progressSteps.map((step, index) => {
                      const isActive = index === activeStepIndex;
                      const isDone = index < activeStepIndex;
                      return (
                        <div
                          key={step.label}
                          className={`track-progress-step rounded-2xl border p-4 text-center ${
                            isDone ? 'is-done' : isActive ? 'is-active' : 'is-upcoming'
                          }`}
                        >
                          <div className="track-progress-dot mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2">
                            {isDone ? <FiCheckCircle className="h-5 w-5" /> : <span>{index + 1}</span>}
                          </div>
                          <p className="track-progress-title mt-3 text-sm font-black">{step.label}</p>
                          <p className="track-progress-detail mt-1 text-xs leading-5">{step.detail}</p>
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
              <section className="track-side-card rounded-[24px] border p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="track-icon flex h-10 w-10 items-center justify-center rounded-lg">
                    <FiShield className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black">Important Information</h2>
                </div>
                <ul className="space-y-3 text-sm leading-6">
                  <li>Please arrive at the center at least 10 minutes before your estimated time.</li>
                  <li>Have your original documents ready.</li>
                  <li>Your queue position may change if there are cancellations or new bookings.</li>
                  <li>This page updates automatically.</li>
                </ul>
              </section>

              <section className="track-side-card rounded-[24px] border p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="track-icon flex h-12 w-12 items-center justify-center rounded-xl">
                    <FiAlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black">Get Notified</h2>
                    <p className="mt-1 text-sm">Check this page regularly for queue updates.</p>
                  </div>
                </div>
              </section>

              <section className="track-side-card rounded-[24px] border p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="track-icon flex h-10 w-10 items-center justify-center rounded-lg">
                    <FiHelpCircle className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-black">Need Help?</h2>
                </div>
                <div className="space-y-3 text-sm">
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
                  className="track-light-button mt-5 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-black"
                >
                  Contact Support
                </Link>
              </section>
            </aside>
          </div>
        ) : (
          <div className="track-card rounded-[26px] border p-10 text-center shadow-sm">
            <div className="track-icon mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl">
              <FiShield className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black">Enter your ticket reference</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8">
              Your ticket reference is printed on your QR ticket after booking. Use it to check your current queue status.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default TrackQueue;
