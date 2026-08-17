import prisma from '../config/prisma.js';

const DEFAULT_APPOINTMENT_SCHEDULE = {
  workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
  dayOff: ['Friday'],
  startTime: '08:00 AM',
  endTime: '04:00 PM',
  maxAppointmentsPerSlot: 5,
  maxAppointmentsPerDay: 120
};

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

const normalizeTimeLabel = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.includes('AM') || raw.includes('PM')) return raw;
  const [hourValue, minuteValue = '00'] = raw.split(':').map(Number);
  if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) return fallback;
  const period = hourValue >= 12 ? 'PM' : 'AM';
  const hour = hourValue % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')} ${period}`;
};

const normalizeSchedule = (payload = {}) => {
  const workingDays = normalizeDayList(payload.workingDays, DEFAULT_APPOINTMENT_SCHEDULE.workingDays);
  const explicitDayOff = normalizeDayList(payload.dayOff, null);
  const dayOff = explicitDayOff || WEEK_DAYS.filter((day) => !workingDays.includes(day));

  return {
    ...DEFAULT_APPOINTMENT_SCHEDULE,
    ...payload,
    workingDays,
    dayOff,
    startTime: normalizeTimeLabel(payload.startTime, DEFAULT_APPOINTMENT_SCHEDULE.startTime),
    endTime: normalizeTimeLabel(payload.endTime, DEFAULT_APPOINTMENT_SCHEDULE.endTime),
    maxAppointmentsPerSlot: Math.max(1, Number(payload.maxAppointmentsPerSlot || DEFAULT_APPOINTMENT_SCHEDULE.maxAppointmentsPerSlot)),
    maxAppointmentsPerDay: Math.max(1, Number(payload.maxAppointmentsPerDay || DEFAULT_APPOINTMENT_SCHEDULE.maxAppointmentsPerDay))
  };
};

export class SettingService {
  static async getUserSettings(userId) {
    let settings = await prisma.setting.findFirst({ where: { user: userId } });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          user: userId,
          darkMode: false,
          language: 'en'
        }
      });
    }

    return settings;
  }

  static async updateUserSettings(userId, data) {
    let settings = await prisma.setting.findFirst({ where: { user: userId } });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          user: userId,
          ...data
        }
      });
    } else {
      settings = await prisma.setting.update({
        where: { id: settings.id },
        data
      });
    }

    return settings;
  }

  static async getSystemConfigs() {
    const list = await prisma.systemConfig.findMany();
    return list;
  }

  static async updateSystemConfig(key, value) {
    try {
      const config = await prisma.systemConfig.update({
        where: { key },
        data: { value }
      });
      return config;
    } catch (error) {
      if (error.code === 'P2025') {
        throw { statusCode: 404, message: 'Configuration key not found' };
      }
      throw error;
    }
  }

  static async getAppointmentSchedule() {
    let config = await prisma.systemConfig.findUnique({ where: { key: 'appointmentSchedule' } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          key: 'appointmentSchedule',
          value: DEFAULT_APPOINTMENT_SCHEDULE,
          description: 'Appointment calendar and capacity controls'
        }
      });
    }
    return normalizeSchedule(config.value || {});
  }

  static async updateAppointmentSchedule(payload) {
    const nextSchedule = normalizeSchedule(payload || {});

    const config = await prisma.systemConfig.upsert({
      where: { key: 'appointmentSchedule' },
      update: {
        value: nextSchedule,
        description: 'Appointment calendar and capacity controls'
      },
      create: {
        key: 'appointmentSchedule',
        value: nextSchedule,
        description: 'Appointment calendar and capacity controls'
      }
    });

    return config.value;
  }
}
