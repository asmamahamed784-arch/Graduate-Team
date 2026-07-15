import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCalendarAlt, FaDownload, FaEye, FaIdCard, FaQrcode, FaRedo, FaRoute, FaTimesCircle } from 'react-icons/fa';
import api from '../api/axiosInstance';
import Modal from '../components/Modal';
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
const HISTORY_STATUSES = new Set(['Completed', 'Cancelled', 'Expired']);

const normalizeStatus = (status) => {
  const value = String(status || 'Pending').trim().toLowerCase();
  if (value === 'approved' || value === 'confirmed') return 'Scheduled';
  if (value === 'being served' || value === 'serving' || value === 'now serving') return 'Now Serving';
  if (value === 'on hold' || value === 'hold') return 'On Hold';
  if (value === 'cancelled' || value === 'canceled' || value === 'rejected') return 'Cancelled';
  if (value === 'completed' || value === 'complete') return 'Completed';
  if (value === 'expired') return 'Expired';
  if (value === 'resubmitted') return 'Resubmitted';
  if (value === 'scheduled') return 'Scheduled';
  if (value === 'waiting') return 'Waiting';
  return 'Pending';
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
  currentStatus: normalizeStatus(ticket.status || ticket.requestStatus),
  queueNumber: queueNumberOf(ticket),
});

const statusBadge = (status = 'Pending') => {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-black';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700`;
  if (status === 'Now Serving') return `${base} bg-blue-100 text-blue-700`;
  if (status === 'Cancelled' || status === 'Expired') return `${base} bg-red-100 text-red-700`;
  if (status === 'On Hold') return `${base} bg-slate-100 text-slate-700`;
  if (status === 'Scheduled') return `${base} bg-indigo-100 text-indigo-700`;
  if (status === 'Resubmitted') return `${base} bg-purple-100 text-purple-700`;
  return `${base} bg-amber-100 text-amber-700`;
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

const formatDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

const sortAppointments = (appointments) => [...appointments].sort((a, b) => {
  const dateA = `${a.appointmentDate || ''} ${a.appointmentTime || ''}`;
  const dateB = `${b.appointmentDate || ''} ${b.appointmentTime || ''}`;
  return dateB.localeCompare(dateA);
});

const UserAppointments = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [qrCodes, setQrCodes] = useState({});
  const [selectedQrCodeUrl, setSelectedQrCodeUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentAppointments = useMemo(
    () => sortAppointments(bookings.filter((ticket) => CURRENT_STATUSES.has(ticket.currentStatus))).reverse(),
    [bookings]
  );
  const appointmentHistory = useMemo(
    () => sortAppointments(bookings.filter((ticket) => HISTORY_STATUSES.has(ticket.currentStatus))),
    [bookings]
  );

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
      toast.success(`Ticket ${ticket.ref} downloaded.`);
    } catch (error) {
      toast.error(error.message || 'Unable to download your ticket.');
    }
  };

  const handleCancelAppointment = async (ticket) => {
    if (!ticket?.id) return;
    const confirmed = window.confirm(`Cancel appointment ${ticket.ref}?`);
    if (!confirmed) return;

    try {
      await api.put(`/api/bookings/${ticket.id}/cancel`);
      toast.success('Appointment cancelled.');
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
    <div className="nqs-user-appointments min-h-screen bg-[#f5f8fc] text-[#06194A]">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Citizen Portal</p>
          <h1 className="mt-1 text-2xl font-black text-[#0B3A75] sm:text-3xl">My Appointments</h1>
          <p className="mt-1 text-sm text-slate-600">View your National ID appointment, QR ticket, and appointment history.</p>
        </section>

        <section className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black text-[#0B3A75]">
                <FaCalendarAlt className="text-blue-700" />
                Current Appointment
              </h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                {currentAppointments.length} current
              </span>
            </div>

            {currentAppointments.length ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {currentAppointments.map((ticket) => {
                  const canCancel = ['Pending', 'Waiting'].includes(ticket.currentStatus);
                  const qrCodeUrl = qrCodes[ticket.ref];
                  return (
                    <article key={ticket.id || ticket.ref} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ticket Reference</p>
                          <p className="font-mono text-xl font-black text-blue-700">{ticket.ref}</p>
                        </div>
                        <span className={statusBadge(ticket.currentStatus)}>{ticket.currentStatus}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[150px_1fr]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                          <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-xl bg-slate-50">
                            {qrCodeUrl ? (
                              <img src={qrCodeUrl} alt={`QR ticket ${ticket.ref}`} className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">Generating QR...</span>
                            )}
                          </div>
                          <p className="mt-2 text-[11px] font-semibold text-slate-500">QR contains ticket reference only</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <InfoItem label="Citizen Name" value={ticket.citizenDisplayName} />
                          <InfoItem label="Ticket Reference" value={ticket.ref} />
                          <InfoItem label="Queue Number" value={ticket.queueNumber} />
                          <InfoItem label="Service Type" value={ticket.serviceName} />
                          <InfoItem label="Center" value={ticket.centerName} />
                          <InfoItem label="Appointment Date" value={formatDate(ticket.appointmentDate)} />
                          <InfoItem label="Appointment Time" value={ticket.appointmentTime || 'Not scheduled'} />
                          <InfoItem label="Current Status" value={ticket.currentStatus} />
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Link
                          to={`/dashboard/user/track?ref=${encodeURIComponent(ticket.ref)}`}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800"
                        >
                          <FaRoute />
                          Track Queue
                        </Link>
                        <ActionButton onClick={() => openDetails(ticket)} className="nqs-outline-action border border-blue-200 bg-white text-blue-700">
                          <FaEye />
                          View Details
                        </ActionButton>
                        <ActionButton onClick={() => openDetails(ticket)} className="nqs-outline-action border border-blue-200 bg-white text-blue-700">
                          <FaQrcode />
                          View Ticket / QR
                        </ActionButton>
                        <ActionButton onClick={() => handleDownloadTicket(ticket)} className="nqs-outline-action border border-blue-200 bg-white text-blue-700">
                          <FaDownload />
                          Download Ticket
                        </ActionButton>
                        {canCancel && (
                          <ActionButton onClick={() => handleCancelAppointment(ticket)} className="nqs-danger-outline border border-red-200 bg-white text-red-600">
                            <FaTimesCircle />
                            Cancel
                          </ActionButton>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <FaIdCard className="mx-auto text-4xl text-blue-200" />
                <h3 className="mt-4 text-xl font-black text-[#06194A]">No current appointment</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Book a National ID service to receive your queue ticket.</p>
                <Link to="/dashboard/user/new-id-registration" className="mt-5 inline-flex rounded-lg bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800">
                  Book Appointment
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[#0B3A75]">Appointment History</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {appointmentHistory.length} records
              </span>
            </div>
            {appointmentHistory.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[1060px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Citizen Name</th>
                      <th className="px-4 py-3">Ticket Reference</th>
                      <th className="px-4 py-3">Service Type</th>
                      <th className="px-4 py-3">Center</th>
                      <th className="px-4 py-3">Appointment Date</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Queue Number</th>
                      <th className="px-4 py-3">Current Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {appointmentHistory.map((ticket) => (
                      <tr key={ticket.id || ticket.ref}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{ticket.citizenDisplayName}</td>
                        <td className="px-4 py-3 font-mono font-black text-blue-700">{ticket.ref}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{ticket.serviceName}</td>
                        <td className="px-4 py-3 text-slate-600">{ticket.centerName}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(ticket.appointmentDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{ticket.appointmentTime || 'Not scheduled'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{ticket.queueNumber}</td>
                        <td className="px-4 py-3"><span className={statusBadge(ticket.currentStatus)}>{ticket.currentStatus}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton onClick={() => openDetails(ticket)} className="nqs-outline-action border border-blue-200 bg-white px-3 py-2 text-blue-700">
                              <FaEye />
                              View Details
                            </ActionButton>
                            <ActionButton onClick={() => openDetails(ticket)} className="nqs-outline-action border border-blue-200 bg-white px-3 py-2 text-blue-700">
                              <FaQrcode />
                              View Ticket / QR
                            </ActionButton>
                            <Link to={`/dashboard/user/track?ref=${encodeURIComponent(ticket.ref)}`} className="nqs-outline-action inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-black text-blue-700">
                              <FaRoute />
                              Track Queue
                            </Link>
                            <ActionButton onClick={() => handleDownloadTicket(ticket)} className="nqs-outline-action border border-blue-200 bg-white px-3 py-2 text-blue-700">
                              <FaDownload />
                              Download Ticket
                            </ActionButton>
                            {ticket.currentStatus === 'Cancelled' && (
                              <Link to={getResubmitPath(ticket)} className="nqs-success-action inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white hover:bg-emerald-700">
                                <FaRedo />
                                Resubmit Appointment
                              </Link>
                            )}
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
        </section>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="My Queue Ticket" className="max-w-md border border-slate-200 bg-white">
        {selectedTicket && (
          <div className="space-y-4 p-2 text-center">
            {(selectedQrCodeUrl || qrCodes[selectedTicket.ref]) && (
              <img src={selectedQrCodeUrl || qrCodes[selectedTicket.ref]} alt={`QR ticket ${selectedTicket.ref}`} className="mx-auto h-40 w-40 object-contain" />
            )}
            <p className="font-mono text-xl font-black text-[#06194A]">{selectedTicket.ref}</p>
            <div className="grid grid-cols-2 gap-3 text-left">
              <InfoItem label="Citizen Name" value={selectedTicket.citizenDisplayName} />
              <InfoItem label="Ticket Reference" value={selectedTicket.ref} />
              <InfoItem label="Service" value={selectedTicket.serviceName} />
              <InfoItem label="Center" value={selectedTicket.centerName} />
              <InfoItem label="Date" value={formatDate(selectedTicket.appointmentDate)} />
              <InfoItem label="Time" value={selectedTicket.appointmentTime || 'Not scheduled'} />
              <InfoItem label="Queue Number" value={selectedTicket.queueNumber} />
              <InfoItem label="Current Status" value={selectedTicket.currentStatus} />
            </div>
            {selectedTicket.currentStatus === 'Cancelled' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left">
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
                  <p className="mt-1 text-sm font-semibold text-red-900">No cancellation reason was provided.</p>
                )}
                {selectedTicket.cancellationNotes && (
                  <p className="mt-3 text-sm font-semibold text-red-900">Admin note: {selectedTicket.cancellationNotes}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserAppointments;
