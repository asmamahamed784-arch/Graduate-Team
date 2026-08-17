import prisma from '../config/prisma.js';

import { CORRECTION_REASON_CATALOG, CORRECTION_REASON_NAMES } from '../constants/correctionReasons.js';
import { generateRef } from '../utils/generateReference.js';
import {
  getCenterDistrict,
  isBanaadirNationalIdCenter,
  isLostNationalIdReplacementService,
  isNationalIdService,
  isNewNationalIdRegistrationService,
  isUpdateNationalIdInformationService,
  normalizeBanaadirDistrict
} from '../utils/nqsScope.js';
import { canAccessTicket, getAssignedCenterId, isAdminRole, normalizeRole } from '../utils/rbac.js';
import {
  sendAppointmentApprovalEmail,
  sendAppointmentCancellationEmail,
  sendAppointmentCompletionEmail,
  sendBookingConfirmationEmail
} from '../services/emailService.js';
import { logSmsOnly } from '../services/smsLogService.js';
import { normalizeOtpPhone, verifyOtpToken } from '../services/otpService.js';
import { ERRORS } from '../utils/errorMessages.js';
import {
  ensureCitizenPermanentNqsId,
  isIssuedNationalIdStatus,
  restoreCitizenIdStatusAfterRequestEnd,
  syncCitizenIdentityProfile
} from '../utils/citizenIdentity.js';

const sanitizeReplacementDetails = (details = {}, fallbackUser = {}) => ({
  fullName: String(details.fullName || fallbackUser.name || '').trim(),
  phone: String(details.phone || fallbackUser.phone || '').trim(),
  nationalIdNumber: String(details.nationalIdNumber || fallbackUser.nationalId || '').trim(),
  reason: String(details.reason || '').trim(),
  dateLost: String(details.dateLost || '').trim(),
  placeLost: String(details.placeLost || '').trim(),
  policeReportNumber: String(details.policeReportNumber || '').trim(),
  policeReportDocument: String(details.policeReportDocument || '').trim(),
  additionalNotes: String(details.additionalNotes || '').trim(),
  district: String(details.district || details.centerDistrict || '').trim()
});

const validateReplacementDetails = (details) => {
  const requiredFields = [
    ['fullName', 'Full name is required for lost National ID replacement.'],
    ['phone', 'Phone number is required for lost National ID replacement.'],
    ['district', 'District is required for lost National ID replacement.'],
    ['reason', 'Reason for replacement is required.'],
    ['dateLost', 'Date lost is required.'],
    ['placeLost', 'Place lost is required.']
  ];

  const missing = requiredFields.find(([field]) => !details[field]);
  return missing?.[1] || '';
};

const sanitizeUpdateDetails = (details = {}, fallbackUser = {}) => ({
  fullName: String(details.fullName || fallbackUser.name || '').trim(),
  phone: String(details.phone || fallbackUser.phone || '').trim(),
  nationalIdNumber: String(details.nationalIdNumber || fallbackUser.nationalId || '').trim(),
  mistakeType: String(details.mistakeType || '').trim(),
  selectedFields: Array.isArray(details.selectedFields) ? details.selectedFields.map((field) => String(field).trim()).filter(Boolean) : [],
  changes: Array.isArray(details.changes)
    ? details.changes.map((change) => ({
        field: String(change.field || '').trim(),
        currentValue: String(change.currentValue || '').trim(),
        newValue: String(change.newValue || '').trim(),
        reason: String(change.reason || '').trim()
      })).filter((change) => change.field)
    : [],
  fieldToUpdate: String(details.fieldToUpdate || '').trim(),
  currentValue: String(details.currentValue || '').trim(),
  newValue: String(details.newValue || '').trim(),
  reason: String(details.reason || '').trim(),
  notes: String(details.notes || '').trim()
});

const normalizeUpdateComparableValue = (field = '', value = '') => {
  const key = String(field || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const text = String(value || '').trim();
  if (!text) return '';
  if (key.includes('marital')) {
    const normalizedMaritalStatus = text.toLowerCase().replace(/[^a-z]/g, '');
    if (normalizedMaritalStatus === 'single' || normalizedMaritalStatus === 'singe') return 'SINGLE';
    if (normalizedMaritalStatus === 'married' || normalizedMaritalStatus === 'marrid') return 'MARRIED';
    return text.toUpperCase();
  }
  if (key.includes('date')) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return text.toLowerCase().replace(/\s+/g, ' ');
};

const validateUpdateDetails = (details) => {
  const mistakeTypes = ['Document type', 'Office Mistake', 'Mixed Mistake'];
  const requiredFields = [
    ['fullName', 'Full name is required for update requests.'],
  ];

  const missing = requiredFields.find(([field]) => !details[field]);
  if (missing) return missing[1];
  if (!mistakeTypes.includes(details.mistakeType)) return 'Please select type mistake.';
  if (!isValidGovernmentName(details.fullName, 5)) return 'Full Name must contain letters only.';

  const changes = details.changes?.length
    ? details.changes
    : details.fieldToUpdate
      ? [{
          field: details.fieldToUpdate,
          currentValue: details.currentValue,
          newValue: details.newValue,
          reason: details.reason
        }]
      : [];

  if (changes.length === 0) return 'Please select at least one field to update.';
  const incomplete = changes.find((change) => !change.field || !change.newValue || !change.reason);
  if (incomplete) return 'Each selected update field must include a new value and reason.';
  const invalidMaritalStatus = changes.find((change) => (
    String(change.field || '').toLowerCase().includes('marital') &&
    !['SINGLE', 'MARRIED'].includes(String(change.newValue || '').trim().toUpperCase())
  ));
  if (invalidMaritalStatus) return 'Please select your marital status.';
  const nationalIdChange = changes.find((change) => {
    const field = String(change.field || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return field.includes('nationalid') || field === 'idnumber' || field === 'nqs';
  });
  if (nationalIdChange) {
    return 'National ID number cannot be changed. Each citizen keeps one permanent ID.';
  }
  const unchanged = changes.find((change) => (
    normalizeUpdateComparableValue(change.field, change.currentValue) === normalizeUpdateComparableValue(change.field, change.newValue)
  ));
  if (unchanged) {
    return `${unchanged.field || 'Selected field'} has no change. Please enter a different new value or reject the request.`;
  }
  return '';
};

const sanitizeServiceRequestDetails = (details = {}, fallbackUser = {}) => ({
  fullName: String(details.fullName || fallbackUser.name || '').trim(),
  phone: String(details.phone || fallbackUser.phone || '').trim(),
  serviceName: String(details.serviceName || '').trim(),
  notes: String(details.notes || details.additionalNotes || '').trim(),
  selectedCenter: String(details.selectedCenter || '').trim(),
  centerDistrict: String(details.centerDistrict || details.district || '').trim(),
  appointmentDate: String(details.appointmentDate || '').trim(),
  appointmentTime: String(details.appointmentTime || '').trim()
});

const validateServiceRequestDetails = (details) => {
  if (!details.fullName) return 'Full name is required.';
  if (!details.phone) return 'Phone number is required.';
  return '';
};

const normalizeFullNameForLookup = (value) => (
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const normalizePhoneForLookup = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00252')) return digits.slice(2);
  if (digits.startsWith('252')) return digits;
  if (digits.startsWith('0')) return `252${digits.slice(1)}`;
  if (digits.startsWith('6')) return `252${digits}`;
  return digits;
};

const ISSUED_NATIONAL_ID_MESSAGE = 'You already have a National ID. You cannot register for a new National ID. You may only update your information or request a replacement for a lost ID.';
const ACTIVE_APPOINTMENT_MESSAGE = 'You already have an active appointment for this service. Please complete, update, or cancel the existing appointment.';
const ACTIVE_LOST_REPLACEMENT_MESSAGE = 'You already have an active lost ID replacement request. Please wait until the current request is completed.';
const ACTIVE_UPDATE_REQUEST_MESSAGE = 'You already have a pending Update Information request. Please wait until the Center or Admin completes it.';
const UPDATE_REQUEST_BLOCKS_OTHER_SERVICES_MESSAGE = 'You already have an Update Information request waiting for review. You cannot submit another request until that update is completed.';
const NO_EXISTING_NATIONAL_ID_MESSAGE = 'No existing National ID registration found for this name and phone number.';
const CANCELLATION_SUCCESS_MESSAGE = 'The appointment was cancelled successfully, and the citizen has been notified.';
const COMPLETED_REQUEST_LOCKED_MESSAGE = 'This request has already been completed and cannot be cancelled.';
/** Field labels used by admin/operator cancel modals (Lost ID / appointments). */
const STAFF_INCORRECT_FIELD_OPTIONS = [
  'Full Name',
  "Mother's Name",
  'Date of Birth',
  'Age',
  'Phone Number',
  'Gender',
  'Marital Status',
  'District Where You Live',
  'Nearest Landmark',
  'Full Address',
  // Replace Lost National ID form fields
  'National ID Number',
  'Date Lost',
  'Place Lost',
  'Reason',
  'Police Report Number',
  'Police Report Document',
  'Notes',
  'Selected Center',
  'Appointment Date',
  'Appointment Time',
];
const CANCELLATION_REASON_OPTIONS = [
  ...new Set([
    ...CORRECTION_REASON_NAMES.filter((reason) => reason !== 'Other'),
    ...STAFF_INCORRECT_FIELD_OPTIONS,
  ]),
];
const OTHER_CANCELLATION_REASON = 'Other';
const COMPLETED_STATUS_VALUES = new Set(['Completed', 'COMPLETED']);
const NEEDS_CORRECTION_STATUS = 'NEEDS_CORRECTION';
const RESUBMITTED_STATUS = 'RESUBMITTED';
const BLOCKING_NEW_REGISTRATION_STATUSES = new Set([
  'Waiting',
  'Pending',
  'Approved',
  'Scheduled',
  'In Progress',
  'Resubmitted',
  'Now Serving',
  'Being Served',
  'Completed',
  'On Hold'
]);
const BLOCKING_NEW_REGISTRATION_REQUEST_STATUSES = new Set([
  'Pending',
  'Under Review',
  'Approved',
  'In Progress',
  'Completed',
  'Resubmission Required'
]);
const ACTIVE_TICKET_STATUSES = ['Pending', 'Approved', 'Scheduled', 'Waiting', 'Being Served', 'In Progress', 'On Hold'];
const ACTIVE_REQUEST_STATUSES = ['Pending', 'Under Review', 'Approved', 'In Progress', 'Resubmission Required'];
const CORRECTION_ACTIVE_STATUSES = new Set(['Pending', 'Approved', 'Scheduled', 'Waiting', 'Being Served', 'In Progress', 'On Hold']);
const CITIZEN_CANCEL_WINDOW_MS = 60 * 60 * 1000;
const ISSUED_APPLICATION_STATUSES = new Set(['Completed']);
const TICKET_DATA_FIELDS = new Set([
  'ref',
  'service',
  'citizenName',
  'citizen',
  'counter',
  'waitTime',
  'status',
  'center',
  'district',
  'date',
  'timeSlot',
  'requestType',
  'requestStatus',
  'nationalIdNumber',
  'cardSerialNumber',
  'cardStatus',
  'registrationDetails',
  'replacementDetails',
  'updateDetails',
  'existingRegistration',
  'cancellationReason',
  'cancellationReasons',
  'additionalCancellationReason',
  'cancellationNotes',
  'previousStatusBeforeCancellation',
  'cancelledBy',
  'cancelledAt',
  'rejectionReason',
  'needsResubmission',
  'completedAt',
  'createdAt',
  'updatedAt'
]);

const markTicketCompletedAt = (ticket) => {
  if (!ticket.completedAt) {
    ticket.completedAt = new Date();
  }
};

const clearTicketCompletedAt = (ticket) => {
  ticket.completedAt = null;
};

const JSON_TICKET_FIELDS = new Set([
  'registrationDetails',
  'replacementDetails',
  'updateDetails',
  'existingRegistration',
  'cancellationReasons'
]);

const idFrom = (value) => {
  if (!value) return value;
  if (typeof value === 'object') return value.id || value._id || value;
  return value;
};

const pickTicketData = (data = {}) => {
  const output = Object.fromEntries(
    Object.entries(data).filter(([key, value]) => TICKET_DATA_FIELDS.has(key) && value !== undefined)
  );
  ['service', 'center', 'citizen'].forEach((key) => {
    if (output[key]) output[key] = idFrom(output[key]);
  });
  // Clone JSON so nested cancel feedback always persists on update.
  JSON_TICKET_FIELDS.forEach((key) => {
    if (output[key] != null && typeof output[key] === 'object') {
      output[key] = JSON.parse(JSON.stringify(output[key]));
    }
  });
  return output;
};

const getQueueNumberFromRef = (ref) => {
  if (!ref) return '';
  return String(ref).split('-').pop();
};

const formatExistingRegistrationInfo = (ticket, centerOverride, citizenOverride) => {
  const center = centerOverride || (typeof ticket?.center === 'object' ? ticket.center : null) || {};
  const citizen = citizenOverride || (typeof ticket?.citizen === 'object' ? ticket.citizen : null) || {};
  const details = ticket?.registrationDetails || {};

  return {
    found: Boolean(ticket),
    ticket: ticket?.id || null,
    originalRegistrationId: ticket?.id || null,
    ticketNumber: ticket?.ref || '',
    originalTicketReference: ticket?.ref || '',
    queueNumber: getQueueNumberFromRef(ticket?.ref),
    originalQueueNumber: getQueueNumberFromRef(ticket?.ref),
    serviceType: ticket?.service?.name || 'New National ID Registration',
    centerName: center.name || details.selectedCenter || '',
    originalCenter: center.name || details.selectedCenter || '',
    originalDistrict: ticket?.district || details.district || center.district || center.city || '',
    centerId: center.id || idFrom(ticket?.center) || null,
    date: ticket?.date || details.appointmentDate || '',
    timeSlot: ticket?.timeSlot || details.appointmentTime || '',
    status: ticket?.status || '',
    citizenName: ticket?.citizenName || details.fullName || citizen.name || '',
    citizenPhone: details.phone || citizen.phone || '',
    citizenEmail: citizen.email || '',
    nationalIdNumber: ticket?.nationalIdNumber || details.nationalIdNumber || citizen.nationalId || '',
    cardSerialNumber: ticket?.cardSerialNumber || '',
    cardStatus: ticket?.cardStatus || '',
    registrationDetails: {
      ...details,
      fullName: details.fullName || ticket?.citizenName || citizen.name || '',
      phone: details.phone || citizen.phone || '',
      selectedCenter: details.selectedCenter || center.name || '',
      centerDistrict: details.centerDistrict || center.district || center.city || ''
    }
  };
};

const hydrateTickets = async (tickets = []) => {
  const existingRegistrationIds = [...new Set(tickets
    .map((ticket) => idFrom(ticket.existingRegistration?.ticket || ticket.existingRegistration?.originalRegistrationId))
    .filter(Boolean))];
  const originalRegistrations = existingRegistrationIds.length
    ? await prisma.ticket.findMany({ where: { id: { in: existingRegistrationIds } } })
    : [];
  const ticketsForReference = [...tickets, ...originalRegistrations];
  const serviceIds = [...new Set(ticketsForReference.map((ticket) => idFrom(ticket.service)).filter(Boolean))];
  const centerIds = [...new Set(ticketsForReference.map((ticket) => idFrom(ticket.center)).filter(Boolean))];
  const citizenIds = [...new Set(ticketsForReference.map((ticket) => idFrom(ticket.citizen)).filter(Boolean))];
  const ticketIds = tickets.map((ticket) => ticket.id).filter(Boolean);
  const ticketRefs = tickets.map((ticket) => ticket.ref).filter(Boolean);
  const [services, centers, citizens, feedbackRows, notificationRows] = await Promise.all([
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true, category: true, duration: true, requirements: true, priority: true } })
      : [],
    centerIds.length
      ? prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, address: true, city: true, district: true, phone: true } })
      : [],
    citizenIds.length
      ? prisma.user.findMany({ where: { id: { in: citizenIds } }, select: { id: true, name: true, username: true, email: true, phone: true, nationalId: true, citizenProfile: { select: { nationalId: true, nationalIdStatus: true } } } })
      : [],
    ticketIds.length
      ? prisma.requestCorrectionFeedback.findMany({ where: { request: { in: ticketIds } }, orderBy: { id: 'asc' } })
      : [],
    ticketIds.length || ticketRefs.length
      ? prisma.notification.findMany({
          where: {
            OR: [
              ...(ticketIds.length ? [{ relatedEntity: { in: ticketIds } }] : []),
              ...(ticketRefs.length ? [{ referenceNumber: { in: ticketRefs } }] : [])
            ]
          },
          orderBy: { timestamp: 'desc' }
        })
      : []
  ]);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const centersById = new Map(centers.map((center) => [center.id, center]));
  const citizensById = new Map(citizens.map((citizen) => [citizen.id, {
    ...citizen,
    nationalId: citizen.citizenProfile?.nationalId || citizen.nationalId
  }]));
  const originalsById = new Map(originalRegistrations.map((ticket) => [ticket.id, ticket]));
  const reasonIds = [...new Set(feedbackRows.map((row) => row.correctionReason).filter(Boolean))];
  const reasonDocs = reasonIds.length
    ? await prisma.correctionReason.findMany({ where: { id: { in: reasonIds } } })
    : [];
  const reasonById = new Map(reasonDocs.map((reason) => [reason.id, reason.reasonName]));
  const feedbackByTicket = new Map();
  feedbackRows.forEach((row) => {
    const current = feedbackByTicket.get(row.request) || { reasons: [], notes: [] };
    const reasonName = reasonById.get(row.correctionReason) || row.correctionReason;
    if (reasonName && !current.reasons.includes(reasonName)) current.reasons.push(reasonName);
    if (row.additionalNote && !current.notes.includes(row.additionalNote)) current.notes.push(row.additionalNote);
    feedbackByTicket.set(row.request, current);
  });
  const ticketIdByRef = new Map(tickets.map((ticket) => [ticket.ref, ticket.id]));
  const notificationByTicket = new Map();
  notificationRows.forEach((notification) => {
    const key = notification.relatedEntity || ticketIdByRef.get(notification.referenceNumber);
    if (!key || notificationByTicket.has(key)) return;
    const text = `${notification.title || ''} ${notification.desc || ''} ${notification.notificationType || ''}`.toLowerCase();
    if (!text.includes('cancel') && !text.includes('correction')) return;
    notificationByTicket.set(key, notification);
  });

  return tickets.map((ticket) => {
    const originalId = ticket.existingRegistration?.ticket || ticket.existingRegistration?.originalRegistrationId;
    const original = originalsById.get(originalId);
    const cancellationDetails = getEmbeddedCancellationDetails(ticket);
    const feedback = feedbackByTicket.get(ticket.id);
    const notification = notificationByTicket.get(ticket.id);
    const notificationReasons = cleanStringArray(notification?.cancellationReasons);
    const embeddedReasons = cleanStringArray(cancellationDetails.cancellationReasons || cancellationDetails.reasons);
    const hasCorrectionFeedback = Boolean(
      cancellationDetails.cancellationReason ||
      cancellationDetails.summary ||
      embeddedReasons.length ||
      feedback ||
      notification
    );
    const correctionResolved = correctionResolvedFromTicket(ticket);
    const unresolvedCorrection = hasCorrectionFeedback && !correctionResolved && CORRECTION_ACTIVE_STATUSES.has(ticket.status);
    const cancellationReason = ticket.cancellationReason ||
      cancellationDetails.cancellationReason ||
      cancellationDetails.summary ||
      (feedback?.reasons?.length ? feedback.reasons.join(', ') : '') ||
      notification?.cancellationReason ||
      (notificationReasons.length ? notificationReasons.join(', ') : '');
    const cancellationReasons = ticket.cancellationReasons ||
      cancellationDetails.cancellationReasons ||
      cancellationDetails.reasons ||
      feedback?.reasons ||
      (notificationReasons.length ? notificationReasons : []);
    const cancellationNotes = ticket.cancellationNotes ||
      cancellationDetails.cancellationNotes ||
      cancellationDetails.additionalNotes ||
      feedback?.notes?.join(' ') ||
      notification?.cancellationNotes ||
      '';
    return {
      ...ticket,
      _id: ticket.id,
      status: unresolvedCorrection ? 'Cancelled' : ticket.status,
      requestStatus: unresolvedCorrection ? 'Resubmission Required' : ticket.requestStatus,
      needsResubmission: unresolvedCorrection || ticket.needsResubmission || false,
      hasCorrectionFeedback,
      correctionResolved,
      cancellationReason: cancellationReason || '',
      cancellationReasons: cancellationReasons || [],
      additionalCancellationReason: ticket.additionalCancellationReason || cancellationDetails.additionalCancellationReason || cancellationDetails.additionalReason || '',
      cancellationNotes,
      previousStatusBeforeCancellation: ticket.previousStatusBeforeCancellation || cancellationDetails.previousStatusBeforeCancellation || '',
      cancelledBy: ticket.cancelledBy || cancellationDetails.cancelledBy || '',
      cancelledAt: ticket.cancelledAt || cancellationDetails.cancelledAt || null,
      service: servicesById.get(idFrom(ticket.service)) || ticket.service,
      center: centersById.get(idFrom(ticket.center)) || ticket.center,
      citizen: citizensById.get(idFrom(ticket.citizen)) || ticket.citizen,
      existingRegistration: ticket.existingRegistration
        ? {
            ...ticket.existingRegistration,
            ...(original
              ? formatExistingRegistrationInfo(
                  original,
                  centersById.get(idFrom(original.center)),
                  citizensById.get(idFrom(original.citizen))
                )
              : {})
          }
        : ticket.existingRegistration
    };
  });
};

const hydrateTicket = async (ticket) => {
  if (!ticket) return null;
  const [hydrated] = await hydrateTickets([ticket]);
  return hydrated;
};

const findTicketById = (id) => prisma.ticket.findUnique({ where: { id } });
const findTicketByIdOrRef = (idOrRef) => (
  /^(REQ|NQS)-\d+$/i.test(String(idOrRef || '').trim())
    ? prisma.ticket.findUnique({ where: { ref: String(idOrRef).toUpperCase() } })
    : prisma.ticket.findUnique({ where: { id: idOrRef } })
);

const updateTicketById = async (id, data) => prisma.ticket.update({
  where: { id },
  data: pickTicketData({ ...data, updatedAt: new Date() })
});

const cancellationDetailFieldFor = (ticket = {}) => {
  if (ticket.requestType === 'lost_replacement' || ticket.requestType === 'replace_lost_id') return 'replacementDetails';
  if (ticket.requestType === 'update_information') return 'updateDetails';
  return 'registrationDetails';
};

const getEmbeddedCancellationDetails = (ticket = {}) => (
  ticket.registrationDetails?.cancellationDetails ||
  ticket.replacementDetails?.cancellationDetails ||
  ticket.updateDetails?.cancellationDetails ||
  {}
);

const embedCancellationDetails = (ticket, details) => {
  const field = cancellationDetailFieldFor(ticket);
  ticket[field] = {
    ...(ticket[field] || {}),
    cancellationDetails: details
  };
};

const clearEmbeddedCancellationDetails = (ticket) => {
  const field = cancellationDetailFieldFor(ticket);
  if (!ticket[field]?.cancellationDetails) return;
  const { cancellationDetails: _cancellationDetails, ...details } = ticket[field];
  ticket[field] = details;
};

const comparableText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const comparablePhone = (value) => normalizePhoneForLookup(value);

const comparableDate = (value) => String(value || '').slice(0, 10);

const comparableNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const comparableRegistrationDetails = (details = {}) => ({
  fullName: comparableText(details.fullName),
  phone: comparablePhone(details.phone),
  motherName: comparableText(details.motherName),
  dateOfBirth: comparableDate(details.dateOfBirth),
  age: comparableNumber(details.age),
  gender: comparableText(details.gender),
  maritalStatus: comparableText(details.maritalStatus),
  district: comparableText(details.district),
  address: comparableText(details.address || details.fullAddress),
  nearestLandmark: comparableText(details.nearestLandmark)
});

const comparableReplacementDetails = (details = {}) => ({
  fullName: comparableText(details.fullName),
  phone: comparablePhone(details.phone),
  nationalIdNumber: comparableText(details.nationalIdNumber),
  reason: comparableText(details.reason),
  dateLost: comparableDate(details.dateLost),
  placeLost: comparableText(details.placeLost),
  policeReportNumber: comparableText(details.policeReportNumber),
  policeReportDocument: comparableText(details.policeReportDocument),
  additionalNotes: comparableText(details.additionalNotes || details.notes),
  district: comparableText(details.district || details.centerDistrict)
});

const comparableUpdateDetails = (details = {}) => {
  const changes = Array.isArray(details.changes) && details.changes.length
    ? details.changes
    : details.fieldToUpdate
      ? [{
          field: details.fieldToUpdate,
          currentValue: details.currentValue,
          newValue: details.newValue,
          reason: details.reason
        }]
      : [];

  return {
    fullName: comparableText(details.fullName),
    phone: comparablePhone(details.phone),
    nationalIdNumber: comparableText(details.nationalIdNumber),
    mistakeType: comparableText(details.mistakeType),
    changes: changes
      .map((change) => ({
        field: comparableText(change.field),
        currentValue: comparableText(change.currentValue),
        newValue: comparableText(change.newValue),
        reason: comparableText(change.reason)
      }))
      .sort((a, b) => a.field.localeCompare(b.field)),
    notes: comparableText(details.notes)
  };
};

const comparableUpdateSubmission = (details = {}) => {
  const changes = Array.isArray(details.changes) && details.changes.length
    ? details.changes
    : details.fieldToUpdate
      ? [{
          field: details.fieldToUpdate,
          newValue: details.newValue
        }]
      : [];

  return {
    changes: changes
      .map((change) => ({
        field: comparableText(change.field),
        newValue: normalizeUpdateComparableValue(change.field, change.newValue)
      }))
      .sort((a, b) => a.field.localeCompare(b.field))
  };
};

const sameComparable = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const hasAppointmentChange = (ticket = {}, { centerId = '', date = '', timeSlot = '' } = {}) => (
  String(idFrom(ticket.center) || '') !== String(centerId || '') ||
  String(ticket.date || '') !== String(date || '') ||
  String(ticket.timeSlot || '') !== String(timeSlot || '')
);

const comparableAppointment = ({ centerId = '', date = '', timeSlot = '' } = {}) => ({
  centerId: String(centerId || ''),
  date: String(date || ''),
  timeSlot: String(timeSlot || '')
});

const correctionResolvedFromTicket = (ticket = {}) => Boolean(
  ticket.registrationDetails?.correctionResolved ||
  ticket.replacementDetails?.correctionResolved ||
  ticket.updateDetails?.correctionResolved
);

const setCorrectionResolved = (ticket, resolved) => {
  const field = cancellationDetailFieldFor(ticket);
  ticket[field] = {
    ...(ticket[field] || {}),
    correctionResolved: Boolean(resolved)
  };
};

const correctionSnapshotForTicket = (ticket = {}) => {
  const snapshot = {
    requestType: ticket.requestType || 'new_national_id'
  };

  if (ticket.requestType === 'update_information') {
    snapshot.details = comparableUpdateDetails(ticket.updateDetails || {});
    snapshot.submission = comparableUpdateSubmission(ticket.updateDetails || {});
    return snapshot;
  }

  if (ticket.requestType === 'lost_replacement' || ticket.requestType === 'replace_lost_id') {
    snapshot.details = comparableReplacementDetails(ticket.replacementDetails || {});
  } else {
    snapshot.details = comparableRegistrationDetails(ticket.registrationDetails || {});
  }

  snapshot.appointment = comparableAppointment({
    centerId: idFrom(ticket.center),
    date: ticket.date,
    timeSlot: ticket.timeSlot
  });
  return snapshot;
};

const isBlockingNewRegistration = (ticket) => {
  if (!ticket) return false;
  return (
    BLOCKING_NEW_REGISTRATION_STATUSES.has(ticket.status) ||
    BLOCKING_NEW_REGISTRATION_REQUEST_STATUSES.has(ticket.requestStatus) ||
    ticket.needsResubmission === true
  );
};

const hasIssuedNationalId = (user = {}) => (
  isIssuedNationalIdStatus(user.citizenProfile?.nationalIdStatus || user.nationalIdStatus)
);

const splitCitizenName = (fullName = '') => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : parts[1] || '',
    lastName: parts.length > 2 ? parts[parts.length - 1] : ''
  };
};

const setCitizenNameParts = (user, fullName = '') => {
  const cleanName = String(fullName || '').trim();
  if (!cleanName || !user) return;
  const parts = splitCitizenName(cleanName);
  user.name = cleanName;
  user.firstName = parts.firstName || user.firstName;
  user.middleName = parts.middleName || user.middleName;
  user.lastName = parts.lastName || user.lastName;
};

const hasApprovedRegistration = (ticket) => (
  Boolean(ticket) && (
    ticket.status === 'Completed' ||
    ISSUED_APPLICATION_STATUSES.has(ticket.requestStatus)
  )
);

const hasCitizenNationalIdAccess = (user, registration) => (
  hasIssuedNationalId(user) || hasApprovedRegistration(registration)
);

const getIdentityNationalId = (user = {}, registration = null) => (
  String(
    user.citizenProfile?.nationalId ||
    user.nationalId ||
    registration?.nationalIdNumber ||
    registration?.citizen?.nationalId ||
    registration?.registrationDetails?.nationalIdNumber ||
    ''
  ).trim()
);

const cancellationNotificationType = (ticket) => (
  ticket?.requestType === 'new_national_id' ? 'APPOINTMENT_CANCELLED' : 'REQUEST_CANCELLED'
);

const cleanStringArray = (value) => (
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

const isCompletedTicket = (ticket = {}) => (
  COMPLETED_STATUS_VALUES.has(String(ticket.status || '').trim()) ||
  COMPLETED_STATUS_VALUES.has(String(ticket.requestStatus || '').trim())
);

const citizenCancelWindowExpired = (ticket = {}) => {
  const createdAt = new Date(ticket.createdAt);
  if (Number.isNaN(createdAt.getTime())) return true;
  return Date.now() - createdAt.getTime() > CITIZEN_CANCEL_WINDOW_MS;
};

const ensureCorrectionReasonDocuments = async () => {
  await Promise.all(
    CORRECTION_REASON_CATALOG.map((reason) => (
      prisma.correctionReason.upsert({
        where: { code: reason.code },
        update: {
          reasonName: reason.reasonName,
          fieldName: reason.fieldName,
          category: reason.category,
          isActive: true
        },
        create: {
          code: reason.code,
          reasonName: reason.reasonName,
          fieldName: reason.fieldName,
          category: reason.category,
          isActive: true
        }
      })
    ))
  );

  return prisma.correctionReason.findMany({
    where: {
      code: { in: CORRECTION_REASON_CATALOG.map((reason) => reason.code) },
      isActive: true
    }
  });
};

const resolveCorrectionReasons = async (inputReasons = []) => {
  const requested = cleanStringArray(inputReasons);
  if (!requested.length) {
    return { error: 'Please select at least one correction reason.' };
  }

  const reasonDocs = await ensureCorrectionReasonDocuments();
  const byId = new Map(reasonDocs.map((reason) => [String(reason.id), reason]));
  const byCode = new Map(reasonDocs.map((reason) => [reason.code, reason]));
  const byName = new Map(reasonDocs.map((reason) => [reason.reasonName, reason]));

  const resolved = [];
  const invalid = [];
  requested.forEach((value) => {
    const match = byId.get(value) || byCode.get(value) || byName.get(value);
    if (match) {
      if (!resolved.some((reason) => String(reason.id) === String(match.id))) {
        resolved.push(match);
      }
    } else {
      invalid.push(value);
    }
  });

  if (invalid.length) {
    return { error: `Invalid correction reason selected: ${invalid.join(', ')}` };
  }

  return { reasons: resolved };
};

const formatCorrectionNotificationMessage = ({ ticket, reasons, additionalNote }) => {
  const reasonList = reasons.map((reason) => `- ${reason.reasonName}`).join('\n');
  return `Your National ID registration request ${ticket.ref} requires corrections before it can continue.\n\nProblems found:\n${reasonList}\n\nAdmin note:\n${additionalNote}`;
};

const flattenCorrectionValues = (source = {}, prefix = '') => (
  Object.entries(source || {}).reduce((items, [key, value]) => {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) return items;
    if (Array.isArray(value)) {
      items[fieldName] = JSON.stringify(value);
      return items;
    }
    if (typeof value === 'object') {
      return { ...items, ...flattenCorrectionValues(value, fieldName) };
    }
    items[fieldName] = String(value);
    return items;
  }, {})
);

const createCorrectionHistory = async ({ ticket, before, after, changedBy }) => {
  const oldValues = flattenCorrectionValues(before);
  const newValues = flattenCorrectionValues(after);
  const changedFields = Object.keys(newValues).filter((field) => oldValues[field] !== newValues[field]);

  if (!changedFields.length) return;

  await prisma.requestCorrectionHistory.createMany({
    data: changedFields.map((fieldName) => ({
      request: ticket.id,
      fieldName,
      oldValue: oldValues[fieldName] || '',
      correctedValue: newValues[fieldName] || '',
      changedBy
    }))
  });
};

const buildCancellationPayload = (body = {}) => {
  const inputReasons = cleanStringArray(body.cancellationReasons || body.reasonIds || body.reasons);
  const legacyReason = String(body.cancellationReason || body.rejectionReason || body.reason || '').trim();
  const additionalReason = String(body.additionalReason || body.additionalCancellationReason || '').trim();
  const additionalNotes = String(body.additionalNotes || body.cancellationNotes || '').trim();

  let selectedReasons = [...new Set(inputReasons)];
  if (!selectedReasons.length && legacyReason) {
    if (CANCELLATION_REASON_OPTIONS.includes(legacyReason) || legacyReason === OTHER_CANCELLATION_REASON) {
      selectedReasons = [legacyReason];
    } else {
      selectedReasons = [OTHER_CANCELLATION_REASON];
    }
  }

  if (!selectedReasons.length) {
    return { error: 'Please select at least one cancellation reason.' };
  }

  const customSelectedReasons = selectedReasons.filter((reason) => (
    reason !== OTHER_CANCELLATION_REASON && !CANCELLATION_REASON_OPTIONS.includes(reason)
  ));
  if (customSelectedReasons.length) {
    selectedReasons = selectedReasons.filter((reason) => (
      reason === OTHER_CANCELLATION_REASON || CANCELLATION_REASON_OPTIONS.includes(reason)
    ));
    if (!selectedReasons.includes(OTHER_CANCELLATION_REASON)) {
      selectedReasons.push(OTHER_CANCELLATION_REASON);
    }
  }

  const invalidReasons = selectedReasons.filter((reason) => (
    reason !== OTHER_CANCELLATION_REASON && !CANCELLATION_REASON_OPTIONS.includes(reason)
  ));
  if (invalidReasons.length) {
    return { error: `Invalid cancellation reason selected: ${invalidReasons.join(', ')}` };
  }

  const requiresOtherText = selectedReasons.includes(OTHER_CANCELLATION_REASON);
  const resolvedAdditionalReason = additionalReason || customSelectedReasons.join(', ') || (
    requiresOtherText && legacyReason && !CANCELLATION_REASON_OPTIONS.includes(legacyReason)
      ? legacyReason
      : ''
  );
  if (requiresOtherText && !resolvedAdditionalReason) {
    return { error: 'Please enter the additional cancellation reason.' };
  }

  const displayReasons = selectedReasons.filter((reason) => reason !== OTHER_CANCELLATION_REASON);
  if (requiresOtherText) {
    displayReasons.push(resolvedAdditionalReason);
  }

  return {
    reasons: selectedReasons,
    displayReasons,
    additionalReason: resolvedAdditionalReason,
    additionalNotes,
    summary: displayReasons.join(', ')
  };
};

const applyCancellationDetails = (ticket, cancellation, previousStatus, userId) => {
  const cancelledAt = new Date();
  ticket.cancellationReasons = cancellation.reasons;
  ticket.additionalCancellationReason = cancellation.additionalReason;
  ticket.cancellationNotes = cancellation.additionalNotes;
  ticket.cancellationReason = cancellation.summary;
  ticket.previousStatusBeforeCancellation = previousStatus || '';
  ticket.cancelledBy = userId;
  ticket.cancelledAt = cancelledAt;
  setCorrectionResolved(ticket, false);
  embedCancellationDetails(ticket, {
    cancellationReasons: cancellation.reasons,
    additionalCancellationReason: cancellation.additionalReason,
    cancellationNotes: cancellation.additionalNotes,
    cancellationReason: cancellation.summary,
    summary: cancellation.summary,
    previousStatusBeforeCancellation: previousStatus || '',
    cancelledBy: userId,
    cancelledAt: cancelledAt.toISOString(),
    snapshot: correctionSnapshotForTicket(ticket)
  });
};

const cancellationDetailsFromTicket = (ticket = {}) => {
  const rawReasons = cleanStringArray(ticket.cancellationReasons);
  const additionalReason = String(ticket.additionalCancellationReason || '').trim();
  const displayReasons = rawReasons
    .filter((reason) => reason !== OTHER_CANCELLATION_REASON)
    .concat(rawReasons.includes(OTHER_CANCELLATION_REASON) && additionalReason ? [additionalReason] : [])
    .filter(Boolean);

  if (displayReasons.length) {
    return {
      reasons: rawReasons,
      displayReasons,
      additionalReason,
      additionalNotes: ticket.cancellationNotes || '',
      summary: displayReasons.join(', ')
    };
  }

  const legacyReason = String(ticket.cancellationReason || ticket.rejectionReason || 'No reason provided.').trim();
  return {
    reasons: legacyReason ? [legacyReason] : [],
    displayReasons: legacyReason ? [legacyReason] : [],
    additionalReason: '',
    additionalNotes: ticket.cancellationNotes || '',
    summary: legacyReason || 'No reason provided.'
  };
};

const assertCanCancelTicket = (ticket) => {
  if (isCompletedTicket(ticket)) {
    return ERRORS.APPOINTMENT_ALREADY_COMPLETED;
  }
  const status = String(ticket?.status || '').trim();
  const requestStatus = String(ticket?.requestStatus || '').trim();
  if (['Cancelled', 'Expired'].includes(status) || ['Cancelled', 'CANCELLED'].includes(requestStatus)) {
    return 'This appointment/request cannot be cancelled in its current status.';
  }
  return '';
};

const createCancellationNotification = async ({ ticket, reason, previousStatus = '' }) => {
  if (!ticket?.citizen) return null;

  const requestLabel = getRequestLabel(ticket.requestType);
  const title = ticket.requestType === 'new_national_id' ? 'Appointment Cancelled' : 'Request Cancelled';
  const cancellationDate = ticket.cancelledAt || new Date();
  const cancellation = cancellationDetailsFromTicket(ticket);
  const cleanReason = String(reason || cancellation.summary || 'No reason provided.').trim();
  const reasonsList = cancellation.displayReasons.map((item) => `- ${item}`).join('\n');
  const additionalNoteText = cancellation.additionalNotes
    ? `\n\nAdditional note:\n${cancellation.additionalNotes}`
    : '';
  const message = ticket.requestType === 'new_national_id'
    ? `Your National ID appointment with reference number ${ticket.ref} has been cancelled.\n\nReasons:\n${reasonsList}${additionalNoteText}`
    : `Your ${requestLabel} request with reference number ${ticket.ref} has been cancelled.\n\nReasons:\n${reasonsList}${additionalNoteText}`;

  return prisma.notification.create({
    data: {
      user: typeof ticket.citizen === 'object' ? ticket.citizen?.id : ticket.citizen,
      title,
      desc: message,
      category: 'Appointments',
      notificationType: cancellationNotificationType(ticket),
      referenceNumber: ticket.ref,
      requestType: ticket.requestType,
      relatedEntity: ticket.id,
      relatedEntityType: 'Ticket',
      cancellationReason: cleanReason,
      cancellationReasons: cancellation.reasons,
      additionalCancellationReason: cancellation.additionalReason,
      cancellationNotes: cancellation.additionalNotes,
      cancellationDate,
      previousStatus,
      newStatus: 'Cancelled',
      read: false
    }
  });
};

const createAdminRequestNotifications = async ({ ticket, service, center, requestLabel }) => {
  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        { role: { in: ['admin', 'super_admin'] }, status: { not: 'Locked' } },
        {
          center: center.id,
          role: { in: ['operator', 'super_operator', 'center_manager'] },
          status: { in: ['active', 'Active'] }
        }
      ]
    },
    select: { id: true, role: true }
  });
  if (!recipients.length) return [];

  const title = ticket.requestType === 'new_national_id'
    ? 'New Appointment Booked'
    : ticket.requestType === 'update_information'
      ? 'New Update Information Request'
      : 'New Lost ID Replacement Request';
  const desc = `${ticket.citizenName || 'Citizen'} submitted ${requestLabel} ${ticket.ref} at ${center.name}.`;

  return Promise.all(recipients.map((recipient) => prisma.notification.create({
    data: {
      user: recipient.id,
      title,
      desc,
      category: 'Appointments',
      notificationType: isAdminRole(recipient.role) ? 'ADMIN_NEW_REQUEST' : 'CENTER_NEW_REQUEST',
      referenceNumber: ticket.ref,
      requestType: ticket.requestType,
      relatedEntity: ticket.id,
      relatedEntityType: 'Ticket',
      newStatus: ticket.status || 'Pending'
    }
  })));
};

const futureExpiryDate = (years = 10) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date;
};

const randomDigits = (length = 6) => String(Math.floor(Math.random() * (10 ** length))).padStart(length, '0');

const generateCardSerialNumber = async () => {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const cardSerialNumber = `CARD-${year}-${randomDigits(6)}`;
    const exists = await prisma.user.count({ where: { cardSerialNumber } });
    if (!exists) return cardSerialNumber;
  }
  throw new Error('Could not generate a unique card serial number.');
};

const findActiveRequestForCitizen = async ({ citizenId, requestType, excludeId = null }) => {
  const query = {
    citizen: citizenId,
    requestType,
    ...(excludeId ? { id: { not: excludeId } } : {}),
    OR: [
      { status: { in: ACTIVE_TICKET_STATUSES } },
      { requestStatus: { in: ACTIVE_REQUEST_STATUSES } }
    ]
  };

  return prisma.ticket.findFirst({
    where: query,
    orderBy: { createdAt: 'desc' }
  });
};

const findOpenUpdateRequestForCitizen = async ({ citizenId, excludeId = null }) => prisma.ticket.findFirst({
  where: {
    citizen: citizenId,
    requestType: 'update_information',
    ...(excludeId ? { id: { not: excludeId } } : {}),
    OR: [
      { status: { in: ['Pending', 'On Hold', 'Waiting', 'Being Served', 'In Progress'] } },
      { requestStatus: { in: ['Pending', 'Under Review', 'Approved', 'In Progress', 'Resubmission Required'] } }
    ]
  },
  orderBy: { createdAt: 'desc' }
});

const issueInitialNationalId = async (ticket, reviewedBy) => {
  if (!ticket?.citizen) return null;

  const citizenId = idFrom(ticket.citizen);
  const user = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
  if (!user) return null;

  user.nationalId = await ensureCitizenPermanentNqsId(user);
  if (!user.cardSerialNumber) {
    user.cardSerialNumber = ticket.cardSerialNumber || await generateCardSerialNumber();
  }

  setCitizenNameParts(user, ticket.registrationDetails?.fullName || user.name);

  const updatedUser = await syncCitizenIdentityProfile(user.id, {
    nationalId: user.nationalId,
    cardSerialNumber: user.cardSerialNumber,
    name: ticket.registrationDetails?.fullName || user.name,
    fullName: ticket.registrationDetails?.fullName || user.name,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    phone: ticket.registrationDetails?.phone || user.phone,
    dateOfBirth: ticket.registrationDetails?.dateOfBirth || user.dateOfBirth,
    address: ticket.registrationDetails?.fullAddress || ticket.registrationDetails?.address || user.address,
    district: ticket.registrationDetails?.district || ticket.district,
    center: idFrom(ticket.center) || user.center,
    maritalStatus: ticket.registrationDetails?.maritalStatus || user.maritalStatus,
    nationalIdStatus: 'COMPLETED',
    cardStatus: 'ACTIVE',
    cardIssueDate: user.cardIssueDate || new Date(),
    cardExpiryDate: user.cardExpiryDate || futureExpiryDate(),
    approvedRegistration: ticket.id
  });

  ticket.nationalIdNumber = user.nationalId;
  ticket.cardSerialNumber = user.cardSerialNumber;
  ticket.cardStatus = 'ACTIVE';
  ticket.registrationDetails = {
    ...(ticket.registrationDetails || {}),
    nationalIdNumber: user.nationalId,
    completedAt: ticket.registrationDetails?.completedAt || new Date().toISOString(),
    issuedAt: ticket.registrationDetails?.issuedAt || new Date().toISOString()
  };
  ticket.reviewedBy = reviewedBy || ticket.reviewedBy;
  ticket.reviewedAt = new Date();
  return updatedUser;
};

const ensureIssuedNationalIdFromRegistration = async (userDoc, registration, reviewedBy = null) => {
  if (hasIssuedNationalId(userDoc) || !hasApprovedRegistration(registration)) {
    return userDoc;
  }

  const updatedUser = await issueInitialNationalId(registration, reviewedBy);
  // We'll assume caller saves `registration`
  return updatedUser || userDoc;
};

const completeLostIdReplacement = async (ticket, reviewedBy) => {
  if (!ticket?.citizen) return null;

  const citizenId = idFrom(ticket.citizen);
  const user = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
  if (!user) return null;

  user.nationalId = await ensureCitizenPermanentNqsId(user);

  const cardHistory = user.cardHistory ? [...user.cardHistory] : [];
  if (user.cardSerialNumber) {
    cardHistory.push({
      serialNumber: user.cardSerialNumber,
      status: 'LOST',
      reason: ticket.replacementDetails?.reason || 'Lost ID replacement completed',
      ticket: ticket.id
    });
  }

  const newCardSerialNumber = await generateCardSerialNumber();
  
  const updatedUser = await syncCitizenIdentityProfile(user.id, {
    nationalId: user.nationalId,
    cardHistory,
    cardSerialNumber: newCardSerialNumber,
    cardStatus: 'ACTIVE',
    nationalIdStatus: 'COMPLETED',
    cardIssueDate: new Date(),
    cardExpiryDate: futureExpiryDate(),
    replacementCount: Number(user.replacementCount || 0) + 1
  });

  ticket.nationalIdNumber = user.nationalId;
  ticket.cardSerialNumber = newCardSerialNumber;
  ticket.cardStatus = 'ACTIVE';
  if (ticket.replacementDetails && typeof ticket.replacementDetails === 'object') {
    ticket.replacementDetails = {
      ...ticket.replacementDetails,
      nationalIdNumber: user.nationalId
    };
  }
  ticket.reviewedBy = reviewedBy || ticket.reviewedBy;
  ticket.reviewedAt = new Date();
  return updatedUser;
};

const applyApprovedUpdateDetails = async (ticket, reviewedBy) => {
  if (!ticket?.citizen) return null;

  const citizenId = idFrom(ticket.citizen);
  const user = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
  if (!user) return null;
  user.nationalId = await ensureCitizenPermanentNqsId(user);

  const changes = ticket.updateDetails?.changes?.length
    ? ticket.updateDetails.changes
    : [{
        field: ticket.updateDetails?.fieldToUpdate,
        newValue: ticket.updateDetails?.newValue
      }].filter((change) => change.field);

  changes.forEach((change) => {
    const field = String(change.field || '').trim().toLowerCase();
    const compactField = field.replace(/[^a-z0-9]/g, '');
    const value = String(change.newValue || '').trim();
    if (!value) return;
    // National ID is permanent — ignore any attempt to change it via update request.
    if (compactField.includes('nationalid') || compactField === 'idnumber' || compactField === 'nqs') return;

    if (field === 'name' || field === 'full name') setCitizenNameParts(user, value);
    if (field.includes('phone')) user.phone = value;
    if (field.includes('address')) user.address = value;
    if (field.includes('birth')) user.dateOfBirth = value;
    if (field.includes('district')) user.district = value;
    if (field.includes('marital')) {
      const normalizedMaritalStatus = value.toUpperCase();
      if (['SINGLE', 'MARRIED'].includes(normalizedMaritalStatus)) {
        user.maritalStatus = normalizedMaritalStatus;
      }
    }
  });

  const originalRegistrationId = idFrom(ticket.existingRegistration?.ticket || ticket.existingRegistration?.originalRegistrationId);
  if (originalRegistrationId) {
    const originalRegistration = await prisma.ticket.findUnique({ where: { id: originalRegistrationId } });
    if (originalRegistration) {
      const nextRegistrationDetails = {
        ...(originalRegistration.registrationDetails || {})
      };

      changes.forEach((change) => {
        const field = String(change.field || '').trim().toLowerCase();
        const compactField = field.replace(/[^a-z0-9]/g, '');
        const value = String(change.newValue || '').trim();
        if (!value) return;
        if (compactField.includes('nationalid') || compactField === 'idnumber' || compactField === 'nqs') return;

        if (field === 'name' || field === 'full name') {
          nextRegistrationDetails.fullName = value;
        } else if (field.includes('mother')) {
          nextRegistrationDetails.motherName = value;
        } else if (field.includes('phone')) {
          nextRegistrationDetails.phone = value;
        } else if (field.includes('address')) {
          nextRegistrationDetails.address = value;
          nextRegistrationDetails.fullAddress = value;
        } else if (field.includes('birth')) {
          nextRegistrationDetails.dateOfBirth = value;
        } else if (field.includes('district')) {
          nextRegistrationDetails.district = value;
        } else if (field.includes('marital')) {
          const normalizedMaritalStatus = normalizeUpdateComparableValue('maritalStatus', value);
          if (['SINGLE', 'MARRIED'].includes(normalizedMaritalStatus)) {
            nextRegistrationDetails.maritalStatus = normalizedMaritalStatus;
          }
        } else if (field.includes('gender')) {
          nextRegistrationDetails.gender = value;
        } else if (field.includes('landmark')) {
          nextRegistrationDetails.nearestLandmark = value;
        }
      });

      await prisma.ticket.update({
        where: { id: originalRegistrationId },
        data: {
          citizenName: nextRegistrationDetails.fullName || originalRegistration.citizenName,
          district: nextRegistrationDetails.district || originalRegistration.district,
          registrationDetails: nextRegistrationDetails,
          updatedAt: new Date()
        }
      });
    }
  }

  ticket.nationalIdNumber = getIdentityNationalId(user, ticket) || ticket.updateDetails?.nationalIdNumber || '';
  ticket.reviewedBy = reviewedBy || ticket.reviewedBy;
  ticket.reviewedAt = new Date();

  const updatedUser = await syncCitizenIdentityProfile(user.id, {
    nationalId: user.nationalId,
    name: user.name,
    fullName: user.name,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    phone: user.phone,
    address: user.address,
    dateOfBirth: user.dateOfBirth,
    district: user.district,
    maritalStatus: user.maritalStatus
  });

  ticket.nationalIdNumber = getIdentityNationalId(user, ticket) || ticket.updateDetails?.nationalIdNumber || '';
  ticket.reviewedBy = reviewedBy || ticket.reviewedBy;
  ticket.reviewedAt = new Date();
  return updatedUser;
};

const buildExistingRegistrationInfo = (ticket) => formatExistingRegistrationInfo(ticket);

const getNationalIdFromExistingRegistration = (ticket, user = {}) => (
  String(
    user.nationalId ||
    ticket?.citizen?.nationalId ||
    ticket?.registrationDetails?.nationalIdNumber ||
    ''
  ).trim()
);

const formatMaritalStatusForDisplay = (value = '') => {
  const normalized = normalizeUpdateComparableValue('maritalStatus', value);
  if (normalized === 'SINGLE') return 'Single';
  if (normalized === 'MARRIED') return 'Married';
  return String(value || '').trim();
};

const buildCurrentNationalIdSnapshot = (ticket, user = {}) => {
  const details = ticket?.registrationDetails || {};
  return {
    fullName: details.fullName || ticket?.citizenName || user.name || '',
    motherName: details.motherName || '',
    dateOfBirth: details.dateOfBirth || user.dateOfBirth || '',
    phone: details.phone || ticket?.citizen?.phone || user.phone || '',
    gender: details.gender || '',
    maritalStatus: formatMaritalStatusForDisplay(details.maritalStatus || user.maritalStatus || ''),
    district: details.district || ticket?.district || user.district || '',
    address: details.fullAddress || details.address || user.address || '',
    nearestLandmark: details.nearestLandmark || '',
    nationalIdNumber: getNationalIdFromExistingRegistration(ticket, user)
  };
};

const snapshotValueForField = (snapshot = {}, field = '') => {
  const key = String(field || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const values = {
    name: snapshot.fullName,
    fullname: snapshot.fullName,
    mothersname: snapshot.motherName,
    mothername: snapshot.motherName,
    dateofbirth: snapshot.dateOfBirth,
    birthdate: snapshot.dateOfBirth,
    phone: snapshot.phone,
    phonenumber: snapshot.phone,
    address: snapshot.address,
    fulladdress: snapshot.address,
    maritalstatus: snapshot.maritalStatus,
    district: snapshot.district,
    gender: snapshot.gender,
    nearestlandmark: snapshot.nearestLandmark,
    nationalidnumber: snapshot.nationalIdNumber
  };
  return values[key] || '';
};

const getExistingRegistrationCurrentValue = (ticket, field, user = {}) => {
  const snapshot = buildCurrentNationalIdSnapshot(ticket, user);
  return snapshotValueForField(snapshot, field) || 'Not recorded in current record';
};

const hydrateUpdateDetailsFromExistingRegistration = (details = {}, existingRegistration, user = {}) => {
  const registrationDetails = existingRegistration?.registrationDetails || {};
  const previousData = buildCurrentNationalIdSnapshot(existingRegistration, user);
  const changes = (details.changes?.length
    ? details.changes
    : details.fieldToUpdate
      ? [{
          field: details.fieldToUpdate,
          currentValue: details.currentValue,
          newValue: details.newValue,
          reason: details.reason
        }]
      : []
  ).map((change) => ({
    ...change,
    currentValue: snapshotValueForField(previousData, change.field)
      || change.currentValue
      || 'Not recorded in current record'
  }));

  return {
    ...details,
    fullName: registrationDetails.fullName || existingRegistration?.citizenName || details.fullName || user.name || '',
    phone: registrationDetails.phone || existingRegistration?.citizen?.phone || details.phone || user.phone || '',
    nationalIdNumber: getNationalIdFromExistingRegistration(existingRegistration, user) || details.nationalIdNumber || '',
    selectedFields: details.selectedFields?.length ? details.selectedFields : changes.map((change) => change.field).filter(Boolean),
    changes,
    fieldToUpdate: changes[0]?.field || details.fieldToUpdate || '',
    currentValue: changes[0]?.currentValue || details.currentValue || '',
    newValue: changes[0]?.newValue || details.newValue || '',
    reason: changes[0]?.reason || details.reason || '',
    previousData,
    oldDataSnapshot: previousData,
    originalRegistrationDetails: registrationDetails
  };
};

const canExposeExistingRegistration = (ticket, user) => (
  isAdminRole(user.role) ||
  String(ticket?.citizen?.id || ticket?.citizen?._id || ticket?.citizen || '') === String(user.id)
);

const findExistingNewRegistration = async ({ fullName, phone, userId, onlyBlocking = false }) => {
  const normalizedName = normalizeFullNameForLookup(fullName);
  const normalizedPhone = normalizePhoneForLookup(phone);

  const populateRegistrationTicket = async (query) => hydrateTickets(await prisma.ticket.findMany({
    where: query,
    orderBy: { createdAt: 'asc' }
  }));

  if (userId) {
    const userTickets = await populateRegistrationTicket({ requestType: 'new_national_id', citizen: userId });
    const userMatch = userTickets.find((ticket) => !onlyBlocking || isBlockingNewRegistration(ticket));
    if (userMatch) return userMatch;
  }

  if (!normalizedName || !normalizedPhone) return null;

  const candidates = await populateRegistrationTicket({ requestType: 'new_national_id' });

  return candidates.find((ticket) => {
    if (onlyBlocking && !isBlockingNewRegistration(ticket)) return false;
    const ticketName = normalizeFullNameForLookup(
      ticket.registrationDetails?.fullName || ticket.citizenName || ticket.citizen?.name
    );
    const ticketPhone = normalizePhoneForLookup(
      ticket.registrationDetails?.phone || ticket.citizen?.phone
    );
    return ticketName === normalizedName && ticketPhone === normalizedPhone;
  }) || null;
};

const sanitizeRegistrationDetails = (details = {}, fallbackUser = {}) => ({
  fullName: String(details.fullName || fallbackUser.name || '').trim(),
  phone: String(details.phone || fallbackUser.phone || '').trim(),
  motherName: String(details.motherName || '').trim(),
  dateOfBirth: String(details.dateOfBirth || '').trim(),
  age: Number(details.age || 0),
  gender: String(details.gender || '').trim(),
  maritalStatus: String(details.maritalStatus || '').trim().toUpperCase(),
  district: String(details.district || '').trim(),
  address: String(details.address || details.fullAddress || fallbackUser.address || '').trim(),
  fullAddress: String(details.fullAddress || details.address || fallbackUser.address || '').trim(),
  nearestLandmark: String(details.nearestLandmark || '').trim(),
  selectedCenter: String(details.selectedCenter || '').trim(),
  centerDistrict: String(details.centerDistrict || '').trim(),
  appointmentDate: String(details.appointmentDate || '').trim(),
  appointmentTime: String(details.appointmentTime || '').trim()
});

const normalizeFormText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const isLettersAndSpacesOnly = (value) => /^[A-Za-z\s]+$/.test(String(value || ''));
const isLettersNumbersSpacesOnly = (value) => /^[A-Za-z0-9\s]+$/.test(String(value || ''));
const isAddressTextValid = (value) => /^[A-Za-z0-9\s,]+$/.test(String(value || ''));

const hasMinimumWords = (value, minWords = 2) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  return words.length >= minWords;
};

const isValidGovernmentName = (value, minimumCharacters = 0) => {
  const text = normalizeFormText(value);
  return text.length >= minimumCharacters && isLettersAndSpacesOnly(text) && hasMinimumWords(text);
};

const isValidSomaliPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('252') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^61\d{7}$/.test(local);
};

const calculateAge = (dateOfBirth) => {
  const dob = parseDateKey(dateOfBirth);
  if (!dob) return 0;
  const today = new Date();
  if (dob > today) return 0;
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

const validateRegistrationDetails = (details) => {
  const requiredFields = [
    ['fullName', 'Full name is required.'],
    ['phone', 'Phone number is required.'],
    ['motherName', 'Mother’s name is required.'],
    ['dateOfBirth', 'Date of birth is required.'],
    ['gender', 'Gender is required.'],
    ['maritalStatus', 'Please select your marital status.'],
    ['district', 'District is required.'],
    ['address', 'Full address is required.'],
    ['nearestLandmark', 'Nearest landmark is required.']
  ];
  const missing = requiredFields.find(([field]) => !details[field]);
  if (missing) return missing[1];
  const fullName = normalizeFormText(details.fullName);
  const motherName = normalizeFormText(details.motherName);
  const district = normalizeFormText(details.district);
  const nearestLandmark = normalizeFormText(details.nearestLandmark);
  const address = normalizeFormText(details.address || details.fullAddress);
  if (!isLettersAndSpacesOnly(fullName)) return 'Full Name must contain letters only.';
  if (fullName.length < 5) return 'Full Name must be at least 5 characters.';
  if (!hasMinimumWords(fullName)) return 'Full Name must contain at least two words.';
  if (!isLettersAndSpacesOnly(motherName)) return "Mother's Name must contain letters only.";
  if (!hasMinimumWords(motherName)) return "Mother's Name must contain at least two words.";
  if (!isValidSomaliPhone(details.phone)) return 'Enter a valid Somali phone number.';
  if (!['Male', 'Female'].includes(details.gender)) return 'Gender must be Male or Female.';
  if (!['SINGLE', 'MARRIED'].includes(details.maritalStatus)) return 'Please select your marital status.';
  if (!isLettersNumbersSpacesOnly(district)) return 'District can contain letters, numbers, and spaces only.';
  if (!isLettersNumbersSpacesOnly(nearestLandmark)) return 'Nearest landmark can contain letters, numbers, and spaces only.';
  if (!isAddressTextValid(address)) return 'Full address can contain letters, numbers, spaces, and commas only.';
  const dob = parseDateKey(details.dateOfBirth);
  if (!dob || dateKey(dob) !== details.dateOfBirth) return ERRORS.INVALID_DATE;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (dob > today) return ERRORS.FUTURE_DATE_NOT_ALLOWED;
  return '';
};

const getRequestLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'lost National ID replacement';
  if (requestType === 'update_information') return 'National ID information update';
  if (requestType === 'service_request') return 'National ID service';
  return 'National ID appointment';
};

const DEFAULT_SCHEDULE = {
  workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  closedDays: ['Friday'],
  startTime: '08:00',
  endTime: '16:00',
  breakTime: { start: '', end: '' },
  slotDuration: 30,
  maxBookingsPerSlot: 5,
  maxAppointmentsPerDay: 100,
  closedDates: [],
  specialUnavailableDates: [],
  isActive: true
};

const dayName = (date) => date.toLocaleDateString('en-US', { weekday: 'long' });
const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalizeDayList = (days, fallback) => {
  const source = Array.isArray(days)
    ? days
    : (typeof days === 'string' && days.trim()
      ? days.split(/[,|]/).map((part) => part.trim()).filter(Boolean)
      : null);
  if (!source) return fallback;
  const normalized = source
    .map((day) => {
      if (typeof day === 'number') return WEEK_DAYS[day];
      if (/^\d+$/.test(String(day))) return WEEK_DAYS[Number(day)];
      return String(day || '').trim();
    })
    .filter((day) => WEEK_DAYS.includes(day));
  return normalized.length ? [...new Set(normalized)] : fallback;
};

const normalizeDateKeyList = (value) => {
  const source = Array.isArray(value)
    ? value
    : (typeof value === 'string' && value.trim() ? [value.trim()] : []);
  return [...new Set(
    source
      .map((item) => {
        const text = String(item || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        const parsed = parseDateKey(text.slice(0, 10));
        return parsed ? dateKey(parsed) : '';
      })
      .filter(Boolean)
  )];
};

const normalizeTimeValue = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const [hourValue, minuteValue = '00'] = raw.split(':').map(Number);
  if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) return fallback;
  return `${String(hourValue).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')}`;
};

const timeToMinutes = (value) => {
  const normalized = normalizeTimeValue(value, '');
  const [hour, minute] = normalized.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const minutesToSlotLabel = (minutes) => {
  const hourValue = Math.floor(minutes / 60);
  const minuteValue = minutes % 60;
  const period = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')} ${period}`;
};

const normalizeSchedule = (payload = {}, center = {}) => {
  const workingDays = normalizeDayList(payload.workingDays, DEFAULT_SCHEDULE.workingDays);
  const closedDays = normalizeDayList(payload.closedDays || payload.dayOff, WEEK_DAYS.filter((day) => !workingDays.includes(day)));
  return {
    ...DEFAULT_SCHEDULE,
    ...payload,
    workingDays,
    closedDays,
    startTime: normalizeTimeValue(payload.startTime, DEFAULT_SCHEDULE.startTime),
    endTime: normalizeTimeValue(payload.endTime, DEFAULT_SCHEDULE.endTime),
    breakTime: {
      start: normalizeTimeValue(payload.breakTime?.start, ''),
      end: normalizeTimeValue(payload.breakTime?.end, '')
    },
    slotDuration: Math.max(5, Number(payload.slotDuration || DEFAULT_SCHEDULE.slotDuration)),
    maxBookingsPerSlot: Math.max(1, Number(payload.maxBookingsPerSlot || payload.maxAppointmentsPerSlot || DEFAULT_SCHEDULE.maxBookingsPerSlot)),
    maxAppointmentsPerDay: Math.max(1, Number(payload.maxAppointmentsPerDay || center.capacity || DEFAULT_SCHEDULE.maxAppointmentsPerDay)),
    closedDates: normalizeDateKeyList(payload.closedDates),
    specialUnavailableDates: normalizeDateKeyList(payload.specialUnavailableDates),
    isActive: payload.isActive ?? true
  };
};

const getCenterSchedule = (center = {}) => normalizeSchedule({
  workingDays: center.workingDays,
  closedDays: center.closedDays,
  startTime: center.startTime,
  endTime: center.endTime,
  breakTime: center.breakTime,
  slotDuration: center.slotDuration,
  maxBookingsPerSlot: center.maxBookingsPerSlot,
  maxAppointmentsPerDay: center.maxAppointmentsPerDay,
  closedDates: center.closedDates,
  specialUnavailableDates: center.specialUnavailableDates,
  isActive: center.isActive
}, center);

/** Slot capacity follows Number of Counters (1 counter = 1 registration per time slot). */
const getSlotCapacity = (center = {}, schedule = {}) => {
  const counters = Number(center.counters);
  if (Number.isFinite(counters) && counters >= 1) {
    return Math.floor(counters);
  }
  return Math.max(1, Number(schedule.maxBookingsPerSlot || DEFAULT_SCHEDULE.maxBookingsPerSlot));
};

const getScheduleSlots = (schedule) => {
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  const duration = Math.max(5, Number(schedule.slotDuration || DEFAULT_SCHEDULE.slotDuration));
  const breakStart = timeToMinutes(schedule.breakTime?.start);
  const breakEnd = timeToMinutes(schedule.breakTime?.end);
  if (start === null || end === null || end < start) return [];

  const slots = [];
  for (let cursor = start; cursor <= end; cursor += duration) {
    const insideBreak = breakStart !== null && breakEnd !== null && cursor >= breakStart && cursor < breakEnd;
    if (!insideBreak) {
      slots.push(minutesToSlotLabel(cursor));
    }
  }
  return slots;
};

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const dateKeyFromValue = (value) => {
  if (!value) return '';
  const directDate = parseDateKey(value);
  if (directDate) return dateKey(directDate);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return dateKey(parsed);
};

const getRegistrationCompletedDateKey = (registration = {}) => (
  dateKeyFromValue(
    registration.registrationDetails?.completedAt ||
    registration.registrationDetails?.issuedAt ||
    registration.citizen?.cardIssueDate ||
    registration.updatedAt
  )
);

const validateReplacementLostDate = (details = {}, existingRegistration = {}) => {
  const lostDate = parseDateKey(details.dateLost);
  if (!lostDate || dateKey(lostDate) !== details.dateLost) {
    return 'Date lost must be a valid date.';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (lostDate > today) {
    return 'Date lost cannot be in the future.';
  }

  const completedKey = getRegistrationCompletedDateKey(existingRegistration);
  const completedDate = parseDateKey(completedKey);
  if (completedDate && lostDate < completedDate) {
    return `Date lost cannot be before your National ID was completed on ${completedKey}.`;
  }

  return '';
};

const isCenterUnavailableOnDate = (center, schedule, date) => {
  const key = dateKey(date);
  const weekday = dayName(date);
  const closedDates = normalizeDateKeyList(schedule.closedDates);
  const specialDates = normalizeDateKeyList(schedule.specialUnavailableDates);
  const workingDays = normalizeDayList(schedule.workingDays, DEFAULT_SCHEDULE.workingDays);
  const closedDays = normalizeDayList(
    schedule.closedDays,
    WEEK_DAYS.filter((day) => !workingDays.includes(day))
  );
  return (
    center.status !== 'Active' ||
    schedule.isActive === false ||
    !workingDays.includes(weekday) ||
    closedDays.includes(weekday) ||
    closedDates.includes(key) ||
    specialDates.includes(key)
  );
};

// @desc    Get booking date and time-slot availability for a center
// @route   GET /api/bookings/availability
// @access  Private/Citizen or Admin

export class BookingService {
  static async getBookingAvailability({ body, query, params, user, ip, io }) {

  try {
    const { centerId, start, end } = query;

    if (!centerId) {
      throw { statusCode: 400, message: 'Center is required.' };
    }

    const center = await prisma.center.findUnique({ where: { id: centerId } });
    if (!center || !isBanaadirNationalIdCenter(center)) {
      throw { statusCode: 404, message: 'Approved Banaadir center not found.' };
    }

    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setDate(today.getDate() + 30);

    const startDate = parseDateKey(start) || today;
    const endDate = parseDateKey(end) || defaultEnd;
    const startKey = dateKey(startDate);
    const endKey = dateKey(endDate);
    const schedule = getCenterSchedule(center);
    const scheduleSlots = getScheduleSlots(schedule);

    const tickets = await prisma.ticket.findMany({
      where: {
        center: centerId,
        date: { gte: startKey, lte: endKey },
        status: { not: 'Cancelled' },
        timeSlot: { in: scheduleSlots }
      },
      select: { date: true, timeSlot: true, status: true }
    });

    const bookedByDate = tickets.reduce((map, ticket) => {
      const slots = map.get(ticket.date) || {};
      if (ticket.timeSlot) {
        slots[ticket.timeSlot] = (slots[ticket.timeSlot] || 0) + 1;
      }
      map.set(ticket.date, slots);
      return map;
    }, new Map());

    const dates = {};
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = dateKey(cursor);
      const slotCounts = bookedByDate.get(key) || {};
      const bookedSlots = Object.entries(slotCounts)
        .filter(([, count]) => count >= getSlotCapacity(center, schedule))
        .map(([slot]) => slot);
      const closed = isCenterUnavailableOnDate(center, schedule, cursor);
      const dayTotal = await prisma.ticket.count({
        where: {
          center: centerId,
          date: key,
          status: { not: 'Cancelled' }
        }
      });
      dates[key] = {
        status: closed
          ? 'closed'
          : dayTotal >= Number(schedule.maxAppointmentsPerDay || DEFAULT_SCHEDULE.maxAppointmentsPerDay)
            ? 'full'
            : bookedSlots.length >= scheduleSlots.length
            ? 'full'
            : 'available',
        bookedSlots
      };
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      data: {
        centerId,
        timeSlots: scheduleSlots,
        schedule: {
          ...schedule,
          maxBookingsPerSlot: getSlotCapacity(center, schedule)
        },
        dates
      }
    };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Create a new booking/appointment
// @route   POST /api/bookings
// @access  Private/Citizen or Admin

  static async createBooking({ body, query, params, user, ip, io }) {

  try {
    const { serviceId, centerId, date, timeSlot, citizenName, registrationDetails, replacementDetails, updateDetails, serviceRequestDetails, otpToken } = body;
    const requestedCenterId = idFrom(centerId);

    let citizenAccount = await prisma.user.findUnique({ where: { id: user.id }, include: { citizenProfile: true } });
    if (!citizenAccount) {
      throw { statusCode: 404, message: 'Citizen account not found.' };
    }
    citizenAccount.nationalId = await ensureCitizenPermanentNqsId(citizenAccount);

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const isUpdateService = isUpdateNationalIdInformationService(service);
    const center = requestedCenterId
      ? await prisma.center.findUnique({ where: { id: requestedCenterId } })
      : isUpdateService && citizenAccount.center
        ? await prisma.center.findUnique({ where: { id: citizenAccount.center } })
        : isUpdateService
          ? await prisma.center.findFirst({ where: { city: 'Banaadir', name: 'Banaadir National ID Center' } })
          : null;

    if (!service || !center) {
      throw { statusCode: 404, message: 'Service or Center not found' };
    }

    if (!isNationalIdService(service) || !isBanaadirNationalIdCenter(center)) {
      throw { statusCode: 400, message: 'Bookings are limited to National ID services at approved Banaadir centers' };
    }

    const resolvedCenterId = center.id || requestedCenterId;
    if (normalizeRole(user.role) === 'citizen' && citizenAccount.center && citizenAccount.center !== resolvedCenterId) {
      throw { statusCode: 403, message: 'Your account belongs to another service center. You can only create requests for your assigned center.' };
    }

    const isReplacement = isLostNationalIdReplacementService(service);
    const isUpdateRequest = isUpdateService;
    const isNewRegistration = isNewNationalIdRegistrationService(service);
    const isGeneralServiceRequest = !isReplacement && !isUpdateRequest && !isNewRegistration;
    const requestType = isReplacement ? 'lost_replacement' : isUpdateRequest ? 'update_information' : isNewRegistration ? 'new_national_id' : 'service_request';
    const openUpdateRequest = normalizeRole(user.role) === 'citizen'
      ? await findOpenUpdateRequestForCitizen({ citizenId: user.id })
      : null;

    if (openUpdateRequest) {
      throw { statusCode: 409, message: isUpdateRequest ? ACTIVE_UPDATE_REQUEST_MESSAGE : UPDATE_REQUEST_BLOCKS_OTHER_SERVICES_MESSAGE };
    }

    const cleanRegistrationDetails = isNewRegistration
      ? sanitizeRegistrationDetails(registrationDetails, user)
      : {};
    const cleanReplacementDetails = isReplacement
      ? sanitizeReplacementDetails(replacementDetails, user)
      : {};
    const cleanServiceRequestDetails = isGeneralServiceRequest
      ? sanitizeServiceRequestDetails(serviceRequestDetails || registrationDetails, user)
      : {};
    let cleanUpdateDetails = isUpdateRequest
      ? sanitizeUpdateDetails(updateDetails, user)
      : {};
    let existingRegistrationInfo = { found: false };
    let existingIdentityTicket = null;

    if (normalizeRole(user.role) === 'citizen') {
      const otpPurpose = isReplacement ? 'replace_lost_id' : isUpdateRequest ? 'update_information' : 'new_id_booking';
      const otpPhone = normalizeOtpPhone(
        isReplacement
          ? cleanReplacementDetails.phone
          : isUpdateRequest
            ? cleanUpdateDetails.phone
            : isGeneralServiceRequest
              ? cleanServiceRequestDetails.phone
              : cleanRegistrationDetails.phone
      );
      if (!verifyOtpToken({
        token: otpToken,
        purpose: otpPurpose,
        userId: user.id,
        phone: otpPhone
      })) {
        throw { statusCode: 401, message: 'OTP verification required before submitting this request.' };
      }
    }

    if (isNewRegistration && hasIssuedNationalId(citizenAccount)) {
      throw { statusCode: 409, message: ISSUED_NATIONAL_ID_MESSAGE };
    }

    if (isNewRegistration) {
      const registrationError = validateRegistrationDetails(cleanRegistrationDetails);
      if (registrationError) {
        throw { statusCode: 400, message: registrationError };
      }
      cleanRegistrationDetails.age = calculateAge(cleanRegistrationDetails.dateOfBirth);
    }
    if (isReplacement) {
      const replacementError = validateReplacementDetails(cleanReplacementDetails);
      if (replacementError) {
        throw { statusCode: 400, message: replacementError };
      }
    }

    if (isUpdateRequest) {
      const existingRegistration = await findExistingNewRegistration({
        fullName: cleanUpdateDetails.fullName,
        phone: cleanUpdateDetails.phone,
        userId: user.id,
        onlyBlocking: false
      });

      if (!existingRegistration) {
        throw { statusCode: 404, message: 'No existing National ID registration found for this account.' };
      }

      if (!canExposeExistingRegistration(existingRegistration, user)) {
        throw { statusCode: 403, message: 'No existing National ID registration found for this account.' };
      }

      existingIdentityTicket = existingRegistration;
      existingRegistrationInfo = buildExistingRegistrationInfo(existingRegistration);
      cleanUpdateDetails = hydrateUpdateDetailsFromExistingRegistration(cleanUpdateDetails, existingRegistration, user);

      if (!hasCitizenNationalIdAccess(citizenAccount, existingRegistration)) {
        throw { statusCode: 403, message: 'You must have an issued National ID before requesting an information update.' };
      }
      citizenAccount = await ensureIssuedNationalIdFromRegistration(citizenAccount, existingRegistration, null);
      cleanUpdateDetails.nationalIdNumber = getIdentityNationalId(citizenAccount, existingRegistration);
    }

    if (isUpdateRequest) {
      const updateError = validateUpdateDetails(cleanUpdateDetails);
      if (updateError) {
        throw { statusCode: 400, message: updateError };
      }
    }

    if (isGeneralServiceRequest) {
      const serviceRequestError = validateServiceRequestDetails(cleanServiceRequestDetails);
      if (serviceRequestError) {
        throw { statusCode: 400, message: serviceRequestError };
      }
    }

    const centerDistrict = getCenterDistrict(center);
    if (!isUpdateRequest && !isGeneralServiceRequest) {
      const selectedDistrict = isNewRegistration
        ? cleanRegistrationDetails.district
        : cleanReplacementDetails.district;

      const selectedDistrictText = String(selectedDistrict || '').trim();
      if (!selectedDistrictText) {
        throw { statusCode: 400, message: 'District is required.' };
      }

      if (isNewRegistration) {
        cleanRegistrationDetails.district = normalizeBanaadirDistrict(selectedDistrict) || selectedDistrictText;
        cleanRegistrationDetails.centerDistrict = centerDistrict;
      }
      if (isReplacement) {
        cleanReplacementDetails.district = normalizeBanaadirDistrict(selectedDistrict) || selectedDistrictText;
      }
    }

    if (isGeneralServiceRequest) {
      cleanServiceRequestDetails.serviceName = cleanServiceRequestDetails.serviceName || service.name;
      cleanServiceRequestDetails.selectedCenter = center.name;
      cleanServiceRequestDetails.centerDistrict = centerDistrict;
      cleanServiceRequestDetails.appointmentDate = date;
      cleanServiceRequestDetails.appointmentTime = timeSlot;
    }

    if (isNewRegistration || isReplacement) {
      const lookupDetails = isNewRegistration
        ? cleanRegistrationDetails
        : cleanReplacementDetails;
      const existingRegistration = await findExistingNewRegistration({
        fullName: lookupDetails.fullName,
        phone: lookupDetails.phone,
        userId: user.id,
        onlyBlocking: isNewRegistration
      });

      if (isNewRegistration && existingRegistration) {
        const alreadyIssued = hasIssuedNationalId(citizenAccount) || hasApprovedRegistration(existingRegistration);
        const existingTicket = canExposeExistingRegistration(existingRegistration, user)
          ? buildExistingRegistrationInfo(existingRegistration)
          : null;
        const duplicateResponse = {
          success: false,
          message: alreadyIssued ? ISSUED_NATIONAL_ID_MESSAGE : ACTIVE_APPOINTMENT_MESSAGE,
          allowedServices: ['update_information', 'replace_lost_id'],
          data: existingTicket ? { existingTicket } : undefined
        };
        if (existingTicket?.ticketNumber) {
          duplicateResponse.existingTicket = existingTicket.ticketNumber;
        }
        return res.status(409).json(duplicateResponse);
      }

      if (isReplacement) {
        if (!existingRegistration) {
          throw { statusCode: 404, message: 'No existing National ID registration found for this name and phone number.' };
        }

        if (!canExposeExistingRegistration(existingRegistration, user)) {
          throw { statusCode: 403, message: NO_EXISTING_NATIONAL_ID_MESSAGE };
        }

        if (!hasCitizenNationalIdAccess(citizenAccount, existingRegistration)) {
          throw { statusCode: 403, message: 'You must have an issued National ID before requesting a replacement.' };
        }

        citizenAccount = await ensureIssuedNationalIdFromRegistration(citizenAccount, existingRegistration, null);
        cleanReplacementDetails.nationalIdNumber = getIdentityNationalId(citizenAccount, existingRegistration);
        const lostDateError = validateReplacementLostDate(cleanReplacementDetails, existingRegistration);
        if (lostDateError) {
          throw { statusCode: 400, message: lostDateError };
        }
        existingIdentityTicket = existingRegistration;
        existingRegistrationInfo = buildExistingRegistrationInfo(existingRegistration);
      }
    }

    const activeRequest = isGeneralServiceRequest
      ? await prisma.ticket.findFirst({
          where: {
            citizen: user.id,
            service: serviceId,
            OR: [
              { status: { in: ACTIVE_TICKET_STATUSES } },
              { requestStatus: { in: ACTIVE_REQUEST_STATUSES } }
            ]
          },
          orderBy: { createdAt: 'desc' }
        })
      : await findActiveRequestForCitizen({
          citizenId: user.id,
          requestType
        });
    if (activeRequest) {
      if (isReplacement) {
        throw { statusCode: 409, message: ERRORS.DUPLICATE_REQUEST, data: activeRequest };
      }
      if (isUpdateRequest) {
        throw { statusCode: 409, message: ERRORS.DUPLICATE_REQUEST, data: activeRequest };
      }
      throw { statusCode: 409, message: ACTIVE_APPOINTMENT_MESSAGE, data: activeRequest };
    }

    if (!isUpdateRequest && (!date || !timeSlot)) {
      throw { statusCode: 400, message: 'Appointment date and time are required.' };
    }

    const schedule = getCenterSchedule(center);
    const scheduleSlots = getScheduleSlots(schedule);
    if (!isUpdateRequest) {
      const bookingDate = parseDateKey(date);
      if (!bookingDate) {
        throw { statusCode: 400, message: ERRORS.INVALID_DATE };
      }
      if (isCenterUnavailableOnDate(center, schedule, bookingDate)) {
        throw { statusCode: 400, message: ERRORS.CLOSED_DATE };
      }
      if (!scheduleSlots.includes(timeSlot)) {
        throw { statusCode: 400, message: ERRORS.CLOSED_TIME };
      }

      const [slotCount, dayCount] = await Promise.all([
        prisma.ticket.count({ where: { center: resolvedCenterId, date, timeSlot, status: { not: 'Cancelled' } } }),
        prisma.ticket.count({ where: { center: resolvedCenterId, date, status: { not: 'Cancelled' } } })
      ]);
      if (slotCount >= getSlotCapacity(center, schedule)
        || dayCount >= Number(schedule.maxAppointmentsPerDay || DEFAULT_SCHEDULE.maxAppointmentsPerDay)) {
        await prisma.notification.create({
          data: {
            user: user.id,
            title: 'Appointment Time Full',
            desc: 'Appointments are full for this time. Please choose another available slot.',
            category: 'Appointments'
          }
        });
        throw { statusCode: 400, message: 'Appointments are full for this time. Please choose another available slot.' };
      }
    }

    if (isNewRegistration) {
      cleanRegistrationDetails.selectedCenter = center.name;
      cleanRegistrationDetails.centerDistrict = centerDistrict;
      cleanRegistrationDetails.appointmentDate = date;
      cleanRegistrationDetails.appointmentTime = timeSlot;
      cleanRegistrationDetails.nationalIdNumber = citizenAccount.nationalId;
    }

    const refCode = await generateRef();
    const citizenId = user.id;
    const requestLabel = getRequestLabel(requestType);
    const nameOfCitizen = cleanRegistrationDetails.fullName || cleanReplacementDetails.fullName || cleanUpdateDetails.fullName || cleanServiceRequestDetails.fullName || citizenName || user.name;

    // Calculate queue waiting list details
    const activeWaiting = await prisma.ticket.count({
      where: {
        center: resolvedCenterId,
        status: 'Waiting',
        date: isUpdateRequest ? '' : date
      }
    });
    // Est wait time = active waiting * service duration
    const waitMins = activeWaiting * service.duration;

    const ticket = await prisma.ticket.create({
      data: {
        ref: refCode,
        service: serviceId,
        citizenName: nameOfCitizen,
        citizen: citizenId,
        center: resolvedCenterId,
      date: isUpdateRequest ? '' : date,
      timeSlot: isUpdateRequest ? null : timeSlot,
      district: isUpdateRequest
        ? ''
        : isGeneralServiceRequest
          ? centerDistrict
          : isNewRegistration
          ? cleanRegistrationDetails.district
          : cleanReplacementDetails.district,
      requestType,
      requestStatus: 'Pending',
      nationalIdNumber: getIdentityNationalId(citizenAccount, existingIdentityTicket),
      cardSerialNumber: isReplacement || isUpdateRequest ? citizenAccount.cardSerialNumber || '' : '',
      cardStatus: isReplacement || isUpdateRequest ? citizenAccount.cardStatus || '' : '',
      registrationDetails: isNewRegistration ? cleanRegistrationDetails : isGeneralServiceRequest ? cleanServiceRequestDetails : undefined,
      replacementDetails: isReplacement ? cleanReplacementDetails : undefined,
      updateDetails: isUpdateRequest ? cleanUpdateDetails : undefined,
      existingRegistration: isUpdateRequest || isReplacement ? existingRegistrationInfo : undefined,
        waitTime: isUpdateRequest ? 'Review pending' : waitMins > 0 ? `${waitMins} min` : '10 min',
        status: isUpdateRequest ? 'On Hold' : 'Waiting'
      }
    });

    if (isNewRegistration) {
      const nameParts = splitCitizenName(cleanRegistrationDetails.fullName);
      await syncCitizenIdentityProfile(citizenId, {
        nationalId: citizenAccount.nationalId,
        name: cleanRegistrationDetails.fullName,
        fullName: cleanRegistrationDetails.fullName,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        phone: cleanRegistrationDetails.phone,
        dateOfBirth: cleanRegistrationDetails.dateOfBirth,
        address: cleanRegistrationDetails.fullAddress || cleanRegistrationDetails.address,
        district: cleanRegistrationDetails.district,
        center: resolvedCenterId,
        maritalStatus: cleanRegistrationDetails.maritalStatus,
        nationalIdStatus: 'WAITING'
      });
    } else if (normalizeRole(user.role) === 'citizen' && !citizenAccount.center) {
      await prisma.user.update({
        where: { id: citizenId },
        data: {
          center: resolvedCenterId,
          district: isReplacement
            ? cleanReplacementDetails.district
            : isGeneralServiceRequest
              ? centerDistrict
              : (cleanUpdateDetails.district || citizenAccount.district || '')
        }
      });
    }

    // Create persistent Notification
    const notif = await prisma.notification.create({
      data: {
        user: citizenId,
        title: isReplacement
          ? 'Replacement Request Submitted'
          : isUpdateRequest
            ? 'Update Request Submitted'
            : isGeneralServiceRequest
              ? 'Service Request Submitted'
            : 'Appointment Confirmed',
        desc: isReplacement || isUpdateRequest
          ? `Your ${requestLabel} request ${refCode} has been submitted.`
          : `Your ticket ${refCode} for ${service.name} has been scheduled.`,
        category: 'Appointments'
      }
    });
    const staffNotifications = await createAdminRequestNotifications({
      ticket,
      service,
      center,
      requestLabel
    });

    await Promise.all([
      sendBookingConfirmationEmail({ user: user, ticket, service, center }),
      logSmsOnly({
        recipient: cleanRegistrationDetails.phone || cleanReplacementDetails.phone || cleanUpdateDetails.phone || cleanServiceRequestDetails.phone || user.phone,
        message: isUpdateRequest
          ? `Your ${service.name} request is submitted. Reference: ${refCode}.`
          : `Your ${service.name} appointment is confirmed. Ticket: ${refCode}. Center: ${center.name}. Date: ${date}.`
      })
    ]);

    // Audit logging
    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: isReplacement
          ? 'Lost ID Request'
          : isUpdateRequest
            ? 'Update Request'
            : 'Booking',
        details: `${isReplacement || isUpdateRequest ? `Created ${requestLabel} request` : 'Booked ticket'}: ${refCode} at center: ${center.name} for service: ${service.name}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    const populatedTicket = await hydrateTicket(ticket);

    // Emit Socket.io updates for real-time queue tracking
    if (io) {
      // Notify the specific center room that the queue list has updated
      io.to(resolvedCenterId.toString()).emit('queueUpdate', { centerId: resolvedCenterId });
      // Notify the specific ticket room (for live single ticket tracking)
      io.to(refCode).emit('ticketUpdate', populatedTicket);
      // If citizenId exists, alert the user’s personal feed
      if (citizenId) {
        io.emit(`notification-${citizenId}`, notif);
      }
      staffNotifications.forEach((staffNotification) => {
        if (staffNotification.user) {
          io.emit(`notification-${staffNotification.user}`, staffNotification);
        }
      });
    }

    return {   data: populatedTicket  };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Get user's appointments/tickets
// @route   GET /api/bookings/my
// @access  Private (Citizen or Admin, scoped to the logged-in account)

  static async getUserBookings({ body, query, params, user, ip, io }) {

  try {
    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: { citizen: user.id },
      orderBy: { createdAt: 'desc' }
    }));

    return { count: tickets.length, data: tickets  };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Get all appointments for administrators
// @route   GET /api/bookings/admin/all
// @access  Private/Admin

  static async getAllBookings({ body, query, params, user, ip, io }) {

  try {
    const { search = '', status = '', center = '', district = '', date = '', requestType = '', requestStatus = '' } = query;
    const dbQuery = {};
    const normalizedDistrict = normalizeBanaadirDistrict(district) || String(district || '').trim();

    if (status) {
      dbQuery.status = status;
    }
    if (requestType) {
      dbQuery.requestType = requestType;
    }
    if (requestStatus) {
      dbQuery.requestStatus = requestStatus;
    }
    if (normalizedDistrict) {
      const districtCenters = await prisma.center.findMany({
        where: { district: normalizedDistrict },
        select: { id: true }
      });
      const districtCenterIds = districtCenters.map((item) => item.id);
      if (center) {
        const selectedCenter = await prisma.center.findUnique({
          where: { id: center },
          select: { district: true }
        });
        const selectedCenterDistrict = normalizeBanaadirDistrict(selectedCenter?.district) || String(selectedCenter?.district || '').trim();
        if (!selectedCenter || selectedCenterDistrict !== normalizedDistrict) {
          return { count: 0, data: []  };
        }
        dbQuery.center = center;
      } else {
        dbQuery.center = { in: districtCenterIds };
      }
    } else if (center) {
      dbQuery.center = center;
    }
    if (['operator', 'super_operator', 'center_manager'].includes(normalizeRole(user.role))) {
      const assignedCenterId = getAssignedCenterId(user);
      if (!assignedCenterId) {
        throw { statusCode: 403, message: 'Operator account is not assigned to a center.' };
      }
      dbQuery.center = assignedCenterId;
    }
    if (date) {
      dbQuery.date = date;
    }
    if (search.trim()) {
      const term = search.trim();
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      });
      const userIds = matchingUsers.map((user) => user.id);
      dbQuery.OR = [
        { ref: { contains: term, mode: 'insensitive' } },
        { citizenName: { contains: term, mode: 'insensitive' } },
        { citizen: { in: userIds } }
      ];
    }

    const tickets = await hydrateTickets(await prisma.ticket.findMany({
      where: dbQuery,
      orderBy: { createdAt: 'desc' }
    }));

    return { count: tickets.length, data: tickets  };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Send appointment/request back to citizen for correction
// @route   PUT /api/bookings/admin/:id/correction
// @access  Private/Admin

  static async sendCorrectionFeedback({ body, query, params, user, ip, io }) {

  try {
    const inputReasons = body.reasonIds || body.correctionReasonIds || body.correctionReasons || body.reasons;
    const additionalNote = String(body.additionalNote || body.additionalNotes || body.note || '').trim();

    if (!additionalNote) {
      throw { statusCode: 400, message: 'Additional notes are required when sending a request back for correction.' };
    }

    const resolvedReasons = await resolveCorrectionReasons(inputReasons);
    if (resolvedReasons.error) {
      throw { statusCode: 400, message: resolvedReasons.error };
    }

    let ticket = await hydrateTicket(await findTicketByIdOrRef(params.id));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to manage this appointment.' };
    }

    if (isCompletedTicket(ticket)) {
      throw { statusCode: 400, message: ERRORS.APPOINTMENT_ALREADY_COMPLETED };
    }

    const previousStatus = ticket.requestStatus || ticket.status || '';
    const correctionReasons = resolvedReasons.reasons;

    ticket = await hydrateTicket(await updateTicketById(ticket.id, {
      status: 'On Hold',
      requestStatus: NEEDS_CORRECTION_STATUS
    }));

    await prisma.requestCorrectionFeedback.createMany({
      data: correctionReasons.map((reason) => ({
        request: ticket.id,
        correctionReason: reason.id,
        admin: user.id,
        additionalNote
      }))
    });

    await prisma.notification.create({
      data: {
        user: idFrom(ticket.citizen),
        title: 'Registration Requires Correction',
        desc: formatCorrectionNotificationMessage({ ticket, reasons: correctionReasons, additionalNote }),
        category: 'Appointments',
        notificationType: 'CORRECTION_REQUIRED',
        referenceNumber: ticket.ref,
        requestType: ticket.requestType,
        relatedEntity: ticket.id,
        relatedEntityType: 'Ticket',
        previousStatus,
        newStatus: NEEDS_CORRECTION_STATUS,
        read: false
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Send Request Back for Correction',
        details: `Sent ticket ${ticket.ref} back for correction. Previous status: ${previousStatus}. Reasons: ${correctionReasons.map((reason) => reason.reasonName).join(', ')}. Notes: ${additionalNote}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    const populatedTicket = await hydrateTicket(await findTicketById(ticket.id));

    if (io) {
      io.to(idFrom(ticket.center).toString()).emit('queueUpdate', { centerId: idFrom(ticket.center) });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
      if (ticket.citizen) {
        io.emit(`notification-${idFrom(ticket.citizen)}`, {
          title: 'Registration Requires Correction',
          desc: `Your request ${ticket.ref} requires corrections before it can continue.`,
          category: 'Appointments'
        });
      }
    }

    return { message: 'Correction feedback sent to the citizen.',
      data: populatedTicket
     };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Update National ID special request status
// @route   PUT /api/bookings/admin/:id/request-status
// @access  Private/Admin

  static async updateRequestStatus({ body, query, params, user, ip, io }) {

  try {
    const { requestStatus, rejectionReason = '', otpToken = '' } = body;
    const allowedStatuses = [
      'Pending',
      'Under Review',
      'Approved',
      'In Progress',
      'Rejected',
      'Completed',
      'Cancelled',
      'Resubmission Required',
      'WAITING',
      'UNDER_REVIEW',
      NEEDS_CORRECTION_STATUS,
      RESUBMITTED_STATUS,
      'APPROVED',
      'COMPLETED',
      'CANCELLED',
      'REJECTED'
    ];

    if (!allowedStatuses.includes(requestStatus)) {
      throw { statusCode: 400, message: 'Invalid request status' };
    }
    let cancellation = null;
    if (requestStatus === 'Cancelled') {
      cancellation = buildCancellationPayload(body);
      if (cancellation.error) {
        throw { statusCode: 400, message: cancellation.error };
      }
    }

    let ticket = await hydrateTicket(await findTicketByIdOrRef(params.id));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to manage this appointment.' };
    }

    if (isCompletedTicket(ticket) && !COMPLETED_STATUS_VALUES.has(requestStatus)) {
        throw { statusCode: 400, message: ERRORS.APPOINTMENT_ALREADY_COMPLETED };
    }

    const isCompletingRequest = requestStatus === 'Completed' || requestStatus === 'COMPLETED';
    const isCancellingRequest = requestStatus === 'Cancelled' || requestStatus === 'CANCELLED';
    if (isCompletingRequest || isCancellingRequest) {
      const populatedForOtp = await hydrateTicket(await findTicketById(ticket.id));
      const citizenPhone = normalizeOtpPhone(
        populatedForOtp?.registrationDetails?.phone ||
        populatedForOtp?.updateDetails?.phone ||
        populatedForOtp?.replacementDetails?.phone ||
        populatedForOtp?.citizen?.phone
      );
      if (!verifyOtpToken({
        token: otpToken,
        purpose: isCompletingRequest ? 'complete_service' : 'cancel_service',
        userId: user.id,
        ticketId: ticket.id,
        phone: citizenPhone
      })) {
        throw {
          statusCode: 401,
          message: isCompletingRequest
            ? 'OTP verification required before completing this service.'
            : 'OTP verification required before cancelling this appointment.'
        };
      }
    }

    if (requestStatus === 'Completed' || requestStatus === 'COMPLETED') {
      const scheduledDate = parseDateKey(ticket.date);
      if (scheduledDate) {
        const slotMinutes = timeToMinutes(ticket.timeSlot);
        const scheduledAt = new Date(scheduledDate);
        if (slotMinutes !== null) {
          scheduledAt.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
        } else {
          scheduledAt.setHours(23, 59, 59, 999);
        }
        if (scheduledAt.getTime() > Date.now()) {
          throw {
            statusCode: 400,
            message: `This appointment is scheduled for ${ticket.date}${ticket.timeSlot ? ` at ${ticket.timeSlot}` : ''}. It cannot be marked Completed before that date and time.`
          };
        }
      }
    }

    if (requestStatus === 'Cancelled') {
      const cancelError = assertCanCancelTicket(ticket);
      if (cancelError) {
        throw { statusCode: 400, message: cancelError };
      }
    }

    if (ticket.requestType === 'new_national_id') {
      throw { statusCode: 400, message: 'This ticket is not a National ID special request' };
    }

    const requestLabel = getRequestLabel(ticket.requestType);
    const previousStatus = ticket.requestStatus || ticket.status || '';
    const wasCompleted = ticket.status === 'Completed' || ticket.requestStatus === 'Completed';
    ticket.requestStatus = requestStatus;
    ticket.reviewedBy = user.id;
    ticket.reviewedAt = new Date();

    if (requestStatus === 'Approved' || requestStatus === 'APPROVED') {
      if (ticket.requestType === 'update_information') {
        const updateError = validateUpdateDetails(ticket.updateDetails || {});
        if (updateError) throw { statusCode: 400, message: updateError };
      }
      ticket.status = ticket.requestType === 'update_information' ? 'On Hold' : 'Waiting';
    }
    if (requestStatus === 'Under Review' || requestStatus === 'UNDER_REVIEW') {
      ticket.status = 'On Hold';
    }
    if (requestStatus === 'In Progress') {
      ticket.status = 'In Progress';
    }
    if (requestStatus === 'Rejected' || requestStatus === 'REJECTED' || requestStatus === 'Cancelled' || requestStatus === 'CANCELLED') {
      ticket.status = 'Cancelled';
      ticket.rejectionReason = requestStatus === 'Cancelled' || requestStatus === 'CANCELLED'
        ? cancellation.summary
        : String(rejectionReason || '').trim();
      if (requestStatus === 'Cancelled' || requestStatus === 'CANCELLED') {
        applyCancellationDetails(ticket, cancellation, previousStatus, user.id);
      } else {
        ticket.cancellationReason = ticket.rejectionReason;
        ticket.cancelledBy = user.id;
        ticket.cancelledAt = new Date();
      }
    }
    if (requestStatus === 'Resubmission Required' || requestStatus === NEEDS_CORRECTION_STATUS) {
      ticket.needsResubmission = true;
      ticket.status = 'On Hold';
      ticket.rejectionReason = String(rejectionReason || '').trim();
    }
    if (requestStatus === 'Completed' || requestStatus === 'COMPLETED') {
      if (ticket.requestType === 'update_information') {
        const updateError = validateUpdateDetails(ticket.updateDetails || {});
        if (updateError) throw { statusCode: 400, message: updateError };
      }
      ticket.status = 'Completed';
      ticket.requestStatus = 'Completed';
      markTicketCompletedAt(ticket);
      if (ticket.requestType === 'lost_replacement') {
        await completeLostIdReplacement(ticket, user.id);
      }
      if (ticket.requestType === 'update_information') {
        await applyApprovedUpdateDetails(ticket, user.id);
      }
    } else if (!['Completed', 'COMPLETED'].includes(String(requestStatus || '').trim()) && wasCompleted) {
      clearTicketCompletedAt(ticket);
    }

    ticket = await hydrateTicket(await updateTicketById(ticket.id, ticket));

    let cancellationNotification = null;
    if (requestStatus === 'Cancelled' || requestStatus === 'CANCELLED') {
      cancellationNotification = await createCancellationNotification({
        ticket: {
          ...ticket,
          cancellationReasons: cancellation?.reasons || ticket.cancellationReasons,
          additionalCancellationReason: cancellation?.additionalReason || ticket.additionalCancellationReason,
          cancellationNotes: cancellation?.additionalNotes || ticket.cancellationNotes,
          cancellationReason: cancellation?.summary || ticket.cancellationReason || ticket.rejectionReason
        },
        reason: cancellation?.summary || ticket.cancellationReason || ticket.rejectionReason,
        previousStatus
      });
    }

    const populatedTicket = await hydrateTicket(await findTicketById(ticket.id));

    const citizenId = ticket.citizen?.id || ticket.citizen;
    const centerId = ticket.center?.id || ticket.center;

    if (citizenId) {
      const notificationTitle = requestStatus === 'Approved'
        ? 'Request Approved'
        : requestStatus === 'Completed'
          ? 'Request Completed'
          : requestStatus === 'Rejected' || requestStatus === 'Cancelled'
            ? 'Request Rejected'
            : 'Request Updated';
      const notificationDesc = requestStatus === 'Approved'
        ? `Your ${requestLabel} request ${ticket.ref} has been approved.`
        : requestStatus === 'Completed'
          ? `Your request ${ticket.ref} has been completed.`
          : requestStatus === 'Rejected' || requestStatus === 'Cancelled'
            ? `Your request ${ticket.ref} was rejected.${ticket.rejectionReason ? ` Reason: ${ticket.rejectionReason}` : ''}`
            : requestStatus === 'Resubmission Required'
              ? `Your ${requestLabel} request ${ticket.ref} needs correction and resubmission.`
              : `Your ${requestLabel} request ${ticket.ref} is now ${requestStatus}.`;
      if (!cancellationNotification) {
        await prisma.notification.create({
          data: {
            user: citizenId,
            title: notificationTitle,
            desc: notificationDesc,
            category: 'Appointments'
          }
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: requestStatus === 'Completed' || requestStatus === 'COMPLETED'
          ? 'Complete Service'
          : requestStatus === 'Cancelled' || requestStatus === 'CANCELLED'
            ? 'Cancel Service'
            : requestStatus === 'Approved' || requestStatus === 'APPROVED'
              ? 'Admin Approval'
              : 'Update Request',
        details: requestStatus === 'Cancelled'
          ? `Cancel Service: cancelled ${requestLabel} request ${ticket.ref}. Previous status: ${previousStatus}. Reasons: ${cancellation.displayReasons.join(', ')}${cancellation.additionalNotes ? `. Notes: ${cancellation.additionalNotes}` : ''}`
          : `Updated ${requestLabel} request ${ticket.ref} to ${requestStatus}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
      if (citizenId) {
        if (cancellationNotification) {
          io.emit(`notification-${citizenId}`, cancellationNotification);
        } else {
          const socketTitle = requestStatus === 'Approved'
            ? 'Appointment Accepted'
            : requestStatus === 'Completed'
              ? 'Appointment Completed'
              : requestStatus === 'Rejected' || requestStatus === 'Cancelled' || requestStatus === 'CANCELLED'
                ? 'Appointment Cancelled'
                : 'Request Updated';
          io.emit(`notification-${citizenId}`, {
            title: socketTitle,
            desc: requestStatus === 'Approved'
              ? `Your request ${ticket.ref} has been accepted. Please check your appointment details.`
              : requestStatus === 'Completed'
                ? `Your request ${ticket.ref} has been completed.`
                : requestStatus === 'Rejected' || requestStatus === 'Cancelled' || requestStatus === 'CANCELLED'
                  ? `Your request ${ticket.ref} was cancelled.`
                  : `Your ${requestLabel} request ${ticket.ref} is now ${requestStatus}.`,
            category: 'Appointments'
          });
        }
      }
    }

    return { message: requestStatus === 'Cancelled' ? CANCELLATION_SUCCESS_MESSAGE : 'Request updated.',
      data: populatedTicket
     };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Update appointment status from admin appointment page
// @route   PUT /api/bookings/admin/:id/status
// @access  Private/Admin

  static async updateBookingStatus({ body, query, params, user, ip, io }) {

  try {
    const { status, cancellationReason = '', otpToken = '' } = body;
    const allowedStatuses = ['Pending', 'Approved', 'Scheduled', 'Waiting', 'Being Served', 'In Progress', 'On Hold', 'Completed', 'Rejected', 'Cancelled', 'Expired'];

    if (!allowedStatuses.includes(status)) {
      throw { statusCode: 400, message: 'Invalid appointment status' };
    }

    let ticket = await hydrateTicket(await findTicketByIdOrRef(params.id));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to manage this appointment.' };
    }

    if (status === 'Completed') {
      const scheduledDate = parseDateKey(ticket.date);
      if (scheduledDate) {
        const slotMinutes = timeToMinutes(ticket.timeSlot);
        const scheduledAt = new Date(scheduledDate);
        if (slotMinutes !== null) {
          scheduledAt.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
        } else {
          scheduledAt.setHours(23, 59, 59, 999);
        }
        if (scheduledAt.getTime() > Date.now()) {
          throw {
            statusCode: 400,
            message: `This appointment is scheduled for ${ticket.date}${ticket.timeSlot ? ` at ${ticket.timeSlot}` : ''}. It cannot be marked Completed before that date and time.`
          };
        }
      }
    }

    if (status === 'Completed' || status === 'Cancelled') {
      const populatedForOtp = await hydrateTicket(await findTicketById(ticket.id));
      const citizenPhone = normalizeOtpPhone(
        populatedForOtp?.registrationDetails?.phone ||
        populatedForOtp?.updateDetails?.phone ||
        populatedForOtp?.replacementDetails?.phone ||
        populatedForOtp?.citizen?.phone
      );
      if (!verifyOtpToken({
        token: otpToken,
        purpose: status === 'Completed' ? 'complete_service' : 'cancel_service',
        userId: user.id,
        ticketId: ticket.id,
        phone: citizenPhone
      })) {
        throw {
          statusCode: 401,
          message: status === 'Completed'
            ? 'OTP verification required before completing this service.'
            : 'OTP verification required before cancelling this appointment.'
        };
      }
    }

    let cancellation = null;
    if (status === 'Cancelled') {
      cancellation = buildCancellationPayload({ ...body, cancellationReason });
      if (cancellation.error) {
        throw { statusCode: 400, message: cancellation.error };
      }
    }

    const previousStatus = ticket.status;
    const previousRequestStatus = ticket.requestStatus;
    const returningFromTerminalStatus = status === 'Waiting' && (
      ['Completed', 'Cancelled'].includes(String(previousStatus || '').trim()) ||
      ['Completed', 'Cancelled', 'Resubmission Required'].includes(String(previousRequestStatus || '').trim())
    );
    const populatedBeforeCancel = await hydrateTicket(await findTicketById(ticket.id));
    const service = populatedBeforeCancel?.service;
    const center = populatedBeforeCancel?.center;
    const requestLabel = getRequestLabel(ticket.requestType);
    if (status === 'Cancelled') {
      const cancelError = assertCanCancelTicket(ticket);
      if (cancelError) {
        throw { statusCode: 400, message: cancelError };
      }
    }

    ticket.status = status;
    ticket.reviewedBy = user.id;
    ticket.reviewedAt = new Date();
    if (status === 'Completed') {
      if (ticket.requestType === 'update_information') {
        const updateError = validateUpdateDetails(ticket.updateDetails || {});
        if (updateError) throw { statusCode: 400, message: updateError };
      }
      ticket.requestStatus = 'Completed';
      markTicketCompletedAt(ticket);
      if (ticket.requestType === 'new_national_id') {
        await issueInitialNationalId(ticket, user.id);
      }
      if (ticket.requestType === 'lost_replacement') {
        await completeLostIdReplacement(ticket, user.id);
      }
      if (ticket.requestType === 'update_information') {
        await applyApprovedUpdateDetails(ticket, user.id);
      }
    } else if (previousStatus === 'Completed' && status !== 'Completed') {
      clearTicketCompletedAt(ticket);
    }
    if (['Waiting', 'Approved', 'Scheduled', 'In Progress', 'Being Served'].includes(status)) {
      if (ticket.requestType === 'update_information') {
        const updateError = validateUpdateDetails(ticket.updateDetails || {});
        if (updateError) throw { statusCode: 400, message: updateError };
      }
      ticket.requestStatus = ['In Progress', 'Being Served'].includes(status) ? 'In Progress' : 'Approved';
      if (ticket.requestType === 'new_national_id') {
        await prisma.user.updateMany({
          where: { id: idFrom(ticket.citizen) },
          data: { nationalIdStatus: ['In Progress', 'Being Served'].includes(status) ? 'UNDER_REVIEW' : 'WAITING' }
        });
      }
    }
    if (status === 'Rejected') {
      ticket.status = 'Rejected';
      ticket.requestStatus = 'Rejected';
      ticket.rejectionReason = String(body?.rejectionReason || cancellationReason || 'Rejected by admin.').trim();
      ticket.cancelledBy = user.id;
      ticket.cancelledAt = new Date();
      ticket.needsResubmission = false;
      const citizenId = idFrom(ticket.citizen);
      if (citizenId) {
        const citizen = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
        await restoreCitizenIdStatusAfterRequestEnd(citizenId, {
          wasIssuedBefore: hasIssuedNationalId(citizen || {})
        });
      }
    }
    if (status === 'Cancelled') {
      applyCancellationDetails(ticket, cancellation, previousStatus, user.id);
      ticket.needsResubmission = false;
      ticket.requestStatus = 'Cancelled';
      ticket.rejectionReason = ticket.cancellationReason;
      const citizenId = idFrom(ticket.citizen);
      if (citizenId) {
        const citizen = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
        // Keep the same permanent National ID — never clear or regenerate after cancel.
        await restoreCitizenIdStatusAfterRequestEnd(citizenId, {
          wasIssuedBefore: hasIssuedNationalId(citizen || {})
        });
      }
    }
    if (status === 'Waiting') {
      if (ticket.requestType !== 'new_national_id') {
        ticket.requestStatus = 'Approved';
      }
      if (returningFromTerminalStatus) {
        ticket.cancellationReason = '';
        ticket.cancellationReasons = [];
        ticket.additionalCancellationReason = '';
        ticket.cancellationNotes = '';
        ticket.cancelledBy = null;
        ticket.cancelledAt = null;
        ticket.rejectionReason = '';
        ticket.needsResubmission = false;
        clearEmbeddedCancellationDetails(ticket);
      }
    }

    ticket = await hydrateTicket(await updateTicketById(ticket.id, ticket));
    const populatedTicket = await hydrateTicket(await findTicketById(ticket.id));

    let statusNotification = null;
    if (ticket.citizen) {
      const notificationTitle = status === 'Cancelled'
        ? 'Appointment Cancelled'
        : status === 'Rejected'
          ? 'Appointment Rejected'
        : status === 'Waiting'
          ? returningFromTerminalStatus
            ? 'Appointment Returned'
            : 'Appointment Accepted'
          : status === 'Completed'
            ? 'Appointment Completed'
            : 'Appointment Updated';
      const notificationDesc = status === 'Cancelled'
        ? `Your appointment ${ticket.ref} was cancelled. Reasons: ${cancellation.displayReasons.join(', ')}.`
        : status === 'Rejected'
          ? `Your appointment ${ticket.ref} was rejected.`
        : status === 'Waiting'
          ? returningFromTerminalStatus
            ? `Your request ${ticket.ref} was returned to waiting by staff.`
            : `Your request ${ticket.ref} has been accepted. Please check your appointment details.`
          : status === 'Completed'
            ? `Your appointment ${ticket.ref} is completed. Tap to view details.`
            : `Your ticket ${ticket.ref} status is now ${status}.`;
      if (status === 'Cancelled') {
        statusNotification = await createCancellationNotification({
          ticket: {
            ...ticket,
            cancellationReasons: cancellation?.reasons || ticket.cancellationReasons,
            additionalCancellationReason: cancellation?.additionalReason || ticket.additionalCancellationReason,
            cancellationNotes: cancellation?.additionalNotes || ticket.cancellationNotes,
            cancellationReason: cancellation?.summary || ticket.cancellationReason
          },
          reason: cancellation?.summary || ticket.cancellationReason,
          previousStatus
        });
      } else {
        await prisma.notification.create({
          data: {
            user: idFrom(ticket.citizen),
            title: notificationTitle,
            desc: notificationDesc,
            category: 'Appointments',
            notificationType: status === 'Completed'
              ? 'APPOINTMENT_COMPLETED'
              : status === 'Waiting'
                ? 'APPOINTMENT_ACCEPTED'
                : status === 'Rejected'
                  ? 'APPOINTMENT_REJECTED'
                  : 'APPOINTMENT_UPDATED',
            referenceNumber: ticket.ref || '',
            requestType: ticket.requestType || '',
            relatedEntity: ticket.id,
            relatedEntityType: 'Ticket',
            newStatus: status
          }
        });
      }

      if (populatedTicket?.citizen) {
        const citizenUser = populatedTicket.citizen;
        if (status === 'Waiting') {
          await sendAppointmentApprovalEmail({
            user: citizenUser,
            ticket: populatedTicket,
            service: populatedTicket.service,
            center: populatedTicket.center
          });
        }
        if (status === 'Cancelled') {
          await sendAppointmentCancellationEmail({
            user: citizenUser,
            ticket: populatedTicket,
            service: populatedTicket.service,
            center: populatedTicket.center
          });
        }
        if (status === 'Completed') {
          await sendAppointmentCompletionEmail({
            user: citizenUser,
            ticket: populatedTicket,
            service: populatedTicket.service,
            center: populatedTicket.center
          });
        }
        await logSmsOnly({
          recipient: citizenUser.phone,
          message: `Your National ID appointment ${ticket.ref} status is now ${status}.`
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: status === 'Completed'
          ? 'Complete Service'
          : status === 'Cancelled'
            ? 'Cancel Service'
            : status === 'Waiting' || status === 'Approved'
              ? 'Admin Approval'
              : 'Update Appointment',
        details: status === 'Cancelled'
          ? `Cancelled ticket ${ticket.ref}. Previous status: ${previousStatus}. Reasons: ${cancellation.displayReasons.join(', ')}${cancellation.additionalNotes ? `. Notes: ${cancellation.additionalNotes}` : ''}`
          : `Updated ticket ${ticket.ref} status to ${status}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    const centerId = idFrom(ticket.center);
    const citizenId = idFrom(ticket.citizen);
    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
      if (citizenId) {
        if (statusNotification) {
          io.emit(`notification-${citizenId}`, statusNotification);
        } else {
          const socketTitle = status === 'Cancelled'
            ? 'Appointment Cancelled'
            : status === 'Rejected'
              ? 'Appointment Rejected'
            : status === 'Waiting'
              ? 'Appointment Accepted'
              : status === 'Completed'
                ? 'Appointment Completed'
                : 'Appointment Updated';
          io.emit(`notification-${citizenId}`, {
            title: socketTitle,
            desc: status === 'Cancelled'
              ? `Your request ${ticket.ref} was cancelled. Reasons: ${cancellation.displayReasons.join(', ')}.`
              : status === 'Rejected'
                ? `Your appointment ${ticket.ref} was rejected.`
              : status === 'Waiting'
                ? `Your request ${ticket.ref} has been accepted. Please check your appointment details.`
                : status === 'Completed'
                  ? `Your appointment ${ticket.ref} is completed. Tap to view details.`
                  : `Your ticket ${ticket.ref} status is now ${status}.`,
            category: 'Appointments',
            referenceNumber: ticket.ref || '',
            relatedEntity: ticket.id
          });
        }
      }
    }

    return { message: status === 'Cancelled' ? CANCELLATION_SUCCESS_MESSAGE : 'Appointment updated.',
      data: populatedTicket
     };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Get single ticket details by reference or ID
// @route   GET /api/bookings/:refOrId
// @access  Public

  static async getBookingDetails({ body, query, params, user, ip, io }) {

  try {
    const { refOrId } = params;
    let dbQuery = {};
    
    if (/^(REQ|NQS)-\d+$/i.test(String(refOrId || '').trim())) {
      dbQuery = { ref: String(refOrId).toUpperCase() };
    } else {
      dbQuery = { id: refOrId };
    }

    const ticket = await hydrateTicket(await prisma.ticket.findFirst({ where: dbQuery }));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    if (!canAccessTicket(user, ticket)) {
      throw { statusCode: 403, message: 'You are not authorized to view this booking.' };
    }

    return { data: ticket  };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Cancel an appointment
// @route   PUT /api/bookings/:id/cancel
// @access  Private

  static async cancelBooking({ body, query, params, user, ip, io }) {

  try {
    let ticket = await hydrateTicket(await findTicketByIdOrRef(params.id));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }

    // Verify ownership
    if (normalizeRole(user.role) === 'citizen' && ticket.citizen && idFrom(ticket.citizen).toString() !== user.id.toString()) {
      throw { statusCode: 403, message: 'Not authorized to cancel this booking' };
    }

    const currentStatus = String(ticket.status || '').trim();
    const currentRequestStatus = String(ticket.requestStatus || '').trim();
    if (['Completed', 'Cancelled', 'Expired', 'Rejected'].includes(currentStatus) || ['Completed', 'Cancelled', 'Rejected'].includes(currentRequestStatus)) {
      throw { statusCode: 400, message: 'This appointment cannot be cancelled in its current status.' };
    }

    if (normalizeRole(user.role) === 'citizen' && citizenCancelWindowExpired(ticket)) {
      throw { statusCode: 400, message: 'You can cancel an appointment only within 1 hour after booking. After that, please contact your service center.' };
    }

    if (normalizeRole(user.role) !== 'citizen') {
      const citizenPhone = normalizeOtpPhone(
        ticket.registrationDetails?.phone ||
        ticket.updateDetails?.phone ||
        ticket.replacementDetails?.phone ||
        ticket.citizen?.phone
      );
      if (!verifyOtpToken({
        token: body?.otpToken,
        purpose: 'cancel_service',
        userId: user.id,
        ticketId: ticket.id,
        phone: citizenPhone
      })) {
        throw { statusCode: 401, message: 'OTP verification required before cancelling this appointment.' };
      }
    }

    const previousStatus = ticket.status;
    const requesterRole = normalizeRole(user.role);
    const requestTypeText = String(ticket.requestType || ticket.type || ticket.service?.name || '').trim().toLowerCase();
    const requestTypeKey = requestTypeText.replace(/[\s-]+/g, '_');
    const isUpdateRequest = requestTypeKey === 'update_information' ||
      requestTypeKey === 'update_national_id_information' ||
      requestTypeText.includes('update');
    const correctionReasons = Array.isArray(body?.cancellationReasons)
      ? body.cancellationReasons.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const cancellation = requesterRole === 'citizen'
      ? null
      : buildCancellationPayload(body);
    if (cancellation?.error) {
      throw { statusCode: 400, message: cancellation.error };
    }
    // Staff "Cancel" closes the appointment. Resubmission is only when correction reasons are sent.
    const needsResubmission = requesterRole !== 'citizen' && !isUpdateRequest && correctionReasons.length > 0;
    ticket.status = 'Cancelled';
    ticket.requestStatus = needsResubmission ? 'Resubmission Required' : 'Cancelled';
    ticket.needsResubmission = needsResubmission;
    if (cancellation) {
      applyCancellationDetails(ticket, cancellation, previousStatus, user.id);
    } else {
      const cancelledAt = new Date();
      ticket.cancellationReason = String(body?.reason || body?.cancellationReason || 'Cancelled by citizen.').trim();
      ticket.cancellationReasons = [ticket.cancellationReason];
      ticket.additionalCancellationReason = '';
      ticket.cancellationNotes = '';
      ticket.previousStatusBeforeCancellation = previousStatus;
      ticket.cancelledBy = user.id;
      ticket.cancelledAt = cancelledAt;
      embedCancellationDetails(ticket, {
        cancellationReasons: ticket.cancellationReasons,
        additionalCancellationReason: '',
        cancellationNotes: '',
        cancellationReason: ticket.cancellationReason,
        summary: ticket.cancellationReason,
        previousStatusBeforeCancellation: previousStatus,
        cancelledBy: user.id,
        cancelledAt: cancelledAt.toISOString()
      });
    }
    ticket = await hydrateTicket(await updateTicketById(ticket.id, ticket));

    // Always keep the same permanent National ID after cancel (never clear / never regenerate).
    const citizenId = idFrom(ticket.citizen);
    if (citizenId) {
      const citizen = await prisma.user.findUnique({ where: { id: citizenId }, include: { citizenProfile: true } });
      await restoreCitizenIdStatusAfterRequestEnd(citizenId, {
        wasIssuedBefore: hasIssuedNationalId(citizen || {})
      });
    }

    const populatedTicket = await hydrateTicket(await findTicketById(ticket.id));

    const notif = await createCancellationNotification({
      ticket: {
        ...ticket,
        cancellationReasons: cancellation?.reasons || ticket.cancellationReasons,
        additionalCancellationReason: cancellation?.additionalReason || ticket.additionalCancellationReason,
        cancellationNotes: cancellation?.additionalNotes || ticket.cancellationNotes,
        cancellationReason: cancellation?.summary || ticket.cancellationReason
      },
      reason: cancellation?.summary || ticket.cancellationReason,
      previousStatus
    });

    if (populatedTicket?.citizen) {
      await Promise.all([
        sendAppointmentCancellationEmail({
          user: populatedTicket.citizen,
          ticket: populatedTicket,
          service: populatedTicket.service,
          center: populatedTicket.center
        }),
        logSmsOnly({
          recipient: populatedTicket.citizen.phone,
          message: [
            `Your National ID appointment ${ticket.ref} has been cancelled.`,
            cancellation?.displayReasons?.length
              ? `Incorrect fields: ${cancellation.displayReasons.join(', ')}.`
              : '',
            cancellation?.additionalNotes
              ? `Note: ${cancellation.additionalNotes}`
              : ''
          ].filter(Boolean).join(' ')
        })
      ]);
    }

    // Audit logging
    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Cancel Service',
        details: `Cancelled ticket reference: ${ticket.ref}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    // Socket.io Real-time update
    const centerId = idFrom(ticket.center);
    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      io.to(ticket.ref).emit('ticketUpdate', ticket);
      if (citizenId) {
        io.emit(`notification-${citizenId}`, notif);
      }
    }

    return { message: 'Booking cancelled.', data: ticket  };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

// @desc    Resubmit corrected appointment/request details
// @route   PUT /api/bookings/:id/resubmit
// @access  Private/Citizen

  static async resubmitBooking({ body, query, params, user, ip, io }) {

  try {
    let ticket = await hydrateTicket(await findTicketByIdOrRef(params.id));

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found' };
    }
    if (normalizeRole(user.role) !== 'citizen') {
      throw { statusCode: 403, message: 'Only citizens can resubmit their own appointment.' };
    }
    if (idFrom(ticket.citizen)?.toString() !== user.id.toString()) {
      throw { statusCode: 403, message: 'Not authorized to resubmit this booking' };
    }
    if (ticket.status !== 'Cancelled') {
      throw { statusCode: 400, message: 'Only cancelled appointments can be resubmitted.' };
    }

    const { registrationDetails, replacementDetails, updateDetails, centerId, date, timeSlot } = body;
    const requestedCenterId = idFrom(centerId) || idFrom(ticket.center);
    const requestedDate = String(date || ticket.date || '').trim();
    const requestedTimeSlot = String(timeSlot || ticket.timeSlot || '').trim();
    const center = requestedCenterId
      ? await prisma.center.findUnique({ where: { id: requestedCenterId } })
      : null;
    if (!center) {
      throw { statusCode: 404, message: 'Selected center was not found.' };
    }
    const centerDistrict = getCenterDistrict(center);
    const correctionDetails = getEmbeddedCancellationDetails(ticket);
    const correctionSnapshot = correctionDetails.snapshot || {};
    const requestedAppointment = comparableAppointment({
      centerId: requestedCenterId,
      date: requestedDate,
      timeSlot: requestedTimeSlot
    });
    let changed = false;

    if (ticket.requestType === 'new_national_id' && registrationDetails) {
      const clean = sanitizeRegistrationDetails(registrationDetails, user);
      const error = validateRegistrationDetails(clean);
      if (error) throw { statusCode: 400, message: error };
      clean.district = normalizeBanaadirDistrict(clean.district);
      clean.centerDistrict = centerDistrict;
      clean.age = calculateAge(clean.dateOfBirth);
      const previousDetails = correctionSnapshot.details || comparableRegistrationDetails(ticket.registrationDetails || {});
      const previousAppointment = correctionSnapshot.appointment || comparableAppointment({
        centerId: idFrom(ticket.center),
        date: ticket.date,
        timeSlot: ticket.timeSlot
      });
      changed = !sameComparable(
        previousDetails,
        comparableRegistrationDetails(clean)
      ) || !sameComparable(previousAppointment, requestedAppointment);
      ticket.registrationDetails = clean;
      ticket.citizenName = clean.fullName;
      ticket.district = clean.district;
    }
    if ((ticket.requestType === 'lost_replacement' || ticket.requestType === 'replace_lost_id') && replacementDetails) {
      const clean = sanitizeReplacementDetails(replacementDetails, user);
      const error = validateReplacementDetails(clean);
      if (error) throw { statusCode: 400, message: error };
      clean.district = normalizeBanaadirDistrict(clean.district);
      const existingRegistration = ticket.existingRegistration?.ticket
        ? await hydrateTicket(await findTicketById(ticket.existingRegistration.ticket))
        : await findExistingNewRegistration({
            fullName: clean.fullName,
            phone: clean.phone,
            userId: user.id,
            onlyBlocking: false
          });
      const lostDateError = validateReplacementLostDate(clean, existingRegistration);
      if (lostDateError) {
        throw { statusCode: 400, message: lostDateError };
      }
      const previousDetails = correctionSnapshot.details || comparableReplacementDetails(ticket.replacementDetails || {});
      const previousAppointment = correctionSnapshot.appointment || comparableAppointment({
        centerId: idFrom(ticket.center),
        date: ticket.date,
        timeSlot: ticket.timeSlot
      });
      changed = !sameComparable(
        previousDetails,
        comparableReplacementDetails(clean)
      ) || !sameComparable(previousAppointment, requestedAppointment);
      ticket.replacementDetails = clean;
      ticket.citizenName = clean.fullName;
      ticket.district = clean.district;
    }
    if (ticket.requestType === 'update_information' && updateDetails) {
      let clean = sanitizeUpdateDetails(updateDetails, user);
      const originalRegistration = ticket.existingRegistration?.ticket
        ? await hydrateTicket(await findTicketById(ticket.existingRegistration.ticket))
        : await findExistingNewRegistration({
          fullName: clean.fullName,
          phone: clean.phone,
          userId: user.id,
          onlyBlocking: false
        });

      if (!originalRegistration || !canExposeExistingRegistration(originalRegistration, user)) {
        throw { statusCode: 404, message: 'No existing National ID registration found for this account.' };
      }

      clean = hydrateUpdateDetailsFromExistingRegistration(clean, originalRegistration, user);
      const error = validateUpdateDetails(clean);
      if (error) throw { statusCode: 400, message: error };
      const previousDetails = correctionSnapshot.submission || comparableUpdateSubmission(ticket.updateDetails || {});
      changed = !sameComparable(
        previousDetails,
        comparableUpdateSubmission(clean)
      );
      ticket.updateDetails = clean;
      ticket.citizenName = clean.fullName;
      ticket.existingRegistration = buildExistingRegistrationInfo(originalRegistration);
    }

    if (!changed) {
      throw { statusCode: 400, message: 'No changes detected. Please correct the requested information before resubmitting.' };
    }

    const isUpdateRequest = ticket.requestType === 'update_information';
    if (!isUpdateRequest) {
      if (!requestedDate || !requestedTimeSlot) {
        throw { statusCode: 400, message: 'Appointment date and time are required.' };
      }
      const schedule = getCenterSchedule(center);
      const scheduleSlots = getScheduleSlots(schedule);
      const bookingDate = parseDateKey(requestedDate);
      if (!bookingDate) {
        throw { statusCode: 400, message: ERRORS.INVALID_DATE };
      }
      if (isCenterUnavailableOnDate(center, schedule, bookingDate)) {
        throw { statusCode: 400, message: ERRORS.CLOSED_DATE };
      }
      if (!scheduleSlots.includes(requestedTimeSlot)) {
        throw { statusCode: 400, message: ERRORS.CLOSED_TIME };
      }

      const [slotCount, dayCount] = await Promise.all([
        prisma.ticket.count({ where: { center: requestedCenterId, date: requestedDate, timeSlot: requestedTimeSlot, status: { not: 'Cancelled' } } }),
        prisma.ticket.count({ where: { center: requestedCenterId, date: requestedDate, status: { not: 'Cancelled' } } })
      ]);
      if (slotCount >= getSlotCapacity(center, schedule)
        || dayCount >= Number(schedule.maxAppointmentsPerDay || DEFAULT_SCHEDULE.maxAppointmentsPerDay)) {
        throw { statusCode: 400, message: 'Appointments are full for this time. Please choose another available slot.' };
      }

      ticket.center = requestedCenterId;
      ticket.date = requestedDate;
      ticket.timeSlot = requestedTimeSlot;
      if (ticket.registrationDetails) {
        ticket.registrationDetails.appointmentDate = requestedDate;
        ticket.registrationDetails.appointmentTime = requestedTimeSlot;
        ticket.registrationDetails.selectedCenter = center.name || ticket.registrationDetails.selectedCenter || '';
        ticket.registrationDetails.centerDistrict = centerDistrict;
      }
    }

    ticket.status = 'Waiting';
    ticket.requestStatus = 'Pending';
    ticket.cancellationReason = '';
    ticket.cancellationReasons = [];
    ticket.additionalCancellationReason = '';
    ticket.cancellationNotes = '';
    ticket.previousStatusBeforeCancellation = '';
    ticket.cancelledBy = null;
    ticket.cancelledAt = null;
    setCorrectionResolved(ticket, true);
    clearEmbeddedCancellationDetails(ticket);
    ticket = await hydrateTicket(await updateTicketById(ticket.id, ticket));

    const populatedTicket = await hydrateTicket(await findTicketById(ticket.id));

    await prisma.notification.create({
      data: {
        user: idFrom(ticket.citizen),
        title: 'Appointment Resubmitted',
        desc: `Your ticket ${ticket.ref} was resubmitted for review.`,
        category: 'Appointments'
      }
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Resubmit Appointment',
        details: `Resubmitted ticket ${ticket.ref}`,
        ipAddress: ip || '127.0.0.1'
      }
    });

    if (io) {
      io.to(idFrom(ticket.center).toString()).emit('queueUpdate', { centerId: idFrom(ticket.center) });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
    }

    return { message: 'Appointment resubmitted.', data: populatedTicket  };
  } catch (error) {
    throw { statusCode: 500, message: error.message };
  }
};

}
