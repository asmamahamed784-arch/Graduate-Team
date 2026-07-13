import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';
import {
  FaBuilding,
  FaCheck,
  FaCheckDouble,
  FaPhoneAlt,
  FaQrcode,
  FaStopwatch,
  FaTicketAlt,
  FaTimesCircle,
  FaUserClock,
} from 'react-icons/fa';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const SERVICE_SECTIONS = [
  { key: 'new_national_id', title: 'New National ID Registration' },
  { key: 'update_information', title: 'Update National ID Information' },
  { key: 'lost_replacement', title: 'Lost National ID Replacement' },
];

const FILTER_LABELS = {
  all: 'All appointments',
  serving: 'Now serving',
  waiting: 'Waiting appointments',
  served: 'Served today',
  average: 'Average service records',
};

const queueGridClass = 'grid grid-cols-1 gap-2 lg:grid-cols-[86px_118px_92px_128px_128px_86px_68px_94px_118px] lg:items-center';
const queueTextClass = 'nqs-operator-text min-w-0 truncate text-[12px] font-semibold';
const queueMutedClass = 'nqs-operator-muted min-w-0 truncate text-[12px] font-medium';

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const todayKey = () => new Date().toISOString().slice(0, 10);

const statusLabel = (status) => (status === 'Being Served' ? 'Now Serving' : status || 'Waiting');

const statusBadge = (status) => {
  const base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block';
  if (status === 'Being Served') return `${base} bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400`;
  if (status === 'Waiting') return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400`;
  if (status === 'On Hold') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400`;
  if (status === 'Completed') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400`;
  if (status === 'Cancelled') return `${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400`;
  return `${base} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`;
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

const normalizeRequestType = (ticket) => {
  if (ticket.requestType) return ticket.requestType;
  const serviceName = nameFrom(ticket.service, ticket.serviceName || '').toLowerCase();
  if (serviceName.includes('update')) return 'update_information';
  if (serviceName.includes('lost') || serviceName.includes('replace')) return 'lost_replacement';
  return 'new_national_id';
};

const cleanCitizenName = (value) => {
  const name = String(value || '').trim();
  if (!name || /^citizen\s*\d+$/i.test(name)) return 'No Data';
  return name;
};

const getCitizenName = (ticket) => cleanCitizenName(
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizen?.name ||
  ticket.citizenName
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

const sortTickets = (tickets) => [...tickets].sort((a, b) => {
  const dateA = a.date || '9999-12-31';
  const dateB = b.date || '9999-12-31';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const timeDiff = timeToMinutes(a.timeSlot) - timeToMinutes(b.timeSlot);
  if (timeDiff !== 0) return timeDiff;

  return getQueueNumber(a) - getQueueNumber(b);
});

const formatDate = (value) => {
  if (!value) return 'Review request';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const isTodayDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === todayKey();
};

const minutesBetween = (start, end) => {
  const startMs = start ? new Date(start).getTime() : NaN;
  const endMs = end ? new Date(end).getTime() : NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60000);
};

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: ticket._id || ticket.id,
  serviceId: idFrom(ticket.service) || ticket.serviceId,
  centerId: idFrom(ticket.center) || ticket.centerId,
  serviceName: nameFrom(ticket.service, ticket.serviceName || 'National ID Service'),
  centerName: nameFrom(ticket.center, ticket.centerName || 'Assigned Center'),
  requestType: normalizeRequestType(ticket),
  citizenDisplayName: getCitizenName(ticket),
  citizenPhone: getCitizenPhone(ticket),
});

const StatCardSkeleton = () => (
  <div className="animate-pulse rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
    <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700" />
    <div className="mt-3 h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="mt-2 h-5 w-14 rounded bg-slate-200 dark:bg-slate-700" />
  </div>
);

const OperatorDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const activeCenter = typeof user?.center === 'object' ? user.center?.name : (user?.center || 'Assigned Center');

  const fetchQueue = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/api/queue/list');
      const nextTickets = (response.data?.data || []).map(normalizeTicket);
      setTickets(sortTickets(nextTickets));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load operator queue.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue(true);
    const intervalId = window.setInterval(() => fetchQueue(false), 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchQueue]);

  const stats = useMemo(() => {
    const sorted = sortTickets(tickets);
    const currentlyServing = sorted.find((ticket) => ticket.status === 'Being Served') || null;
    const waitingTickets = sorted.filter((ticket) => ticket.status === 'Waiting');
    const servedToday = sorted.filter((ticket) => ticket.status === 'Completed' && isTodayDate(ticket.completedAt || ticket.updatedAt));
    const serviceMinutes = servedToday
      .map((ticket) => minutesBetween(ticket.calledAt, ticket.completedAt))
      .filter((value) => Number.isFinite(value));
    const avgServiceTime = serviceMinutes.length
      ? `${Math.round(serviceMinutes.reduce((sum, value) => sum + value, 0) / serviceMinutes.length)} min`
      : '--';

    return {
      currentlyServing,
      waitingTickets,
      ticketsWaitingCount: waitingTickets.length,
      servedToday,
      servedTodayCount: servedToday.length,
      avgServiceTime,
    };
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const sorted = sortTickets(tickets);

    if (activeFilter === 'serving') {
      return sorted.filter((ticket) => ticket.status === 'Being Served');
    }

    if (activeFilter === 'waiting') {
      return sorted.filter((ticket) => ticket.status === 'Waiting');
    }

    if (activeFilter === 'served') {
      return sorted.filter((ticket) => ticket.status === 'Completed' && isTodayDate(ticket.completedAt || ticket.updatedAt));
    }

    if (activeFilter === 'average') {
      return sorted.filter((ticket) => ticket.status === 'Completed' && minutesBetween(ticket.calledAt, ticket.completedAt) !== null);
    }

    return sorted;
  }, [activeFilter, tickets]);

  const groupedTickets = useMemo(() => {
    const grouped = SERVICE_SECTIONS.reduce((acc, section) => {
      acc[section.key] = [];
      return acc;
    }, {});

    visibleTickets.forEach((ticket) => {
      const key = grouped[ticket.requestType] ? ticket.requestType : 'new_national_id';
      grouped[key].push(ticket);
    });

    return grouped;
  }, [visibleTickets]);

  const callTicket = async (ticket) => {
    if (!ticket?.ref) return;
    setActionLoading(`call-${ticket.ref}`);
    try {
      await api.post('/api/qr/action', {
        ticketRef: ticket.ref,
        action: 'arrive',
      });
      toast.success(`Now serving ${ticket.ref}.`);
      await fetchQueue(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to call this ticket.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCallNext = async () => {
    const nextTicket = stats.waitingTickets[0];
    if (!nextTicket) {
      toast.info('No waiting appointments available.');
      return;
    }
    await callTicket(nextTicket);
  };

  const handleComplete = async (ticket) => {
    if (!ticket?.id) return;
    setActionLoading(`complete-${ticket.ref}`);
    try {
      await api.put(`/api/queue/${ticket.id}/complete`);
      toast.success(`Ticket ${ticket.ref} completed.`);

      const nextTicket = stats.waitingTickets.find((entry) => entry.id !== ticket.id && entry.ref !== ticket.ref);
      if (nextTicket) {
        await api.post('/api/qr/action', {
          ticketRef: nextTicket.ref,
          action: 'arrive',
        });
        toast.info(`Next ticket ${nextTicket.ref} is now serving.`);
      }

      await fetchQueue(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to complete this appointment.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (ticket) => {
    if (!ticket?.ref) return;
    setActionLoading(`cancel-${ticket.ref}`);
    try {
      await api.post('/api/qr/action', {
        ticketRef: ticket.ref,
        action: 'cancel',
      });
      toast.success(`Ticket ${ticket.ref} cancelled.`);
      await fetchQueue(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to cancel this appointment.');
    } finally {
      setActionLoading('');
    }
  };

  const statsData = [
    {
      label: 'Now Serving',
      value: stats.currentlyServing?.citizenDisplayName || 'No Data',
      helper: stats.currentlyServing?.ref || 'No active ticket',
      icon: FaUserClock,
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500',
      filter: 'serving',
    },
    {
      label: 'Tickets Waiting',
      value: stats.ticketsWaitingCount.toString(),
      helper: 'Waiting appointments',
      icon: FaTicketAlt,
      bg: 'bg-yellow-100 dark:bg-yellow-900/40',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-500',
      filter: 'waiting',
    },
    {
      label: 'Served Today',
      value: stats.servedTodayCount.toString(),
      helper: 'Completed today',
      icon: FaCheckDouble,
      bg: 'bg-green-100 dark:bg-green-900/40',
      iconColor: 'text-green-600 dark:text-green-400',
      border: 'border-green-500',
      filter: 'served',
    },
    {
      label: 'Avg Service Time',
      value: stats.avgServiceTime,
      helper: 'Start to complete',
      icon: FaStopwatch,
      bg: 'bg-purple-100 dark:bg-purple-900/40',
      iconColor: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500',
      filter: 'average',
    },
  ];

  if ((authLoading || loading) && tickets.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-2 dark:bg-slate-950 sm:p-3">
        <div className="mx-auto max-w-none space-y-3">
          <div className="animate-pulse rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
            <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-64 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="nqs-operator-dashboard min-h-screen bg-slate-50 p-2 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-none space-y-3">
        <motion.div
          variants={item}
          className="nqs-portal-hero relative overflow-hidden rounded-2xl bg-[#082A55] bg-gradient-to-br from-[#082A55] to-[#0B3A75] p-6 text-white shadow-sm"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Operator Console</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Operator Dashboard</h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-100">
                <FaBuilding className="text-blue-300" />
                <span>{activeCenter}</span>
                <span className="mx-1">|</span>
                <span>{today}</span>
              </div>
              {error && <p className="mt-2 text-sm font-medium text-red-300">{error}</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                to="/dashboard/operator/qr-scan"
                className="nqs-hero-card flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#082A55] shadow-sm transition hover:bg-blue-50"
              >
                <FaQrcode className="text-sm" />
                Scan QR Ticket
              </Link>
              <button
                type="button"
                onClick={handleCallNext}
                disabled={Boolean(actionLoading) || stats.ticketsWaitingCount === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaPhoneAlt className="text-sm" />
                Call Next Ticket
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat) => {
            const isActive = activeFilter === stat.filter;
            return (
              <motion.button
                key={stat.label}
                variants={item}
                type="button"
                onClick={() => setActiveFilter((current) => (current === stat.filter ? 'all' : stat.filter))}
                className={`flex min-h-[70px] items-center gap-2 rounded-lg border bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 ${isActive ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700'} border-l-4 ${stat.border}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${stat.bg}`}>
                  <stat.icon className={`text-sm ${stat.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-950 dark:text-white">{stat.value}</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{stat.label}</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{stat.helper}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Showing: {FILTER_LABELS[activeFilter]} ({visibleTickets.length})
          </span>
          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="rounded-md border border-blue-200 px-3 py-1 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              Show all
            </button>
          )}
        </motion.div>

        {visibleTickets.length === 0 ? (
          <motion.div variants={item} className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <FaTicketAlt className="mx-auto text-3xl text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
              {tickets.length === 0 ? 'No appointments available.' : `No records found for ${FILTER_LABELS[activeFilter].toLowerCase()}.`}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Appointments booked for your assigned center will appear here automatically.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {SERVICE_SECTIONS.map((section) => {
              const sectionTickets = groupedTickets[section.key] || [];
              return (
                <motion.section
                  key={section.key}
                  variants={item}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                      <FaTicketAlt className="text-yellow-500" />
                      {section.title}
                    </h2>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      {sectionTickets.length} appointment{sectionTickets.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {sectionTickets.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">No appointments available.</p>
                  ) : (
                    <div className="p-2">
                      <div className={`${queueGridClass} nqs-operator-head rounded-md bg-slate-100 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide dark:bg-slate-900`}>
                        <span>Ticket</span>
                        <span>Citizen</span>
                        <span>Phone</span>
                        <span>Service</span>
                        <span>Center</span>
                        <span>Date</span>
                        <span>Time</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>
                      <div className="mt-1 divide-y divide-slate-200 dark:divide-slate-700">
                        {sectionTickets.map((ticket) => (
                          <div
                            key={ticket.id || ticket.ref}
                            className={`${queueGridClass} bg-white px-2 py-2 transition-colors hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700/60`}
                          >
                            <span className="nqs-operator-link min-w-0 truncate text-[12px] font-bold">{ticket.ref}</span>
                            <span className={queueTextClass}>{ticket.citizenDisplayName}</span>
                            <span className={queueMutedClass}>{ticket.citizenPhone}</span>
                            <span className={queueMutedClass}>{ticket.serviceName}</span>
                            <span className={queueMutedClass}>{ticket.centerName}</span>
                            <span className={queueMutedClass}>{formatDate(ticket.date)}</span>
                            <span className={queueMutedClass}>{ticket.timeSlot || '--'}</span>
                            <span>
                              <span className={statusBadge(ticket.status)}>{statusLabel(ticket.status)}</span>
                            </span>
                            <span>
                              <div className="flex flex-wrap gap-1">
                                  {ticket.status === 'Waiting' && (
                                    <button
                                      type="button"
                                      onClick={() => callTicket(ticket)}
                                      disabled={Boolean(actionLoading)}
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-900/40 dark:text-blue-300"
                                      title="Call ticket"
                                    >
                                      <FaPhoneAlt />
                                      Call
                                    </button>
                                  )}
                                  {ticket.status === 'Being Served' && (
                                    <button
                                      type="button"
                                      onClick={() => handleComplete(ticket)}
                                      disabled={Boolean(actionLoading)}
                                      className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700 transition-colors hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-900/40 dark:text-green-300"
                                      title="Complete appointment"
                                    >
                                      <FaCheck />
                                      Complete
                                    </button>
                                  )}
                                  {['Waiting', 'Being Served', 'On Hold'].includes(ticket.status) && (
                                    <button
                                      type="button"
                                      onClick={() => handleCancel(ticket)}
                                      disabled={Boolean(actionLoading)}
                                      className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-900/40 dark:text-red-300"
                                      title="Cancel appointment"
                                    >
                                      <FaTimesCircle />
                                      Cancel
                                    </button>
                                  )}
                                  {!['Waiting', 'Being Served', 'On Hold'].includes(ticket.status) && (
                                    <span className="nqs-operator-muted text-[11px] font-semibold">No actions</span>
                                  )}
                                </div>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.section>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default OperatorDashboard;
