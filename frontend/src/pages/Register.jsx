import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiEye, FiEyeOff, FiInfo, FiLock, FiUser } from 'react-icons/fi';
import { useAuth } from '../hooks';
import AuthSplitLayout from '../components/AuthSplitLayout';

const schema = yup.object().shape({
  username: yup
    .string()
    .required('Username is required.')
    .matches(/^[A-Za-z._-]+$/, 'Username may only contain letters, dots, underscores, and hyphens (no numbers).')
    .min(3, 'Username must be at least 3 characters.'),
  password: yup
    .string()
    .required('Password is required.')
    .matches(
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
      'Password must be at least 8 characters and include letters, numbers, and a special character.'
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password.')
    .oneOf([yup.ref('password')], 'Passwords do not match.'),
});

export default function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser(data.username, data.password);
      toast.success('Account created.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="mb-8 flex items-start gap-3">
        <Link
          to="/login"
          className="mt-1 text-slate-400 hover:text-slate-700"
          aria-label="Back to sign in"
        >
          <FiChevronLeft size={22} />
        </Link>
        <div>
          <p className="text-3xl font-black !text-slate-900">Create Account</p>
          <p className="mt-1 text-sm !text-slate-500">Fill in your details to get started</p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-bold !text-slate-700">
            Username
          </label>
          <div className="relative">
            <FiUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              {...register('username')}
              className={`w-full rounded-xl border bg-white px-12 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                errors.username ? 'border-red-400' : 'border-slate-200'
              }`}
            />
          </div>
          {errors.username && <p className="mt-2 text-sm font-semibold !text-red-600">{errors.username.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-bold !text-slate-700">
            Password
          </label>
          <div className="relative">
            <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a password"
              {...register('password')}
              className={`w-full rounded-xl border bg-white px-12 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                errors.password ? 'border-red-400' : 'border-slate-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.password && <p className="mt-2 text-sm font-semibold !text-red-600">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-bold !text-slate-700">
            Confirm Password
          </label>
          <div className="relative">
            <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              className={`w-full rounded-xl border bg-white px-12 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
                errors.confirmPassword ? 'border-red-400' : 'border-slate-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.confirmPassword && <p className="mt-2 text-sm font-semibold !text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 !text-[#ffffff]">
            <FiInfo size={13} />
          </span>
          <p className="text-sm font-semibold !text-[#0B2E59]">Your password will be used to sign in to your account.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-[#1F6FC2] px-5 py-3.5 text-sm font-black !text-[#ffffff] transition hover:bg-[#17579C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm !text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-black text-blue-600 hover:text-blue-800">
          Sign In
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
