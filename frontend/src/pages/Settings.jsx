import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiSettings, FiGlobe, FiBell, FiShield, FiUser, FiTrash2, FiLock, FiSave, FiCalendar, FiClock } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';
import { clearToken } from '../auth/jwtUtils';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' },
  }),
};

const languageLabels = {
  en: 'English'
};

const weekDays = [
  { key: 0, label: 'Sunday' },
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' }
];

const defaultSchedule = {
  workingDays: [0, 1, 2, 3, 4, 6],
  dayOff: [5],
  startTime: '08:00',
  endTime: '16:00',
  slotIntervalMinutes: 30,
  maxAppointmentsPerSlot: 5,
  maxAppointmentsPerDay: 80
};

const toInputTime = (value) => {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
};

const toDayNumber = (value) => {
  if (typeof value === 'number') return value;
  if (/^\d+$/.test(String(value))) return Number(value);
  return weekDays.find((day) => day.label === value)?.key;
};

const normalizeScheduleForUi = (value = {}) => {
  const workingDays = Array.isArray(value.workingDays)
    ? value.workingDays.map(toDayNumber).filter((day) => Number.isInteger(day))
    : defaultSchedule.workingDays;
  return {
    ...defaultSchedule,
    ...value,
    workingDays,
    dayOff: weekDays.map((day) => day.key).filter((day) => !workingDays.includes(day)),
    startTime: toInputTime(value.startTime) || defaultSchedule.startTime,
    endTime: toInputTime(value.endTime) || defaultSchedule.endTime
  };
};

const Toggle = ({ enabled, onChange, label, description }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0">
      <p className="text-sm font-bold text-[var(--text-main)]">{label}</p>
      {description && <p className="mt-0.5 text-xs font-semibold text-[var(--text-muted)]">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
      style={{
        backgroundColor: enabled ? 'var(--color-primary)' : '#CBD5E1',
        borderColor: enabled ? 'var(--color-primary)' : '#94A3B8',
      }}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  </div>
);

const Settings = () => {
  const { t, i18n } = useTranslation();

  // Appearance
  const [themeColor] = useState('#4189DD');

  // Language
  const [language, setLanguage] = useState('en');

  // Notifications
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [pushNotif, setPushNotif] = useState(true);

  // Privacy
  const [publicProfile, setPublicProfile] = useState(true);
  const [dataCollection, setDataCollection] = useState(false);

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [schedule, setSchedule] = useState(defaultSchedule);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [settingsRes, scheduleRes] = await Promise.allSettled([
          api.get('/api/settings'),
          api.get('/api/settings/schedule')
        ]);
        if (settingsRes.status === 'fulfilled' && settingsRes.value.data.success) {
          const res = settingsRes.value;
          const settings = res.data.data;
          setLanguage('en');
          setEmailNotif(settings.emailNotif ?? settings.notificationsEnabled ?? true);
          setSmsNotif(settings.smsNotif ?? false);
          setPushNotif(settings.pushNotif ?? true);
          setPublicProfile(settings.publicProfile ?? true);
          setDataCollection(settings.dataCollection ?? false);
          i18n.changeLanguage('en');
        }
        if (scheduleRes.status === 'fulfilled' && scheduleRes.value.data.success) {
          setSchedule(normalizeScheduleForUi(scheduleRes.value.data.data || {}));
        }
      } catch {
        setLanguage('en');
      }
    };
    loadSettings();
  }, [i18n]);

  // Language change
  const handleLanguageChange = (e) => {
    const lng = e.target.value;
    setLanguage(lng);
    i18n.changeLanguage(lng);
    toast.info(`Language changed to ${languageLabels[lng] || 'English'}`);
  };

  const handleSave = async () => {
    try {
      const [settingsRes, scheduleRes] = await Promise.all([
        api.put('/api/settings', {
        darkMode: false,
        language: 'en',
        notificationsEnabled: emailNotif || smsNotif || pushNotif,
        emailNotif,
        smsNotif,
        pushNotif,
        publicProfile,
        dataCollection,
        }),
        api.put('/api/settings/schedule', schedule)
      ]);
      if (settingsRes.data.success && scheduleRes.data.success) {
        toast.success('Settings saved.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save settings.');
    }
  };

  const updateSchedule = (field, value) => {
    setSchedule((current) => ({ ...current, [field]: value }));
  };

  const toggleWorkingDay = (day) => {
    setSchedule((current) => {
      const workingDays = current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day].sort((a, b) => a - b);
      const dayOff = weekDays.map((item) => item.key).filter((item) => !workingDays.includes(item));
      return { ...current, workingDays, dayOff };
    });
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await api.delete('/api/auth/profile');
      if (res.data.success) {
        clearToken();
        setShowDeleteModal(false);
        toast.success('Account deleted.');
        window.location.assign('/register');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete account.');
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden px-3 pb-12 sm:px-5 lg:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-xl bg-[var(--color-primary-soft)] p-2.5">
            <FiSettings className="text-xl text-[var(--color-primary)]" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-main)]">{t('settings')}</h1>
        </div>
        <p className="ml-1 text-sm font-medium text-[var(--text-muted)]">
          Update your display, alerts, and account settings.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ─── Appearance ─────────────────────────────── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiSettings className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">Appearance</h2>
          </div>
          <p className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
            The site uses the standard National ID portal colors.
          </p>
          <div className="space-y-1 divide-y divide-[var(--border-light)]">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-main)]">Main Color</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-muted)]">Main color used across the site</p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-600 shadow"
                  style={{ backgroundColor: themeColor }}
                />
                <span className="font-mono text-xs uppercase text-[var(--text-muted)]">{themeColor}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Language ────────────────────────────────── */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiGlobe className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">{t('language')}</h2>
          </div>
          <p className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
            Choose the language used on the site.
          </p>
          <div className="relative">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-4 py-3 pr-10 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
            >
              <option value="en">English</option>
            </select>
            <FiGlobe className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <p className="mt-3 text-xs font-semibold text-[var(--text-muted)]">
            English is currently available.
          </p>
        </motion.div>

        {/* ─── Notifications ──────────────────────────── */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiBell className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">Notifications</h2>
          </div>
          <p className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
            Choose how you receive appointment and queue updates.
          </p>
          <div className="space-y-1 divide-y divide-[var(--border-light)]">
            <Toggle
              enabled={emailNotif}
              onChange={setEmailNotif}
              label="Email Updates"
              description="Receive booking confirmations and updates via email"
            />
            <Toggle
              enabled={smsNotif}
              onChange={setSmsNotif}
              label="SMS Updates"
              description="Get text messages for queue position updates"
            />
            <Toggle
              enabled={pushNotif}
              onChange={setPushNotif}
              label="Browser Alerts"
              description="Browser alerts for queue updates"
            />
          </div>
        </motion.div>

        {/* ─── Privacy ────────────────────────────────── */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiShield className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">Privacy</h2>
          </div>
          <p className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
            Choose what account information can be used by the system.
          </p>
          <div className="space-y-1 divide-y divide-[var(--border-light)]">
            <Toggle
              enabled={publicProfile}
              onChange={setPublicProfile}
              label="Show Profile to Staff"
              description="Allow authorized office staff to view your profile for appointments"
            />
            <Toggle
              enabled={dataCollection}
              onChange={setDataCollection}
              label="Share Usage Data"
              description="Share anonymous usage data to help improve NQS"
            />
          </div>
        </motion.div>

        {/* ─── Account ────────────────────────────────── */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiCalendar className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">Appointment Schedule</h2>
          </div>
          <p className="mb-4 text-xs font-semibold text-[var(--text-muted)]">
            Set working days, hours, and appointment capacity.
          </p>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Working Days</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {weekDays.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleWorkingDay(day.key)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                      schedule.workingDays.includes(day.key)
                        ? 'border-[var(--border-focus)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Start Time</span>
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => updateSchedule('startTime', e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">End Time</span>
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => updateSchedule('endTime', e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Max Per Time Slot</span>
                <input
                  type="number"
                  min="1"
                  value={schedule.maxAppointmentsPerSlot}
                  onChange={(e) => updateSchedule('maxAppointmentsPerSlot', Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">Max Per Day</span>
                <input
                  type="number"
                  min="1"
                  value={schedule.maxAppointmentsPerDay}
                  onChange={(e) => updateSchedule('maxAppointmentsPerDay', Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
                />
              </label>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--color-primary-soft)] p-3 text-xs font-semibold text-[var(--color-primary)]">
              <FiClock className="mt-0.5 shrink-0" />
              Default schedule is 08:00 AM to 04:00 PM, with Friday closed.
            </div>
          </div>
        </motion.div>

        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiUser className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">Account</h2>
          </div>
          <p className="mb-5 text-xs font-semibold text-[var(--text-muted)]">
            Manage your password or close your account.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.location.assign('/profile')}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            >
              <FiLock size={15} />
              Change Password
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/20"
            >
              <FiTrash2 size={15} />
              Delete Account
            </button>
          </div>
        </motion.div>
      </div>

      {/* ─── Save Button ─────────────────────────────── */}
      <motion.div
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mt-8"
      >
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-3 font-bold text-white shadow-lg shadow-blue-700/20 transition-all hover:bg-blue-800 hover:shadow-xl hover:shadow-blue-700/30 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        >
          <FiSave size={18} />
          Save Changes
        </button>
      </motion.div>

      {/* ─── Delete Confirmation Modal ────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mx-4 w-full max-w-md rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
                <FiTrash2 className="text-red-600 dark:text-red-400 text-lg" />
              </div>
              <h3 className="text-lg font-black text-[var(--text-main)]">Delete Account</h3>
            </div>
            <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
              Are you sure you want to delete your account? This action is <strong>permanent</strong> and cannot be undone.
            </p>
            <p className="mb-6 text-xs font-semibold text-[var(--text-muted)]">
              All your data, bookings, and history will be permanently removed from the system.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl bg-[var(--bg-secondary)] px-4 py-2 text-sm font-bold text-[var(--text-main)] transition-colors hover:bg-[var(--color-primary-soft)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                Yes, Delete My Account
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Settings;
