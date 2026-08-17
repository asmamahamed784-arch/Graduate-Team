import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import {
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFlag,
  FiGrid,
  FiHash,
  FiMapPin,
  FiPhoneCall,
  FiRefreshCw,
  FiUserCheck,
  FiUsers,
  FiVolume2,
  FiChevronRight,
} from 'react-icons/fi';
import { FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import { timeAgo } from '../dashboard/admin/AdminDashboardParts';
import CitizenStaffFeedback from '../components/CitizenStaffFeedback';
import Modal from '../components/Modal';

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

const formatLongDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatMaritalStatus = (value) => {
  if (value === 'SINGLE') return 'Single';
  if (value === 'MARRIED') return 'Married';
  return 'Not recorded';
};

const buildFullName = (...values) => values
  .flat()
  .map((value) => String(value || '').trim())
  .filter(Boolean)
  .join(' ');

const getCitizenNameFromTicket = (ticket) => (
  ticket?.registrationDetails?.fullName ||
  ticket?.replacementDetails?.fullName ||
  ticket?.updateDetails?.fullName ||
  ticket?.citizenName
);

const CURRENT_STATUSES = new Set(['Pending', 'Scheduled', 'Waiting', 'On Hold', 'Now Serving', 'Resubmitted']);

const normalizeStatus = (status) => {
  const value = String(status || 'Pending').trim().toLowerCase();
  if (value === 'approved' || value === 'confirmed') return 'Scheduled';
  if (value === 'being served' || value === 'serving' || value === 'now serving') return 'Now Serving';
  if (value === 'in progress') return 'Now Serving';
  if (value === 'under review') return 'Waiting';
  if (value === 'on hold' || value === 'hold') return 'On Hold';
  if (value === 'cancelled' || value === 'canceled' || value === 'rejected') return 'Cancelled';
  if (value === 'completed' || value === 'complete') return 'Completed';
  if (value === 'expired') return 'Expired';
  if (value === 'resubmitted' || value === 'resubmission required') return 'Resubmitted';
  if (value === 'scheduled') return 'Scheduled';
  if (value === 'waiting') return 'Waiting';
  return 'Pending';
};

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: ticket._id || ticket.id,
  ref: ticket.ref || ticket.reference || ticket.ticketNumber || 'No reference',
  citizenDisplayName: getCitizenNameFromTicket(ticket) || ticket.citizen?.name || ticket.citizen?.fullName || 'Citizen',
  serviceName: asName(ticket.service, ticket.serviceName || requestTypeLabels[ticket.requestType] || 'National ID Service'),
  centerName: asName(ticket.center, ticket.centerName || 'Not assigned'),
  centerAddress: ticket.center?.address || ticket.centerAddress || 'Banaadir, Mogadishu',
  centerPhone: ticket.center?.phone || ticket.centerPhone || '+252 61 000 1000',
  district: ticket.district || ticket.registrationDetails?.district || ticket.replacementDetails?.district || ticket.center?.district || '',
  citizenPhone: ticket.registrationDetails?.phone || ticket.replacementDetails?.phone || ticket.updateDetails?.phone || ticket.citizen?.phone || 'Not available',
  appointmentDate: ticket.date || ticket.appointmentDate,
  appointmentTime: ticket.timeSlot || ticket.time || ticket.appointmentTime,
  nationalIdNumber: ticket.nationalIdNumber || ticket.replacementDetails?.nationalIdNumber || ticket.updateDetails?.nationalIdNumber || '',
  cardSerialNumber: ticket.cardSerialNumber || '',
  currentStatus: normalizeStatus(ticket.status || ticket.requestStatus),
});

const pickActiveAppointment = (tickets) => (
  tickets.find((ticket) => CURRENT_STATUSES.has(ticket.currentStatus)) || null
);

const queueNumberOf = (ticket, trackData) => {
  if (!ticket) return '--';
  if (ticket.queueNumber) return ticket.queueNumber;
  if (ticket.queueNo) return ticket.queueNo;
  if (trackData?.queueNumber) return trackData.queueNumber;
  if (trackData?.position) return `A-${trackData.position}`;
  const suffix = ticket.ref?.split('-').pop();
  return suffix ? `A-${suffix.slice(-3)}` : '--';
};

const sortByAppointmentDate = (appointments) => [...appointments].sort((a, b) => {
  const aKey = `${a.appointmentDate || ''} ${a.appointmentTime || ''} ${a.createdAt || ''}`;
  const bKey = `${b.appointmentDate || ''} ${b.appointmentTime || ''} ${b.createdAt || ''}`;
  return bKey.localeCompare(aKey);
});

const getResubmitPath = (ticket) => {
  const type = ticket?.requestType || ticket?.type;
  const id = encodeURIComponent(ticket?.id || ticket?._id || '');
  if (type === 'update_information') return `/dashboard/user/update-information?resubmit=${id}`;
  if (type === 'replace_lost_id' || type === 'lost_replacement') return `/dashboard/user/replace-lost-id?resubmit=${id}`;
  return `/dashboard/user/new-id-registration?resubmit=${id}`;
};

// Real backend states only (no fabricated "Confirmed"/"Checked In" steps —
// the Ticket model has no such statuses). Mirrors TrackQueue.jsx's stepper.
const appointmentSteps = [
  { key: 'booked', label: 'Booked', icon: FiCheckCircle },
  { key: 'waiting', label: 'Waiting', icon: FiUsers },
  { key: 'serving', label: 'Serving', icon: FiVolume2 },
  { key: 'completed', label: 'Completed', icon: FiFlag },
];

const appointmentStepKey = (status) => {
  if (status === 'Completed') return 'completed';
  if (status === 'Now Serving') return 'serving';
  return 'waiting';
};

// The 5-stage visual queue progress (Waiting Area / People Ahead / In
// Progress / Almost Next / Your Turn) is derived from the real `position`
// value returned by /api/queue/track — it's a presentational bucketing of
// that number, not a separate backend state.
const queueProgressSteps = [
  { key: 'waiting_area', label: 'Waiting Area', icon: FiMapPin },
  { key: 'people_ahead', label: 'People Ahead', icon: FiUsers },
  { key: 'in_progress', label: 'In Progress', icon: FiUserCheck },
  { key: 'almost_next', label: 'Almost Next', icon: FiClock },
  { key: 'your_turn', label: 'Your Turn', icon: FiCheckCircle },
];

const queueProgressStepIndex = (ticket, trackData) => {
  if (!ticket) return -1;
  if (ticket.currentStatus === 'Completed' || ticket.currentStatus === 'Now Serving') return 4;
  const position = trackData ? Number(trackData.position || 0) : null;
  if (position === null || Number.isNaN(position)) return 0;
  if (position <= 0) return 4;
  if (position === 1) return 3;
  if (position <= 3) return 2;
  return 1;
};

const activityFor = (ticket) => {
  const events = [];
  if (ticket.createdAt) events.push({ label: 'Appointment booked', at: ticket.createdAt, icon: FiCalendar, tone: 'blue' });
  if (ticket.currentStatus === 'Completed' && ticket.completedAt) {
    events.push({ label: 'Appointment completed', at: ticket.completedAt, icon: FiCheckCircle, tone: 'green' });
  }
  if (ticket.currentStatus === 'Cancelled' && ticket.cancelledAt) {
    events.push({ label: 'Appointment cancelled', at: ticket.cancelledAt, icon: FaExclamationTriangle, tone: 'pink' });
  }
  return events;
};

const ticketStatusBadgeClass = (status) => {
  const base = 'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-black';
  if (status === 'Completed') return `${base} nqs-badge-tone-green`;
  if (['Cancelled', 'Rejected', 'Expired'].includes(status)) return `${base} nqs-badge-tone-pink`;
  if (['Now Serving', 'On Hold'].includes(status)) return `${base} nqs-badge-tone-orange`;
  return `${base} nqs-badge-tone-blue`;
};

// Sitewide soft-pastel card tone system (styles/nqs-theme-system.css).
const StatCard = ({ icon, label, value, helper, tone = 'blue', to, linkLabel }) => {
  const iconTones = {
    blue: 'nqs-card-tone-icon-blue',
    green: 'nqs-card-tone-icon-green',
    amber: 'nqs-card-tone-icon-orange',
    purple: 'nqs-card-tone-icon-purple',
  };
  const cardTones = {
    blue: 'nqs-card-tone-blue',
    green: 'nqs-card-tone-green',
    amber: 'nqs-card-tone-orange',
    purple: 'nqs-card-tone-purple',
  };

  return (
    <div className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-4 shadow-sm ${cardTones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${iconTones[tone]}`}>
          {icon}
        </div>
        <p className="pt-1 text-right text-xs font-bold leading-tight text-slate-600">{label}</p>
      </div>
      <div>
        <p className="text-2xl font-black leading-none text-[#06194A]">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
      </div>
      {to && (
        <Link to={to} className="mt-1 inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-800">
          {linkLabel}
          <FiChevronRight />
        </Link>
      )}
    </div>
  );
};

const ModalDetail = ({ label, value, wide = false }) => (
  <div className={`rounded-2xl border border-slate-200 bg-[#f1f8ff] p-4 text-left ${wide ? 'sm:col-span-2' : ''}`}>
    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-black text-[#06194A]">{value || 'Not available'}</p>
  </div>
);

const PanelHeader = ({ icon, title, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 text-sm font-black text-[#06194A]">
      <span className="text-blue-700">{icon}</span>
      {title}
    </div>
    {action}
  </div>
);

const UserDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { notifications } = useNotifications();
  const [bookings, setBookings] = useState([]);
  const [trackData, setTrackData] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeTicket = useMemo(() => pickActiveAppointment(bookings), [bookings]);
  const citizen = profileUser || user || {};
  const dashboardTicket = activeTicket;
  const recentRequests = useMemo(() => sortByAppointmentDate(bookings).slice(0, 5), [bookings]);
  const recentActivity = useMemo(
    () => recentRequests.flatMap(activityFor).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4),
    [recentRequests]
  );
  const cancelledForResubmission = useMemo(
    () => sortByAppointmentDate(bookings.filter((ticket) => (
      ticket.currentStatus === 'Cancelled'
    ))),
    [bookings]
  );
  const stats = useMemo(() => {
    const pending = bookings.filter((ticket) => CURRENT_STATUSES.has(ticket.currentStatus)).length;
    return { pending };
  }, [bookings]);

  const citizenSummary = citizen.citizenSummary || {};
  const nameFromParts = buildFullName(citizen.firstName, citizen.middleName, citizen.lastName);
  const profileName = citizenSummary.fullName || nameFromParts || citizen.fullName || citizen.name;
  const latestTicketName = getCitizenNameFromTicket(activeTicket) || getCitizenNameFromTicket(recentRequests[0]);
  const profileNameIsUsername = profileName && citizen.username
    && String(profileName).trim().toLowerCase() === String(citizen.username).trim().toLowerCase();
  const citizenName = (profileNameIsUsername ? latestTicketName : profileName)
    || latestTicketName
    || citizen.username
    || 'Citizen';

  const fetchDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const [profileResponse, bookingResponse] = await Promise.all([
        api.get('/api/auth/profile'),
        api.get('/api/bookings/my')
      ]);
      setProfileUser(getPayload(profileResponse));
      const ownBookings = safeArray(getPayload(bookingResponse)).map(normalizeTicket);
      setBookings(ownBookings);

      const active = pickActiveAppointment(ownBookings);
      if (active?.ref && active.currentStatus !== 'On Hold') {
        try {
          const trackResponse = await api.get(`/api/queue/track/${encodeURIComponent(active.ref)}`);
          setTrackData(trackResponse.data?.data || null);
        } catch {
          setTrackData(null);
        }
      } else {
        setTrackData(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    fetchDashboard(true);
    const intervalId = window.setInterval(() => {
      fetchDashboard(false);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [authLoading, fetchDashboard]);

  const handleViewTicket = (ticket = dashboardTicket) => {
    if (!ticket) return;
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef5ff]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  const queueStepIndex = queueProgressStepIndex(dashboardTicket, trackData);
  const recentNotifications = safeArray(notifications).slice(0, 4);

  return (
    <div className="nqs-citizen-portal min-h-screen bg-[#eef5ff] text-[#06194A]">
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<FiCalendar />}
            label="My Appointments"
            value={stats.pending}
            helper="Upcoming"
            tone="blue"
            to="/dashboard/user/my-appointments"
            linkLabel="View all appointments"
          />
          <StatCard
            icon={<FiUsers />}
            label="Queue Position"
            value={trackData ? (trackData.peopleAhead ?? 0) : '--'}
            helper="People ahead of you"
            tone="green"
            to="/dashboard/user/track"
            linkLabel="Track queue"
          />
          <StatCard
            icon={<FiClock />}
            label="Estimated Wait Time"
            value={trackData?.estimatedWait || '--'}
            helper="Approximate"
            tone="amber"
            to="/dashboard/user/track"
            linkLabel="View queue"
          />
          <StatCard
            icon={<FiHash />}
            label="My Ticket"
            value={dashboardTicket?.ref || '--'}
            helper={dashboardTicket?.currentStatus || 'No active ticket'}
            tone="purple"
            to={dashboardTicket ? `/dashboard/user/booking/ticket/${encodeURIComponent(dashboardTicket.ref)}` : '/dashboard/user/services'}
            linkLabel="View QR Ticket"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <PanelHeader icon={<FiCalendar />} title="Active Appointment" />
            {dashboardTicket ? (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
                      <FiCalendar />
                    </div>
                    <div>
                      <p className="text-base font-black text-[#06194A]">{dashboardTicket.serviceName}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <FiMapPin className="shrink-0" /> {dashboardTicket.centerName}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <FiCalendar className="shrink-0" /> {formatLongDate(dashboardTicket.appointmentDate)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <FiClock className="shrink-0" /> {dashboardTicket.appointmentTime || 'Not scheduled'}
                      </p>
                      <span className={`mt-2 ${ticketStatusBadgeClass(dashboardTicket.currentStatus)}`}>
                        {dashboardTicket.currentStatus}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewTicket(dashboardTicket)}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800"
                  >
                    View Appointment Details
                  </button>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <QRCodeSVG value={dashboardTicket.ref} size={96} level="M" includeMargin />
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ticket Number</p>
                    <p className="font-mono text-sm font-black text-[#06194A]">{dashboardTicket.ref}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm font-semibold text-slate-600">No active appointment right now.</p>
                <Link to="/dashboard/user/services" className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">
                  Book an Appointment
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <PanelHeader
              icon={<FiVolume2 />}
              title="Live Queue Status"
              action={dashboardTicket && trackData ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-black text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
                </span>
              ) : null}
            />
            {dashboardTicket && trackData ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500">My Ticket</p>
                    <p className="mt-1 font-mono text-sm font-black text-[#06194A]">{trackData.reference || dashboardTicket.ref}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500">Now Serving</p>
                    <p className="mt-1 font-mono text-sm font-black text-green-700">{trackData.nowServing?.reference || '--'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500">People Ahead</p>
                    <p className="mt-1 text-sm font-black text-[#06194A]">{trackData.peopleAhead ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-500">Estimated Wait</p>
                    <p className="mt-1 text-sm font-black text-[#06194A]">{trackData.estimatedWait || '--'}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Queue Progress</p>
                  <div className="flex items-start justify-between">
                    {queueProgressSteps.map((step, index) => {
                      const Icon = step.icon;
                      const isDone = index < queueStepIndex;
                      const isCurrent = index === queueStepIndex;
                      const circleClass = isDone
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 text-slate-400';
                      return (
                        <React.Fragment key={step.key}>
                          <div className="flex flex-col items-center gap-1.5 text-center">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${circleClass}`}>
                              {isDone ? <FiCheckCircle /> : isCurrent && step.key === 'people_ahead' ? trackData.peopleAhead ?? 0 : <Icon />}
                            </span>
                            <span className="max-w-[64px] text-[10px] font-bold leading-tight text-slate-600">{step.label}</span>
                          </div>
                          {index < queueProgressSteps.length - 1 && (
                            <span className={`mt-4 h-0.5 flex-1 ${index < queueStepIndex ? 'bg-green-400' : 'bg-slate-200'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <Link
                  to="/dashboard/user/track"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-100"
                >
                  Track Live Queue
                </Link>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm font-semibold text-slate-600">No live queue activity right now.</p>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <PanelHeader icon={<FiGrid />} title="Quick Actions" />
            <div className="grid grid-cols-2 gap-3">
              <Link to="/dashboard/user/services" className="flex flex-col items-start gap-2 rounded-xl border p-3 nqs-card-tone-blue hover:-translate-y-0.5 hover:shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg nqs-card-tone-icon-blue"><FiCalendar /></span>
                <span className="text-sm font-black text-[#06194A]">Book Appointment</span>
                <span className="text-[11px] text-slate-500">Schedule a new appointment</span>
              </Link>
              <Link to="/dashboard/user/track" className="flex flex-col items-start gap-2 rounded-xl border p-3 nqs-card-tone-green hover:-translate-y-0.5 hover:shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg nqs-card-tone-icon-green"><FiUsers /></span>
                <span className="text-sm font-black text-[#06194A]">Track Queue</span>
                <span className="text-[11px] text-slate-500">Check real-time queue status</span>
              </Link>
              {dashboardTicket ? (
                <button
                  type="button"
                  onClick={() => handleViewTicket(dashboardTicket)}
                  className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left nqs-card-tone-purple hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg nqs-card-tone-icon-purple"><FiGrid /></span>
                  <span className="text-sm font-black text-[#06194A]">My QR Ticket</span>
                  <span className="text-[11px] text-slate-500">View and download your QR ticket</span>
                </button>
              ) : (
                <Link to="/dashboard/user/services" className="flex flex-col items-start gap-2 rounded-xl border p-3 nqs-card-tone-purple hover:-translate-y-0.5 hover:shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg nqs-card-tone-icon-purple"><FiGrid /></span>
                  <span className="text-sm font-black text-[#06194A]">My QR Ticket</span>
                  <span className="text-[11px] text-slate-500">View and download your QR ticket</span>
                </Link>
              )}
              <Link to="/dashboard/user/my-appointments" className="flex flex-col items-start gap-2 rounded-xl border p-3 nqs-card-tone-orange hover:-translate-y-0.5 hover:shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg nqs-card-tone-icon-orange"><FiRefreshCw /></span>
                <span className="text-sm font-black text-[#06194A]">Reschedule / Cancel</span>
                <span className="text-[11px] text-slate-500">Reschedule or cancel your appointment</span>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <PanelHeader icon={<FiFlag />} title="Appointment Status" />
            {dashboardTicket ? (
              <ol className="space-y-4">
                {appointmentSteps.map((step, index) => {
                  const currentIndex = appointmentSteps.findIndex((s) => s.key === appointmentStepKey(dashboardTicket.currentStatus));
                  const isDone = index < currentIndex;
                  const isCurrent = index === currentIndex;
                  const Icon = step.icon;
                  return (
                    <li key={step.key} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                        isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                      >
                        {isDone ? <FiCheckCircle /> : <Icon />}
                      </span>
                      <span className={`text-sm font-bold ${isCurrent ? 'text-[#06194A]' : 'text-slate-500'}`}>{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm font-semibold text-slate-600">No appointment to track yet.</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <PanelHeader
                icon={<FiClock />}
                title="Recent Activity"
                action={<Link to="/dashboard/user/my-appointments" className="text-xs font-black text-blue-700">View all</Link>}
              />
              {recentActivity.length === 0 ? (
                <p className="text-sm font-semibold text-slate-600">No recent activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map((event, index) => {
                    const Icon = event.icon;
                    return (
                      <li key={`${event.label}-${index}`} className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm nqs-card-tone-icon-${event.tone}`}>
                          <Icon />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#06194A]">{event.label}</p>
                          <p className="text-[11px] text-slate-500">{timeAgo(event.at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <PanelHeader
                icon={<FiBell />}
                title="Notifications"
                action={<Link to="/notifications" className="text-xs font-black text-blue-700">View all</Link>}
              />
              {recentNotifications.length === 0 ? (
                <p className="text-sm font-semibold text-slate-600">No notifications yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recentNotifications.map((notification) => (
                    <li key={notification.id || notification._id} className="flex items-start gap-3">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-slate-300' : 'bg-blue-600'}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#06194A]">{notification.title || 'Notification'}</p>
                        <p className="truncate text-[11px] text-slate-500">{notification.desc || ''}</p>
                        <p className="text-[10px] text-slate-400">{timeAgo(notification.timestamp)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {cancelledForResubmission.length > 0 && (
          <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FaExclamationTriangle />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Action Required</p>
                  <h2 className="text-xl font-black text-[#06194A]">Correct and resubmit your appointment</h2>
                </div>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                {cancelledForResubmission.length} needs correction
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {cancelledForResubmission.map((ticket) => (
                  <article key={ticket.id || ticket.ref} className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-red-600">Cancelled request</p>
                        <p className="mt-1 font-mono text-xl font-black text-[#06194A]">{ticket.ref}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{ticket.serviceName}</p>
                      </div>
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Cancelled</span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <ModalDetail label="Citizen Name" value={ticket.citizenDisplayName || citizenName} />
                      <ModalDetail label="Center" value={ticket.centerName} />
                      <ModalDetail label="Appointment Date" value={formatLongDate(ticket.appointmentDate)} />
                      <ModalDetail label="Appointment Time" value={ticket.appointmentTime || 'Not scheduled'} />
                    </div>

                    <div className="mt-4">
                      <CitizenStaffFeedback
                        ticket={ticket}
                        title="Admin / operator feedback"
                        forceShow
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleViewTicket(ticket)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"
                      >
                        View Details
                      </button>
                      <Link
                        to={getResubmitPath(ticket)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700"
                      >
                        <FaRedo />
                        Resubmit Appointment
                      </Link>
                    </div>
                  </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="NQ Request Details"
        className="max-w-4xl overflow-hidden border border-slate-200 bg-white"
      >
        {selectedTicket && (
          <div className="space-y-5 p-1">
            <div className="rounded-3xl border border-blue-100 bg-[#0B3A75] p-5 text-white">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-100">National ID Appointment Request</p>
                  <p className="mt-3 font-mono text-3xl font-black text-white sm:text-4xl">{selectedTicket.ref}</p>
                  <p className="mt-2 text-sm font-semibold text-blue-100">
                    {selectedTicket.citizenDisplayName || citizenName}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <QRCodeSVG value={selectedTicket.ref} size={132} level="M" includeMargin />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
              <ModalDetail label="Citizen Name" value={selectedTicket.citizenDisplayName || citizenName} />
              <ModalDetail label="Phone Number" value={selectedTicket.citizenPhone} />
              <ModalDetail label="Marital Status" value={formatMaritalStatus(selectedTicket.registrationDetails?.maritalStatus || citizen.maritalStatus)} />
              <ModalDetail label="National ID Number" value={selectedTicket.nationalIdNumber || citizen.nationalId || 'Not issued yet'} />
              <ModalDetail label="Request Reference" value={selectedTicket.ref} />
              <ModalDetail label="Queue Number" value={queueNumberOf(selectedTicket, selectedTicket.ref === activeTicket?.ref ? trackData : null)} />
              <ModalDetail label="Service Type" value={selectedTicket.serviceName} />
              <ModalDetail label="Appointment Status" value={selectedTicket.currentStatus} />
              <ModalDetail label="Appointment Date" value={formatLongDate(selectedTicket.appointmentDate)} />
              <ModalDetail label="Appointment Time" value={selectedTicket.appointmentTime || 'Not scheduled'} />
              <ModalDetail label="Center Name" value={selectedTicket.centerName} />
              <ModalDetail label="Center Phone" value={selectedTicket.centerPhone} />
              <ModalDetail label="Center Address" value={selectedTicket.centerAddress} wide />
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white">
                  <FiPhoneCall />
                </div>
                <div>
                  <h3 className="font-black text-[#0B3A75]">Important information</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Bring your original documents and arrive 15 minutes before your appointment. Show this request reference or QR code at the selected center.
                  </p>
                </div>
              </div>
            </div>

            {selectedTicket.currentStatus === 'Cancelled' && (
              <div className="space-y-3">
                {selectedTicket.cancelledAt && (
                  <p className="text-sm font-semibold text-slate-700">
                    Cancelled on {formatLongDate(selectedTicket.cancelledAt)}
                  </p>
                )}
                <CitizenStaffFeedback ticket={selectedTicket} />
              </div>
            )}
            {selectedTicket.currentStatus === 'Completed' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Completion Date</p>
                <p className="mt-1 text-sm font-semibold">{formatLongDate(selectedTicket.completedAt)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserDashboard;
