import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import {
  FiUser, FiMail, FiPhone, FiMapPin, FiCalendar, FiHash,
  FiLock, FiEye, FiEyeOff, FiSave, FiStar, FiClock, FiCheckCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: 'easeOut' },
  }),
};

const profileSchema = yup.object().shape({
  fullName: yup.string().required('Full name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string().matches(/^\+?[\d\s-]{7,15}$/, 'Invalid phone number').required('Phone is required'),
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

const statusColors = {
  Completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  Pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  Waiting: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  'Being Served': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  'On Hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
};

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

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [appointments, setAppointments] = useState([]);

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
      email: user?.email || '',
      phone: user?.phone || '',
      nationalId: '',
      dateOfBirth: '',
      address: '',
    },
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    formState: { errors: pwErrors },
    reset: resetPassword,
  } = useForm({
    resolver: yupResolver(passwordSchema),
  });

  useEffect(() => {
    resetProfile({
      fullName: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      nationalId: user?.nationalId || '',
      dateOfBirth: user?.dateOfBirth || '',
      address: user?.address || '',
    });
  }, [resetProfile, user]);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const res = await api.get('/api/bookings/my');
        if (res.data.success) {
          setAppointments((res.data.data || []).map((ticket) => ({
            id: ticket._id || ticket.id,
            service: typeof ticket.service === 'object' ? ticket.service?.name : ticket.service,
            date: ticket.date,
            status: ticket.status
          })));
        }
      } catch (e) {
        toast.error(e.response?.data?.message || 'Could not load appointment history.');
      }
    };
    if (user) {
      loadAppointments();
    }
  }, [user]);

  const completedAppointments = appointments.filter((appointment) => appointment.status === 'Completed');
  const activeAppointments = appointments.filter((appointment) => ['Waiting', 'Being Served', 'On Hold'].includes(appointment.status));

  const onProfileSave = async (values) => {
    try {
      const res = await api.put('/api/auth/profile', {
        name: values.fullName,
        email: values.email,
        phone: values.phone,
        nationalId: values.nationalId,
        dateOfBirth: values.dateOfBirth,
        address: values.address,
      });
      if (res.data.success) {
        updateUser(res.data.data);
        toast.success('Profile updated.');
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
        toast.success('Password changed.');
        resetPassword();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not change password.');
    }
  };

  return (
    <div className="min-h-screen pb-12 text-white">
      {/* ─── Profile Header ──────────────────────────── */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="bg-slate-900 rounded-2xl p-6 md:p-8 mb-6 text-white relative overflow-hidden border border-slate-800 shadow-xl shadow-black/10"
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-sky-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border-4 border-blue-500/20 text-[#4189DD] flex items-center justify-center text-3xl font-bold">
            {initials}
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold">{user?.name || 'NQS User'}</h1>
            <p className="text-slate-500 text-sm">{user?.email || 'No email on file'}</p>
            <div className="flex items-center justify-center sm:justify-start gap-3 mt-2">
              <span className="px-3 py-0.5 bg-blue-500/10 text-[#4189DD] rounded-full text-xs font-medium">
                {user?.role || 'user'}
              </span>
              <span className="text-xs text-slate-500">
                <FiCalendar className="inline mr-1" size={12} />
                Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
        {/* ─── Personal Information ──────────────────── */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiUser className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Details</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Update the details used for your National ID appointments.
          </p>

          <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                icon={FiUser}
                label="Full Name"
                placeholder="Enter full name"
                error={profileErrors.fullName}
                {...regProfile('fullName')}
              />
              <InputField
                icon={FiMail}
                label="Email Address"
                type="email"
                placeholder="Enter email"
                error={profileErrors.email}
                {...regProfile('email')}
              />
              <InputField
                icon={FiPhone}
                label="Phone Number"
                placeholder="+252 61 XXX XXXX"
                error={profileErrors.phone}
                {...regProfile('phone')}
              />
              <InputField
                icon={FiHash}
                label="National ID"
                placeholder="SO-100200300"
                error={profileErrors.nationalId}
                {...regProfile('nationalId')}
              />
              <InputField
                icon={FiCalendar}
                label="Date of Birth"
                type="date"
                error={profileErrors.dateOfBirth}
                {...regProfile('dateOfBirth')}
              />
              <InputField
                icon={FiMapPin}
                label="Address"
                placeholder="Enter address"
                error={profileErrors.address}
                {...regProfile('address')}
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <FiSave size={15} />
                Save Changes
              </button>
            </div>
          </form>
        </motion.div>

        {/* ─── Activity Summary ──────────────────────── */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appointment Summary</h2>
          <div className="space-y-4">
            {[
              { label: 'Total Appointments', value: appointments.length.toString(), icon: FiCalendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
              { label: 'Completed Visits', value: completedAppointments.length.toString(), icon: FiStar, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/30' },
              { label: 'Active Queue Visits', value: activeAppointments.length.toString(), icon: FiClock, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
            ].map((stat) => (
              <div key={stat.label} className={`flex items-center gap-3 p-3 rounded-xl ${stat.bg}`}>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={stat.color} size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Security ──────────────────────────────── */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <FiLock className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Change your password to keep your account secure.
          </p>

          <form onSubmit={handlePassword(onPasswordChange)} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Current Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  placeholder="Enter current password"
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 ${
                    pwErrors.currentPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  {...regPassword('currentPassword')}
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrentPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {pwErrors.currentPassword && <p className="text-xs text-red-500 mt-1">{pwErrors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">New Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className={`w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 ${
                    pwErrors.newPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  {...regPassword('newPassword')}
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {pwErrors.newPassword && <p className="text-xs text-red-500 mt-1">{pwErrors.newPassword.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className={`w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 ${
                    pwErrors.confirmPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  {...regPassword('confirmPassword')}
                />
              </div>
              {pwErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{pwErrors.confirmPassword.message}</p>}
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <FiCheckCircle size={15} />
              Update Password
            </button>
          </form>
        </motion.div>

        {/* ─── Recent Appointments ────────────────────── */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Appointments</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Service</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.slice(0, 5).map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <td className="py-2.5 text-gray-800 dark:text-gray-200 font-medium">{a.service}</td>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400">{a.date}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[a.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400 dark:text-gray-500">
                      No appointments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
