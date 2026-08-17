import { FiCheckCircle, FiClock, FiUserX, FiXCircle } from 'react-icons/fi';

// Shared between AdminAppointments.jsx and CitizenAppointmentDetails.jsx so both
// pages agree on exactly what "Waiting" / "In Progress" / etc mean for a ticket.
// Same convention already used by CenterOperatorDetail.jsx and OperatorAppointments.jsx:
// "Correction Required" is a display-only label for requestStatus === 'Resubmission
// Required' (the backend never stores that label). "No Show" mirrors the same
// defensive status set backend/services/reportService.js already checks for — real,
// just not produced by any current flow, so it will legitimately show 0 rather than
// fake data.
const normalizeStatusValue = (value = '') => String(value || '').trim().toLowerCase();

export const classifyAppointment = (appointment = {}) => {
  const status = normalizeStatusValue(appointment.status);
  const requestStatus = normalizeStatusValue(appointment.requestStatus);

  if (requestStatus === 'resubmission required') return 'correctionRequired';
  if (['no show', 'no-show', 'noshow'].includes(status)) return 'noShow';
  if (status === 'completed' || requestStatus === 'completed') return 'completed';
  if (['cancelled', 'canceled', 'rejected', 'expired'].includes(status) || ['rejected', 'cancelled'].includes(requestStatus)) return 'cancelled';
  if (['being served', 'in progress'].includes(status)) return 'inProgress';
  return 'waiting';
};

export const STATUS_CATEGORY_META = {
  waiting: { label: 'Waiting', icon: FiClock, color: '#b45309' },
  completed: { label: 'Completed', icon: FiCheckCircle, color: '#047857' },
  cancelled: { label: 'Cancelled / Rejected', icon: FiXCircle, color: '#dc2626' },
  noShow: { label: 'No Show', icon: FiUserX, color: '#64748b' }
};

export const getStatusLabel = (appointment = {}) => {
  const category = classifyAppointment(appointment);
  if (category === 'correctionRequired') return 'Correction Required';
  if (category === 'noShow') return 'No Show';
  if (category === 'inProgress') return 'Now Serving';
  return appointment.status || appointment.requestStatus || 'Pending';
};

export const statusClass = (appointment) => {
  const base = 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold';
  const category = classifyAppointment(appointment);
  if (category === 'completed') return `${base} bg-emerald-50 text-emerald-700`;
  if (category === 'cancelled') return `${base} bg-red-50 text-red-700`;
  if (category === 'inProgress') return `${base} bg-sky-50 text-sky-700`;
  if (category === 'correctionRequired') return `${base} bg-purple-50 text-purple-700`;
  if (category === 'noShow') return `${base} bg-slate-100 text-slate-600`;
  return `${base} bg-amber-50 text-amber-700`;
};
