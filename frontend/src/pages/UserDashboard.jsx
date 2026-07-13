import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentList,
  HiOutlineEye,
  HiOutlinePlus,
  HiOutlineTicket,
} from 'react-icons/hi2';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';
import DataTable from '../components/ui/DataTable';

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

const formatDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatMogadishuTime = () => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Mogadishu',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const getCitizenNameFromTicket = (ticket) => (
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizenName
);

const CURRENT_STATUSES = new Set(['Pending', 'Scheduled', 'Waiting', 'On Hold', 'Now Serving', 'Resubmitted']);
const HISTORY_STATUSES = new Set(['Completed', 'Cancelled', 'Expired']);

const normalizeStatus = (status) => {
  const value = String(status || 'Pending').trim().toLowerCase();
  if (value === 'approved' || value === 'confirmed') return 'Scheduled';
  if (value === 'being served' || value === 'serving' || value === 'now serving') return 'Now Serving';
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
  citizenDisplayName: getCitizenNameFromTicket(ticket) || 'Citizen',
  serviceName: asName(ticket.service, ticket.serviceName || requestTypeLabels[ticket.requestType] || 'National ID Service'),
  centerName: asName(ticket.center, ticket.centerName || 'Not assigned'),
  centerAddress: ticket.center?.address || ticket.centerAddress || 'Banaadir, Mogadishu',
  centerPhone: ticket.center?.phone || ticket.centerPhone || '+252 61 000 1000',
  appointmentDate: ticket.date || ticket.appointmentDate,
  appointmentTime: ticket.timeSlot || ticket.time || ticket.appointmentTime,
  currentStatus: normalizeStatus(ticket.status || ticket.requestStatus),
});

const pickActiveAppointment = (tickets) => {
  return tickets.find((ticket) => CURRENT_STATUSES.has(ticket.currentStatus)) || null;
};

const queueNumberOf = (ticket, trackData) => {
  if (!ticket) return '--';
  if (ticket.queueNumber) return ticket.queueNumber;
  if (ticket.queueNo) return ticket.queueNo;
  if (trackData?.queueNumber) return trackData.queueNumber;
  if (trackData?.position) return `A-${trackData.position}`;
  const suffix = ticket.ref?.split('-').pop();
  return suffix ? `A-${suffix.slice(-3)}` : '--';
};

const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">{value || 'Not available'}</p>
  </div>
);

const statusBadge = (status = 'Pending') => {
  const base = 'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-black';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  if (status === 'Now Serving') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`;
  if (status === 'Cancelled' || status === 'Expired') return `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`;
  if (status === 'On Hold') return `${base} bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300`;
  if (status === 'Scheduled') return `${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300`;
  if (status === 'Resubmitted') return `${base} bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
};

const sortByAppointmentDate = (appointments) => [...appointments].sort((a, b) => {
  const aKey = `${a.appointmentDate || ''} ${a.appointmentTime || ''} ${a.createdAt || ''}`;
  const bKey = `${b.appointmentDate || ''} ${b.appointmentTime || ''} ${b.createdAt || ''}`;
  return bKey.localeCompare(aKey);
});

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1d355f] dark:bg-[#071a33]';

const UserDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeTicket = useMemo(() => pickActiveAppointment(bookings), [bookings]);
  const currentAppointments = useMemo(
    () => sortByAppointmentDate(bookings.filter((ticket) => CURRENT_STATUSES.has(ticket.currentStatus))).reverse(),
    [bookings]
  );
  const appointmentHistory = useMemo(
    () => sortByAppointmentDate(bookings.filter((ticket) => HISTORY_STATUSES.has(ticket.currentStatus))),
    [bookings]
  );
  const citizenName = user?.fullName || user?.name || user?.username || getCitizenNameFromTicket(activeTicket) || 'Citizen';

  const fetchDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      const bookingResponse = await api.get('/api/bookings/my');

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
      setRefreshing(false);
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

  const handleViewTicket = async (ticket = activeTicket) => {
    if (!ticket) return;
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const historyColumns = [
    {
      header: 'Ticket',
      accessor: 'ref',
      render: (row) => <span className="whitespace-nowrap font-mono font-black text-blue-700 dark:text-blue-300">{row.ref}</span>,
    },
    {
      header: 'Service',
      accessor: 'serviceName',
      render: (row) => <span className="font-semibold">{row.serviceName}</span>,
    },
    { header: 'Center', accessor: 'centerName' },
    {
      header: 'Appointment',
      accessor: 'appointmentDate',
      sortValue: (row) => row.appointmentDate || '',
      render: (row) => (
        <span className="whitespace-nowrap">
          {formatDate(row.appointmentDate)}
          {row.appointmentTime ? <span className="block text-xs text-slate-500 dark:text-slate-400">{row.appointmentTime}</span> : null}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'currentStatus',
      render: (row) => <span className={statusBadge(row.currentStatus)}>{row.currentStatus}</span>,
    },
    {
      header: 'Actions',
      accessor: '_actions',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleViewTicket(row); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/40"
        >
          <HiOutlineEye className="h-3.5 w-3.5" /> Details
        </button>
      ),
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4">
      {/* Welcome banner */}
      <section className="nqs-portal-hero relative overflow-hidden rounded-2xl bg-[#082A55] bg-gradient-to-br from-[#082A55] to-[#0B3A75] p-6 text-white shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Citizen Portal</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Welcome, {citizenName}
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              Track your queue, manage appointments, and apply for National ID services.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-blue-100 backdrop-blur">
            {refreshing ? 'Updating…' : `Mogadishu time ${formatMogadishuTime()}`}
          </div>
        </div>
      </section>

      {/* Current appointment */}
      <section className={cardClass}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <HiOutlineClipboardDocumentList className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            Current Appointment
          </h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            {currentAppointments.length} record{currentAppointments.length === 1 ? '' : 's'}
          </span>
        </div>

        {currentAppointments.length ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {currentAppointments.map((ticket) => (
              <article key={ticket.id || ticket.ref} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#1d355f] dark:bg-[#061225]/60">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <HiOutlineTicket className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Ticket Reference</p>
                      <p className="font-mono text-xl font-black text-blue-700 dark:text-blue-300">{ticket.ref}</p>
                    </div>
                  </div>
                  <span className={statusBadge(ticket.currentStatus)}>{ticket.currentStatus}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoItem label="Citizen Name" value={ticket.citizenDisplayName || citizenName} />
                  <InfoItem label="Service Type" value={ticket.serviceName} />
                  <InfoItem label="Center" value={ticket.centerName} />
                  <InfoItem label="Appointment Date" value={formatDate(ticket.appointmentDate)} />
                  <InfoItem label="Appointment Time" value={ticket.appointmentTime || 'Not scheduled'} />
                  <InfoItem label="Queue Number" value={queueNumberOf(ticket, ticket.ref === activeTicket?.ref ? trackData : null)} />
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => handleViewTicket(ticket)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 sm:w-auto"
                  >
                    <HiOutlineEye className="h-4 w-4" />
                    View Details
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center dark:border-blue-500/30 dark:bg-blue-500/5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md shadow-blue-900/20">
              <HiOutlineCalendarDays className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">No Active Appointment</h3>
            <p className="mx-auto mt-3 max-w-lg text-base font-semibold text-slate-700 dark:text-slate-300">
              You do not have any active National ID appointment.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Book your appointment to receive your queue number and appointment schedule.
            </p>
            <Link
              to="/dashboard/user/services"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3.5 text-base font-black text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <HiOutlinePlus className="h-5 w-5" />
              Book Appointment
            </Link>
          </div>
        )}
      </section>

      {/* Appointment history */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Appointment History</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-slate-300">
            {appointmentHistory.length} record{appointmentHistory.length === 1 ? '' : 's'}
          </span>
        </div>
        <DataTable
          columns={historyColumns}
          data={appointmentHistory}
          searchPlaceholder="Search by ticket, service, or center..."
          emptyTitle="No past appointments yet"
          emptyText="Completed, cancelled, and expired appointments will appear here permanently."
        />
      </section>

      {/* Details modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Appointment Details"
        className="max-w-2xl border border-slate-200 bg-white dark:border-[#1d355f] dark:bg-[#071a33]"
      >
        {selectedTicket && (
          <div className="space-y-5 p-2">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">Reference Number</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-2xl font-black text-slate-900 dark:text-white">{selectedTicket.ref}</p>
                <span className={statusBadge(selectedTicket.currentStatus)}>{selectedTicket.currentStatus}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
              <InfoItem label="Citizen Name" value={selectedTicket.citizenDisplayName || citizenName} />
              <InfoItem label="Ticket Reference" value={selectedTicket.ref} />
              <InfoItem label="Service Type" value={selectedTicket.serviceName} />
              <InfoItem label="Center" value={selectedTicket.centerName} />
              <InfoItem label="Appointment Date" value={formatDate(selectedTicket.appointmentDate)} />
              <InfoItem label="Appointment Time" value={selectedTicket.appointmentTime || 'Not scheduled'} />
              <InfoItem label="Queue Number" value={queueNumberOf(selectedTicket, selectedTicket.ref === activeTicket?.ref ? trackData : null)} />
              <InfoItem label="Appointment Status" value={selectedTicket.currentStatus} />
              <InfoItem label="Center Address" value={selectedTicket.centerAddress} />
              <InfoItem label="Center Phone" value={selectedTicket.centerPhone} />
            </div>
            {selectedTicket.currentStatus === 'Cancelled' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <p className="text-xs font-black uppercase tracking-wide text-red-600 dark:text-red-300">Cancellation Reason</p>
                <p className="mt-1 text-sm font-semibold">
                  {selectedTicket.cancellationReason || 'No cancellation reason was provided.'}
                </p>
              </div>
            )}
            {selectedTicket.currentStatus === 'Completed' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Completion Date</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(selectedTicket.completedAt)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserDashboard;
