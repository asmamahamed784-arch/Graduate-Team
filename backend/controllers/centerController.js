import Center from '../models/Center.js';
import AuditLog from '../models/AuditLog.js';
import Ticket from '../models/Ticket.js';
import { BANAADIR_CENTER_NAMES } from '../utils/nqsScope.js';

const BANAADIR_DISTRICTS = [
  'Hodan',
  'Howlwadaag',
  'Wadajir',
  'Dharkenley',
  'Dayniile',
  'Heliwaa',
  'Yaqshiid',
  'Kaaraan',
  'Shibis',
  'Boondheere',
  'Xamar Weyne',
  'Xamar Jajab',
  'Waaberi',
  'Wardhiigley',
  'Abdulaziz',
  'Shangaani',
  'Kaxda',
  'Garasbaaley'
];

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalizeDistrict = (value = '') => {
  const key = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    hawlwadaag: 'Howlwadaag',
    howlwadaag: 'Howlwadaag',
    hamarweyne: 'Xamar Weyne',
    xamarweyne: 'Xamar Weyne',
    hamarjajab: 'Xamar Jajab',
    xamarjajab: 'Xamar Jajab',
    waberi: 'Waaberi',
    waaberi: 'Waaberi',
    karaan: 'Kaaraan'
  };
  return BANAADIR_DISTRICTS.find((district) => district.toLowerCase().replace(/[^a-z0-9]/g, '') === key) || aliases[key] || '';
};

const districtFromCenterName = (name = '') => {
  const base = String(name).replace(/\s+National ID Center$/i, '').trim();
  return normalizeDistrict(base) || (/^Banaadir$/i.test(base) ? 'Hodan' : '');
};

const normalizeDayList = (days, fallback = []) => {
  if (!Array.isArray(days)) return fallback;
  return [...new Set(days.map((day) => String(day || '').trim()).filter((day) => WEEK_DAYS.includes(day)))];
};

const normalizeDateList = (dates = []) => (
  Array.isArray(dates)
    ? [...new Set(dates.map((date) => String(date || '').trim()).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))]
    : []
);

const normalizeTime = (value, fallback) => {
  const text = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
  if (!match) return fallback;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const formatHours = (startTime, endTime) => `${startTime} - ${endTime}`;

const normalizeSchedule = (schedule = {}, existingSchedule = {}) => {
  const workingDays = normalizeDayList(
    schedule.workingDays,
    existingSchedule.workingDays?.length ? existingSchedule.workingDays : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  );
  const startTime = normalizeTime(schedule.startTime, existingSchedule.startTime || '08:00');
  const endTime = normalizeTime(schedule.endTime, existingSchedule.endTime || '16:00');
  const closedDays = normalizeDayList(
    schedule.closedDays,
    existingSchedule.closedDays?.length ? existingSchedule.closedDays : WEEK_DAYS.filter((day) => !workingDays.includes(day))
  );

  return {
    workingDays,
    startTime,
    endTime,
    breakTime: {
      start: normalizeTime(schedule.breakTime?.start, existingSchedule.breakTime?.start || ''),
      end: normalizeTime(schedule.breakTime?.end, existingSchedule.breakTime?.end || '')
    },
    slotDuration: Math.max(5, Number(schedule.slotDuration || existingSchedule.slotDuration || 30)),
    maxBookingsPerSlot: Math.max(1, Number(schedule.maxBookingsPerSlot || existingSchedule.maxBookingsPerSlot || schedule.maxAppointmentsPerSlot || 5)),
    maxAppointmentsPerDay: Math.max(1, Number(schedule.maxAppointmentsPerDay || existingSchedule.maxAppointmentsPerDay || 100)),
    closedDays,
    closedDates: normalizeDateList(schedule.closedDates || existingSchedule.closedDates || []),
    specialUnavailableDates: normalizeDateList(schedule.specialUnavailableDates || existingSchedule.specialUnavailableDates || []),
    isActive: typeof schedule.isActive === 'boolean' ? schedule.isActive : existingSchedule.isActive ?? true
  };
};

const buildCenterPayload = (body, existingCenter = {}) => {
  const schedule = normalizeSchedule(body.schedule || {}, existingCenter.schedule || {});
  const name = String(body.name ?? existingCenter.name ?? '').trim();
  const district = normalizeDistrict(body.district ?? existingCenter.district) || districtFromCenterName(name);
  const status = body.status || existingCenter.status || 'Active';

  return {
    name,
    address: String(body.address ?? existingCenter.address ?? '').trim(),
    city: 'Banaadir',
    district,
    phone: String(body.phone ?? existingCenter.phone ?? '').trim(),
    counters: Math.max(1, Number(body.counters ?? existingCenter.counters ?? 1)),
    capacity: Math.max(1, Number(body.capacity ?? schedule.maxAppointmentsPerDay)),
    hours: body.hours || formatHours(schedule.startTime, schedule.endTime),
    status,
    schedule: {
      ...schedule,
      isActive: status === 'Active' && schedule.isActive !== false
    }
  };
};

const timeToMinutes = (value) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const validateCenterPayload = (payload) => {
  if (!payload.name) return 'Center name is required.';
  if (!payload.address) return 'Address is required.';
  if (!payload.phone) return 'Phone number is required.';
  if (!payload.district) return 'Please select a valid Banaadir district.';
  if (!payload.schedule.workingDays.length) return 'Select at least one working day.';
  const start = timeToMinutes(payload.schedule.startTime);
  const end = timeToMinutes(payload.schedule.endTime);
  if (start === null || end === null || start >= end) return 'Opening time must be before closing time.';
  return '';
};

// @desc    Get all centers
// @route   GET /api/centers
// @access  Public
export const listCenters = async (req, res) => {
  try {
    const centers = await Center.find({
      name: { $in: BANAADIR_CENTER_NAMES },
      city: 'Banaadir'
    });
    return res.json({ success: true, count: centers.length, data: centers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get center by ID
// @route   GET /api/centers/:id
// @access  Public
export const getCenterById = async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }
    if (center.city !== 'Banaadir' || !BANAADIR_CENTER_NAMES.includes(center.name)) {
      return res.status(404).json({ success: false, message: 'Center is outside the NQS scope' });
    }
    return res.json({ success: true, data: center });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new center
// @route   POST /api/centers
// @access  Private/Admin
export const createCenter = async (req, res) => {
  try {
    const payload = buildCenterPayload(req.body);

    const validationError = validateCenterPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    if (!BANAADIR_CENTER_NAMES.includes(payload.name)) {
      return res.status(400).json({
        success: false,
        message: 'Only approved Banaadir National ID centers are allowed'
      });
    }

    const centerExists = await Center.findOne({ name: payload.name });
    if (centerExists) {
      return res.status(400).json({ success: false, message: 'Center name already exists' });
    }

    const center = await Center.create(payload);

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Create Center',
      details: `Created new service center: ${payload.name}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({ success: true, data: center });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update center
// @route   PUT /api/centers/:id
// @access  Private/Admin
export const updateCenter = async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);

    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    const payload = buildCenterPayload(req.body, center);
    const validationError = validateCenterPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    if (!BANAADIR_CENTER_NAMES.includes(payload.name)) {
      return res.status(400).json({
        success: false,
        message: 'Only approved Banaadir National ID centers are allowed'
      });
    }

    const updatedCenter = await Center.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Update Center',
      details: `Updated center ID: ${center._id} (${center.name})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, data: updatedCenter });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete center
// @route   DELETE /api/centers/:id
// @access  Private/Admin
export const deleteCenter = async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);

    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    const linkedTickets = await Ticket.countDocuments({ center: center._id });
    if (linkedTickets > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a center that has queue tickets'
      });
    }

    await Center.findByIdAndDelete(req.params.id);

    // Audit log
    await AuditLog.create({
      user: req.user._id,
      role: req.user.role,
      action: 'Delete Center',
      details: `Deleted center name: ${center.name}`,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, message: 'Center removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
