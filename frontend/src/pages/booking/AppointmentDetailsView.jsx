import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCalendar, FiChevronLeft, FiClock, FiInfo, FiMapPin, FiUser, FiXCircle } from 'react-icons/fi';
import api from '../../api/axiosInstance';

const asName = (value, fallback = 'National ID Service') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || fallback;
};

const formatDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const CANCEL_WINDOW_MS = 60 * 60 * 1000;
const cancelWindowRemainingMs = (ticket) => {
  const createdAt = new Date(ticket?.createdAt);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return CANCEL_WINDOW_MS - (Date.now() - createdAt.getTime());
};
const canCancel = (ticket) => (
  ['Pending', 'Waiting', 'Scheduled'].includes(ticket?.status) && cancelWindowRemainingMs(ticket) > 0
);

const statusMeta = (status) => {
  if (status === 'Completed') return { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' };
  if (status === 'Cancelled') return { label: 'Cancelled', className: 'bg-red-100 text-red-700' };
  return { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700' };
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
    <span className="mt-0.5 text-blue-600"><Icon /></span>
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const AppointmentDetailsView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ref: refParam } = useParams();
  const [ticket, setTicket] = useState(location.state?.ticket || null);
  const [loading, setLoading] = useState(!location.state?.ticket);

  const fetchTicket = async () => {
    if (!refParam) return;
    try {
      const res = await api.get(`/api/bookings/${encodeURIComponent(refParam)}`);
      setTicket(res.data?.data || res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load this appointment.');
      navigate('/dashboard/user/my-appointments', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ticket && refParam) fetchTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam]);

  const handleCancel = async () => {
    if (!ticket?.id && !ticket?._id) return;
    const confirmed = window.confirm(`Cancel appointment ${ticket.ref}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await api.put(`/api/bookings/${ticket.id || ticket._id}/cancel`);
      toast.success('Appointment cancelled.');
      navigate('/dashboard/user/my-appointments');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel this appointment.');
    }
  };

  const handleReschedule = () => {
    toast.info('To change your date or time, cancel this appointment (within 1 hour of booking) and book a new one.');
  };

  if (loading || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  const meta = statusMeta(ticket.status);

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-10 pt-4 text-slate-900">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label="Go back"
        >
          <FiChevronLeft />
        </button>

        <h1 className="text-2xl font-black text-[#0B3A75]">Appointment Details</h1>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Request Number</p>
              <p className="mt-1 font-mono text-xl font-black text-[#0B2E59]">{ticket.ref}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span>
          </div>

          <div className="mt-3">
            <InfoRow icon={FiUser} label="Service" value={asName(ticket.service)} />
            <InfoRow icon={FiMapPin} label="Center" value={asName(ticket.center)} />
            <InfoRow icon={FiCalendar} label="Date & Time" value={`${formatDate(ticket.date)} • ${ticket.timeSlot || 'Not scheduled'}`} />
            <InfoRow icon={FiClock} label="Status" value={ticket.status} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleReschedule}
            className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-3.5 text-sm font-black text-blue-700 hover:bg-blue-50"
          >
            <FiInfo /> Reschedule
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!canCancel(ticket)}
            title={!canCancel(ticket) ? 'Cancellation is only available within 1 hour of booking.' : ''}
            className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3.5 text-sm font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiXCircle /> Cancel Appointment
          </button>
        </div>

        <Link
          to={`/dashboard/user/booking/track/${encodeURIComponent(ticket.ref)}`}
          className="mt-3 block w-full rounded-2xl bg-[#0B2E59] px-4 py-3.5 text-center text-sm font-black text-white hover:bg-[#123A6B]"
        >
          Track Your Queue
        </Link>
      </div>
    </div>
  );
};

export default AppointmentDetailsView;
