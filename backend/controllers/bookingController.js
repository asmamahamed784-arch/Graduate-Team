import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Center from '../models/Center.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { generateRef } from '../utils/generateReference.js';
import {
  isBanaadirNationalIdCenter,
  isLostNationalIdReplacementService,
  isNationalIdService,
  isUpdateNationalIdInformationService
} from '../utils/nqsScope.js';
import { canAccessTicket, getAssignedCenterId, normalizeRole } from '../utils/rbac.js';
import {
  sendAppointmentApprovalEmail,
  sendAppointmentCancellationEmail,
  sendAppointmentCompletionEmail,
  sendBookingConfirmationEmail
} from '../services/emailService.js';
import { logSmsOnly } from '../services/smsLogService.js';

const sanitizeReplacementDetails = (details = {}, fallbackUser = {}) => ({
  fullName: String(details.fullName || fallbackUser.name || '').trim(),
  phone: String(details.phone || fallbackUser.phone || '').trim(),
  nationalIdNumber: String(details.nationalIdNumber || fallbackUser.nationalId || '').trim(),
  reason: String(details.reason || '').trim(),
  dateLost: String(details.dateLost || '').trim(),
  placeLost: String(details.placeLost || '').trim(),
  policeReportNumber: String(details.policeReportNumber || '').trim(),
  policeReportDocument: String(details.policeReportDocument || '').trim(),
  additionalNotes: String(details.additionalNotes || '').trim()
});

const validateReplacementDetails = (details) => {
  const requiredFields = [
    ['fullName', 'Full name is required for lost National ID replacement.'],
    ['phone', 'Phone number is required for lost National ID replacement.'],
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

const validateUpdateDetails = (details) => {
  const requiredFields = [
    ['fullName', 'Full name is required for update requests.'],
    ['phone', 'Phone number is required for update requests.'],
  ];

  const missing = requiredFields.find(([field]) => !details[field]);
  if (missing) return missing[1];
  if (!isValidGovernmentName(details.fullName, 5)) return 'Full Name must contain letters only.';
  if (!isValidSomaliPhone(details.phone)) return 'Enter a valid Somali phone number.';

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
  const incomplete = changes.find((change) => !change.field || !change.currentValue || !change.newValue || !change.reason);
  if (incomplete) return 'Each selected update field must include current value, new value, and reason.';
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

const getQueueNumberFromRef = (ref) => {
  if (!ref) return '';
  return String(ref).split('-').pop();
};

const buildExistingRegistrationInfo = (ticket) => ({
  found: Boolean(ticket),
  ticket: ticket?._id || null,
  ticketNumber: ticket?.ref || '',
  queueNumber: getQueueNumberFromRef(ticket?.ref),
  serviceType: ticket?.service?.name || 'New National ID Registration',
  centerName: ticket?.center?.name || ticket?.registrationDetails?.selectedCenter || '',
  centerId: ticket?.center?._id || ticket?.center || null,
  date: ticket?.date || ticket?.registrationDetails?.appointmentDate || '',
  timeSlot: ticket?.timeSlot || ticket?.registrationDetails?.appointmentTime || '',
  status: ticket?.status || ''
});

const canExposeExistingRegistration = (ticket, user) => (
  normalizeRole(user.role) === 'admin' ||
  String(ticket?.citizen?._id || ticket?.citizen || '') === String(user._id)
);

const findExistingNewRegistration = async ({ fullName, phone }) => {
  const normalizedName = normalizeFullNameForLookup(fullName);
  const normalizedPhone = normalizePhoneForLookup(phone);
  if (!normalizedName || !normalizedPhone) return null;

  const candidates = await Ticket.find({ requestType: 'new_national_id' })
    .populate('service', 'name')
    .populate('center', 'name city district')
    .populate('citizen', 'name phone')
    .sort({ createdAt: 1 });

  return candidates.find((ticket) => {
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
  return /^(61|62|63|65|66|68|69)\d{7}$/.test(String(value || '').trim());
};

const calculateAge = (dateOfBirth) => {
  const dob = parseDateKey(dateOfBirth);
  if (!dob) return 0;
  const today = new Date();
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
  if (!isLettersNumbersSpacesOnly(district)) return 'District can contain letters, numbers, and spaces only.';
  if (!isLettersNumbersSpacesOnly(nearestLandmark)) return 'Nearest landmark can contain letters, numbers, and spaces only.';
  if (!isAddressTextValid(address)) return 'Full address can contain letters, numbers, spaces, and commas only.';
  const dob = parseDateKey(details.dateOfBirth);
  if (!dob || dateKey(dob) !== details.dateOfBirth || dob > new Date()) return 'Enter a real date of birth.';
  const age = calculateAge(details.dateOfBirth);
  if (age < 18) return 'You must be at least 18 years old to book this service.';
  return '';
};

const getRequestLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'lost National ID replacement';
  if (requestType === 'update_information') return 'National ID information update';
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
  if (!Array.isArray(days)) return fallback;
  return days
    .map((day) => {
      if (typeof day === 'number') return WEEK_DAYS[day];
      if (/^\d+$/.test(String(day))) return WEEK_DAYS[Number(day)];
      return String(day || '').trim();
    })
    .filter((day) => WEEK_DAYS.includes(day));
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
    closedDates: Array.isArray(payload.closedDates) ? payload.closedDates : [],
    specialUnavailableDates: Array.isArray(payload.specialUnavailableDates) ? payload.specialUnavailableDates : [],
    isActive: payload.isActive ?? true
  };
};

const getCenterSchedule = (center) => normalizeSchedule(center?.schedule || {}, center);

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

const isCenterUnavailableOnDate = (center, schedule, date) => {
  const key = dateKey(date);
  const weekday = dayName(date);
  return (
    center.status !== 'Active' ||
    schedule.isActive === false ||
    !schedule.workingDays.includes(weekday) ||
    schedule.closedDays.includes(weekday) ||
    schedule.closedDates.includes(key) ||
    schedule.specialUnavailableDates.includes(key)
  );
};

// @desc    Get booking date and time-slot availability for a center
// @route   GET /api/bookings/availability
// @access  Private/Citizen or Admin
export const getBookingAvailability = async (req, res) => {
  try {
    const { centerId, start, end } = req.query;

    if (!centerId) {
      return res.status(400).json({ success: false, message: 'Center is required.' });
    }

    const center = await Center.findById(centerId);
    if (!center || !isBanaadirNationalIdCenter(center)) {
      return res.status(404).json({ success: false, message: 'Approved Banaadir center not found.' });
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

    const tickets = await Ticket.find({
      center: centerId,
      date: { $gte: startKey, $lte: endKey },
      status: { $ne: 'Cancelled' },
      timeSlot: { $in: scheduleSlots }
    }).select('date timeSlot status');

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
        .filter(([, count]) => count >= Number(schedule.maxBookingsPerSlot || DEFAULT_SCHEDULE.maxBookingsPerSlot))
        .map(([slot]) => slot);
      const closed = isCenterUnavailableOnDate(center, schedule, cursor);
      const dayTotal = await Ticket.countDocuments({
        center: centerId,
        date: key,
        status: { $ne: 'Cancelled' }
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

    return res.json({
      success: true,
      data: {
        centerId,
        timeSlots: scheduleSlots,
        schedule,
        dates
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new booking/appointment
// @route   POST /api/bookings
// @access  Private/Citizen or Admin
export const createBooking = async (req, res) => {
  try {
    const { serviceId, centerId, date, timeSlot, citizenName, registrationDetails, replacementDetails, updateDetails } = req.body;

    const service = await Service.findById(serviceId);
    const isUpdateService = isUpdateNationalIdInformationService(service);
    const center = centerId
      ? await Center.findById(centerId)
      : isUpdateService
        ? await Center.findOne({ city: 'Banaadir', name: 'Banaadir National ID Center' })
        : null;

    if (!service || !center) {
      return res.status(404).json({ success: false, message: 'Service or Center not found' });
    }

    if (!isNationalIdService(service) || !isBanaadirNationalIdCenter(center)) {
      return res.status(400).json({
        success: false,
        message: 'Bookings are limited to National ID services at approved Banaadir centers'
      });
    }

    const resolvedCenterId = center._id || centerId;

    const isReplacement = isLostNationalIdReplacementService(service);
    const isUpdateRequest = isUpdateService;
    const isNewRegistration = !isReplacement && !isUpdateRequest;
    const cleanRegistrationDetails = isNewRegistration
      ? sanitizeRegistrationDetails(registrationDetails, req.user)
      : {};
    const cleanReplacementDetails = isReplacement
      ? sanitizeReplacementDetails(replacementDetails, req.user)
      : {};
    const cleanUpdateDetails = isUpdateRequest
      ? sanitizeUpdateDetails(updateDetails, req.user)
      : {};

    if (isNewRegistration) {
      const registrationError = validateRegistrationDetails(cleanRegistrationDetails);
      if (registrationError) {
        return res.status(400).json({ success: false, message: registrationError });
      }
      cleanRegistrationDetails.age = calculateAge(cleanRegistrationDetails.dateOfBirth);
    }
    if (isReplacement) {
      const replacementError = validateReplacementDetails(cleanReplacementDetails);
      if (replacementError) {
        return res.status(400).json({ success: false, message: replacementError });
      }
    }
    if (isUpdateRequest) {
      const updateError = validateUpdateDetails(cleanUpdateDetails);
      if (updateError) {
        return res.status(400).json({ success: false, message: updateError });
      }
    }

    let existingRegistrationInfo = { found: false };
    if (isNewRegistration || isUpdateRequest) {
      const lookupDetails = isNewRegistration ? cleanRegistrationDetails : cleanUpdateDetails;
      const existingRegistration = await findExistingNewRegistration({
        fullName: lookupDetails.fullName,
        phone: lookupDetails.phone
      });

      if (isNewRegistration && existingRegistration) {
        const existingTicket = canExposeExistingRegistration(existingRegistration, req.user)
          ? buildExistingRegistrationInfo(existingRegistration)
          : null;
        return res.status(409).json({
          success: false,
          message: 'You have already registered for a National ID service. Please use your existing ticket or contact support.',
          data: existingTicket ? { existingTicket } : undefined
        });
      }

      if (isUpdateRequest) {
        if (!existingRegistration) {
          return res.status(404).json({
            success: false,
            message: 'No existing National ID registration found for this name and phone number.'
          });
        }

        if (!canExposeExistingRegistration(existingRegistration, req.user)) {
          return res.status(403).json({
            success: false,
            message: 'No existing National ID registration found for this name and phone number.'
          });
        }

        existingRegistrationInfo = buildExistingRegistrationInfo(existingRegistration);
      }
    }

    if (!isUpdateRequest && (!date || !timeSlot)) {
      return res.status(400).json({ success: false, message: 'Appointment date and time are required.' });
    }

    const schedule = getCenterSchedule(center);
    const scheduleSlots = getScheduleSlots(schedule);
    if (!isUpdateRequest) {
      const bookingDate = parseDateKey(date);
      if (!bookingDate) {
        return res.status(400).json({ success: false, message: 'Invalid appointment date.' });
      }
      if (isCenterUnavailableOnDate(center, schedule, bookingDate)) {
        return res.status(400).json({ success: false, message: 'This center is not available on this date.' });
      }
      if (!scheduleSlots.includes(timeSlot)) {
        return res.status(400).json({ success: false, message: 'Selected time is outside the available appointment schedule.' });
      }

      const [slotCount, dayCount] = await Promise.all([
        Ticket.countDocuments({ center: resolvedCenterId, date, timeSlot, status: { $ne: 'Cancelled' } }),
        Ticket.countDocuments({ center: resolvedCenterId, date, status: { $ne: 'Cancelled' } })
      ]);
      if (slotCount >= Number(schedule.maxBookingsPerSlot || DEFAULT_SCHEDULE.maxBookingsPerSlot)
        || dayCount >= Number(schedule.maxAppointmentsPerDay || DEFAULT_SCHEDULE.maxAppointmentsPerDay)) {
        await Notification.create({
          user: req.user._id,
          title: 'Appointment Time Full',
          desc: 'Appointments are full for this time. Please choose another available slot.',
          category: 'Appointments'
        });
        return res.status(400).json({ success: false, message: 'Appointments are full for this time. Please choose another available slot.' });
      }
    }

    if (isNewRegistration) {
      cleanRegistrationDetails.selectedCenter = center.name;
      cleanRegistrationDetails.centerDistrict = cleanRegistrationDetails.centerDistrict || center.district || center.city || 'Banaadir';
      cleanRegistrationDetails.appointmentDate = date;
      cleanRegistrationDetails.appointmentTime = timeSlot;
    }

    const refCode = await generateRef();
    const citizenId = req.user._id;
    const requestType = isReplacement ? 'lost_replacement' : isUpdateRequest ? 'update_information' : 'new_national_id';
    const requestLabel = getRequestLabel(requestType);
    const nameOfCitizen = cleanRegistrationDetails.fullName || cleanReplacementDetails.fullName || cleanUpdateDetails.fullName || citizenName || req.user.name;

    // Calculate queue waiting list details
    const activeWaiting = await Ticket.countDocuments({
      center: resolvedCenterId,
      status: 'Waiting',
      date: isUpdateRequest ? '' : date
    });
    // Est wait time = active waiting * service duration
    const waitMins = activeWaiting * service.duration;

    const ticket = await Ticket.create({
      ref: refCode,
      service: serviceId,
      citizenName: nameOfCitizen,
      citizen: citizenId,
      center: resolvedCenterId,
      date: isUpdateRequest ? '' : date,
      timeSlot: isUpdateRequest ? null : timeSlot,
      requestType,
      requestStatus: 'Pending',
      registrationDetails: isNewRegistration ? cleanRegistrationDetails : undefined,
      replacementDetails: isReplacement ? cleanReplacementDetails : undefined,
      updateDetails: isUpdateRequest ? cleanUpdateDetails : undefined,
      existingRegistration: isUpdateRequest ? existingRegistrationInfo : undefined,
      documents: isReplacement && cleanReplacementDetails.policeReportDocument
        ? [{ name: 'Police report', fileUrl: cleanReplacementDetails.policeReportDocument, documentType: 'police_report' }]
        : [],
      waitTime: isUpdateRequest ? 'Review pending' : waitMins > 0 ? `${waitMins} min` : '10 min',
      status: isUpdateRequest ? 'On Hold' : 'Waiting'
    });

    // Create persistent Notification
    const notif = await Notification.create({
      user: citizenId,
      title: isReplacement
        ? 'Replacement Request Submitted'
        : isUpdateRequest
          ? 'Update Request Submitted'
          : 'Appointment Confirmed',
      desc: isReplacement || isUpdateRequest
        ? `Your ${requestLabel} request ${refCode} has been submitted.`
        : `Your ticket ${refCode} for ${service.name} has been scheduled.`,
      category: 'Appointments'
    });

    await Promise.all([
      sendBookingConfirmationEmail({ user: req.user, ticket, service, center }),
      logSmsOnly({
        recipient: req.user.phone,
        message: isUpdateRequest
          ? `Your ${service.name} request is submitted. Reference: ${refCode}.`
          : `Your ${service.name} appointment is confirmed. Ticket: ${refCode}. Center: ${center.name}. Date: ${date}.`
      })
    ]);

    // Audit logging
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: isReplacement
        ? 'Create Lost ID Replacement Request'
        : isUpdateRequest
          ? 'Create ID Information Update Request'
          : 'Book Appointment',
      details: `${isReplacement || isUpdateRequest ? `Created ${requestLabel} request` : 'Booked ticket'}: ${refCode} at center: ${center.name} for service: ${service.name}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    // Emit Socket.io updates for real-time queue tracking
    const io = req.app.get('io');
    if (io) {
      // Notify the specific center room that the queue list has updated
      io.to(resolvedCenterId.toString()).emit('queueUpdate', { centerId: resolvedCenterId });
      // Notify the specific ticket room (for live single ticket tracking)
      io.to(refCode).emit('ticketUpdate', ticket);
      // If citizenId exists, alert the user’s personal feed
      if (citizenId) {
        io.emit(`notification-${citizenId}`, notif);
      }
    }

    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user's appointments/tickets
// @route   GET /api/bookings/my
// @access  Private (Citizen or Admin, scoped to the logged-in account)
export const getUserBookings = async (req, res) => {
  try {
    const tickets = await Ticket.find({ citizen: req.user._id })
      .populate('service')
      .populate('center')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all appointments for administrators
// @route   GET /api/bookings/admin/all
// @access  Private/Admin
export const getAllBookings = async (req, res) => {
  try {
    const { search = '', status = '', center = '', date = '', requestType = '', requestStatus = '' } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }
    if (requestType) {
      query.requestType = requestType;
    }
    if (requestStatus) {
      query.requestStatus = requestStatus;
    }
    if (center) {
      query.center = center;
    }
    if (normalizeRole(req.user.role) === 'super_operator') {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!assignedCenterId) {
        return res.status(403).json({ success: false, message: 'Super operator account is not assigned to a center.' });
      }
      query.center = assignedCenterId;
    }
    if (date) {
      query.date = date;
    }
    if (search.trim()) {
      const term = search.trim();
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
          { phone: { $regex: term, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = matchingUsers.map((user) => user._id);
      query.$or = [
        { ref: { $regex: term, $options: 'i' } },
        { citizenName: { $regex: term, $options: 'i' } },
        { citizen: { $in: userIds } }
      ];
    }

    const tickets = await Ticket.find(query)
      .populate('service', 'name category duration')
      .populate('center', 'name address city phone')
      .populate('citizen', 'name email phone')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update National ID special request status
// @route   PUT /api/bookings/admin/:id/request-status
// @access  Private/Admin
export const updateRequestStatus = async (req, res) => {
  try {
    const { requestStatus } = req.body;
    const allowedStatuses = ['Pending', 'Approved', 'Rejected', 'Completed', 'Resubmission Required'];

    if (!allowedStatuses.includes(requestStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid request status' });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate('service', 'name category duration')
      .populate('center', 'name address city phone')
      .populate('citizen', 'name email phone');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to manage this appointment.' });
    }

    if (ticket.requestType === 'new_national_id') {
      return res.status(400).json({ success: false, message: 'This ticket is not a National ID special request' });
    }

    const requestLabel = getRequestLabel(ticket.requestType);
    ticket.requestStatus = requestStatus;
    if (requestStatus === 'Approved' && ticket.status === 'Cancelled') {
      ticket.status = 'Waiting';
    }
    if (requestStatus === 'Rejected') {
      ticket.status = 'Cancelled';
    }
    if (requestStatus === 'Resubmission Required') {
      ticket.needsResubmission = true;
      ticket.status = 'Cancelled';
    }
    if (requestStatus === 'Completed') {
      ticket.status = 'Completed';
      ticket.completedAt = new Date();
    }

    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name category duration')
      .populate('center', 'name address city phone')
      .populate('citizen', 'name email phone');

    const citizenId = ticket.citizen?._id || ticket.citizen;
    const centerId = ticket.center?._id || ticket.center;

    if (citizenId) {
      await Notification.create({
        user: citizenId,
        title: 'Request Updated',
        desc: requestStatus === 'Resubmission Required'
          ? `Your ${requestLabel} request ${ticket.ref} needs correction and resubmission.`
          : `Your ${requestLabel} request ${ticket.ref} is now ${requestStatus}.`,
        category: 'Appointments'
      });
    }

    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Update National ID Request',
      details: `Updated ${requestLabel} request ${ticket.ref} to ${requestStatus}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(centerId.toString()).emit('queueUpdate', { centerId });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
      if (citizenId) {
        io.emit(`notification-${citizenId}`, {
          title: 'Request Updated',
          desc: `Your ${requestLabel} request ${ticket.ref} is now ${requestStatus}.`,
          category: 'Appointments'
        });
      }
    }

    return res.json({ success: true, message: 'Request updated.', data: populatedTicket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update appointment status from admin appointment page
// @route   PUT /api/bookings/admin/:id/status
// @access  Private/Admin
export const updateBookingStatus = async (req, res) => {
  try {
    const { status, cancellationReason = '' } = req.body;
    const allowedStatuses = ['Waiting', 'Being Served', 'On Hold', 'Completed', 'Cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment status' });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to manage this appointment.' });
    }

    if (status === 'Cancelled' && !String(cancellationReason || '').trim()) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required.' });
    }

    ticket.status = status;
    if (status === 'Completed') {
      ticket.completedAt = new Date();
      if (ticket.requestType !== 'new_national_id') {
        ticket.requestStatus = 'Completed';
      }
    }
    if (status === 'Cancelled' && ticket.requestType !== 'new_national_id') {
      ticket.requestStatus = 'Rejected';
    }
    if (status === 'Cancelled') {
      ticket.cancellationReason = String(cancellationReason || '').trim();
      ticket.cancelledBy = req.user._id;
      ticket.cancelledAt = new Date();
      ticket.needsResubmission = true;
      ticket.requestStatus = 'Resubmission Required';
    }
    if (status === 'Being Served' && !ticket.calledAt) {
      ticket.calledAt = new Date();
    }
    if (status === 'Waiting') {
      ticket.completedAt = null;
      if (ticket.requestType !== 'new_national_id' && ticket.requestStatus !== 'Completed') {
        ticket.requestStatus = 'Approved';
      }
    }

    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name category duration')
      .populate('center', 'name address city phone')
      .populate('citizen', 'name email phone');

    if (ticket.citizen) {
      await Notification.create({
        user: ticket.citizen,
        title: status === 'Cancelled'
          ? 'Appointment Cancelled'
          : 'Appointment Updated',
        desc: status === 'Cancelled'
          ? `Your appointment ${ticket.ref} was cancelled. Reason: ${ticket.cancellationReason}. Please correct your information and resubmit your appointment.`
          : `Your ticket ${ticket.ref} status is now ${status}.`,
        category: 'Appointments'
      });

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

    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Update Appointment',
      details: status === 'Cancelled'
        ? `Cancelled ticket ${ticket.ref}. Reason: ${ticket.cancellationReason}`
        : `Updated ticket ${ticket.ref} status to ${status}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
      if (ticket.citizen) {
        io.emit(`notification-${ticket.citizen}`, {
          title: status === 'Cancelled' ? 'Appointment Cancelled' : 'Appointment Updated',
          desc: status === 'Cancelled'
            ? `Your appointment ${ticket.ref} was cancelled. Reason: ${ticket.cancellationReason}. Please correct your information and resubmit your appointment.`
            : `Your ticket ${ticket.ref} status is now ${status}.`,
          category: 'Appointments'
        });
      }
    }

    return res.json({ success: true, message: 'Appointment updated.', data: populatedTicket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single ticket details by reference or ID
// @route   GET /api/bookings/:refOrId
// @access  Public
export const getBookingDetails = async (req, res) => {
  try {
    const { refOrId } = req.params;
    let query = {};
    
    if (refOrId.startsWith('NQS-')) {
      query = { ref: refOrId };
    } else {
      query = { _id: refOrId };
    }

    const ticket = await Ticket.findOne(query)
      .populate('service')
      .populate('center')
      .populate('citizen', 'name email phone');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (!canAccessTicket(req.user, ticket)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this booking.' });
    }

    return res.json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel an appointment
// @route   PUT /api/bookings/:id/cancel
// @access  Private
export const cancelBooking = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Verify ownership
    if (normalizeRole(req.user.role) === 'citizen' && ticket.citizen && ticket.citizen.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    ticket.status = 'Cancelled';
    await ticket.save();
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name category duration')
      .populate('center', 'name address city phone')
      .populate('citizen', 'name email phone');

    // Create Notification
    const notif = await Notification.create({
      user: ticket.citizen,
      title: 'Appointment Cancelled',
      desc: `Your appointment with ticket ${ticket.ref} has been cancelled.`,
      category: 'Appointments'
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
          message: `Your National ID appointment ${ticket.ref} has been cancelled.`
        })
      ]);
    }

    // Audit logging
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Cancel Booking',
      details: `Cancelled ticket reference: ${ticket.ref}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    // Socket.io Real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', ticket);
      if (ticket.citizen) {
        io.emit(`notification-${ticket.citizen}`, notif);
      }
    }

    return res.json({ success: true, message: 'Booking cancelled.', data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resubmit corrected appointment/request details
// @route   PUT /api/bookings/:id/resubmit
// @access  Private/Citizen
export const resubmitBooking = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (normalizeRole(req.user.role) !== 'citizen') {
      return res.status(403).json({ success: false, message: 'Only citizens can resubmit their own appointment.' });
    }
    if (ticket.citizen?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to resubmit this booking' });
    }
    if (ticket.status !== 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Only cancelled appointments can be resubmitted.' });
    }
    if (!ticket.needsResubmission) {
      return res.status(400).json({ success: false, message: 'This appointment is not marked for resubmission.' });
    }

    const { registrationDetails, replacementDetails, updateDetails, note = '' } = req.body;

    if (ticket.requestType === 'new_national_id' && registrationDetails) {
      const clean = sanitizeRegistrationDetails(registrationDetails, req.user);
      const error = validateRegistrationDetails(clean);
      if (error) return res.status(400).json({ success: false, message: error });
      clean.age = calculateAge(clean.dateOfBirth);
      ticket.registrationDetails = clean;
      ticket.citizenName = clean.fullName;
    }
    if (ticket.requestType === 'lost_replacement' && replacementDetails) {
      const clean = sanitizeReplacementDetails(replacementDetails, req.user);
      const error = validateReplacementDetails(clean);
      if (error) return res.status(400).json({ success: false, message: error });
      ticket.replacementDetails = clean;
      ticket.citizenName = clean.fullName;
    }
    if (ticket.requestType === 'update_information' && updateDetails) {
      const clean = sanitizeUpdateDetails(updateDetails, req.user);
      const error = validateUpdateDetails(clean);
      if (error) return res.status(400).json({ success: false, message: error });
      ticket.updateDetails = clean;
      ticket.citizenName = clean.fullName;
    }

    ticket.status = 'Waiting';
    ticket.requestStatus = 'Pending';
    ticket.needsResubmission = false;
    ticket.cancellationReason = '';
    ticket.cancelledBy = null;
    ticket.cancelledAt = null;
    ticket.resubmissionHistory.push({ note: String(note || 'Citizen resubmitted corrected information.').trim() });
    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('service', 'name category duration')
      .populate('center', 'name address city phone')
      .populate('citizen', 'name username phone');

    await Notification.create({
      user: ticket.citizen,
      title: 'Appointment Resubmitted',
      desc: `Your ticket ${ticket.ref} was resubmitted for review.`,
      category: 'Appointments'
    });

    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Resubmit Appointment',
      details: `Resubmitted ticket ${ticket.ref}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(ticket.center.toString()).emit('queueUpdate', { centerId: ticket.center });
      io.to(ticket.ref).emit('ticketUpdate', populatedTicket);
    }

    return res.json({ success: true, message: 'Appointment resubmitted.', data: populatedTicket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
