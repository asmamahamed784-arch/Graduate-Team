import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { BrowserQRCodeReader } from '@zxing/library';
import { toast } from 'react-toastify';
import {
  FiCamera,
  FiSearch,
  FiCheckCircle,
  FiXCircle,
  FiZap,
  FiStopCircle,
  FiClock,
  FiUser,
  FiMapPin,
  FiMail,
  FiPhone,
  FiHash,
  FiClipboard,
  FiAlertTriangle,
  FiEdit3
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';

const getInitials = (name = 'Citizen') => name
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

const mapTicketPayload = (payload = {}, fallbackReference = '', options = {}) => {
  const reference = payload.ticketNumber || payload.ticketRef || fallbackReference;
  const displayStatus = options.displayStatus || payload.actionStatus || payload.verificationStatus || payload.status || 'Invalid';

  return {
    valid: options.valid ?? true,
    found: Boolean(payload.ticketNumber || payload.ticketRef || payload.citizenName || payload.fullName),
    reference,
    ticketNumber: reference,
    fullName: payload.fullName || payload.citizenName || '',
    citizenName: payload.citizenName || payload.fullName || '',
    nationalId: payload.nationalId || '',
    citizenPhoto: payload.citizenPhoto || payload.photo || payload.photoUrl || '',
    email: payload.email || '',
    phone: payload.phone || '',
    service: payload.service || '',
    requestType: payload.requestType || 'new_national_id',
    requestStatus: payload.requestStatus || '',
    replacementDetails: payload.replacementDetails || {},
    updateDetails: payload.updateDetails || {},
    date: payload.appointmentDate || payload.date || '',
    time: payload.timeSlot || payload.time || '',
    center: payload.center || '',
    centerAddress: payload.centerAddress || '',
    queueNumber: payload.queueNumber || '',
    scanId: payload.scanId,
    status: payload.status || displayStatus,
    displayStatus,
    error: options.error || ''
  };
};

const QRVerify = () => {
  const { user } = useAuth();
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const lastScannedRef = useRef('');

  const addRecent = useCallback((reference, status) => {
    setRecentVerifications((prev) => [
      {
        id: `${reference}-${Date.now()}`,
        reference,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status,
        verifiedBy: user?.name || 'NQS Operator'
      },
      ...prev
    ].slice(0, 5));
  }, [user?.name]);

  const verifyCode = useCallback(async (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      toast.warning('Please enter a reference code.');
      return;
    }

    setVerifying(true);
    try {
      const res = await api.post('/api/qr/verify', { ticketRef: code });
      if (res.data.success) {
        const payload = res.data.data;
        setVerificationResult(mapTicketPayload(payload, code, { valid: true, displayStatus: payload.status || 'Valid' }));
        addRecent(payload.ticketNumber || payload.ticketRef, 'Valid');
        toast.success(res.data.message || 'Ticket verified.');
      }
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'This QR ticket could not be verified.';
      const payload = e.response?.data?.data || {};
      setVerificationResult(mapTicketPayload(payload, code, {
        valid: false,
        displayStatus: payload.status || 'Invalid',
        error: errMsg
      }));
      addRecent(payload.ticketNumber || payload.ticketRef || code, payload.status || 'Invalid');
      toast.error(errMsg);
    } finally {
      setVerifying(false);
    }
  }, [addRecent]);

  const stopScanner = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    lastScannedRef.current = '';
    setScannerActive(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const reader = new BrowserQRCodeReader(500);
      readerRef.current = reader;
      setScannerActive(true);
      await reader.decodeFromVideoDevice(null, videoRef.current, (result) => {
        if (!result) return;
        const scanned = result.getText().trim().toUpperCase();
        if (!scanned || scanned === lastScannedRef.current) return;
        lastScannedRef.current = scanned;
        setManualCode(scanned);
        verifyCode(scanned);
      });
    } catch (err) {
      stopScanner();
      toast.error(err.message || 'Unable to access the camera scanner.');
    }
  }, [stopScanner, verifyCode]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const handleVerify = () => {
    verifyCode(manualCode);
  };

  const handleTicketAction = async (action) => {
    const ticketRef = verificationResult?.reference || manualCode.trim().toUpperCase();
    if (!ticketRef) {
      toast.warning('Please scan or enter a ticket reference first.');
      return;
    }

    setActionLoading(action);
    try {
      const res = await api.post('/api/qr/action', { ticketRef, action });
      const payload = res.data.data || {};
      const actionStatus = payload.actionStatus || (action === 'arrive' ? 'Arrived' : action === 'cancel' ? 'Cancelled' : action === 'reject' ? 'Rejected' : payload.status || 'Verified');
      setVerificationResult(mapTicketPayload(payload, ticketRef, {
        valid: !['Cancelled', 'Rejected'].includes(actionStatus),
        displayStatus: actionStatus,
        error: action === 'reject' ? 'This ticket was rejected for review.' : ''
      }));
      addRecent(payload.ticketNumber || payload.ticketRef || ticketRef, actionStatus);
      toast.success(res.data.message || 'QR ticket updated.');
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Unable to update this QR ticket.';
      toast.error(errMsg);
    } finally {
      setActionLoading('');
    }
  };

  const actionButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
  const terminalStatus = ['Cancelled', 'Completed', 'Expired', 'Rejected'].includes(verificationResult?.status);
  const positiveStatuses = ['Valid', 'Verified', 'Arrived', 'Being Served', 'Completed'];
  const problemStatuses = ['Invalid', 'Expired', 'Cancelled', 'Rejected'];
  const currentDisplayStatus = verificationResult?.displayStatus || verificationResult?.status;
  const statusIsPositive = positiveStatuses.includes(currentDisplayStatus);
  const statusIsProblem = problemStatuses.includes(currentDisplayStatus) || (verificationResult && !verificationResult.valid && !verificationResult.found);
  const statusBadgeClass = statusIsPositive
    ? 'bg-green-900/40 text-green-300'
    : statusIsProblem
      ? 'bg-red-900/40 text-red-300'
      : 'bg-amber-900/40 text-amber-200';
  const resultDetails = verificationResult ? [
    { label: 'Full Name', value: verificationResult.fullName || verificationResult.citizenName, icon: FiUser },
    { label: 'Ticket Number', value: verificationResult.ticketNumber || verificationResult.reference, icon: FiHash },
    { label: 'National ID Number', value: verificationResult.nationalId || 'Not available', icon: FiClipboard },
    { label: 'Email', value: verificationResult.email || 'Not available', icon: FiMail },
    { label: 'Phone', value: verificationResult.phone || 'Not available', icon: FiPhone },
    { label: 'Service', value: verificationResult.service, icon: FiZap },
    ...(verificationResult.requestType === 'lost_replacement'
      ? [
          { label: 'Replacement Status', value: verificationResult.requestStatus || 'Pending', icon: FiClipboard },
          { label: 'Reason', value: verificationResult.replacementDetails?.reason || 'Not available', icon: FiAlertTriangle },
          { label: 'Date Lost', value: verificationResult.replacementDetails?.dateLost || 'Not available', icon: FiClock },
          { label: 'Place Lost', value: verificationResult.replacementDetails?.placeLost || 'Not available', icon: FiMapPin }
        ]
      : []),
    ...(verificationResult.requestType === 'update_information'
      ? [
          { label: 'Request Status', value: verificationResult.requestStatus || 'Pending', icon: FiClipboard },
          { label: 'Field To Update', value: verificationResult.updateDetails?.fieldToUpdate || 'Not available', icon: FiEdit3 },
          { label: 'Current Value', value: verificationResult.updateDetails?.currentValue || 'Not available', icon: FiClipboard },
          { label: 'New Value', value: verificationResult.updateDetails?.newValue || 'Not available', icon: FiCheckCircle },
          { label: 'Reason', value: verificationResult.updateDetails?.reason || 'Not available', icon: FiAlertTriangle }
        ]
      : []),
    { label: 'Center', value: verificationResult.center, icon: FiMapPin },
    {
      label: 'Appointment Date',
      value: `${verificationResult.date || 'Not available'}${verificationResult.time ? ` at ${verificationResult.time}` : ''}`,
      icon: FiClock
    },
    { label: 'Queue Number', value: verificationResult.queueNumber, icon: FiClipboard },
    { label: 'Current Status', value: verificationResult.displayStatus || verificationResult.status, icon: FiCheckCircle }
  ].filter((item) => item.value) : [];

  return (
    <div className="min-h-screen pb-12 text-slate-900 dark:text-slate-100">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#4189DD]/15 rounded-xl">
            <FiCamera className="text-[#7CB8FF] text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">QR Scan</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Scan or enter a ticket reference to verify a National ID appointment</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#4189DD]/20 dark:bg-[#071a33] dark:shadow-xl dark:shadow-black/20"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Scan Ticket</h2>

          <div
            className={`relative aspect-square max-h-72 rounded-xl bg-gray-900 dark:bg-gray-950 flex flex-col items-center justify-center mb-4 overflow-hidden ${
              scannerActive ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : ''
            }`}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className={`absolute inset-0 h-full w-full object-cover ${scannerActive ? 'opacity-100' : 'opacity-0'}`}
            />

            {scannerActive && (
              <motion.div
                className="absolute inset-0 border-2 border-blue-400 rounded-xl pointer-events-none"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}

            {scannerActive && (
              <motion.div
                className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {!scannerActive && (
              <>
                <FiCamera className="text-gray-600 text-4xl mb-3" />
                <p className="text-slate-500 text-sm text-center px-4">Camera feed will appear here</p>
              </>
            )}
            {scannerActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bottom-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5"
              >
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs">Live</span>
              </motion.div>
            )}
          </div>

          <button
            onClick={scannerActive ? stopScanner : startScanner}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
              scannerActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-700 hover:bg-blue-800 text-white'
            }`}
          >
            {scannerActive ? (
              <>
                <FiStopCircle size={16} />
                Stop Camera
              </>
            ) : (
              <>
                <FiZap size={16} />
                Start Camera
              </>
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#4189DD]/20 dark:bg-[#071a33] dark:shadow-xl dark:shadow-black/20">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Enter Reference</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter the ticket reference printed on the QR ticket or shown in the confirmation email.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="NQS-XXXX"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400 dark:bg-[#061225] dark:border-[#27476f] dark:text-slate-100 dark:placeholder-slate-500 font-mono"
                />
              </div>
              <button
                onClick={handleVerify}
                disabled={verifying || !manualCode.trim()}
                className="px-6 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {verifying ? 'Checking...' : 'Check'}
              </button>
            </div>
          </div>

          {verificationResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-6 ${
                statusIsProblem
                  ? 'bg-red-950/20 border-red-700/40'
                  : statusIsPositive
                  ? 'bg-green-950/20 border-green-700/40'
                  : 'bg-blue-950/20 border-[#4189DD]/30'
              }`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 text-lg font-black text-blue-700 dark:border-[#4189DD]/25 dark:bg-[#061225] dark:text-[#7CB8FF]">
                  {verificationResult.citizenPhoto ? (
                    <img
                      src={verificationResult.citizenPhoto}
                      alt={verificationResult.fullName || 'Citizen photo'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(verificationResult.fullName || verificationResult.citizenName || 'Citizen')
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {statusIsPositive ? (
                      <FiCheckCircle className="text-green-400" size={20} />
                    ) : (
                      <FiXCircle className="text-red-400" size={20} />
                    )}
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {verificationResult.fullName || verificationResult.citizenName || verificationResult.reference}
                    </h3>
                  </div>
                  <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{verificationResult.reference}</p>
                  <span
                    className={`mt-2 inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusBadgeClass}`}
                  >
                    {verificationResult.displayStatus || verificationResult.status || 'Invalid'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {!verificationResult.valid && verificationResult.error && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-950/40 p-3 text-sm text-red-300">
                    <FiAlertTriangle className="mt-0.5 shrink-0" />
                    <p>{verificationResult.error}</p>
                  </div>
                )}

                {resultDetails.length > 0 && (
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    {resultDetails.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#27476f] dark:bg-[#061225]/60">
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <Icon size={14} />
                            <span>{item.label}</span>
                          </div>
                          <p className="break-words font-semibold text-slate-900 dark:text-white">{item.value}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {verificationResult.valid && (
                  <div className="flex justify-center pt-3 border-t border-green-800/40">
                    <QRCodeSVG
                      value={verificationResult.reference}
                      size={120}
                      bgColor="transparent"
                      fgColor={document.documentElement.classList.contains('dark') ? '#86efac' : '#15803d'}
                    />
                  </div>
                )}

                {verificationResult.found && (
                <div className="grid gap-3 border-t border-slate-200 pt-4 dark:border-[#27476f] sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => handleTicketAction('verify')}
                    disabled={!verificationResult.valid || terminalStatus || actionLoading}
                    className={`${actionButtonClass} bg-blue-700 text-white hover:bg-blue-800`}
                  >
                    <FiCheckCircle size={16} />
                    {actionLoading === 'verify' ? 'Saving...' : 'Verify Ticket'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTicketAction('arrive')}
                    disabled={!verificationResult.valid || terminalStatus || actionLoading}
                    className={`${actionButtonClass} bg-cyan-700 text-white hover:bg-cyan-800`}
                  >
                    <FiUser size={16} />
                    {actionLoading === 'arrive' ? 'Saving...' : 'Mark Citizen Arrived'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTicketAction('complete')}
                    disabled={!verificationResult.valid || terminalStatus || actionLoading}
                    className={`${actionButtonClass} bg-green-700 text-white hover:bg-green-800`}
                  >
                    <FiClipboard size={16} />
                    {actionLoading === 'complete' ? 'Saving...' : 'Complete Appointment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTicketAction('cancel')}
                    disabled={!verificationResult.valid || terminalStatus || actionLoading}
                    className={`${actionButtonClass} border border-red-800/60 bg-red-950/20 text-red-300 hover:bg-red-950/40`}
                  >
                    <FiXCircle size={16} />
                    {actionLoading === 'cancel' ? 'Saving...' : 'Cancel Appointment'}
                  </button>
                </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#4189DD]/20 dark:bg-[#071a33] dark:shadow-xl dark:shadow-black/20"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1d355f]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Checks</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Last 5 checks during this session</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left dark:bg-[#0b2444]">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Checked By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#122c50]">
              {recentVerifications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500">
                    No QR tickets checked in this session yet.
                  </td>
                </tr>
              ) : (
                recentVerifications.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-blue-50/50 dark:hover:bg-white/5">
                    <td className="px-6 py-3 font-mono font-medium text-slate-800 dark:text-slate-200">{v.reference}</td>
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{v.time}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          positiveStatuses.includes(v.status)
                            ? 'bg-green-900/40 text-green-300'
                            : 'bg-red-900/40 text-red-300'
                        }`}
                      >
                        {positiveStatuses.includes(v.status) ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <FiUser size={13} className="text-slate-500" />
                      {v.verifiedBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default QRVerify;
