import React, { useEffect, useRef } from 'react';
import { FiCheckCircle, FiRefreshCw, FiShield, FiX } from 'react-icons/fi';

/**
 * Reusable "type the citizen's 6-digit OTP" confirmation modal used by every
 * admin/operator screen that completes or cancels a citizen's appointment.
 * Pair with `useOtpGate()` from `frontend/src/hooks`.
 */
const OtpGateModal = ({
  flow,
  digits,
  seconds,
  requesting,
  verifying,
  error,
  onDigitChange,
  onVerify,
  onResend,
  onClose
}) => {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (flow) {
      const timer = setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [flow]);

  if (!flow) return null;

  const otp = digits.join('');

  const handleChange = (index, value) => {
    const nextValue = onDigitChange(index, value);
    if (nextValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === 'Enter' && otp.length === 6) {
      onVerify();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length !== 6) return;
    event.preventDefault();
    pasted.split('').forEach((digit, index) => onDigitChange(index, digit));
    inputRefs.current[5]?.focus();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <FiShield className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
          {flow.title || 'Verify OTP'}
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
          {flow.description ||
            `Enter the 6-digit code sent to the citizen${flow.phone ? ` (${flow.phone})` : ''}${flow.ticketRef ? ` for ${flow.ticketRef}` : ''}.`}
        </p>

        <div className="mt-6 flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => { inputRefs.current[index] = node; }}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              inputMode="numeric"
              maxLength={1}
              disabled={requesting || verifying}
              className="h-12 w-11 rounded-xl border border-slate-300 bg-white text-center text-xl font-black text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onVerify}
          disabled={requesting || verifying || otp.length !== 6}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifying ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <FiCheckCircle />
          )}
          Verify &amp; Continue
        </button>

        <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
          <span>{requesting ? 'Sending OTP...' : `Resend in ${seconds}s`}</span>
          <button
            type="button"
            onClick={onResend}
            disabled={requesting || verifying || seconds > 0}
            className="inline-flex items-center gap-1.5 font-black text-blue-700 disabled:opacity-40 dark:text-blue-300"
          >
            <FiRefreshCw className="h-3.5 w-3.5" /> Resend OTP
          </button>
        </div>
      </div>
    </div>
  );
};

export default OtpGateModal;
