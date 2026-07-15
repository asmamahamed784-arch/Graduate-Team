import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaClipboardList,
  FaPhoneAlt,
  FaShieldAlt,
  FaSyncAlt,
  FaUserCircle,
} from 'react-icons/fa';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks/useAuth';
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

const formatIssuedDate = (value) => {
  if (!value) return 'Not issued yet';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Not issued yet';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

const formatAccountStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'active') return 'Active';
  if (normalized === 'inactive') return 'Inactive';
  return 'Active';
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

const CURRENT_STATUSES = new Set(['Pending', 'Scheduled', 'Waiting', 'On Hold', 'Now Serving', 'In Progress', 'Resubmitted']);

const normalizeStatus = (status) => {
  const value = String(status || 'Pending').trim().toLowerCase();
  if (value === 'approved' || value === 'confirmed') return 'Scheduled';
  if (value === 'being served' || value === 'serving' || value === 'now serving') return 'Now Serving';
  if (value === 'in progress' || value === 'under review') return 'In Progress';
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

const normalizeNationalIdProcessStatus = (value) => {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'ACTIVE') return 'COMPLETED';
  if (status === 'PENDING') return 'WAITING';
  if (status === 'NOT_ISSUED') return 'NOT_STARTED';
  if (status === 'BEING SERVED' || status === 'IN PROGRESS') return 'UNDER_REVIEW';
  if (status === 'SCHEDULED') return 'WAITING';
  if (status === 'CANCELED') return 'CANCELLED';
  return status || 'NOT_STARTED';
};

const formatNationalIdProcessStatus = (status) => {
  const normalized = normalizeNationalIdProcessStatus(status);
  const labels = {
    NOT_STARTED: 'Not Started',
    WAITING: 'Waiting',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    SUSPENDED: 'Suspended',
    EXPIRED: 'Expired',
    DECEASED: 'Deceased',
  };
  return labels[normalized] || 'Not Started';
};

const nationalIdStatusBadge = (status) => {
  const normalized = normalizeNationalIdProcessStatus(status);
  const base = 'inline-flex w-fit rounded-full px-3 py-1 text-xs font-black';
  if (normalized === 'COMPLETED' || normalized === 'APPROVED') return `${base} bg-emerald-100 text-emerald-700`;
  if (normalized === 'REJECTED' || normalized === 'CANCELLED') return `${base} bg-red-100 text-red-700`;
  if (normalized === 'WAITING' || normalized === 'UNDER_REVIEW') return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-slate-100 text-slate-600`;
};

const getCancellationReasonList = (item = {}) => {
  const reasons = Array.isArray(item.cancellationReasons) ? item.cancellationReasons : [];
  const additional = String(item.additionalCancellationReason || '').trim();
  const filtered = reasons
    .filter((reason) => reason && reason !== 'Other')
    .concat(reasons.includes('Other') && additional ? [additional] : []);

  if (filtered.length) return filtered;
  return item.cancellationReason ? [item.cancellationReason] : [];
};

const StatCard = ({ icon, label, value, helper, tone = 'blue', to, onClick }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-indigo-50 text-indigo-700',
  };

  const className = 'min-w-0 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const content = (
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${tones[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight text-slate-600">{label}</p>
          <p className="mt-1 text-2xl font-black leading-none text-[#06194A]">{value}</p>
          <p className="mt-1 text-xs leading-snug text-slate-500">{helper}</p>
        </div>
      </div>
  );

  if (to) {
    return <Link to={to} className={className}>{content}</Link>;
  }

  if (onClick) {
    return <button type="button" onClick={onClick} className={className}>{content}</button>;
  }

  return <section className={className}>{content}</section>;
};

const ModalDetail = ({ label, value, wide = false, to, onClick }) => {
  const className = `rounded-2xl border border-slate-200 bg-[#f1f8ff] p-4 text-left transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${wide ? 'sm:col-span-2' : ''}`;
  const content = (
    <>
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-[#06194A]">{value || 'Not available'}</p>
    </>
  );

  if (to) {
    return <Link to={to} className={className}>{content}</Link>;
  }

  if (onClick) {
    return <button type="button" onClick={onClick} className={className}>{content}</button>;
  }

  return <div className={className}>{content}</div>;
};

const UserDashboard = () => {
  const { user, loading: authLoading } = useAuth();
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
  const stats = useMemo(() => {
    const completed = bookings.filter((ticket) => ticket.currentStatus === 'Completed').length;
    const pending = bookings.filter((ticket) => CURRENT_STATUSES.has(ticket.currentStatus)).length;
    const rejected = bookings.filter((ticket) => ['Rejected', 'Cancelled', 'Expired'].includes(ticket.currentStatus)).length;
    const replacements = bookings.filter((ticket) => ['lost_replacement', 'replace_lost_id'].includes(ticket.requestType)).length;

    return {
      total: bookings.length,
      completed,
      pending,
      rejected,
      active: dashboardTicket ? 1 : 0,
      replacements,
    };
  }, [bookings, dashboardTicket]);

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
  const hasIssuedNationalId = Boolean(citizenSummary.nationalIdNumber || citizen.nationalId || ['ACTIVE', 'COMPLETED'].includes(citizen.nationalIdStatus));
  const profileProcessStatus = normalizeNationalIdProcessStatus(citizenSummary.nationalIdStatus || citizen.nationalIdStatus);
  const nationalIdStatus = hasIssuedNationalId
    ? 'COMPLETED'
    : stats.pending && profileProcessStatus === 'NOT_STARTED'
      ? 'WAITING'
      : profileProcessStatus;
  const nationalIdNumber = citizenSummary.nationalIdNumber || citizen.nationalId || 'Not issued yet';
  const issueDate = citizenSummary.issueDate || citizen.cardIssueDate;
  const expiryDate = citizenSummary.expiryDate || citizen.cardExpiryDate;
  const currentCenter = citizenSummary.centerName
    || dashboardTicket?.centerName
    || citizen.center?.name
    || citizenSummary.districtName
    || citizen.district
    || 'Not selected';
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

  return (
    <div className="nqs-citizen-portal min-h-screen bg-[#eef5ff] text-[#06194A]">
      <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-100">
                <FaUserCircle className="text-5xl" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Welcome back,</p>
                <h1 className="text-3xl font-black leading-tight text-[#06194A]">{citizenName}</h1>
                <p className="mt-1 text-base font-semibold text-slate-600">Citizen Dashboard</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[190px_1fr] md:items-center">
              <div className="hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 shadow-inner md:block">
                <div className="rounded-lg border border-blue-200 bg-white/80 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-700 text-xs font-black text-white">NQS</span>
                    <span className="text-xs font-black text-blue-900">NQS National ID</span>
                  </div>
                  <div className="mt-3 grid grid-cols-[40px_1fr] gap-2">
                    <span className="h-10 rounded-md bg-blue-100" />
                    <span className="space-y-1.5">
                      <span className="block h-2 rounded bg-blue-100" />
                      <span className="block h-2 rounded bg-blue-100" />
                      <span className="block h-2 w-2/3 rounded bg-blue-100" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 border-l border-slate-200 pl-0 md:pl-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white">
                  <FaShieldAlt className="text-2xl" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#06194A]">Your Identity, Our Priority</h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                    Manage your National ID requests, appointments, and queue status from one place.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
                <FaUserCircle />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Citizen Summary</p>
                <h2 className="text-xl font-black text-[#06194A]">Account and National ID overview</h2>
              </div>
            </div>
            <span className={nationalIdStatusBadge(nationalIdStatus)}>
              {formatNationalIdProcessStatus(nationalIdStatus)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ModalDetail label="Full Name" value={citizenName} to="/profile" />
            <ModalDetail label="National ID Number" value={nationalIdNumber} to="/profile" />
            <ModalDetail
              label="National ID Status"
              to="/dashboard/user/appointments"
              value={(
                <span className={nationalIdStatusBadge(nationalIdStatus)}>
                  {formatNationalIdProcessStatus(nationalIdStatus)}
                </span>
              )}
            />
            <ModalDetail label="Marital Status" value={formatMaritalStatus(citizenSummary.maritalStatus || citizen.maritalStatus || activeTicket?.registrationDetails?.maritalStatus)} to="/profile" />
            <ModalDetail label="Account Status" value={formatAccountStatus(citizenSummary.accountStatus || citizen.status)} to="/profile" />
            <ModalDetail label="Registration Date" value={formatIssuedDate(citizenSummary.registrationDate || citizen.createdAt)} to="/profile" />
            <ModalDetail label="Issue Date" value={formatIssuedDate(issueDate)} to="/profile" />
            <ModalDetail label="Expiry Date" value={formatIssuedDate(expiryDate)} to="/profile" />
            <ModalDetail label="District / Center" value={currentCenter} to="/centers" />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard icon={<FaClipboardList />} label="Total Requests" value={stats.total} helper="All time" to="/dashboard/user/appointments" />
          <StatCard icon={<FaCheckCircle />} label="Completed Requests" value={stats.completed} helper="All time" tone="green" to="/dashboard/user/appointments?status=Completed" />
          <StatCard icon={<FaClock />} label="Pending Requests" value={stats.pending} helper="Awaiting action" tone="amber" to="/dashboard/user/appointments?status=Pending" />
          <StatCard icon={<FaShieldAlt />} label="Rejected Requests" value={stats.rejected} helper="Needs attention" tone="amber" to="/dashboard/user/appointments?status=Cancelled" />
          <StatCard
            icon={<FaCalendarAlt />}
            label="Active Appointment"
            value={stats.active}
            helper={dashboardTicket ? dashboardTicket.ref : 'No active appointment'}
            tone="purple"
            to={dashboardTicket ? undefined : '/dashboard/user/appointments'}
            onClick={dashboardTicket ? () => handleViewTicket(dashboardTicket) : undefined}
          />
          <StatCard icon={<FaSyncAlt />} label="Replacement Requests" value={stats.replacements} helper="Lost ID requests" tone="blue" to="/dashboard/user/appointments?type=replace_lost_id" />
        </section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="NQ Ticket Details"
        className="max-w-4xl overflow-hidden border border-slate-200 bg-white"
      >
        {selectedTicket && (
          <div className="space-y-5 p-1">
            <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-[#0B3A75] to-[#2563eb] p-5 text-white">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-100">National ID Appointment Ticket</p>
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
              <ModalDetail label="Ticket Reference" value={selectedTicket.ref} />
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
                  <FaPhoneAlt />
                </div>
                <div>
                  <h3 className="font-black text-[#0B3A75]">Important information</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Bring your original documents and arrive 15 minutes before your appointment. Show this ticket reference or QR code at the selected center.
                  </p>
                </div>
              </div>
            </div>

            {selectedTicket.currentStatus === 'Cancelled' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
                <p className="text-xs font-black uppercase tracking-wide text-red-600">Cancellation Reasons</p>
                {getCancellationReasonList(selectedTicket).length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getCancellationReasonList(selectedTicket).map((reason) => (
                      <span key={reason} className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-700">
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-semibold">No cancellation reason was provided.</p>
                )}
                {selectedTicket.cancelledAt && (
                  <p className="mt-3 text-sm font-semibold">Cancelled on {formatLongDate(selectedTicket.cancelledAt)}</p>
                )}
                {selectedTicket.cancellationNotes && (
                  <p className="mt-2 text-sm font-semibold">Admin note: {selectedTicket.cancellationNotes}</p>
                )}
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
