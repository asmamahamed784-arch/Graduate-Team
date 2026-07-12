import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle, FiCalendar, FiMapPin, FiClock, FiCpu, FiPrinter, FiDownload, FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../../api/axiosInstance';
import { downloadTicketPdf } from '../../utils/ticketPdf';

const Confirmation = ({ data, onConfirm, onBack }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const { service, center, date, timeSlot, reference } = data;

  useEffect(() => {
    if (reference) {
      const getQr = async () => {
        try {
          const res = await api.get(`/api/qr/generate?text=${reference}`);
          if (res.data.success) {
            setQrCodeUrl(res.data.data);
          }
        } catch {
          setQrCodeUrl('');
        }
      };
      getQr();
    }
  }, [reference]);

  const handleConfirmClick = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      toast.success('Appointment booked.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not book the appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      await downloadTicketPdf({
        ref: reference,
        service: service?.name,
        center: center?.name,
        date: date ? date.toLocaleDateString() : '',
        timeSlot,
        status: 'Confirmed'
      });
      toast.success('Ticket downloaded.');
    } catch (err) {
      toast.error(err.message || 'Could not download the QR ticket.');
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <AnimatePresence mode="wait">
        {!reference ? (
          <motion.div
            key="confirm-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="rounded-xl border border-blue-500/20 bg-slate-950/45 p-4 shadow-lg shadow-black/15 backdrop-blur"
          >
            <div className="mb-4 flex items-center space-x-2.5">
              <div className="rounded-lg bg-[#4189DD]/10 p-2 text-[#7CB8FF]">
                <FiAlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Confirm Your Booking</h2>
                <p className="text-xs text-slate-400">
                  Review your appointment details before booking.
                </p>
              </div>
            </div>

            <div className="mb-5 space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 rounded-lg bg-[#4189DD]/10 p-2 text-[#7CB8FF]">
                  <FiCpu className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Service</span>
                  <p className="text-sm font-bold text-white">{service?.name || 'National ID Registration'}</p>
                  <p className="text-xs text-slate-400">{service?.description || 'Book a National ID registration appointment.'}</p>
                </div>
              </div>

              <div className="h-px bg-slate-800" />

              <div className="flex items-start space-x-3">
                <div className="mt-0.5 rounded-lg bg-teal-500/10 p-2 text-teal-300">
                  <FiMapPin className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Service Center</span>
                  <p className="text-sm font-bold text-white">{center?.name || 'Banaadir National ID Center'}</p>
                  <p className="text-xs text-slate-400">{center?.address || 'Banaadir Region'}</p>
                </div>
              </div>

              <div className="h-px bg-slate-800" />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 rounded-lg bg-amber-500/10 p-2 text-amber-300">
                    <FiCalendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</span>
                    <p className="text-xs font-bold text-white">
                      {date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select a date'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 rounded-lg bg-blue-500/10 p-2 text-[#7CB8FF]">
                    <FiClock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Time Slot</span>
                    <p className="text-xs font-bold text-white">{timeSlot || 'Select a time'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                className="flex items-center justify-center space-x-2 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-300 transition duration-200 hover:bg-slate-800 disabled:opacity-50"
              >
                <FiArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={isSubmitting}
                className="flex items-center justify-center space-x-2 rounded-lg bg-[#4189DD] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-950/30 transition duration-200 hover:bg-blue-500 disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <svg className="-ml-1 mr-2 h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Booking...</span>
                  </>
                ) : (
                  <span>Confirm Booking</span>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success-ticket"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-slate-900/90 p-5 text-center shadow-xl shadow-black/25"
          >
            {/* Success decorative gradient */}
            <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500" />
            
            <div className="mb-4 flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 15 }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-inner dark:bg-green-950/40 dark:text-green-400"
              >
                <FiCheckCircle className="h-7 w-7" />
              </motion.div>
            </div>

            <h2 className="mb-1.5 text-xl font-bold text-white">Appointment Booked</h2>
            <p className="mx-auto mb-5 max-w-sm text-xs text-slate-400">
              Please show this QR ticket at the reception desk when you arrive.
            </p>

            <div className="mx-auto mb-5 inline-block w-full max-w-xs rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reference Code</span>
                <span className="text-base font-extrabold tracking-wide text-[#7CB8FF]">{reference}</span>
              </div>

              <div className="mb-4 flex justify-center rounded-lg border border-gray-100 bg-white p-3 shadow-sm dark:bg-white">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code Ticket" className="mx-auto h-32 w-32 object-contain" />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center text-xs text-gray-400">Generating QR Code...</div>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <p><strong className="text-slate-500 font-medium">Service:</strong> {service?.name || 'National ID Registration'}</p>
                <p><strong className="text-slate-500 font-medium">Location:</strong> {center?.name || 'Banaadir National ID Center'}</p>
                <p>
                  <strong className="text-slate-500 font-medium">Scheduled:</strong>{' '}
                  {date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Selected date'} at {timeSlot || 'selected time'}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handlePrint}
                className="flex w-full items-center justify-center space-x-2 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-300 transition duration-200 hover:bg-slate-800 sm:w-auto"
              >
                <FiPrinter className="h-3.5 w-3.5" />
                <span>Print Ticket</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center justify-center space-x-2 rounded-lg bg-[#4189DD] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-950/30 transition duration-200 hover:bg-blue-500 sm:w-auto"
              >
                <FiDownload className="h-3.5 w-3.5" />
                <span>Download Ticket</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Confirmation;
