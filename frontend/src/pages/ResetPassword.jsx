import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock } from 'react-icons/fi';
import api from '../api/axiosInstance';

const getResetSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem('nqs_forgot_password_token') || 'null');
  } catch {
    return null;
  }
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getResetSession());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.verificationToken) {
      toast.error('OTP verification required.');
      navigate('/forgot-password', { replace: true });
    }
  }, [navigate, session]);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/otp/forgot-password/reset', {
        phone: session.phone,
        userId: session.userId,
        password,
        verificationToken: session.verificationToken
      });
      sessionStorage.removeItem('nqs_forgot_password_token');
      toast.success('New password created. Please log in.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create new password.');
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="nqs-auth-dark flex min-h-screen items-center justify-center bg-[#061426] px-4 py-10 text-white">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-blue-400/20 bg-[#0B2344] p-8 shadow-2xl shadow-black/30">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl">
            <FiLock />
          </div>
          <h1 className="mt-5 text-2xl font-black">Create New Password</h1>
          <p className="mt-2 text-sm text-blue-100">Your OTP has been verified.</p>
        </div>

        <div className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border border-transparent bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-xl border border-transparent bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800 disabled:opacity-60">
          {loading ? 'Creating...' : 'Create New Password'}
        </button>
        <Link to="/login" className="mt-5 block text-center text-sm font-bold text-blue-300 hover:text-blue-100">
          Back to login
        </Link>
      </form>
    </div>
  );
};

export default ResetPassword;
