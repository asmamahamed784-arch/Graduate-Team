import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import {
  FaArrowRight,
  FaBuilding,
  FaCheck,
  FaCheckDouble,
  FaClock,
  FaEye,
  FaPhoneAlt,
  FaSyncAlt,
  FaTicketAlt,
  FaTimes,
  FaUsers,
} from 'react-icons/fa';
import api from '../api/axiosInstance';
import { useAuth, useOtpGate } from '../hooks';
import { canCancelAppointment, canCompleteAppointment, canReacceptAppointment } from '../utils/appointmentActions';
import LostIdCancelDetails from '../components/LostIdCancelDetails';
import OtpGateModal from '../components/OtpGateModal';
import {
  getIncorrectFieldOptionsForTicket,
  isLostReplacementRequest,
} from '../utils/cancellationFields';
import { getChangedUpdateFields } from '../utils/updateRequestFields';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ACTIVE_STATUSES = ['Waiting', 'Being Served', 'On Hold'];

const QUEUE_FILTER_LABELS = {
  all: 'Requests in Queue',
  waiting: 'Waiting Requests',
  completed: 'Completed Services',
  serving: 'Now Serving',
};

const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

const statusBadge = (status) => {
  const base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold';
  if (status === 'Being Served') return `${base} bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400`;
  if (status === 'Waiting') return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400`;
  if (status === 'On Hold') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400`;
  if (status === 'Completed') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400`;
  if (status === 'Cancelled') return `${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400`;
  return `${base} bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300`;
};

const nameFrom = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || value.title || fallback;
};

const idFrom = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id || value.id;
};

const getCitizenName = (ticket) => (
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizen?.name ||
  ticket.citizenName ||
  'No Data'
);

const getCitizenPhone = (ticket) => (
  ticket.registrationDetails?.phone ||
  ticket.replacementDetails?.phone ||
  ticket.updateDetails?.phone ||
  ticket.citizen?.phone ||
  'No Data'
);

const getQueueNumber = (ticket) => {
  if (!ticket) return 0;
  if (ticket.queueNumber) return Number.parseInt(String(ticket.queueNumber).replace(/\D/g, ''), 10) || 0;
  const suffix = ticket.ref?.split('-').pop();
  return Number.parseInt(suffix, 10) || 0;
};

const timeToMinutes = (value) => {
  if (!value) return 24 * 60;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 24 * 60;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const waitToMinutes = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const sortTickets = (tickets) => [...tickets].sort((a, b) => {
  const dateA = a.date || '9999-12-31';
  const dateB = b.date || '9999-12-31';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const timeDiff = timeToMinutes(a.timeSlot) - timeToMinutes(b.timeSlot);
  if (timeDiff !== 0) return timeDiff;

  return getQueueNumber(a) - getQueueNumber(b);
});

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: ticket._id || ticket.id,
  serviceName: nameFrom(ticket.service, ticket.serviceName || 'National ID Service'),
  centerName: nameFrom(ticket.center, ticket.centerName || 'Assigned Center'),
  centerId: idFrom(ticket.center) || ticket.centerId,
  citizenDisplayName: getCitizenName(ticket),
  citizenPhone: getCitizenPhone(ticket),
  waitMinutes: waitToMinutes(ticket.waitTime),
});

const isPastAppointmentDate = (ticket) => {
  const rawDate = ticket?.date || ticket?.appointmentDate;
  if (!rawDate || String(rawDate).toLowerCase() === 'review request') return false;

  const appointmentDate = new Date(rawDate);
  if (Number.isNaN(appointmentDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  appointmentDate.setHours(0, 0, 0, 0);

  return appointmentDate < today;
};

const QueueManagement = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const {
    otpFlow, otpDigits, otpSeconds, otpRequesting, otpVerifying, otpError,
    requestOtp, updateOtpDigit, verifyOtpGate, resendOtpGate, closeOtpGate
  } = useOtpGate();
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [cancelModalTicket, setCancelModalTicket] = useState(null);
  const [selectedCancelReasons, setSelectedCancelReasons] = useState([]);
  const [cancelNotes, setCancelNotes] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const activeCenter = nameFrom(user?.center || user?.assignedCenter, 'Assigned Center');
  const activeCenterId =
    idFrom(user?.center) ||
    idFrom(user?.assignedCenter) ||
    user?.centerId ||
    user?.assignedCenterId ||
    '';

  const fetchTickets = useCallback(async (options = {}) => {
    const { showLoading = false, notify = false } =
      typeof options === 'boolean' ? { showLoading: options } : options;
    if (showLoading) setLoading(true);
    if (notify) setRefreshing(true);
    try {
      const response = await api.get('/api/operator/dashboard');
      const payload = response.data?.data || {};
      const nextTickets = (payload.tickets || payload.allCenterTickets || []).map(normalizeTicket);
      setTickets(sortTickets(nextTickets));
      setError('');
      if (notify) toast.success('Queue refreshed.');
      return true;
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to load center queue.';
      setError(message);
      if (notify) toast.error(message);
      return false;
    } finally {
      if (showLoading) setLoading(false);
      if (notify) setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    fetchTickets({ notify: true });
  }, [fetchTickets, refreshing]);

  useEffect(() => {
    fetchTickets({ showLoading: true });
    const intervalId = window.setInterval(() => fetchTickets(), 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchTickets]);

  useEffect(() => {
    if (!activeCenterId) return undefined;

    const socket = io(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || undefined);
    socket.emit('joinCenter', String(activeCenterId));

    const refreshCenterQueue = (payload = {}) => {
      if (!payload.centerId || String(payload.centerId) === String(activeCenterId)) {
        fetchTickets();
      }
    };

    socket.on('queueUpdate', refreshCenterQueue);
    return () => {
      socket.off('queueUpdate', refreshCenterQueue);
      socket.disconnect();
    };
  }, [activeCenterId, fetchTickets]);

  const stats = useMemo(() => {
    const sorted = sortTickets(tickets);
    const activeTickets = sorted.filter((ticket) => ACTIVE_STATUSES.includes(ticket.status));
    const waitingTickets = sorted.filter((ticket) => ticket.status === 'Waiting');
    const callableWaitingTickets = waitingTickets.filter((ticket) => !isPastAppointmentDate(ticket));
    const nowServing = sorted.find((ticket) => ticket.status === 'Being Served');
    const completedTickets = sorted.filter((ticket) => ticket.status === 'Completed');
    const avgWait = waitingTickets.length
      ? Math.round(waitingTickets.reduce((sum, ticket) => sum + (ticket.waitMinutes || 10), 0) / waitingTickets.length)
      : 0;

    return {
      activeTickets,
      waitingTickets,
      callableWaitingTickets,
      nowServing,
      completedTickets,
      avgWait,
    };
  }, [tickets]);

  const displayedTickets = useMemo(() => {
    if (filter === 'waiting') return stats.waitingTickets;
    if (filter === 'completed') return stats.completedTickets;
    if (filter === 'serving') return stats.nowServing ? [stats.nowServing] : [];
    return stats.activeTickets;
  }, [filter, stats]);

  const nextUp = stats.callableWaitingTickets.slice(0, 3);

  const handleCallNext = useCallback(async () => {
    const nextTicket = stats.callableWaitingTickets[0];
    if (!nextTicket?.ref) {
      if (stats.waitingTickets.length > 0) {
        toast.error('Waiting requests with past appointment dates cannot be called. Please reschedule or cancel them first.');
        return;
      }
      toast.info('No waiting requests available for this center.');
      return;
    }

    setActionLoading(`call-${nextTicket.ref}`);
    try {
      await api.put(`/api/queue/${nextTicket.id}/call`);
      toast.success(`Now serving ${nextTicket.ref}.`);
      await fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to call the next request.');
    } finally {
      setActionLoading('');
    }
  }, [fetchTickets, stats.callableWaitingTickets, stats.waitingTickets.length]);

  const handleComplete = useCallback(async (ticket) => {
    if (!ticket?.id) return;
    if (!canCompleteAppointment(ticket)) {
      toast.info('This appointment is already completed or closed.');
      return;
    }
    setActionLoading(`complete-${ticket.ref}`);
    try {
      const otpToken = await requestOtp({
        purpose: 'complete_service',
        ticketId: ticket.id,
        ticketRef: ticket.ref,
        title: 'Verify to Complete',
        description: `Ask the citizen for the 6-digit code sent to their phone to complete ${ticket.ref}.`
      });
      if (!otpToken) {
        toast.info('Complete service cancelled.');
        return;
      }
      // Prefer queue complete when actively serving; fallback to booking status for waiting tickets.
      try {
        await api.put(`/api/queue/${ticket.id}/complete`, { otpToken });
      } catch {
        await api.put(`/api/bookings/admin/${ticket.id}/status`, {
          status: 'Completed',
          otpToken
        });
      }
      toast.success(`Request ${ticket.ref} completed.`);
      await fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to complete this request.');
    } finally {
      setActionLoading('');
    }
  }, [fetchTickets, requestOtp]);

  const handleCancelTicket = useCallback(async (ticket, cancelData = {}) => {
    if (!ticket?.id) return;

    setActionLoading(`cancel-${ticket.ref}`);
    try {
      const otpToken = await requestOtp({
        purpose: 'cancel_service',
        ticketId: ticket.id,
        ticketRef: ticket.ref,
        title: 'Verify to Cancel',
        description: `Ask the citizen for the 6-digit code sent to their phone to cancel ${ticket.ref}.`
      });
      if (!otpToken) {
        toast.info('Cancellation aborted.');
        return;
      }
      await api.put(`/api/bookings/${ticket.id}/cancel`, {
        cancellationReason: cancelData.cancellationReason || 'Cancelled by center operator',
        cancellationReasons: cancelData.cancellationReasons || [],
        additionalNotes: cancelData.additionalNotes || '',
        otpToken
      });
      toast.success(`Request ${ticket.ref} cancelled. Citizen has been notified.`);
      setCancelModalTicket(null);
      setSelectedCancelReasons([]);
      setCancelNotes('');
      setCustomCancelReason('');
      setShowCancelConfirmation(false);
      await fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to cancel this request.');
    } finally {
      setActionLoading('');
    }
  }, [fetchTickets, requestOtp]);

  const handleReacceptTicket = useCallback(async (ticket) => {
    if (!ticket?.id) return;
    if (!canReacceptAppointment(ticket)) {
      toast.info('Re-accept is available only after the appointment is completed.');
      return;
    }
    const confirmed = window.confirm(`Re-accept ${ticket.ref}? This will return it to Waiting so it can be handled again.`);
    if (!confirmed) return;

    setActionLoading(`reaccept-${ticket.ref}`);
    try {
      await api.put(`/api/bookings/admin/${ticket.id}/status`, { status: 'Waiting' });
      toast.success(`Request ${ticket.ref} returned to Waiting.`);
      await fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to re-accept this request.');
    } finally {
      setActionLoading('');
    }
  }, [fetchTickets]);

  const openCancelModal = (ticket) => {
    if (!canCancelAppointment(ticket)) {
      toast.info('This appointment is already closed and cannot be cancelled.');
      return;
    }
    setCancelModalTicket(ticket);
    setSelectedCancelReasons([]);
    setCancelNotes('');
    setCustomCancelReason('');
    setShowCancelConfirmation(false);
  };

  const closeCancelModal = () => {
    setCancelModalTicket(null);
    setSelectedCancelReasons([]);
    setCancelNotes('');
    setCustomCancelReason('');
    setShowCancelConfirmation(false);
  };

  const toggleCancelReason = (reason) => {
    setShowCancelConfirmation(false);
    setSelectedCancelReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason]
    );
  };

  const selectedReasonLabels = (ticket = cancelModalTicket) => {
    const allowed = getIncorrectFieldOptionsForTicket(ticket);
    return selectedCancelReasons.filter((reason) => allowed.includes(reason));
  };

  const submitCancel = () => {
    if (!cancelModalTicket) return;
    const isUpdateReq = cancelModalTicket.requestType === 'update_information';
    const isLostReq = isLostReplacementRequest(cancelModalTicket);

    if (isUpdateReq) {
      const changedFields = getChangedUpdateFields(cancelModalTicket);
      if (!changedFields.length) {
        toast.error('No changes detected. Cancellation is not required.');
        return;
      }
      if (!customCancelReason.trim()) {
        toast.error('Please enter a cancellation reason.');
        return;
      }
      if (!showCancelConfirmation) {
        setShowCancelConfirmation(true);
        return;
      }
      const reason = customCancelReason.trim();
      handleCancelTicket(cancelModalTicket, {
        cancellationReasons: [reason],
        cancellationReason: reason,
        additionalNotes: '',
      });
      return;
    }

    const validReasons = selectedReasonLabels(cancelModalTicket);
    if (!validReasons.length) {
      toast.error(
        isLostReq
          ? 'Please select at least one incorrect Lost ID field.'
          : 'Please select at least one incorrect field.'
      );
      return;
    }
    if (!showCancelConfirmation) {
      setShowCancelConfirmation(true);
      return;
    }
    handleCancelTicket(cancelModalTicket, {
      cancellationReasons: validReasons,
      cancellationReason: validReasons.join(', '),
      additionalNotes: cancelNotes.trim(),
    });
  };

  const canAct = Boolean(actionLoading);

  const changeFilter = useCallback((nextFilter) => {
    if (nextFilter === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ filter: nextFilter });
    }
    window.setTimeout(() => {
      document.getElementById('queue-ticket-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [setSearchParams]);

  // Sitewide soft-pastel card tone system (styles/nqs-theme-system.css).
  const statCards = [
    {
      filter: 'waiting',
      value: stats.waitingTickets.length,
      label: 'Waiting Now',
      helper: 'Click to view waiting requests',
      icon: FaUsers,
      tone: 'purple',
    },
    {
      filter: 'waiting',
      value: `${stats.avgWait} min`,
      label: 'Average Wait',
      helper: 'Click to view wait list',
      icon: FaClock,
      tone: 'orange',
    },
    {
      filter: 'completed',
      value: stats.completedTickets.length,
      label: 'Completed Service',
      helper: 'Click to view completed work',
      icon: FaCheckDouble,
      tone: 'green',
    },
  ];

  return (
    <motion.div
      className="min-h-screen bg-slate-50 p-3 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-5 lg:p-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-none space-y-5">
        <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
              Queue Management
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                LIVE
              </span>
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <FaBuilding className="text-blue-500" />
              Current queue for {activeCenter}.
            </p>
            {loading && <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">Syncing queue...</p>}
            {error && <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || Boolean(actionLoading)}
              className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleCallNext}
              disabled={canAct || stats.waitingTickets.length === 0}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <FaPhoneAlt />
              Call Next
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <motion.div
            variants={item}
            className="rounded-2xl border border-blue-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Now Serving</p>
            <AnimatePresence mode="wait">
              {stats.nowServing ? (
                <motion.div
                  key={stats.nowServing.ref}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3"
                >
                  <p className="text-4xl font-black text-slate-950 dark:text-white">{stats.nowServing.ref}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{stats.nowServing.citizenDisplayName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{stats.nowServing.serviceName}</p>
                  <button
                    type="button"
                    onClick={() => handleComplete(stats.nowServing)}
                    disabled={canAct}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:bg-slate-400"
                  >
                    <FaCheck />
                    Complete Service
                  </button>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-5 text-3xl font-black text-slate-400 dark:text-slate-500"
                >
                  --
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {nextUp.map((ticket, index) => (
            <motion.div
              key={ticket.ref}
              variants={item}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Next #{index + 1}</p>
              <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{ticket.ref}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{ticket.citizenDisplayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ticket.serviceName}</p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <FaClock />
                {ticket.waitMinutes || 10} min wait
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div id="queue-ticket-table" variants={item} className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white">
              <FaTicketAlt className="text-yellow-500" />
              {QUEUE_FILTER_LABELS[filter] || 'Requests in Queue'}
            </h2>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {displayedTickets.length} request{displayedTickets.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-blue-50 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  {['Reference', 'Full Name', 'Phone', 'Service', 'Center', 'Position', 'Wait Time', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <AnimatePresence>
                  {displayedTickets.length > 0 ? (
                    displayedTickets.map((ticket, index) => (
                      <motion.tr
                        key={ticket.ref}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="hover:bg-blue-50 dark:hover:bg-slate-700/60"
                      >
                        <td className="px-4 py-3 font-black text-blue-700 dark:text-blue-300">{ticket.ref}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{ticket.citizenDisplayName}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ticket.citizenPhone}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ticket.serviceName}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ticket.centerName}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {ticket.status === 'Being Served' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-green-600 dark:text-green-400">
                              <FaArrowRight />
                              Serving
                            </span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ticket.waitMinutes || 10} min</td>
                        <td className="px-4 py-3"><span className={statusBadge(ticket.status)}>{ticket.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTicket(ticket)}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              <FaEye className="text-[10px]" />
                              View
                            </button>
                            {(ticket.status === 'Waiting' || ticket.status === 'Being Served') && (
                              <button
                                type="button"
                                onClick={() => handleComplete(ticket)}
                                disabled={canAct}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                <FaCheck className="text-[10px]" />
                                Complete
                              </button>
                            )}
                            {(ticket.status === 'Waiting' || ticket.status === 'Being Served') && (
                              <button
                                type="button"
                                onClick={() => openCancelModal(ticket)}
                                disabled={canAct}
                                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                <FaTimes className="text-[10px]" />
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleReacceptTicket(ticket)}
                              disabled={canAct || !canReacceptAppointment(ticket)}
                              title={canReacceptAppointment(ticket) ? 'Return completed appointment to Waiting' : 'Available after Complete'}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-bold !text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
                            >
                              <FaSyncAlt className="text-[10px]" />
                              Re-accept
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-6 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                        No requests to display for this filter.
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statCards.map((card) => {
            const isActive = filter === card.filter;
            return (
              <button
                key={`${card.label}-${card.filter}`}
                type="button"
                onClick={() => changeFilter(card.filter)}
                className={`flex items-center gap-4 rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md nqs-card-tone-${card.tone} ${
                  isActive ? 'ring-2 ring-blue-500/20' : ''
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg nqs-card-tone-icon-${card.tone}`}>
                  <card.icon />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-black text-[var(--text-main)]">{card.value}</p>
                  <p className="text-xs font-semibold text-[var(--text-muted)]">{card.label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--color-primary)]">{card.helper}</p>
                </div>
              </button>
            );
          })}
        </motion.div>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Request details</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{selectedTicket.ref}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Full Name', selectedTicket.citizenDisplayName],
                ['Phone', selectedTicket.citizenPhone],
                ['Service', selectedTicket.serviceName],
                ['Center', selectedTicket.centerName],
                ['Status', selectedTicket.status],
                ['Wait Time', `${selectedTicket.waitMinutes || 10} min`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                  <span className="text-right font-bold text-slate-900 dark:text-slate-100">{value || '--'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cancelModalTicket && (() => {
        const isUpdateReq = cancelModalTicket.requestType === 'update_information';
        const isLostReq = isLostReplacementRequest(cancelModalTicket);
        const fieldOptions = getIncorrectFieldOptionsForTicket(cancelModalTicket);
        const changedFields = isUpdateReq ? getChangedUpdateFields(cancelModalTicket) : [];
        const hasNoChanges = isUpdateReq && changedFields.length === 0;
        const modalTitle = isUpdateReq
          ? 'Cancel Update Request'
          : isLostReq
            ? 'Cancel Replace Lost National ID'
            : 'Cancel Appointment';
        const modalHelp = isUpdateReq
          ? 'Review the changed information and provide a cancellation reason for this update request.'
          : isLostReq
            ? 'Review the Lost ID details the citizen submitted, select incorrect fields, and add notes. The citizen will see this feedback and can resubmit.'
            : 'Select the incorrect fields. The citizen will receive this feedback and can resubmit from their dashboard.';

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white ${isUpdateReq ? 'max-w-lg' : 'max-w-2xl'}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Operator Action</p>
                <h2 className="mt-1 text-2xl font-black">{modalTitle}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{modalHelp}</p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close cancel appointment modal"
              >
                <FaTimes />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Request Reference</p>
                  <p className="mt-1 font-mono text-sm font-black text-blue-700 dark:text-blue-300">{cancelModalTicket.ref}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Full Name</p>
                  <p className="mt-1 text-sm font-black">{cancelModalTicket.citizenDisplayName || '--'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Request Type</p>
                  <p className="mt-1 text-sm font-black">{getRequestTypeLabel(cancelModalTicket.requestType)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Current Status</p>
                  <p className="mt-1 text-sm font-black">{cancelModalTicket.status || '--'}</p>
                </div>
              </div>
            </div>

            {isLostReq && <LostIdCancelDetails ticket={cancelModalTicket} />}

            {isUpdateReq ? (
              <div className="mt-5 space-y-4">
                {hasNoChanges ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                    No changes detected. Cancellation is not required.
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Changed Information</span>
                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 font-black uppercase text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          <tr>
                            <th className="px-3 py-2">Field</th>
                            <th className="px-3 py-2">Previous Information</th>
                            <th className="px-3 py-2">Requested Information</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                          {changedFields.map((field, index) => (
                            <tr key={`${field.field}-${index}`}>
                              <td className="px-3 py-2 font-bold text-blue-700 dark:text-blue-300">{field.field}</td>
                              <td className="px-3 py-2 text-slate-500 line-through dark:text-slate-400">{field.oldValue}</td>
                              <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{field.newValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!hasNoChanges && (
                  <label className="block">
                    <span className="text-sm font-bold">Cancellation Reason</span>
                    <textarea
                      value={customCancelReason}
                      onChange={(event) => {
                        setShowCancelConfirmation(false);
                        setCustomCancelReason(event.target.value);
                      }}
                      rows={3}
                      placeholder="Enter the reason for cancelling this update request"
                      className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900/40"
                    />
                  </label>
                )}
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <span className="text-sm font-bold">
                    {isLostReq ? 'Select incorrect Lost ID fields' : 'Select incorrect fields'}
                  </span>
                  <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40 sm:grid-cols-2">
                    {fieldOptions.map((reason) => {
                      const checked = selectedCancelReasons.includes(reason);
                      return (
                        <label
                          key={reason}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            checked
                              ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCancelReason(reason)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          />
                          <span>{reason}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm font-bold">Additional notes</span>
                  <textarea
                    value={cancelNotes}
                    onChange={(event) => {
                      setShowCancelConfirmation(false);
                      setCancelNotes(event.target.value);
                    }}
                    rows={3}
                    placeholder="Citizen may submit a corrected request."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900/40"
                  />
                </label>
              </>
            )}

            {showCancelConfirmation && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-black">Confirm cancellation</p>
                <p className="mt-2">
                  {isUpdateReq
                    ? `Cancellation reason: ${customCancelReason.trim()}. Are you sure you want to cancel this update request?`
                    : `You selected the following incorrect fields: ${selectedReasonLabels(cancelModalTicket).join(', ')}. Are you sure you want to cancel this ${isLostReq ? 'Lost ID request' : 'appointment'}?`}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={Boolean(actionLoading) || hasNoChanges}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading
                  ? 'Cancelling...'
                  : (isUpdateReq
                    ? 'Confirm Cancel Update'
                    : isLostReq
                      ? 'Confirm Cancel Lost ID'
                      : 'Confirm Cancellation')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      <OtpGateModal
        flow={otpFlow}
        digits={otpDigits}
        seconds={otpSeconds}
        requesting={otpRequesting}
        verifying={otpVerifying}
        error={otpError}
        onDigitChange={updateOtpDigit}
        onVerify={verifyOtpGate}
        onResend={resendOtpGate}
        onClose={closeOtpGate}
      />
    </motion.div>
  );
};

export default QueueManagement;
