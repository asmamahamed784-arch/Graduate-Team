import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import {
  FiUser, FiPhone, FiMapPin, FiCalendar, FiHash,
  FiLock, FiEye, FiEyeOff, FiSave, FiCheckCircle,
  FiGlobe, FiMoon, FiBell, FiShield, FiUserCheck, FiChevronRight, FiLogOut, FiEdit3,
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth, useLanguage, useNotification, useTheme } from '../hooks';
import { formatSomaliPhone, isValidSomaliPhone } from './appointments/appointmentShared';
import Modal from '../components/Modal';

const NOTIFICATIONS_PREF_KEY = 'nqs_notifications_enabled';

const profileSchema = yup.object().shape({
  fullName: yup.string().required('Full name is required').matches(/^[A-Za-z\s'-]+$/, 'Full name may only contain letters.'),
  phone: yup.string().required('Phone is required').test('somali-phone', 'Enter a valid Somali phone number.', (value) => isValidSomaliPhone(value)),
  nationalId: yup.string().optional(),
  dateOfBirth: yup.string().optional(),
  address: yup.string().optional(),
});

const passwordSchema = yup.object().shape({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup.string().min(8, 'Minimum 8 characters').required('New password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm your password'),
});

const InputField = ({ icon: Icon, label, error, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
      <input
        className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
        }`}
        {...props}
      />
    </div>
    {error && <p className="text-xs text-red-500 mt-1">{error.message}</p>}
  </div>
);

const ToggleSwitch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={(event) => {
      event.stopPropagation();
      onChange(!checked);
    }}
    className="relative h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/20"
    style={{
      backgroundColor: checked ? 'var(--color-primary)' : '#CBD5E1',
      borderColor: checked ? 'var(--color-primary)' : '#94A3B8',
    }}
  >
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const SettingsRow = ({ icon: Icon, iconTone, title, description, onClick, right, danger = false }) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-4 border-b border-gray-100 px-4 py-4 text-left last:border-0 dark:border-gray-700 sm:px-6 sm:py-5 ${onClick ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''}`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${iconTone}`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-base font-black ${danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{title}</span>
        {description && <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">{description}</span>}
      </span>
      {right || (onClick && <FiChevronRight className="shrink-0 text-gray-300 dark:text-gray-600" />)}
    </Component>
  );
};

const Profile = () => {
  const { user, updateUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const { toast: notifyToast } = useNotification();
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem(NOTIFICATIONS_PREF_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const initials = useMemo(() => {
    return (user?.name || 'NQS User')
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [user?.name]);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      fullName: user?.name || '',
      phone: formatSomaliPhone(user?.phone),
      nationalId: '',
      dateOfBirth: '',
      address: '',
    },
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    setError: setPasswordError,
    formState: { errors: pwErrors },
    reset: resetPassword,
  } = useForm({ resolver: yupResolver(passwordSchema) });

  useEffect(() => {
    resetProfile({
      fullName: user?.name || '',
      phone: formatSomaliPhone(user?.phone),
      nationalId: user?.nationalId || '',
      dateOfBirth: user?.dateOfBirth || '',
      address: user?.address || '',
    });
  }, [resetProfile, user]);

  // AuthContext caches the profile from login time. Re-fetch on open so fields
  // filled in later (e.g. phone/DOB synced when a National ID request completes)
  // show up here instead of staying blank until the next login.
  useEffect(() => {
    const refreshProfile = async () => {
      try {
        const res = await api.get('/api/auth/profile');
        if (res.data.success) {
          updateUser(res.data.data);
        }
      } catch {
        // Keep whatever is already cached in context.
      }
    };
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onProfileSave = async (values) => {
    try {
      const res = await api.put('/api/auth/profile', {
        name: values.fullName,
        phone: formatSomaliPhone(values.phone),
        nationalId: values.nationalId,
        dateOfBirth: values.dateOfBirth,
        address: values.address,
      });
      if (res.data.success) {
        updateUser(res.data.data);
        toast.success('Profile updated.');
        setActiveModal(null);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update profile.');
    }
  };

  const onPasswordChange = async (values) => {
    try {
      const res = await api.put('/api/auth/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (res.data.success) {
        toast.success('PIN changed.');
        resetPassword();
        setActiveModal(null);
      }
    } catch (e) {
      const message = e.response?.data?.message || 'Could not change your PIN.';
      const lower = message.toLowerCase();
      // One error only: field message under the input (no second toast).
      if (lower.includes('current password')) {
        setPasswordError('currentPassword', { type: 'server', message });
        return;
      }
      if (lower.includes('new password') || lower.includes('passwords must')) {
        setPasswordError('newPassword', { type: 'server', message });
        return;
      }
      toast.error(message);
    }
  };

  const handleToggleNotifications = (next) => {
    setNotificationsEnabled(next);
    try {
      localStorage.setItem(NOTIFICATIONS_PREF_KEY, String(next));
    } catch {
      // Preference just won't persist across sessions if storage is unavailable.
    }
    notifyToast.success(next ? 'Notifications turned on.' : 'Notifications turned off.');
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-10 pt-6 text-slate-900 dark:bg-gray-900 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <section>
          <h1 className="text-3xl font-black text-[#0B3A75] dark:text-white sm:text-4xl">Settings</h1>
          <p className="mt-2 text-base text-slate-600 dark:text-gray-400">Manage your account and app preferences</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-blue-100 bg-blue-50 text-2xl font-black text-[#0B3A75] dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-300 sm:h-20 sm:w-20">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-black text-gray-900 dark:text-white sm:text-2xl">{user?.name || 'NQS User'}</h2>
              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">{formatSomaliPhone(user?.phone) || 'No phone number added'}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('personal')}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              <FiEdit3 size={13} /> Edit Profile
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <SettingsRow
            icon={FiUser}
            iconTone="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
            title="Personal Information"
            description="View and update your personal details"
            onClick={() => setActiveModal('personal')}
          />
          <SettingsRow
            icon={FiGlobe}
            iconTone="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"
            title="Language"
            description="Choose your preferred language"
            onClick={() => setActiveModal('language')}
            right={<span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-gray-700 dark:text-gray-300">{language === 'so' ? 'Soomaali' : 'English'}</span>}
          />
          <SettingsRow
            icon={FiMoon}
            iconTone="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
            title="Dark Mode"
            description="Switch between light and dark theme"
            right={<ToggleSwitch checked={isDark} onChange={toggleTheme} label="Dark mode" />}
          />
          <SettingsRow
            icon={FiBell}
            iconTone="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
            title="Notifications"
            description="Manage app notification preferences"
            right={<ToggleSwitch checked={notificationsEnabled} onChange={handleToggleNotifications} label="Notifications" />}
          />
          <SettingsRow
            icon={FiShield}
            iconTone="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
            title="Security & PIN"
            description="Manage your PIN and security settings"
            onClick={() => setActiveModal('security')}
          />
          <SettingsRow
            icon={FiUserCheck}
            iconTone="bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
            title="Privacy"
            description="Manage your privacy and data"
            onClick={() => setActiveModal('privacy')}
          />
          <SettingsRow
            icon={FiLogOut}
            iconTone="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"
            title="Logout"
            description="Sign out from your account"
            onClick={logout}
            danger
          />
        </section>
      </div>

      <Modal isOpen={activeModal === 'personal'} onClose={() => setActiveModal(null)} title="Personal Information" className="max-w-lg">
        <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField icon={FiUser} label="Full Name" placeholder="Enter full name" error={profileErrors.fullName} {...regProfile('fullName')} />
            <InputField icon={FiPhone} label="Phone Number" placeholder="+252 61 XXX XXXX" error={profileErrors.phone} {...regProfile('phone')} />
            <InputField icon={FiHash} label="National ID" placeholder="SO-100200300" error={profileErrors.nationalId} {...regProfile('nationalId')} />
            <InputField icon={FiCalendar} label="Date of Birth" type="date" error={profileErrors.dateOfBirth} {...regProfile('dateOfBirth')} />
            <InputField icon={FiMapPin} label="Address" placeholder="Enter address" error={profileErrors.address} {...regProfile('address')} />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800"
          >
            <FiSave size={15} /> Save Changes
          </button>
        </form>
      </Modal>

      <Modal isOpen={activeModal === 'security'} onClose={() => setActiveModal(null)} title="Security & PIN" className="max-w-md">
        <form onSubmit={handlePassword(onPasswordChange)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Current PIN</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type={showCurrentPw ? 'text' : 'password'}
                placeholder="Enter current PIN"
                className={`w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 ${
                  pwErrors.currentPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                {...regPassword('currentPassword')}
              />
              <button type="button" onClick={() => setShowCurrentPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrentPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {pwErrors.currentPassword && <p className="mt-1 text-xs text-red-500">{pwErrors.currentPassword.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">New PIN</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type={showNewPw ? 'text' : 'password'}
                placeholder="Enter new PIN"
                className={`w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 ${
                  pwErrors.newPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                {...regPassword('newPassword')}
              />
              <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNewPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            {pwErrors.newPassword && <p className="mt-1 text-xs text-red-500">{pwErrors.newPassword.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Confirm New PIN</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="password"
                placeholder="Confirm new PIN"
                className={`w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 ${
                  pwErrors.confirmPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                {...regPassword('confirmPassword')}
              />
            </div>
            {pwErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{pwErrors.confirmPassword.message}</p>}
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800"
          >
            <FiCheckCircle size={15} /> Update PIN
          </button>
        </form>
      </Modal>

      <Modal isOpen={activeModal === 'language'} onClose={() => setActiveModal(null)} title="Language">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { changeLanguage('en'); setActiveModal(null); }}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${language === 'en' ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 text-gray-700 dark:border-gray-600 dark:text-gray-200'}`}
          >
            English
            {language === 'en' && <FiCheckCircle />}
          </button>
          <button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-400 dark:border-gray-700 dark:text-gray-600">
            Soomaali
            <span className="text-xs font-semibold">Coming soon</span>
          </button>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title="Privacy">
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>NQS stores the personal details you provide for your National ID appointments — your name, phone number, National ID number, date of birth, and address.</p>
          <p>This information is used only to process your National ID requests and queue appointments, and is only visible to authorized NQS staff.</p>
          <p>You can review or update your personal information at any time from the Personal Information section above.</p>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;
