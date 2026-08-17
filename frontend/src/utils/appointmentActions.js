/**
 * Shared appointment action rules for Admin / Operator / Queue UIs.
 * Terminal tickets must never show Complete or Cancel actions.
 */

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

export const TERMINAL_APPOINTMENT_STATUSES = new Set([
  'completed',
  'complete',
  'cancelled',
  'canceled',
  'rejected',
  'expired',
  'no show',
  'noshow',
  'resubmission required',
  'correction required',
  'needs correction',
]);

export const getAppointmentStatusValues = (appointment = {}) => ([
  normalizeStatus(appointment.status),
  normalizeStatus(appointment.requestStatus),
  normalizeStatus(appointment.currentStatus),
  normalizeStatus(appointment.displayStatus),
]);

// Once a citizen is checked into the live queue, they're already at the
// center — the original booked clock time no longer matters for whether
// Complete should be offered.
const ACTIVE_QUEUE_STATUSES = new Set([
  'waiting',
  'being served',
  'now serving',
  'in progress',
  'on hold',
]);

export const isActiveInQueue = (appointment = {}) => (
  getAppointmentStatusValues(appointment).some((status) => ACTIVE_QUEUE_STATUSES.has(status))
);

export const isTerminalAppointment = (appointment = {}) => {
  const statuses = getAppointmentStatusValues(appointment);
  return statuses.some((status) => TERMINAL_APPOINTMENT_STATUSES.has(status));
};

export const isCompletedAppointment = (appointment = {}) => (
  getAppointmentStatusValues(appointment).some((status) => status === 'completed' || status === 'complete')
);

export const isCancelledAppointment = (appointment = {}) => (
  getAppointmentStatusValues(appointment).some((status) => (
    status === 'cancelled'
    || status === 'canceled'
    || status === 'rejected'
    || status === 'resubmission required'
    || status === 'correction required'
    || status === 'needs correction'
  ))
);

const parseAppointmentDateTime = (appointment = {}) => {
  const dateValue = String(appointment.date || '').slice(0, 10);
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return null;

  const scheduled = new Date(year, month - 1, day);
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(appointment.timeSlot || '').trim());
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    scheduled.setHours(hour, minute, 0, 0);
  } else {
    scheduled.setHours(23, 59, 59, 999);
  }
  return scheduled;
};

/** An appointment can't be marked Completed before its own scheduled date/time arrives. */
export const hasAppointmentTimeArrived = (appointment = {}) => {
  const scheduled = parseAppointmentDateTime(appointment);
  return !scheduled || scheduled.getTime() <= Date.now();
};

export const canCompleteAppointment = (appointment = {}) => (
  !isTerminalAppointment(appointment)
  && (isActiveInQueue(appointment) || hasAppointmentTimeArrived(appointment))
);

export const canCancelAppointment = (appointment = {}) => !isTerminalAppointment(appointment);

export const canReacceptAppointment = (appointment = {}) => isCompletedAppointment(appointment);
