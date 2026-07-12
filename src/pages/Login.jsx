import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff, FiLock, FiUser } from 'react-icons/fi';
import { useAuth } from '../hooks';

const schema = yup.object().shape({
  username: yup.string().min(3, 'Username must be at least 3 characters').required('Username is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const dashboardMap = {
  admin: '/dashboard/admin',
  operator: '/operator-dashboard',
  super_operator: '/operator-dashboard',
  citizen: '/dashboard/user',
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
    setValue,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    const rememberedUsername = localStorage.getItem('nqs_remembered_username');
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

      if (rememberMe) {
        localStorage.setItem('nqs_remembered_username', data.username);
      } else {
        localStorage.removeItem('nqs_remembered_username');
      }

      navigate(dashboardMap[user.role] || '/');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info('Password reset is not configured yet.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#071A33] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-blue-400/20 bg-[#0B2344] p-8 shadow-2xl shadow-black/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white shadow-lg shadow-blue-900/30">
            NQS
          </div>
          <h1 className="text-2xl font-black">Sign in to National Queue System</h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-bold text-blue-100">
              Username
            </label>
            <div className="relative">
              <FiUser className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Username"
                {...register('username')}
                className={`w-full rounded-xl border bg-white px-12 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
                  errors.username ? 'border-red-400' : 'border-transparent'
                }`}
              />
            </div>
            {errors.username && <p className="mt-2 text-sm font-semibold text-red-300">{errors.username.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-bold text-blue-100">
              Password
            </label>
            <div className="relative">
              <FiLock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                {...register('password')}
                className={`w-full rounded-xl border bg-white px-12 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
                  errors.password ? 'border-red-400' : 'border-transparent'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {errors.password && <p className="mt-2 text-sm font-semibold text-red-300">{errors.password.message}</p>}
          </div>

          <div className="flex items-center justify-between text-sm">
            <label htmlFor="remember-me" className="flex items-center gap-2 text-blue-100">
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
              className="font-bold text-blue-300 hover:text-blue-100"
            >
              Forgot password
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-blue-100">
          Do not have an account?{' '}
          <Link to="/register" className="font-black text-blue-300 hover:text-blue-100">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
