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
  const source = Array.isArray(days)
    ? days
    : (typeof days === 'string' && days.trim()
      ? days.split(/[,|]/).map((part) => part.trim()).filter(Boolean)
      : null);
  if (!source) return fallback;
  const normalized = [...new Set(
    source.map((day) => String(day || '').trim()).filter((day) => WEEK_DAYS.includes(day))
  )];
  return normalized.length ? normalized : fallback;
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

const hasNewPastDate = (dates = [], existingDates = []) => {
  const existing = new Set(normalizeDateList(existingDates));
  return normalizeDateList(dates).some((date) => date < todayKey() && !existing.has(date));
};

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

const serializeCenter = (center = {}) => {
  const workingDays = normalizeDayList(
    center.workingDays,
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
  );
  const closedDays = normalizeDayList(
    center.closedDays,
    WEEK_DAYS.filter((day) => !workingDays.includes(day))
  );
  return {
    ...center,
    _id: center.id,
    workingDays,
    closedDays,
    closedDates: normalizeDateList(center.closedDates || []),
    specialUnavailableDates: normalizeDateList(center.specialUnavailableDates || []),
    schedule: {
      workingDays,
      startTime: center.startTime || '08:00',
      endTime: center.endTime || '16:00',
      breakTime: center.breakTime || { start: '', end: '' },
      slotDuration: Number(center.slotDuration || 30),
      maxBookingsPerSlot: Number(center.maxBookingsPerSlot || 5),
      maxAppointmentsPerDay: Number(center.maxAppointmentsPerDay || center.capacity || 100),
      closedDays,
      closedDates: normalizeDateList(center.closedDates || []),
      specialUnavailableDates: normalizeDateList(center.specialUnavailableDates || []),
      isActive: center.isActive !== false
    }
  };
};

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
    maxBookingsPerSlot: Math.max(1, Number(schedule.maxBookingsPerSlot || existingSchedule.maxAppointmentsPerSlot || 5)),
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
  const counters = Math.max(1, Number(body.counters ?? existingCenter.counters ?? 1));

  return {
    name,
    address: String(body.address ?? existingCenter.address ?? '').trim(),
    city: 'Banaadir',
    district,
    district,
    phone: String(body.phone ?? existingCenter.phone ?? '').trim(),
    counters,
    capacity: Math.max(1, Number(body.capacity ?? schedule.maxAppointmentsPerDay)),
    hours: body.hours || formatHours(schedule.startTime, schedule.endTime),
    status,
    workingDays: schedule.workingDays,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    breakTime: schedule.breakTime,
    slotDuration: schedule.slotDuration,
    maxBookingsPerSlot: counters,
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

const validateCenterPayload = (payload, existingCenter = null) => {
  if (!payload.name) return 'Center name is required.';
  if (!payload.address) return 'Address is required.';
  if (!payload.phone) return 'Phone number is required.';
  if (!payload.district) return 'District is required.';
  if (!payload.workingDays.length) return 'Select at least one working day.';
  if (existingCenter) {
    if (hasNewPastDate(payload.closedDates, existingCenter.closedDates)) return 'Closed dates cannot be in the past.';
    if (hasNewPastDate(payload.specialUnavailableDates, existingCenter.specialUnavailableDates)) return 'Unavailable dates cannot be in the past.';
  } else {
    if (hasPastDate(payload.closedDates)) return 'Closed dates cannot be in the past.';
    if (hasPastDate(payload.specialUnavailableDates)) return 'Unavailable dates cannot be in the past.';
  }
  const start = timeToMinutes(payload.startTime);
  const end = timeToMinutes(payload.endTime);
  if (start === null || end === null) return 'Opening and closing time are required.';
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

export class CenterService {
  static async listCenters({ district = '', user }) {
    await ensureCenterDistricts(await prisma.center.findMany({ where: { district: '' } }));
    const query = {};
    const normalizedDistrict = cleanDistrict(district);
    if (normalizedDistrict) {
      query.district = normalizedDistrict;
    }
    const role = normalizeRole(user?.role);
    if (user && !isAdminRole(user.role) && role !== 'citizen') {
      const assignedCenterId = getAssignedCenterId(user);
      if (assignedCenterId) {
        query.id = assignedCenterId;
      } else {
        return [];
      }
    }
    const centers = await ensureCenterDistricts(await prisma.center.findMany({ where: query }));
    const sortedCenters = [...centers].sort((a, b) => (
      String(a.district || '').localeCompare(String(b.district || '')) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    ));
    return sortedCenters.map(serializeCenter);
  }

  static async getCenterById({ id, user }) {
    const center = await prisma.center.findUnique({ where: { id } });
    if (!center) {
      throw { statusCode: 404, message: 'Center not found' };
    }
    const role = normalizeRole(user?.role);
    if (user && !isAdminRole(user.role) && role !== 'citizen') {
      const assignedCenterId = getAssignedCenterId(user);
      if (!assignedCenterId || assignedCenterId !== center.id) {
        throw { statusCode: 403, message: 'You are not authorized to access another center.' };
      }
    }
    return serializeCenter(center);
  }

  static async getAssignedCenter({ user }) {
    const assignedCenterId = getAssignedCenterId(user);
    if (!assignedCenterId) {
      throw { statusCode: 404, message: 'No center is assigned to this account.' };
    }

    const center = await prisma.center.findUnique({ where: { id: assignedCenterId } });
    if (!center) {
      throw { statusCode: 404, message: 'Assigned center not found.' };
    }

    return serializeCenter(center);
  }

  static async createCenter({ data, user, ipAddress }) {
    const payload = buildCenterPayload(data);
    const managerCredentials = data.managerCredentials || {};

    const validationError = validateCenterPayload(payload);
    if (validationError) {
      throw { statusCode: 400, message: validationError };
    }

    const managerName = String(managerCredentials.name || '').trim();
    const managerUsername = String(managerCredentials.username || '').trim().toLowerCase();
    const managerPhone = normalizeSomaliPhone(managerCredentials.phone || payload.phone || '');
    const temporaryPassword = String(managerCredentials.temporaryPassword || '').trim();

    if (!managerName || !managerUsername || !managerPhone || !temporaryPassword) {
      throw {
        statusCode: 400,
        message: 'Center manager name, username, phone, and temporary password are required.'
      };
    }

    if (temporaryPassword.length < 6) {
      throw { statusCode: 400, message: 'Temporary password must be at least 6 characters.' };
    }

    if (!isValidSomaliPhone(managerPhone)) {
      throw {
        statusCode: 400,
        message: 'Center manager phone must be a valid Somali number, for example 61XXXXXXX.'
      };
    }

    const centerExists = await prisma.center.findFirst({ where: { name: payload.name } });
    if (centerExists) {
      throw { statusCode: 400, message: 'Center name already exists' };
    }

    const userExists = await prisma.user.findFirst({
      where: { phone: managerPhone }
    });
    if (userExists) {
      throw { statusCode: 400, message: 'Phone number is already in use.' };
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
          user: user.id,
          role: user.role,
          action: 'Create Center',
          details: `Created new service center: ${payload.name} and manager username ${managerUsername}`,
          ipAddress: ipAddress || '127.0.0.1'
        }
      });

      return { center, manager };
    });

    return {
      ...serializeCenter(result.center),
      managerCredentials: {
        id: result.manager.id,
        username: result.manager.username,
        role: result.manager.role,
        mustChangePassword: result.manager.mustChangePassword
      }
    };
  }

  static async updateCenter({ id, data, user, ipAddress }) {
    const center = await prisma.center.findUnique({ where: { id } });

    if (!center) {
      throw { statusCode: 404, message: 'Center not found' };
    }

    if (!isAdminRole(user.role)) {
      const assignedCenterId = getAssignedCenterId(user);
      if (!assignedCenterId || assignedCenterId !== center.id.toString()) {
        throw { statusCode: 403, message: 'You are not authorized to update another center.' };
      }
    }

    const payload = buildCenterPayload(data, center);
    const validationError = validateCenterPayload(payload, center);
    if (validationError) {
      throw { statusCode: 400, message: validationError };
    }

    const updatedCenter = await prisma.center.update({
      where: { id },
      data: payload
    });

    await prisma.auditLog.create({
      data: {
        user: user.id,
        role: user.role,
        action: 'Update Center',
        details: `Updated center ID: ${center.id} (${center.name})`,
        ipAddress: ipAddress || '127.0.0.1'
      }
    });

    return serializeCenter(updatedCenter);
  }

  static async deleteCenter({ id, user, ipAddress }) {
    const center = await prisma.center.findUnique({ where: { id } });

    if (!center) {
      throw { statusCode: 404, message: 'Center not found' };
    }

    try {
      const deleted = await prisma.$transaction(async (tx) => {
        const result = await deleteCenterCascade(tx, center);

        await tx.auditLog.create({
          data: {
            user: user.id,
            role: user.role,
            action: 'Delete Center',
            details: `Deleted center name: ${center.name}; removed ${result.tickets} ticket(s) and ${result.staffUsers} staff account(s).`,
            ipAddress: ipAddress || '127.0.0.1'
          }
        });

        return result;
      });

      return deleted;
    } catch (error) {
      if (error.code === 'P2025') {
        throw { statusCode: 404, message: 'Center already removed.' };
      }
      throw error;
    }
  }
}
