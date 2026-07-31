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

export const canCompleteAppointment = (appointment = {}) => !isTerminalAppointment(appointment);

export const canCancelAppointment = (appointment = {}) => !isTerminalAppointment(appointment);

export const canReacceptAppointment = (appointment = {}) => isCompletedAppointment(appointment);
