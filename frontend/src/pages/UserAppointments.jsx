import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaCalendarAlt,
  FaChevronRight,
  FaClock,
  FaDownload,
  FaEdit,
  FaIdCard,
  FaMapMarkerAlt,
  FaRedo,
  FaRoute,
  FaTimesCircle,
  FaUserPlus,
} from 'react-icons/fa';
import { FiCheckCircle, FiGrid, FiSearch, FiXCircle } from 'react-icons/fi';
import api from '../api/axiosInstance';
import CitizenStaffFeedback from '../components/CitizenStaffFeedback';
import Modal from '../components/Modal';
import { useAuth } from '../hooks';
import { downloadTicketPdf } from '../utils/ticketPdf';

const requestTypeLabels = {
  new_national_id: 'New National ID Registration',
  replace_lost_id: 'Replace Lost National ID',
  lost_replacement: 'Replace Lost National ID',
  update_information: 'Update National ID Information',
};

const getPayload = (response) => response.data?.data || response.data || [];
const safeArray = (value) => (Array.isArray(value) ? value : []);
const asName = (value, fallback = 'Not available') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || value.title || fallback;
};

const getCitizenNameFromTicket = (ticket) => (
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizenName ||
  ticket.citizen?.name
);

const CURRENT_STATUSES = new Set(['Pending', 'Scheduled', 'Waiting', 'On Hold', 'Now Serving', 'Resubmitted']);
const CANCEL_WINDOW_MS = 60 * 60 * 1000;

const getCancelWindowRemainingMs = (ticket) => {
  const createdAt = new Date(ticket?.createdAt);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return CANCEL_WINDOW_MS - (Date.now() - createdAt.getTime());
};

const canCitizenCancelTicket = (ticket) => {
  if (!['Pending', 'Waiting', 'Scheduled'].includes(ticket.currentStatus)) return false;
  return getCancelWindowRemainingMs(ticket) > 0;
};

const formatCancelWindowRemaining = (ticket) => {
  const remainingMs = getCancelWindowRemainingMs(ticket);
  if (remainingMs <= 0) return '';
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${totalMinutes} min`;
};

const normalizeStatus = (status) => {
  const value = String(status || 'Pending').trim().toLowerCase();
  if (value === 'approved' || value === 'confirmed') return 'Scheduled';
  if (value === 'being served' || value === 'serving' || value === 'now serving') return 'Now Serving';
  if (value === 'on hold' || value === 'hold') return 'On Hold';
  if (value === 'cancelled' || value === 'canceled' || value === 'rejected') return 'Cancelled';
  if (value === 'resubmission required' || value === 'needs correction' || value === 'correction required') return 'Cancelled';
  if (value === 'completed' || value === 'complete') return 'Completed';
  if (value === 'expired') return 'Expired';
  if (value === 'resubmitted') return 'Resubmitted';
  if (value === 'scheduled') return 'Scheduled';
  if (value === 'waiting') return 'Waiting';
  return 'Pending';
};

const currentStatusOf = (ticket = {}) => {
  const requestStatus = normalizeStatus(ticket.requestStatus);
  if (['Cancelled', 'Completed', 'Expired', 'Resubmitted'].includes(requestStatus)) return requestStatus;
  return normalizeStatus(ticket.status || ticket.requestStatus);
};

const queueNumberOf = (ticket) => {
  if (!ticket) return '--';
  if (ticket.queueNumber) return ticket.queueNumber;
  if (ticket.queueNo) return ticket.queueNo;
  if (ticket.queue?.number) return ticket.queue.number;
  const suffix = ticket.ref?.split('-').pop();
  return suffix ? `A-${suffix.slice(-3)}` : '--';
};

const getResubmitPath = (ticket) => {
  const type = ticket?.requestType || ticket?.type;
  if (type === 'update_information') return `/dashboard/user/update-information?resubmit=${encodeURIComponent(ticket.id || ticket._id)}`;
  if (type === 'replace_lost_id' || type === 'lost_replacement') return `/dashboard/user/replace-lost-id?resubmit=${encodeURIComponent(ticket.id || ticket._id)}`;
  return `/dashboard/user/new-id-registration?resubmit=${encodeURIComponent(ticket?.id || ticket?._id)}`;
};

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: ticket._id || ticket.id,
  ref: ticket.ref || ticket.reference || ticket.ticketNumber || 'No reference',
  citizenDisplayName: getCitizenNameFromTicket(ticket) || 'Citizen',
  serviceName: asName(ticket.service, ticket.serviceName || requestTypeLabels[ticket.requestType] || 'National ID Service'),
  centerName: asName(ticket.center, ticket.centerName || 'Not assigned'),
  appointmentDate: ticket.date || ticket.appointmentDate,
  appointmentTime: ticket.timeSlot || ticket.time || ticket.appointmentTime,
  createdAt: ticket.createdAt,
  currentStatus: currentStatusOf(ticket),
  queueNumber: queueNumberOf(ticket),
});

/** The mockup only needs three buckets — Upcoming / Completed / Cancelled — even
 *  though currentStatus itself carries more detail (Waiting, On Hold, etc). */
const statusBucket = (currentStatus) => {
  if (currentStatus === 'Completed') return 'completed';
  if (currentStatus === 'Cancelled' || currentStatus === 'Expired') return 'cancelled';
  return 'upcoming';
};

const bucketMeta = {
  upcoming: { label: 'Upcoming', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', badge: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-700' },
};

const requestTypeVisual = {
  new_national_id: { icon: FaUserPlus, bg: 'bg-blue-50', color: 'text-blue-600' },
  update_information: { icon: FaEdit, bg: 'bg-purple-50', color: 'text-purple-600' },
  lost_replacement: { icon: FaIdCard, bg: 'bg-amber-50', color: 'text-amber-600' },
  replace_lost_id: { icon: FaIdCard, bg: 'bg-amber-50', color: 'text-amber-600' },
};

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const serviceFilterTabs = [
  { key: 'all', label: 'All Services', icon: FiGrid },
  { key: 'new_national_id', label: 'New Registration', icon: FaUserPlus },
  { key: 'update_information', label: 'Update Information', icon: FaEdit },
  { key: 'lost_replacement', label: 'Lost ID Replacement', icon: FaIdCard },
];

const shortRequestTypeLabels = {
  new_national_id: 'New Registration',
  update_information: 'Update Information',
  lost_replacement: 'Lost ID Replacement',
  replace_lost_id: 'Lost ID Replacement',
};

const serviceKeyOf = (ticket = {}) => {
  const value = String(ticket.requestType || ticket.type || '').toLowerCase();
  if (value === 'update_information') return 'update_information';
  if (value === 'lost_replacement' || value === 'replace_lost_id') return 'lost_replacement';
  return 'new_national_id';
};

const shortServiceName = (ticket = {}) => (
  shortRequestTypeLabels[ticket.requestType] ||
  shortRequestTypeLabels[serviceKeyOf(ticket)] ||
  ticket.serviceName ||
  'New Registration'
);

const getCitizenPhoneFromTicket = (ticket = {}) => (
  ticket.phone ||
  ticket.phoneNumber ||
  ticket.citizen?.phone ||
  ticket.citizen?.phoneNumber ||
  ticket.registrationDetails?.phone ||
  ticket.registrationDetails?.phoneNumber ||
  ticket.replacementDetails?.phone ||
  ticket.replacementDetails?.phoneNumber ||
  ticket.updateDetails?.phone ||
  ticket.updateDetails?.phoneNumber ||
  'Not available'
);

const getNationalIdFromTicket = (ticket = {}) => (
  ticket.nationalId ||
  ticket.nqsId ||
  ticket.citizen?.nationalId ||
  ticket.registrationDetails?.nationalId ||
  ticket.replacementDetails?.nationalId ||
  ticket.updateDetails?.nationalId ||
  'Not available'
);

const getCenterDistrictFromTicket = (ticket = {}) => (
  ticket.center?.district ||
  ticket.center?.address ||
  ticket.district ||
  ticket.registrationDetails?.district ||
  ticket.replacementDetails?.district ||
  ticket.updateDetails?.district ||
  ''
);

const statusCategoryOf = (ticket = {}) => {
  const haystack = [ticket.currentStatus, ticket.status, ticket.requestStatus]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('no show') || haystack.includes('no_show')) return 'noShow';
  if (haystack.includes('correction') || haystack.includes('resubmission')) return 'waiting';
  if (ticket.currentStatus === 'Completed' || haystack.includes('completed')) return 'completed';
  if (ticket.currentStatus === 'Cancelled' || ticket.currentStatus === 'Expired' || haystack.includes('cancel')) return 'cancelled';
  if (ticket.currentStatus === 'Now Serving' || ticket.currentStatus === 'On Hold' || haystack.includes('progress') || haystack.includes('serving')) return 'waiting';
  return 'waiting';
};

const statusFilterCards = [
  { key: 'all', label: 'Total Appointments', tone: 'blue', icon: FiGrid },
  { key: 'waiting', label: 'Waiting', tone: 'purple', icon: FaClock },
  { key: 'completed', label: 'Completed', tone: 'green', icon: FiCheckCircle },
  { key: 'cancelled', label: 'Cancelled', tone: 'pink', icon: FiXCircle },
  { key: 'noShow', label: 'No Show', tone: 'rose', icon: FaUserPlus },
];

const DetailInfoCard = ({ label, value }) => (
  <div className="nqs-ua-info-card rounded-md border px-3 py-2">
    <p className="text-[10px] font-black uppercase tracking-wide">{label}</p>
    <p className="mt-0.5 truncate text-sm font-black" title={String(value || '')}>{value || 'Not available'}</p>
  </div>
);

const StatusFilterCard = ({ card, value, active, onClick }) => {
  const Icon = card.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nqs-ua-stat-card nqs-ua-stat-${card.tone} ${active ? 'is-active' : ''}`}
    >
      <span className="nqs-ua-stat-icon">
        <Icon />
      </span>
      <span className="min-w-0">
        <span className="nqs-ua-stat-value">{value}</span>
        <span className="nqs-ua-stat-label">{card.label}</span>
      </span>
    </button>
  );
};

const statusBadge = (status = 'Pending') => {
  const base = 'nqs-ua-status-badge inline-flex items-center rounded-full px-3 py-1 text-xs font-black';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700`;
  if (status === 'Now Serving') return `${base} bg-blue-100 text-blue-700`;
  if (status === 'Cancelled' || status === 'Expired') return `${base} bg-red-100 text-red-700`;
  if (status === 'On Hold') return `${base} bg-slate-100 text-slate-700`;
  if (status === 'Scheduled') return `${base} bg-indigo-100 text-indigo-700`;
  if (status === 'Resubmitted') return `${base} bg-purple-100 text-purple-700`;
  return `${base} bg-amber-100 text-amber-700`;
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-black text-[#06194A]">{value || 'Not available'}</p>
  </div>
);

const ActionButton = ({ children, disabled = false, onClick, className = '' }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

const StatCard = ({ icon: Icon, value, label, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl border border-slate-100 p-4 text-center ${tones[tone]}`}>
      <Icon className="text-lg" />
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
};

const AppointmentRow = ({ ticket, onOpen }) => {
  const visual = requestTypeVisual[ticket.requestType] || requestTypeVisual.new_national_id;
  const Icon = visual.icon;
  const bucket = bucketMeta[statusBucket(ticket.currentStatus)];
  return (
    <button
      type="button"
      onClick={() => onOpen(ticket)}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${visual.bg}`}>
        <Icon className={visual.color} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-black text-[#06194A]">{ticket.serviceName}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${bucket.badge}`}>{bucket.label}</span>
        </div>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
          <FaMapMarkerAlt className="shrink-0" /> {ticket.centerName}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>Queue No. <strong className="text-slate-700">{ticket.queueNumber}</strong></span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><FaCalendarAlt /> {formatShortDate(ticket.appointmentDate)}</span>
            <span className="flex items-center gap-1"><FaClock /> {ticket.appointmentTime || 'Not scheduled'}</span>
          </span>
        </div>
      </div>
      <FaChevronRight className="shrink-0 text-slate-300" />
    </button>
  );
};

const sortAppointments = (appointments) => [...appointments].sort((a, b) => {
  const dateA = `${a.appointmentDate || ''} ${a.appointmentTime || ''}`;
  const dateB = `${b.appointmentDate || ''} ${b.appointmentTime || ''}`;
  return dateB.localeCompare(dateA);
});

const UserAppointments = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeService, setActiveService] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [qrCodes, setQrCodes] = useState({});
  const [selectedQrCodeUrl, setSelectedQrCodeUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sortedAppointments = useMemo(() => sortAppointments(bookings), [bookings]);
  const currentAppointments = useMemo(
    () => sortAppointments(bookings.filter((ticket) => CURRENT_STATUSES.has(ticket.currentStatus))).reverse(),
    [bookings]
  );
  const cancelledTickets = bookings.filter((ticket) => ticket.currentStatus === 'Cancelled');

  const citizenSnapshot = useMemo(() => {
    const latest = sortedAppointments[0] || {};
    const centerDistrict = getCenterDistrictFromTicket(latest);
    return {
      name: latest.citizenDisplayName || user?.name || user?.fullName || user?.username || 'Citizen',
      phone: getCitizenPhoneFromTicket(latest),
      nationalId: getNationalIdFromTicket(latest),
      serviceType: latest.id ? shortServiceName(latest) : 'Not available',
      center: latest.id
        ? `${latest.centerName || 'Not assigned'}${centerDistrict ? ` · ${centerDistrict}` : ''}`
        : 'Not available',
      dateTime: latest.id ? `${formatShortDate(latest.appointmentDate)} · ${latest.appointmentTime || 'Not scheduled'}` : 'Not available',
      queueNumber: latest.id ? latest.queueNumber : 'Not available',
      status: latest.id ? latest.currentStatus : 'Not available',
    };
  }, [sortedAppointments, user]);

  const serviceCounts = useMemo(() => {
    const counts = { all: sortedAppointments.length, new_national_id: 0, update_information: 0, lost_replacement: 0 };
    sortedAppointments.forEach((ticket) => {
      counts[serviceKeyOf(ticket)] += 1;
    });
    return counts;
  }, [sortedAppointments]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: sortedAppointments.length,
      waiting: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    };
    sortedAppointments.forEach((ticket) => {
      counts[statusCategoryOf(ticket)] += 1;
    });
    return counts;
  }, [sortedAppointments]);

  const filteredAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedAppointments.filter((ticket) => {
      if (activeService !== 'all' && serviceKeyOf(ticket) !== activeService) return false;
      if (activeStatus !== 'all' && statusCategoryOf(ticket) !== activeStatus) return false;
      if (!term) return true;
      const haystack = [
        ticket.ref,
        ticket.citizenDisplayName,
        shortServiceName(ticket),
        ticket.serviceName,
        ticket.centerName,
        getCenterDistrictFromTicket(ticket),
        ticket.queueNumber,
        ticket.currentStatus,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [activeService, activeStatus, search, sortedAppointments]);

  const nextManageableAppointment = currentAppointments[0] || null;

  const fetchAppointments = useCallback(async () => {
    try {
      const response = await api.get('/api/bookings/my');
      setBookings(safeArray(getPayload(response)).map(normalizeTicket));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load your appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    const intervalId = window.setInterval(fetchAppointments, 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchAppointments]);

  useEffect(() => {
    let mounted = true;
    const generateQrCodes = async () => {
      if (!currentAppointments.length) {
        setQrCodes({});
        return;
      }

      const refs = currentAppointments.map((ticket) => ticket.ref).filter(Boolean);
      try {
        const entries = await Promise.all(
          refs.map(async (ref) => {
            const response = await api.get(`/api/qr/generate?text=${encodeURIComponent(ref)}`);
            return [ref, response.data?.success ? response.data.data : ''];
          })
        );
        if (mounted) setQrCodes(Object.fromEntries(entries));
      } catch {
        if (mounted) setQrCodes({});
      }
    };
    generateQrCodes();
    return () => {
      mounted = false;
    };
  }, [currentAppointments]);

  useEffect(() => {
    let mounted = true;
    const generateSelectedQr = async () => {
      setSelectedQrCodeUrl('');
      if (!selectedTicket?.ref) return;

      try {
        const response = await api.get(`/api/qr/generate?text=${encodeURIComponent(selectedTicket.ref)}`);
        if (mounted && response.data?.success) {
          setSelectedQrCodeUrl(response.data.data);
        }
      } catch {
        if (mounted) setSelectedQrCodeUrl('');
      }
    };
    generateSelectedQr();
    return () => {
      mounted = false;
    };
  }, [selectedTicket?.ref]);

  const handleDownloadTicket = async (ticket) => {
    if (!ticket) return;
    try {
      await downloadTicketPdf({
        ...ticket,
        service: ticket.serviceName,
        center: ticket.centerName,
        date: ticket.appointmentDate,
        timeSlot: ticket.appointmentTime,
        status: ticket.currentStatus,
      });
      toast.success(`Request ${ticket.ref} downloaded.`);
    } catch (error) {
      toast.error(error.message || 'Unable to download your request.');
    }
  };

  const handleCancelAppointment = async (ticket) => {
    if (!ticket?.id) return;
    if (!canCitizenCancelTicket(ticket)) {
      toast.error('You can cancel an appointment only within 1 hour after booking.');
      return;
    }
    const remaining = formatCancelWindowRemaining(ticket);
    const confirmed = window.confirm(
      `Cancel appointment ${ticket.ref}?\n\nCancellation is only allowed within 1 hour of booking${remaining ? ` (${remaining} left)` : ''}.`
    );
    if (!confirmed) return;

    try {
      await api.put(`/api/bookings/${ticket.id}/cancel`);
      toast.success('Appointment cancelled.');
      setIsModalOpen(false);
      await fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel this appointment.');
    }
  };

  const openDetails = (ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8fc]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="nqs-user-appointments nqs-user-appointments-v2 min-h-screen bg-white text-[#06194A]">
      <div className="mx-auto max-w-[1420px] space-y-6 px-6 py-7 lg:px-8">
        <section className="nqs-ua-hero">
          <Link
            to="/dashboard/user"
            className="nqs-ua-back-btn mb-5 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-black"
          >
            ← Back to Appointments
          </Link>

          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-lg text-blue-700">
              <FaUserPlus />
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#06194A]">{citizenSnapshot.name}</h1>
              <p className="mt-1 text-sm font-semibold text-[#41617f]">Citizen appointment history - this citizen only.</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailInfoCard label="Full Name" value={citizenSnapshot.name} />
            <DetailInfoCard label="Phone" value={citizenSnapshot.phone} />
            <DetailInfoCard label="National ID" value={citizenSnapshot.nationalId} />
            <DetailInfoCard label="Service Type" value={citizenSnapshot.serviceType} />
            <DetailInfoCard label="Center" value={citizenSnapshot.center} />
            <DetailInfoCard label="Appointment Date & Time" value={citizenSnapshot.dateTime} />
            <DetailInfoCard label="Queue Number" value={citizenSnapshot.queueNumber} />
            <DetailInfoCard label="Current Status" value={citizenSnapshot.status} />
          </div>
        </section>

        <section className="nqs-ua-controls border-t pt-5">
          <div className="flex flex-wrap gap-2">
            {serviceFilterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeService === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveService(tab.key)}
                  className={`nqs-ua-service-tab ${isActive ? 'is-active' : ''}`}
                >
                  <Icon />
                  {tab.label}
                  {tab.key !== 'all' ? <span>({serviceCounts[tab.key]})</span> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {statusFilterCards.map((card) => (
              <StatusFilterCard
                key={card.key}
                card={card}
                value={statusCounts[card.key]}
                active={activeStatus === card.key}
                onClick={() => setActiveStatus(card.key)}
              />
            ))}
          </div>
        </section>

        <label className="nqs-ua-search relative block max-w-md">
          <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this citizen's appointments (request, service, center)"
            className="w-full rounded-md border py-3 pl-10 pr-3 text-sm font-semibold outline-none"
          />
        </label>

        <section className="nqs-ua-table-panel overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-black text-[#06194A]">
              {activeStatus === 'all'
                ? 'Total Appointments'
                : statusFilterCards.find((card) => card.key === activeStatus)?.label}
            </h2>
            <span className="nqs-ua-count-pill w-fit rounded-md border bg-white px-3 py-1.5 text-xs font-black">
              {filteredAppointments.length} appointment{filteredAppointments.length === 1 ? '' : 's'}
            </span>
          </div>

          {filteredAppointments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr>
                    {['Request', 'Full Name', 'Service', 'Center', 'Date & Time', 'Queue', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-xs font-black uppercase tracking-wide">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((ticket) => (
                    <tr key={ticket.id || ticket.ref}>
                      <td className="px-4 py-4 font-mono font-black text-blue-700">{ticket.ref}</td>
                      <td className="px-4 py-4 font-semibold">{ticket.citizenDisplayName}</td>
                      <td className="px-4 py-4">{shortServiceName(ticket)}</td>
                      <td className="px-4 py-4 font-semibold">
                        {ticket.centerName}
                        {getCenterDistrictFromTicket(ticket) ? (
                          <span className="block text-xs font-medium">{getCenterDistrictFromTicket(ticket)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {formatShortDate(ticket.appointmentDate)}
                        <span className="block text-xs">{ticket.appointmentTime || 'Not scheduled'}</span>
                      </td>
                      <td className="px-4 py-4 font-mono font-black">{ticket.queueNumber}</td>
                      <td className="px-4 py-4">
                        <span className={statusBadge(ticket.currentStatus)}>{ticket.currentStatus}</span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => openDetails(ticket)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <FaIdCard className="mx-auto text-4xl text-blue-200" />
              <h3 className="mt-4 text-xl font-black text-[#06194A]">No appointments found</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#41617f]">
                {bookings.length ? 'No appointments match the selected filters.' : 'Book a National ID service to receive your queue request.'}
              </p>
              {!bookings.length && (
                <Link to="/dashboard/user/new-id-registration" className="mt-5 inline-flex rounded-lg bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800">
                  Book Appointment
                </Link>
              )}
            </div>
          )}
        </section>

        {cancelledTickets.length > 0 && (
          <section className="space-y-4">
            {cancelledTickets.map((ticket) => (
              <article key={`feedback-${ticket.id || ticket.ref}`} className="rounded-md border border-red-100 bg-red-50/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-red-600">Cancelled request</p>
                    <p className="font-mono text-lg font-black text-[#06194A]">{ticket.ref}</p>
                    <p className="text-sm font-semibold text-[#41617f]">{shortServiceName(ticket)}</p>
                  </div>
                  <Link
                    to={getResubmitPath(ticket)}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
                  >
                    <FaRedo />
                    Resubmit
                  </Link>
                </div>
                <CitizenStaffFeedback ticket={ticket} forceShow />
              </article>
            ))}
          </section>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="My Queue Request" className="max-w-md border border-slate-200 bg-white">
        {selectedTicket && (
          <div className="space-y-4 p-2">
            <div className="text-center">
              {(selectedQrCodeUrl || qrCodes[selectedTicket.ref]) && (
                <img src={selectedQrCodeUrl || qrCodes[selectedTicket.ref]} alt={`QR Request ${selectedTicket.ref}`} className="mx-auto h-40 w-40 object-contain" />
              )}
              <p className="mt-2 font-mono text-xl font-black text-[#06194A]">{selectedTicket.ref}</p>
              <span className={statusBadge(selectedTicket.currentStatus)}>{selectedTicket.currentStatus}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <InfoItem label="Citizen Name" value={selectedTicket.citizenDisplayName} />
              <InfoItem label="Request Reference" value={selectedTicket.ref} />
              <InfoItem label="Service" value={selectedTicket.serviceName} />
              <InfoItem label="Center" value={selectedTicket.centerName} />
              <InfoItem label="Date" value={formatDate(selectedTicket.appointmentDate)} />
              <InfoItem label="Time" value={selectedTicket.appointmentTime || 'Not scheduled'} />
              <InfoItem label="Queue Number" value={selectedTicket.queueNumber} />
              <InfoItem label="Current Status" value={selectedTicket.currentStatus} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to={`/dashboard/user/track?ref=${encodeURIComponent(selectedTicket.ref)}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-black text-white hover:bg-blue-800"
              >
                <FaRoute /> Track Queue
              </Link>
              <ActionButton onClick={() => handleDownloadTicket(selectedTicket)} className="nqs-outline-action border border-blue-200 bg-white px-3 py-2.5 text-blue-700">
                <FaDownload /> Download
              </ActionButton>
              {canCitizenCancelTicket(selectedTicket) && (
                <ActionButton onClick={() => handleCancelAppointment(selectedTicket)} className="nqs-danger-outline col-span-2 border border-red-200 bg-white text-red-600">
                  <FaTimesCircle /> Cancel Appointment ({formatCancelWindowRemaining(selectedTicket)} left)
                </ActionButton>
              )}
              {selectedTicket.currentStatus === 'Cancelled' && (
                <Link
                  to={getResubmitPath(selectedTicket)}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
                >
                  <FaRedo /> Resubmit Appointment
                </Link>
              )}
            </div>

            {selectedTicket.currentStatus === 'Cancelled' && (
              <CitizenStaffFeedback ticket={selectedTicket} forceShow />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserAppointments;
