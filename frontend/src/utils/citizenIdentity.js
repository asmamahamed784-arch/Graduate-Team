// Resolves which citizen an appointment belongs to, and builds a stable key so
// AdminAppointments.jsx (linking out) and CitizenAppointmentDetails.jsx (filtering
// down to just that person) always agree on the same grouping — a real, linked
// citizen account is grouped by their user id; a walk-in/anonymous ticket with no
// linked account falls back to phone, then finally to its own ticket ref so a row
// always has somewhere to go.
import { getCitizenPhone } from './appointmentDisplay';

export const getCitizenId = (appointment = {}) => {
  const citizen = appointment.citizen;
  if (!citizen) return '';
  if (typeof citizen === 'string') return citizen;
  return String(citizen.id || citizen._id || '');
};

export const getCitizenKey = (appointment = {}) => {
  const citizenId = getCitizenId(appointment);
  if (citizenId) return `id:${citizenId}`;

  const phone = getCitizenPhone(appointment);
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits) return `phone:${digits}`;

  return `ref:${appointment.ref || appointment._id || appointment.id || ''}`;
};

export const matchesCitizenKey = (appointment, citizenKey) => getCitizenKey(appointment) === citizenKey;
