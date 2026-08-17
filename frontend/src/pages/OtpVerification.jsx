import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCheckCircle, FiRefreshCw, FiShield } from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';

const STORAGE_KEY = 'nqs_pending_otp_flow';

const emptyDigits = ['', '', '', '', '', ''];

const getPendingFlow = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

const OtpVerification = () => {
  const navigate = useNavigate();
  const { verifyLoginOtp } = useAuth();
  const [searchParams] = useSearchParams();
  const purpose = searchParams.get('purpose') || '';
  const [flow, setFlow] = useState(() => getPendingFlow());
  const [digits, setDigits] = useState(emptyDigits);
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const inputRefs = useRef([]);
  const verifyInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  const otp = useMemo(() => digits.join(''), [digits]);
  const phone = flow?.phone || '';

  useEffect(() => {
    if (!flow || flow.purpose !== purpose) {
      toast.error('OTP session expired. Please submit the form again.');
      navigate(purpose === 'login' ? '/login' : '/dashboard/user/services', { replace: true });
    }
  }, [flow, navigate, purpose]);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const updateDigit = (index, value) => {
    const nextValue = value.replace(/\D/g, '').slice(-1);
    if (message) setMessage('');
    setDigits((current) => {
      const next = [...current];
      next[index] = nextValue;
      return next;
    });
    if (nextValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length !== 6) return;
    event.preventDefault();
    if (message) setMessage('');
    setDigits(pasted.split(''));
    inputRefs.current[5]?.focus();
  };

  const resendOtp = async () => {
    if (!flow || seconds > 0 || resendInFlightRef.current) return;
    resendInFlightRef.current = true;
    setLoading(true);
    setMessage('');
    try {
      if (purpose === 'login') {
        const resendResponse = await api.post('/api/auth/login/otp/resend', { loginToken: flow.loginToken });
        const nextData = resendResponse.data?.data || {};
        if (nextData.phone || nextData.otpId) {
          const nextFlow = { ...flow, phone: nextData.phone || flow.phone, otpId: nextData.otpId || flow.otpId };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlow));
          setFlow(nextFlow);
        }
      } else {
        const endpoint = purpose === 'forgot_password' ? '/api/otp/forgot-password/request' : '/api/otp/request';
        const resendResponse = await api.post(endpoint, {
          purpose,
          phone: flow.phone,
          otpId: flow.otpId,
          resend: true,
          identifier: flow.identifier,
          userId: flow.userId,
          ticketId: flow.ticketId
        });
        const nextData = resendResponse.data?.data || {};
        if (nextData.phone || nextData.otpId) {
          const nextFlow = { ...flow, phone: nextData.phone || flow.phone, otpId: nextData.otpId || flow.otpId };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlow));
          setFlow(nextFlow);
        }
      }
      setDigits(emptyDigits);
      setSeconds(60);
      toast.success('New OTP sent. The previous code is no longer valid.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
      resendInFlightRef.current = false;
    }
  };

  const submitFinalRequest = async (verificationToken) => {
    if (flow.finalRequest?.method === 'put') {
      const response = await api.put(flow.finalRequest.url, {
        ...flow.finalRequest.payload,
        otpToken: verificationToken
      });
      return response.data.data;
    }

    const response = await api.post(flow.finalRequest.url, {
      ...flow.finalRequest.payload,
      otpToken: verificationToken
    });
    return response.data.data;
  };

  const verify = async () => {
    if (verifyInFlightRef.current) return;
    if (otp.length !== 6 || !flow) {
      setMessage('Enter the 6-digit OTP.');
      return;
    }

    verifyInFlightRef.current = true;
    setLoading(true);
    setMessage('');
    try {
      const endpoint = purpose === 'forgot_password' ? '/api/otp/forgot-password/verify' : '/api/otp/verify';
      if (purpose === 'login') {
        const user = await verifyLoginOtp(flow.loginToken, otp, flow.otpId);
        sessionStorage.removeItem(STORAGE_KEY);
        toast.success(flow.successMessage || 'Login verified.');
        const dashboardMap = {
          admin: '/dashboard/admin',
          super_admin: '/dashboard/admin',
          operator: '/operator-dashboard',
          super_operator: '/operator-dashboard',
          center_manager: '/operator-dashboard',
          user_manager: '/user-management',
          citizen: '/dashboard/user',
        };
        navigate(dashboardMap[user.role] || '/', { replace: true });
        return;
      }

      const response = await api.post(endpoint, {
        purpose,
        phone: flow.phone,
        otpId: flow.otpId,
        identifier: flow.identifier,
        userId: flow.userId,
        ticketId: flow.ticketId,
        code: otp
      });
      const verificationToken = response.data.data?.verificationToken;

      if (purpose === 'forgot_password') {
        sessionStorage.setItem('nqs_forgot_password_token', JSON.stringify({
          phone: flow.phone,
          otpId: flow.otpId,
          identifier: flow.identifier,
          userId: flow.userId,
          verificationToken
        }));
        sessionStorage.removeItem(STORAGE_KEY);
        toast.success('OTP verified. Create a new password.');
        navigate('/reset-password', { replace: true });
        return;
      }

      const result = await submitFinalRequest(verificationToken);
      if (flow.clearDraftKey) {
        localStorage.removeItem(flow.clearDraftKey);
      }
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success(flow.successMessage || 'Verified successfully.');
      navigate(flow.successPath || '/dashboard/user/my-appointments', {
        replace: true,
        state: { otpVerified: true, result }
      });
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid OTP.';
      setMessage(msg);
      setDigits(emptyDigits);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      verifyInFlightRef.current = false;
    }
  };

  if (!flow) return null;

  return (
    <div className="nqs-auth-dark min-h-screen bg-[#061426] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-lg items-center">
        <div className="w-full rounded-3xl border border-blue-400/20 bg-[#0B2344] p-6 shadow-2xl shadow-black/30">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-lg shadow-blue-950/30">
              <FiShield />
            </div>
            <h1 className="mt-5 text-2xl font-black">Verify OTP</h1>
            <p className="mt-2 text-sm text-blue-100">
              Enter the 6-digit code sent to {phone || 'your phone'}.
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => { inputRefs.current[index] = node; }}
                value={digit}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                inputMode="numeric"
                maxLength={1}
                className="h-12 w-12 rounded-xl border border-blue-300/25 bg-[#071A33] text-center text-xl font-black text-white outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-500/20"
              />
            ))}
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={verify}
            disabled={loading || otp.length !== 6}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <FiCheckCircle />}
            Verify
          </button>

          <div className="mt-4 flex items-center justify-between text-sm text-blue-100">
            <span>Resend in {seconds}s</span>
            <button
              type="button"
              onClick={resendOtp}
              disabled={loading || seconds > 0}
              className="inline-flex items-center gap-2 font-black text-blue-300 disabled:opacity-40"
            >
              <FiRefreshCw /> Resend OTP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtpVerification;
