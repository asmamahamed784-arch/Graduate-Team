import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaCalendarAlt,
  FaClipboardList,
  FaEye,
  FaPlus,
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
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-black text-[#06194A]">{value || 'Not available'}</p>
  </div>
);

const statusBadge = (status = 'Pending') => {
  const base = 'inline-flex rounded-full px-3 py-1 text-xs font-black';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700`;
  if (status === 'Now Serving') return `${base} bg-blue-100 text-blue-700`;
  if (status === 'Cancelled' || status === 'Expired') return `${base} bg-red-100 text-red-700`;
  if (status === 'On Hold') return `${base} bg-slate-100 text-slate-700`;
  if (status === 'Scheduled') return `${base} bg-indigo-100 text-indigo-700`;
  if (status === 'Resubmitted') return `${base} bg-purple-100 text-purple-700`;
  return `${base} bg-amber-100 text-amber-700`;
};

const sortByAppointmentDate = (appointments) => [...appointments].sort((a, b) => {
  const aKey = `${a.appointmentDate || ''} ${a.appointmentTime || ''} ${a.createdAt || ''}`;
  const bKey = `${b.appointmentDate || ''} ${b.appointmentTime || ''} ${b.createdAt || ''}`;
  return bKey.localeCompare(aKey);
});

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

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8fc]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-[#06194A]">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Citizen Dashboard</p>
              <h1 className="mt-1 text-2xl font-black text-[#0B3A75] sm:text-3xl">National ID Service Overview</h1>
              <p className="mt-1 text-sm text-slate-600">Citizen: {citizenName}. Track your queue and manage your National ID appointment.</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800">
              {refreshing ? 'Updating...' : `Mogadishu time ${formatMogadishuTime()}`}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-black text-[#0B3A75]">
              <FaClipboardList className="text-blue-700" />
              Current Appointment
            </h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              {currentAppointments.length} record
            </span>
          </div>

          {currentAppointments.length ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {currentAppointments.map((ticket) => {
                return (
                  <article key={ticket.id || ticket.ref} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ticket Reference</p>
                        <p className="font-mono text-xl font-black text-blue-700">{ticket.ref}</p>
                      </div>
                      <span className={statusBadge(ticket.currentStatus)}>{ticket.currentStatus}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoItem label="Citizen Name" value={ticket.citizenDisplayName || citizenName} />
                      <InfoItem label="Service Type" value={ticket.serviceName} />
                      <InfoItem label="Center" value={ticket.centerName} />
                      <InfoItem label="Appointment Date" value={formatDate(ticket.appointmentDate)} />
                      <InfoItem label="Appointment Time" value={ticket.appointmentTime || 'Not scheduled'} />
                      <InfoItem label="Current Status" value={ticket.currentStatus} />
                    </div>

                    <div className="mt-5">
                      <ActionButton onClick={() => handleViewTicket(ticket)} className="w-full bg-blue-700 text-white hover:bg-blue-800 sm:w-auto">
                        <FaEye />
                        View Details
                      </ActionButton>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm">
                <FaCalendarAlt className="text-2xl" />
              </div>
              <h3 className="mt-5 text-2xl font-black text-[#06194A]">No Active Appointment</h3>
              <p className="mx-auto mt-3 max-w-lg text-base font-semibold text-slate-700">
                You do not have any active National ID appointment.
              </p>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                Book your appointment to receive your queue number and appointment schedule.
              </p>
              <Link
                to="/services/new-id-registration"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-7 py-4 text-base font-black text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <FaPlus />
                Book Appointment
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-[#0B3A75]">Appointment History</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {appointmentHistory.length} records
            </span>
          </div>

          {appointmentHistory.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Citizen Name</th>
                    <th className="px-4 py-3">Ticket Reference</th>
                    <th className="px-4 py-3">Service Type</th>
                    <th className="px-4 py-3">Center</th>
                    <th className="px-4 py-3">Appointment Date</th>
                    <th className="px-4 py-3">Appointment Time</th>
                    <th className="px-4 py-3">Current Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {appointmentHistory.map((ticket) => (
                    <tr key={ticket.id || ticket.ref}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{ticket.citizenDisplayName || citizenName}</td>
                      <td className="px-4 py-3 font-mono font-black text-blue-700">{ticket.ref}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{ticket.serviceName}</td>
                      <td className="px-4 py-3 text-slate-600">{ticket.centerName}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(ticket.appointmentDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{ticket.appointmentTime || 'Not scheduled'}</td>
                      <td className="px-4 py-3">
                        <span className={statusBadge(ticket.currentStatus)}>{ticket.currentStatus}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton onClick={() => handleViewTicket(ticket)} className="bg-blue-700 px-3 py-2 text-white hover:bg-blue-800">
                            <FaEye />
                            View Details
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Completed, cancelled, and expired appointments will appear here permanently.
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Appointment Details"
        className="max-w-2xl border border-slate-200 bg-white"
      >
        {selectedTicket && (
          <div className="space-y-5 p-2">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Reference Number</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-2xl font-black text-[#06194A]">{selectedTicket.ref}</p>
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
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
                <p className="text-xs font-black uppercase tracking-wide text-red-600">Cancellation Reason</p>
                <p className="mt-1 text-sm font-semibold">
                  {selectedTicket.cancellationReason || 'No cancellation reason was provided.'}
                </p>
              </div>
            )}
            {selectedTicket.currentStatus === 'Completed' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Completion Date</p>
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
