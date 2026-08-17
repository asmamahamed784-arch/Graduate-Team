import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff, FiHeadphones, FiLock, FiUser } from 'react-icons/fi';
import { useAuth } from '../hooks';
import api from '../api/axiosInstance';
import AuthSplitLayout from '../components/AuthSplitLayout';

const schema = yup.object().shape({
  username: yup.string().min(3, 'Username or Phone must be at least 3 characters').required('Username or Phone is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const dashboardMap = {
  admin: '/dashboard/admin',
  super_admin: '/dashboard/admin',
  operator: '/operator-dashboard',
  super_operator: '/operator-dashboard',
  center_manager: '/operator-dashboard',
  user_manager: '/user-management',
  citizen: '/dashboard/user',
};

const getRememberedUsername = () => {
  try {
    return localStorage.getItem('nqs_remembered_username') || '';
  } catch {
    return '';
  }
};

const setRememberedUsername = (username, remember) => {
  try {
    if (remember) {
      localStorage.setItem('nqs_remembered_username', username);
    } else {
      localStorage.removeItem('nqs_remembered_username');
    }
  } catch {
    // Remember-me is optional; login should still work if storage is unavailable.
  }
};

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, role } = useAuth();
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    const rememberedUsername = getRememberedUsername();
    if (rememberedUsername) {
      setValue('username', rememberedUsername);
      setRememberMe(true);
    }
  }, [setValue]);

  useEffect(() => {
    if (isAuthenticated && role) {
      navigate(dashboardMap[role] || '/');
    }
  }, [isAuthenticated, role, navigate]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const user = await login(data.username, data.password);

      setRememberedUsername(data.username, rememberMe);

      if (user?.otpRequired) {
        sessionStorage.setItem('nqs_pending_otp_flow', JSON.stringify({
          purpose: 'login',
          phone: user.phone,
          otpId: user.otpId,
          loginToken: user.loginToken,
          role: user.role,
          successMessage: 'Login verified.'
        }));
        toast.success('OTP sent to your phone.');
        navigate('/verify-otp?purpose=login', { replace: true });
        return;
      }

      navigate(dashboardMap[user.role] || '/');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const currentUsername = getValues('username') || '';
    const identifier = window.prompt('Enter your username or registered phone number', currentUsername);
    if (!identifier) return;
    setLoading(true);
    try {
      const otpResponse = await api.post('/api/otp/forgot-password/request', { identifier });
      sessionStorage.setItem('nqs_pending_otp_flow', JSON.stringify({
        purpose: 'forgot_password',
        phone: otpResponse.data?.data?.phone || identifier,
        otpId: otpResponse.data?.data?.otpId,
        identifier,
        userId: otpResponse.data?.data?.userId,
        successMessage: 'OTP verified.'
      }));
      toast.success('OTP sent.');
      navigate('/forgot-password?purpose=forgot_password');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="mb-8">
        <p className="text-3xl font-black !text-slate-900">Welcome Back</p>
        <p className="mt-1 text-sm !text-slate-500">Sign in to your account to continue</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-bold !text-slate-700">
            Username or Phone
          </label>
          <div className="relative">
            <FiUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username or phone"
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
              autoComplete="current-password"
              placeholder="Enter your password"
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

        <div className="flex items-center justify-between text-sm">
          <label htmlFor="remember-me" className="flex items-center gap-2 !text-slate-500">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="font-bold text-blue-600 hover:text-blue-800"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F6FC2] px-5 py-3.5 text-sm font-black !text-[#ffffff] transition hover:bg-[#17579C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiUser /> {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <Link
        to="/faq"
        className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800"
      >
        <FiHeadphones /> Need help?
      </Link>

      <p className="mt-4 text-center text-sm !text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-black text-blue-600 hover:text-blue-800">
          Create Account
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
