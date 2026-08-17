import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';

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

const BookingSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const ticket = location.state?.ticket || null;

  useEffect(() => {
    if (!ticket) {
      navigate('/dashboard/user/my-appointments', { replace: true });
    }
  }, [navigate, ticket]);

  if (!ticket) return null;

  const ref = ticket.ref || ticket.reference || ticket.ticketNumber || '--';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B2E59] px-6 py-10 text-white">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#0B2E59]">
        <FiCheck size={36} strokeWidth={3} />
      </div>
      <h1 className="mt-6 text-2xl font-black">Appointment Booked!</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-blue-100">Your appointment has been successfully confirmed.</p>

      <div className="mt-8 w-full max-w-sm rounded-2xl bg-white/10 p-5">
        <p className="text-xs font-black uppercase tracking-wide text-blue-200">Request Number</p>
        <p className="mt-1 font-mono text-2xl font-black">{ref}</p>

        <div className="mt-4 space-y-2 border-t border-white/15 pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-blue-200">Date</span>
            <span className="font-bold">{formatDate(ticket.date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-200">Time</span>
            <span className="font-bold">{ticket.timeSlot || 'Not scheduled'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-blue-200">Center</span>
            <span className="text-right font-bold">{asName(ticket.center)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard/user/booking/ticket', { state: { ticket } })}
          className="w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-[#0B2E59] hover:bg-blue-50"
        >
          View Request
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/user')}
          className="w-full rounded-2xl border border-white/30 px-5 py-3.5 text-sm font-black text-white hover:bg-white/10"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
};

export default BookingSuccess;
