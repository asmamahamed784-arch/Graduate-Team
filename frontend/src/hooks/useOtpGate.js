import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axiosInstance';

const emptyDigits = () => ['', '', '', '', '', ''];

/**
 * Shared "type the citizen's 6-digit OTP to confirm this action" gate.
 * `requestOtp(...)` sends the code and returns a Promise that resolves with
 * the verificationToken once the staff member enters it correctly, or
 * `null` if they close the modal without verifying.
 */
export const useOtpGate = () => {
  const [flow, setFlow] = useState(null);
  const [digits, setDigits] = useState(emptyDigits);
  const [seconds, setSeconds] = useState(60);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const resolverRef = useRef(null);
  const flowRef = useRef(null);

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  useEffect(() => {
    if (!flow || seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [flow, seconds]);

  const reset = () => {
    setFlow(null);
    setDigits(emptyDigits());
    setSeconds(60);
    setRequesting(false);
    setVerifying(false);
    setError('');
  };

  const closeOtpGate = useCallback(() => {
    resolverRef.current?.(null);
    resolverRef.current = null;
    reset();
  }, []);

  const requestOtp = useCallback(({ purpose, ticketId, ticketRef, title, description }) => {
    setDigits(emptyDigits());
    setSeconds(60);
    setError('');
    setRequesting(true);
    setFlow({ purpose, ticketId, ticketRef, title, description, otpId: null, phone: '' });

    (async () => {
      try {
        const res = await api.post('/api/otp/request', { purpose, ticketId });
        const data = res.data?.data || {};
        setFlow((current) => (current ? { ...current, otpId: data.otpId, phone: data.phone || '' } : current));
      } catch (err) {
        setError(err.response?.data?.message || 'Could not send OTP.');
      } finally {
        setRequesting(false);
      }
    })();

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const updateOtpDigit = useCallback((index, value) => {
    const nextValue = value.replace(/\D/g, '').slice(-1);
    setError('');
    setDigits((current) => {
      const next = [...current];
      next[index] = nextValue;
      return next;
    });
    return nextValue;
  }, []);

  const resendOtpGate = useCallback(async () => {
    const current = flowRef.current;
    if (!current || seconds > 0) return;
    setRequesting(true);
    setError('');
    try {
      const res = await api.post('/api/otp/request', {
        purpose: current.purpose,
        ticketId: current.ticketId,
        otpId: current.otpId,
        resend: true
      });
      const data = res.data?.data || {};
      setFlow((f) => (f ? { ...f, otpId: data.otpId || f.otpId, phone: data.phone || f.phone } : f));
      setDigits(emptyDigits());
      setSeconds(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend OTP.');
    } finally {
      setRequesting(false);
    }
  }, [seconds]);

  const verifyOtpGate = useCallback(async () => {
    const current = flowRef.current;
    const otp = digits.join('');
    if (!current) return;
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await api.post('/api/otp/verify', {
        purpose: current.purpose,
        ticketId: current.ticketId,
        otpId: current.otpId,
        code: otp
      });
      const token = res.data.data?.verificationToken;
      resolverRef.current?.(token);
      resolverRef.current = null;
      reset();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP.');
      setDigits(emptyDigits());
      setVerifying(false);
    }
  }, [digits]);

  return {
    otpFlow: flow,
    otpDigits: digits,
    otpSeconds: seconds,
    otpRequesting: requesting,
    otpVerifying: verifying,
    otpError: error,
    requestOtp,
    updateOtpDigit,
    verifyOtpGate,
    resendOtpGate,
    closeOtpGate
  };
};

export default useOtpGate;
