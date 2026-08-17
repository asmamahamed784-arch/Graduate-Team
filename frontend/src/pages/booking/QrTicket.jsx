import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiDownload, FiShare2 } from 'react-icons/fi';
import api from '../../api/axiosInstance';
import { downloadTicketPdf } from '../../utils/ticketPdf';

const asName = (value, fallback = 'National ID Service') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || fallback;
};

const QrTicket = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ref: refParam } = useParams();
  const [ticket, setTicket] = useState(location.state?.ticket || null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(!location.state?.ticket);

  useEffect(() => {
    if (ticket || !refParam) return;
    let mounted = true;
    const loadTicket = async () => {
      try {
        const res = await api.get(`/api/bookings/${encodeURIComponent(refParam)}`);
        if (mounted) setTicket(res.data?.data || res.data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load this request.');
        navigate('/dashboard/user/my-appointments', { replace: true });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadTicket();
    return () => { mounted = false; };
  }, [navigate, refParam, ticket]);

  const ticketRef = ticket?.ref || ticket?.reference || refParam || '';

  useEffect(() => {
    if (!ticketRef) return;
    let mounted = true;
    const loadQr = async () => {
      try {
        const res = await api.get(`/api/qr/generate?text=${encodeURIComponent(ticketRef)}`);
        if (mounted) setQrCodeUrl(res.data?.success ? res.data.data : '');
      } catch {
        if (mounted) setQrCodeUrl('');
      }
    };
    loadQr();
    return () => { mounted = false; };
  }, [ticketRef]);

  const handleDownload = async () => {
    if (!ticket) return;
    try {
      await downloadTicketPdf({
        ...ticket,
        service: asName(ticket.service),
        center: asName(ticket.center),
        timeSlot: ticket.timeSlot,
      });
      toast.success('Request downloaded.');
    } catch (error) {
      toast.error(error.message || 'Could not download the request.');
    }
  };

  const handleShare = async () => {
    const shareText = `My NQS appointment request: ${ticketRef}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'NQS Request', text: shareText });
      } catch {
        // User cancelled the share sheet — no error needed.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Request reference copied to clipboard.');
    } catch {
      toast.error('Could not share this request.');
    }
  };

  if (loading || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-28 pt-4 text-slate-900">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label="Go back"
        >
          <FiChevronLeft />
        </button>

        <h1 className="text-2xl font-black text-[#0B3A75]">Your QR Request</h1>
        <p className="mt-1 text-sm text-slate-500">Show this QR code at the center</p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Request Number</p>
          <p className="mt-1 font-mono text-2xl font-black text-[#0B2E59]">{ticketRef}</p>

          <div className="mx-auto mt-5 flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt={`QR Request ${ticketRef}`} className="h-full w-full object-contain p-4" />
            ) : (
              <span className="text-xs font-semibold text-slate-500">Generating QR code...</span>
            )}
          </div>

          <p className="mt-5 text-sm font-semibold text-slate-500">
            Please arrive 15 minutes before your appointment time.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#0B2E59] px-4 py-3.5 text-sm font-black text-white hover:bg-[#123A6B]"
          >
            <FiDownload /> Download
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            <FiShare2 /> Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrTicket;
