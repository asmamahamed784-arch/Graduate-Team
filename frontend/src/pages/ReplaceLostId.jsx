import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiRefreshCw } from 'react-icons/fi';
import api from '../api/axiosInstance';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import { downloadTicketPdf } from '../utils/ticketPdf';
import {
  LOST_ID_SERVICE_NAME,
  activeCenters,
  findService,
  formatDate,
  getDistrict,
  inputClass,
  labelClass,
  maxDateKey,
  pageShellClass,
  panelClass,
  timeSlots,
  todayKey
} from './appointments/appointmentShared';

const ReplaceLostId = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const resubmitId = searchParams.get('resubmit');
  const [services, setServices] = useState([]);
  const [centers, setCenters] = useState([]);
  const [availability, setAvailability] = useState({});
  const [availableSlots, setAvailableSlots] = useState(timeSlots);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [resubmitTicket, setResubmitTicket] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [form, setForm] = useState({
    nationalIdNumber: user?.nationalId || '',
    fullName: user?.name || '',
    phone: user?.phone || '',
    dateLost: '',
    placeLost: '',
    reason: '',
    policeReportNumber: '',
    policeReportDocument: '',
    notes: '',
    centerId: '',
    date: '',
    timeSlot: ''
  });

  const service = useMemo(() => findService(services, LOST_ID_SERVICE_NAME), [services]);
  const selectedCenter = useMemo(
    () => centers.find((center) => (center._id || center.id) === form.centerId),
    [centers, form.centerId]
  );
  const bookedSlots = form.date ? availability[form.date]?.bookedSlots || [] : [];
  const availableDateOptions = useMemo(
    () => Object.entries(availability)
      .filter(([, info]) => info?.status === 'available')
      .map(([date]) => date)
      .sort(),
    [availability]
  );

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [serviceRes, centerRes] = await Promise.all([
          apiClient.get('/api/services/list'),
          apiClient.get('/api/centers/list')
        ]);
        setServices(serviceRes.data || []);
        setCenters(activeCenters(centerRes.data || []));
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load replacement options.');
      } finally {
        setLoading(false);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (!resubmitId || centers.length === 0) return;

    let mounted = true;
    const loadResubmitTicket = async () => {
      try {
        const res = await api.get(`/api/bookings/${resubmitId}`);
        const existing = res.data?.data || res.data;
        if (!mounted || !existing) return;
        if (existing.status !== 'Cancelled') {
          toast.error('Only cancelled appointments can be resubmitted.');
          return;
        }

        const details = existing.replacementDetails || {};
        setResubmitTicket(existing);
        setTicket(null);
        setForm({
          nationalIdNumber: details.nationalIdNumber || user?.nationalId || '',
          fullName: details.fullName || existing.citizenName || user?.name || '',
          phone: details.phone || existing.citizen?.phone || user?.phone || '',
          dateLost: details.dateLost ? String(details.dateLost).slice(0, 10) : '',
          placeLost: details.placeLost || '',
          reason: details.reason || '',
          policeReportNumber: details.policeReportNumber || '',
          policeReportDocument: details.policeReportDocument || '',
          notes: details.additionalNotes || details.notes || '',
          centerId: existing.center?._id || existing.center || '',
          date: existing.date ? String(existing.date).slice(0, 10) : '',
          timeSlot: existing.timeSlot || ''
        });
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load the cancelled appointment.');
      }
    };

    loadResubmitTicket();
    return () => {
      mounted = false;
    };
  }, [resubmitId, centers.length, user?.name, user?.nationalId, user?.phone]);

  useEffect(() => {
    if (!form.centerId) {
      setAvailability({});
      setAvailableSlots(timeSlots);
      return;
    }

    const loadAvailability = async () => {
      try {
        const res = await apiClient.get('/api/bookings/availability', {
          centerId: form.centerId,
          start: todayKey(),
          end: maxDateKey()
        });
        setAvailability(res.data?.dates || {});
        setAvailableSlots(res.data?.timeSlots?.length ? res.data.timeSlots : timeSlots);
      } catch {
        setAvailability({});
        setAvailableSlots(timeSlots);
      }
    };
    loadAvailability();
  }, [form.centerId]);

  useEffect(() => {
    if (!ticket?.ref) return;

    const loadQr = async () => {
      try {
        const res = await api.get(`/api/qr/generate?text=${encodeURIComponent(ticket.ref)}`);
        setQrCodeUrl(res.data?.success ? res.data.data : '');
      } catch {
        setQrCodeUrl('');
      }
    };
    loadQr();
  }, [ticket]);

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'date') {
        next.timeSlot = '';
      }
      if (field === 'centerId') {
        next.date = '';
        next.timeSlot = '';
      }
      return next;
    });
  };

  const validateForm = () => {
    const required = [
      ['fullName', 'Full name is required.'],
      ['phone', 'Phone number is required.'],
      ['dateLost', 'Date lost is required.'],
      ['placeLost', 'Place lost is required.'],
      ['reason', 'Reason is required.'],
      ['centerId', 'Please select a center.'],
      ['date', 'Please choose an appointment date.'],
      ['timeSlot', 'Please choose an appointment time.']
    ];
    const missing = required.find(([field]) => !String(form[field] || '').trim());
    if (missing) {
      toast.error(missing[1]);
      return false;
    }
    if (availability[form.date]?.status === 'closed') {
      toast.error('This center is not available on this date.');
      return false;
    }
    if (availability[form.date]?.status === 'full') {
      toast.error('Appointments are full for this date. Please choose another date.');
      return false;
    }
    if (bookedSlots.includes(form.timeSlot)) {
      toast.error('Appointments are full for this time. Please choose another available slot.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!service) {
      toast.error('Replace Lost National ID is not available right now.');
      return;
    }
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        serviceId: service._id || service.id,
        centerId: form.centerId,
        date: form.date,
        timeSlot: form.timeSlot,
        citizenName: form.fullName,
        replacementDetails: {
          nationalIdNumber: form.nationalIdNumber,
          fullName: form.fullName,
          phone: form.phone,
          dateLost: form.dateLost,
          placeLost: form.placeLost,
          reason: form.reason,
          policeReportNumber: form.policeReportNumber,
          policeReportDocument: form.policeReportDocument,
          additionalNotes: form.notes
        }
      };
      const resubmitTicketId = resubmitTicket?._id || resubmitTicket?.id;
      const res = resubmitTicketId
        ? await apiClient.put(`/api/bookings/${resubmitTicketId}/resubmit`, payload)
        : await apiClient.post('/api/bookings', payload);
      setTicket({
        ...(res.data || {}),
        service: 'Replace Lost National ID',
        center: selectedCenter?.name,
        date: form.date,
        timeSlot: form.timeSlot,
        status: res.data?.status || 'Waiting'
      });
      setResubmitTicket(null);
      toast.success(resubmitTicket ? 'Replacement appointment resubmitted successfully.' : 'Replacement appointment created successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create the replacement appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!ticket) return;
    try {
      await downloadTicketPdf(ticket);
      toast.success('Ticket downloaded.');
    } catch (error) {
      toast.error(error.message || 'Could not download the ticket.');
    }
  };

  if (loading) {
    return (
      <div className={pageShellClass}>
        <div className="mx-auto max-w-5xl">
          <div className={panelClass}>Loading replacement form...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div className="mx-auto max-w-6xl space-y-4">
        <Link to="/dashboard/user/services" className="inline-flex items-center gap-2 text-sm font-bold text-[#7CB8FF] hover:text-white">
          <FiArrowLeft /> Back to services
        </Link>

        <section className={panelClass}>
          <span className="rounded-full border border-[#4189DD]/35 bg-[#4189DD]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#7CB8FF]">
            Lost National ID Replacement
          </span>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">Replace Lost National ID</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Report your lost card details, choose a center, and book a replacement appointment.
          </p>
        </section>

        {resubmitTicket && (
          <section className="rounded-2xl border border-red-400/40 bg-red-950/30 p-4 text-red-100">
            <p className="text-xs font-black uppercase tracking-wide text-red-200">Correction required</p>
            <p className="mt-1 text-sm font-semibold">
              Your appointment {resubmitTicket.ref} was cancelled. Reason: {resubmitTicket.cancellationReason || 'Please correct your information and resubmit your appointment.'}
            </p>
          </section>
        )}

        {ticket ? (
          <section className={`${panelClass} grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]`}>
            <div className="rounded-2xl bg-white p-5">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Replacement QR code" className="mx-auto h-44 w-44 object-contain" />
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-500">Generating QR code...</div>
              )}
            </div>
            <div>
              <div className="mb-4 flex items-center gap-2 text-emerald-300">
                <FiCheckCircle />
                <span className="text-sm font-bold">Replacement appointment confirmed</span>
              </div>
              <h2 className="font-mono text-3xl font-black">{ticket.ref}</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info label="Service" value="Replace Lost National ID" />
                <Info label="Center" value={ticket.center} />
                <Info label="Date" value={formatDate(ticket.date)} />
                <Info label="Time" value={ticket.timeSlot} />
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button onClick={handleDownload} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400">
                  <FiDownload /> Download Ticket
                </button>
                <Link to="/track" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#4189DD]/60 px-4 py-2.5 text-sm font-bold text-[#7CB8FF] hover:bg-[#4189DD]/10">
                  <FiClock /> Check Queue Status
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <section className={panelClass}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4189DD]/15 text-[#7CB8FF]">
                  <FiRefreshCw />
                </div>
                <div>
                  <h2 className="text-lg font-black">Lost ID Details</h2>
                  <p className="text-xs text-slate-500">Police report details are optional.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="National ID Number (optional)" value={form.nationalIdNumber} onChange={(value) => updateForm('nationalIdNumber', value)} />
                <Field label="Full Name" value={form.fullName} onChange={(value) => updateForm('fullName', value)} />
                <Field label="Phone" value={form.phone} onChange={(value) => updateForm('phone', value)} />
                <Field label="Date Lost" type="date" value={form.dateLost} onChange={(value) => updateForm('dateLost', value)} />
                <Field label="Place Lost" value={form.placeLost} onChange={(value) => updateForm('placeLost', value)} />
                <Field label="Reason" value={form.reason} onChange={(value) => updateForm('reason', value)} />
                <Field label="Police Report Number (optional)" value={form.policeReportNumber} onChange={(value) => updateForm('policeReportNumber', value)} />
                <label>
                  <span className={labelClass}>Upload Police Report (optional)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) => updateForm('policeReportDocument', event.target.files?.[0]?.name || '')}
                    className={inputClass}
                  />
                  {form.policeReportDocument && <p className="mt-1 text-xs text-slate-400">{form.policeReportDocument}</p>}
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Notes</span>
                  <textarea value={form.notes} rows={3} onChange={(event) => updateForm('notes', event.target.value)} className={`${inputClass} resize-none`} />
                </label>
              </div>

              <h2 className="mb-4 mt-6 text-lg font-black">Appointment Details</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={labelClass}>Select Center</span>
                  <select value={form.centerId} onChange={(event) => updateForm('centerId', event.target.value)} className={inputClass}>
                    <option value="">Choose a Banaadir center</option>
                    {centers.map((center) => (
                      <option key={center._id || center.id} value={center._id || center.id}>
                        {center.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Appointment Date</span>
                  <select
                    value={form.date}
                    disabled={!form.centerId}
                    onChange={(event) => updateForm('date', event.target.value)}
                    className={inputClass}
                  >
                    <option value="">{form.centerId ? 'Choose an available date' : 'Select a center first'}</option>
                    {availableDateOptions.map((date) => (
                      <option key={date} value={date}>{formatDate(date)}</option>
                    ))}
                  </select>
                  {form.centerId && availableDateOptions.length === 0 && (
                    <p className="mt-1.5 text-xs font-semibold text-amber-400">No available dates for this center in the next 30 days.</p>
                  )}
                </label>
                <label>
                  <span className={labelClass}>Appointment Time</span>
                  <select value={form.timeSlot} onChange={(event) => updateForm('timeSlot', event.target.value)} className={inputClass}>
                    <option value="">Choose a time</option>
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot} disabled={!form.date || availability[form.date]?.status !== 'available' || bookedSlots.includes(slot)}>
                        {slot}{bookedSlots.includes(slot) ? ' - Full' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {/* Form footer: compact summary + submit */}
            <section className={panelClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">Summary</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    <Info label="Service" value="Replace Lost ID" />
                    <Info label="Center" value={selectedCenter?.name || 'Not selected'} />
                    <Info label="District" value={selectedCenter ? getDistrict(selectedCenter) : 'Not selected'} />
                    <Info label="Date" value={formatDate(form.date)} />
                    <Info label="Time" value={form.timeSlot || 'Not selected'} />
                  </div>
                </div>
                <button disabled={submitting} className="shrink-0 rounded-xl bg-amber-500 px-8 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? 'Submitting...' : 'Create Replacement Appointment'}
                </button>
              </div>
            </section>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text', min, max }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  </label>
);

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/45 px-3 py-2.5">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-white">{value || 'Not selected'}</p>
  </div>
);

export default ReplaceLostId;
