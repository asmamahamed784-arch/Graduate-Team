import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import { getAssignedCenterId, isAdminRole, normalizeRole } from '../utils/rbac.js';

const BANAADIR_DISTRICTS = [
  'Abdulaziz',
  'Boondheere',
  'Dayniile',
  'Dharkenley',
  'Garasbaaley',
  'Heliwaa',
  'Hodan',
  'Howlwadaag',
  'Kaaraan',
  'Kaxda',
  'Shangaani',
  'Shibis',
  'Waaberi',
  'Wadajir',
  'Wardhiigley',
  'Xamar Jajab',
  'Xamar Weyne',
  'Yaqshiid'
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

const cleanDistrict = (value = '') => normalizeDistrict(value) || String(value || '').trim();

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

const todayKey = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
};

const hasPastDate = (dates = []) => dates.some((date) => date < todayKey());

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

const serializeCenter = (center = {}) => ({
  ...center,
  _id: center.id,
  schedule: {
    workingDays: center.workingDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    startTime: center.startTime || '08:00',
    endTime: center.endTime || '16:00',
    breakTime: center.breakTime || { start: '', end: '' },
    slotDuration: Number(center.slotDuration || 30),
    maxBookingsPerSlot: Number(center.maxBookingsPerSlot || 5),
    maxAppointmentsPerDay: Number(center.maxAppointmentsPerDay || center.capacity || 100),
    closedDays: center.closedDays || ['Friday', 'Saturday'],
    closedDates: center.closedDates || [],
    specialUnavailableDates: center.specialUnavailableDates || [],
    isActive: center.isActive !== false
  }
});

const scheduleFromCenter = (center = {}) => ({
  workingDays: center.workingDays,
  startTime: center.startTime,
  endTime: center.endTime,
  breakTime: center.breakTime,
  slotDuration: center.slotDuration,
  maxBookingsPerSlot: center.maxBookingsPerSlot,
  maxAppointmentsPerDay: center.maxAppointmentsPerDay,
  closedDays: center.closedDays,
  closedDates: center.closedDates,
  specialUnavailableDates: center.specialUnavailableDates,
  isActive: center.isActive
});

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
  const schedule = normalizeSchedule(body.schedule || {}, existingCenter.schedule || scheduleFromCenter(existingCenter));
  const name = String(body.name ?? existingCenter.name ?? '').trim();
  const district = cleanDistrict(body.district ?? existingCenter.district) || districtFromCenterName(name);
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
    workingDays: schedule.workingDays,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    breakTime: schedule.breakTime,
    slotDuration: schedule.slotDuration,
    maxBookingsPerSlot: schedule.maxBookingsPerSlot,
    maxAppointmentsPerDay: schedule.maxAppointmentsPerDay,
    closedDays: schedule.closedDays,
    closedDates: schedule.closedDates,
    specialUnavailableDates: schedule.specialUnavailableDates,
    isActive: status === 'Active' && schedule.isActive !== false
  };
};

const normalizeSomaliPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('252')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('0')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('6')) return `+252${digits.slice(0, 9)}`;
  return '';
};

const isValidSomaliPhone = (value = '') => /^\+2526\d{7,8}$/.test(normalizeSomaliPhone(value));

const timeToMinutes = (value) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const validateCenterPayload = (payload) => {
  if (!payload.name) return 'Center name is required.';
  if (!payload.address) return 'Address is required.';
  if (!payload.phone) return 'Phone number is required.';
  if (!payload.district) return 'District is required.';
  if (!payload.workingDays.length) return 'Select at least one working day.';
  if (hasPastDate(payload.closedDates)) return 'Closed dates cannot be in the past.';
  if (hasPastDate(payload.specialUnavailableDates)) return 'Unavailable dates cannot be in the past.';
  const start = timeToMinutes(payload.startTime);
  const end = timeToMinutes(payload.endTime);
  if (start === null || end === null || start >= end) return 'Opening time must be before closing time.';
  return '';
};

const centerReferenceWhere = (center) => ({
  OR: [
    { center: center.id },
    { center: center.name }
  ]
});

const deleteCenterCascade = async (tx, center) => {
  const tickets = await tx.ticket.findMany({
    where: centerReferenceWhere(center),
    select: { id: true, ref: true, citizen: true }
  });
  const ticketIds = tickets.map((ticket) => ticket.id);
  const ticketRefs = tickets.map((ticket) => ticket.ref).filter(Boolean);

  const staffUsers = await tx.user.findMany({
    where: {
      OR: [
        { center: center.id },
        { center: center.name },
        { accountProfile: { center: center.id } },
        { accountProfile: { center: center.name } }
      ],
      role: { in: ['operator', 'super_operator', 'center_manager'] }
    },
    select: { id: true }
  });
  const staffUserIds = staffUsers.map((user) => user.id);

  await tx.notification.deleteMany({
    where: {
      OR: [
        { relatedEntity: center.id },
        { relatedEntity: center.name },
        ...(ticketIds.length ? [{ relatedEntity: { in: ticketIds } }] : []),
        ...(ticketRefs.length ? [{ referenceNumber: { in: ticketRefs } }] : [])
      ]
    }
  });

  if (ticketIds.length) {
    await tx.document.deleteMany({ where: { ticket: { in: ticketIds } } });
    await tx.feedback.deleteMany({ where: { ticket: { in: ticketIds } } });
    await tx.otpCode.deleteMany({ where: { ticket: { in: ticketIds } } });
  }

  if (ticketRefs.length) {
    await tx.qRScan.deleteMany({ where: { ticketRef: { in: ticketRefs } } });
    await tx.queueHistory.deleteMany({ where: { ticketRef: { in: ticketRefs } } });
  }

  await tx.queueHistory.deleteMany({
    where: {
      OR: [
        { center: center.id },
        { center: center.name }
      ]
    }
  });
  await tx.counter.deleteMany({
    where: {
      OR: [
        { center: center.id },
        { center: center.name }
      ]
    }
  });

  await tx.ticket.deleteMany({ where: centerReferenceWhere(center) });

  await tx.citizen.updateMany({
    where: {
      OR: [
        { center: center.id },
        { center: center.name }
      ]
    },
    data: { center: null }
  });

  await tx.user.updateMany({
    where: {
      role: 'citizen',
      OR: [
        { center: center.id },
        { center: center.name }
      ]
    },
    data: { center: null }
  });

  if (staffUserIds.length) {
    await tx.activeSession.deleteMany({ where: { user: { in: staffUserIds } } });
    await tx.setting.deleteMany({ where: { user: { in: staffUserIds } } });
    await tx.otpCode.deleteMany({ where: { user: { in: staffUserIds } } });
    await tx.user.deleteMany({ where: { id: { in: staffUserIds } } });
  }

  await tx.accountProfile.deleteMany({
    where: {
      OR: [
        { center: center.id },
        { center: center.name }
      ]
    }
  });

  await tx.center.delete({ where: { id: center.id } });

  return {
    tickets: ticketIds.length,
    staffUsers: staffUserIds.length
  };
};

const ensureCenterDistricts = async (centers) => {
  const updates = centers
    .filter((center) => !center.district)
    .map(async (center) => {
      const district = districtFromCenterName(center.name);
      if (district) {
        await prisma.center.update({
          where: { id: center.id },
          data: { district }
        });
        return { ...center, district };
      }
      return center;
    });

  if (updates.length) {
    const resolvedUpdates = await Promise.all(updates);
    const updatedCentersMap = new Map(resolvedUpdates.map(c => [c.id, c]));
    return centers.map(c => updatedCentersMap.get(c.id) || c);
  }
  return centers;
};

// @desc    Get all centers
// @route   GET /api/centers
// @access  Public
export const listCenters = async (req, res) => {
  try {
    const { district = '' } = req.query;
    await ensureCenterDistricts(await prisma.center.findMany({ where: { district: '' } }));
    const query = {};
    const normalizedDistrict = cleanDistrict(district);
    if (normalizedDistrict) {
      query.district = normalizedDistrict;
    }
    if (req.user && !isAdminRole(req.user.role)) {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (assignedCenterId) {
        query.id = assignedCenterId;
      } else if (normalizeRole(req.user.role) !== 'citizen') {
        return res.json({ success: true, count: 0, data: [] });
      }
    }
    const centers = await ensureCenterDistricts(await prisma.center.findMany({ where: query }));
    const sortedCenters = [...centers].sort((a, b) => (
      String(a.district || '').localeCompare(String(b.district || '')) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    ));
    return res.json({ success: true, count: sortedCenters.length, data: sortedCenters.map(serializeCenter) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get center by ID
// @route   GET /api/centers/:id
// @access  Public
export const getCenterById = async (req, res) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.params.id } });
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }
    if (req.user && !isAdminRole(req.user.role)) {
      const assignedCenterId = getAssignedCenterId(req.user);
      if (!assignedCenterId || assignedCenterId !== center.id) {
        return res.status(403).json({ success: false, message: 'You are not authorized to access another center.' });
      }
    }
    return res.json({ success: true, data: serializeCenter(center) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAssignedCenter = async (req, res) => {
  try {
    const assignedCenterId = getAssignedCenterId(req.user);
    if (!assignedCenterId) {
      return res.status(404).json({ success: false, message: 'No center is assigned to this account.' });
    }

    const center = await prisma.center.findUnique({ where: { id: assignedCenterId } });
    if (!center) {
      return res.status(404).json({ success: false, message: 'Assigned center not found.' });
    }

    return res.json({ success: true, data: serializeCenter(center) });
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
    const managerCredentials = req.body.managerCredentials || {};

    const validationError = validateCenterPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const managerName = String(managerCredentials.name || '').trim();
    const managerUsername = String(managerCredentials.username || '').trim().toLowerCase();
    const managerPhone = normalizeSomaliPhone(managerCredentials.phone || payload.phone || '');
    const temporaryPassword = String(managerCredentials.temporaryPassword || '').trim();

    if (!managerName || !managerUsername || !managerPhone || !temporaryPassword) {
      return res.status(400).json({
        success: false,
        message: 'Center manager name, username, phone, and temporary password are required.'
      });
    }

    if (temporaryPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Temporary password must be at least 6 characters.' });
    }

    if (!isValidSomaliPhone(managerPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Center manager phone must be a valid Somali number, for example 61XXXXXXX.'
      });
    }

    const centerExists = await prisma.center.findFirst({ where: { name: payload.name } });
    if (centerExists) {
      return res.status(400).json({ success: false, message: 'Center name already exists' });
    }

    const userExists = await prisma.user.findFirst({
      where: { phone: managerPhone }
    });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Phone number is already in use.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const center = await tx.center.create({ data: payload });
      const manager = await tx.user.create({
        data: {
          name: managerName,
          username: managerUsername,
          email: managerCredentials.email ? String(managerCredentials.email).trim().toLowerCase() : undefined,
          phone: managerPhone,
          password: await bcrypt.hash(temporaryPassword, 10),
          role: 'center_manager',
          operatorType: 'center_manager',
          status: 'active',
          center: center.id,
          assignedDistrict: payload.district,
          mustChangePassword: false,
          accountProfile: {
            create: {
              name: managerName,
              email: managerCredentials.email ? String(managerCredentials.email).trim().toLowerCase() : null,
              phone: managerPhone,
              status: 'active',
              operatorType: 'center_manager',
              center: center.id,
              assignedDistrict: payload.district,
              district: payload.district,
              mustChangePassword: false
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          user: req.user.id,
          role: req.user.role,
          action: 'Create Center',
          details: `Created new service center: ${payload.name} and manager username ${managerUsername}`,
          ipAddress: req.ip || '127.0.0.1'
        }
      });

      return { center, manager };
    });

    return res.status(201).json({
      success: true,
      data: {
        ...serializeCenter(result.center),
        managerCredentials: {
          id: result.manager.id,
          username: result.manager.username,
          role: result.manager.role,
          mustChangePassword: result.manager.mustChangePassword
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update center
// @route   PUT /api/centers/:id
// @access  Private/Admin
export const updateCenter = async (req, res) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.params.id } });

    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    const payload = buildCenterPayload(req.body, center);
    const validationError = validateCenterPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const updatedCenter = await prisma.center.update({
      where: { id: req.params.id },
      data: payload
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: req.user.id,
        role: req.user.role,
        action: 'Update Center',
        details: `Updated center ID: ${center.id} (${center.name})`,
        ipAddress: req.ip || '127.0.0.1'
      }
    });

    return res.json({ success: true, data: serializeCenter(updatedCenter) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete center
// @route   DELETE /api/centers/:id
// @access  Private/Admin
export const deleteCenter = async (req, res) => {
  try {
    const center = await prisma.center.findUnique({ where: { id: req.params.id } });

    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const result = await deleteCenterCascade(tx, center);

      await tx.auditLog.create({
        data: {
          user: req.user.id,
          role: req.user.role,
          action: 'Delete Center',
          details: `Deleted center name: ${center.name}; removed ${result.tickets} ticket(s) and ${result.staffUsers} staff account(s).`,
          ipAddress: req.ip || '127.0.0.1'
        }
      });

      return result;
    });

    return res.json({
      success: true,
      message: 'Center and linked database records removed.',
      deleted
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Center already removed.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
