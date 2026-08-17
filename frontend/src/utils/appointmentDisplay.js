// Shared display helpers for appointment/ticket records returned by
// GET /api/bookings/admin/all (backend/services/bookingService.js hydrateTickets).
// Used by both AdminAppointments.jsx and CitizenAppointmentDetails.jsx.

export const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const getQueueNumber = (ref) => {
  if (!ref) return '--';
  return ref.split('-').pop();
};

export const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

export const getAppointmentCenterName = (appointment = {}) => (
  appointment.center?.name ||
  appointment.registrationDetails?.selectedCenter ||
  appointment.existingRegistration?.centerName ||
  'No center assigned'
);

export const getAppointmentCenterDistrict = (appointment = {}) => (
  appointment.center?.district ||
  appointment.registrationDetails?.centerDistrict ||
  appointment.registrationDetails?.district ||
  ''
);

export const getCenterRecordId = (center = {}) => String(center._id || center.id || '');

export const getCitizenPhone = (appointment = {}) => (
  appointment.citizen?.phone ||
  appointment.registrationDetails?.phone ||
  appointment.replacementDetails?.phone ||
  appointment.updateDetails?.phone ||
  '--'
);

export const getCitizenName = (appointment = {}) => (
  appointment.citizen?.name ||
  appointment.citizenName ||
  appointment.registrationDetails?.fullName ||
  appointment.replacementDetails?.fullName ||
  appointment.updateDetails?.fullName ||
  'Unknown Citizen'
);

export const getCitizenEmail = (appointment = {}) => appointment.citizen?.email || '--';
