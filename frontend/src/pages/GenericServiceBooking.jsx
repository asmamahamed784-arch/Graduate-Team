import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiBriefcase, FiCalendar, FiMapPin, FiPhone, FiUser } from 'react-icons/fi';
import api from '../api/axiosInstance';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import {
  activeCenters,
  formatDate,
  formatSomaliPhone,
  getDistrict,
  inputClass,
  isBeforeToday,
  isPastTimeSlot,
  isValidSomaliPhone,
  labelClass,
  maxDateKey,
  panelClass,
  pageShellClass,
  todayKey
} from './appointments/appointmentShared';

const idFrom = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return value.id || value._id || '';
  return value;
};

const GenericServiceBooking = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState(null);
  const [centers, setCenters] = useState([]);
  const [availability, setAvailability] = useState({});
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: formatSomaliPhone(user?.phone || ''),
    centerId: '',
    date: '',
    timeSlot: '',
    notes: ''
  });

  const selectedCenter = useMemo(
    () => centers.find((center) => idFrom(center) === form.centerId),
    [centers, form.centerId]
  );
  const bookedSlots = form.date ? availability[form.date]?.bookedSlots || [] : [];
  const availableSlots = useMemo(() => {
    if (!form.date || availability[form.date]?.status !== 'available') return [];
    return scheduleSlots;
  }, [availability, form.date, scheduleSlots]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [serviceRes, centerRes] = await Promise.all([
          apiClient.get('/api/services/list'),
          apiClient.get('/api/centers/list')
        ]);
        const liveServices = serviceRes.data || [];
        const foundService = liveServices.find((item) => idFrom(item) === serviceId);
        if (!foundService) {
          toast.error('Service not found.');
          navigate('/dashboard/user/services', { replace: true });
          return;
        }
        setService(foundService);
        setCenters(activeCenters(centerRes.data || []));
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load this service.');
      } finally {
        setLoading(false);
      }
    };
    loadOptions();
  }, [navigate, serviceId]);

  useEffect(() => {
    if (!form.centerId) {
      setAvailability({});
      setScheduleSlots([]);
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
        setScheduleSlots(res.data?.timeSlots || []);
      } catch {
        setAvailability({});
        setScheduleSlots([]);
      }
    };
    loadAvailability();
  }, [form.centerId]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'phone' ? formatSomaliPhone(value) : value,
      ...(field === 'centerId' ? { date: '', timeSlot: '' } : {}),
      ...(field === 'date' ? { timeSlot: '' } : {})
    }));
  };

  const validate = () => {
    if (!service) return 'Service not found.';
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!isValidSomaliPhone(form.phone)) return 'Enter a valid Somali phone number.';
    if (!form.centerId) return 'Please select a center.';
    if (!form.date) return 'Please choose an appointment date.';
    if (isBeforeToday(form.date)) return 'Past appointment dates cannot be selected.';
    if (availability[form.date]?.status === 'closed') return 'This center is not available on this date.';
    if (availability[form.date]?.status === 'full') return 'Appointments are full for this date. Please choose another date.';
    if (!form.timeSlot) return 'Please choose an appointment time.';
    if (isPastTimeSlot(form.date, form.timeSlot)) return 'Past appointment times cannot be selected.';
    if (!availableSlots.includes(form.timeSlot)) return 'Selected time is outside this center schedule.';
    if (bookedSlots.includes(form.timeSlot)) return 'Appointments are full for this time. Please choose another available slot.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const cleanPhone = formatSomaliPhone(form.phone);
    const payload = {
      serviceId: idFrom(service),
      centerId: form.centerId,
      date: form.date,
      timeSlot: form.timeSlot,
      citizenName: form.fullName.trim(),
      serviceRequestDetails: {
        fullName: form.fullName.trim(),
        phone: cleanPhone,
        serviceName: service.name,
        notes: form.notes.trim(),
        selectedCenter: selectedCenter?.name || '',
        centerDistrict: selectedCenter ? getDistrict(selectedCenter) : '',
        appointmentDate: form.date,
        appointmentTime: form.timeSlot
      }
    };

    setSubmitting(true);
    try {
      const otpResponse = await api.post('/api/otp/request', {
        purpose: 'new_id_booking',
        phone: cleanPhone
      });
      sessionStorage.setItem('nqs_pending_otp_flow', JSON.stringify({
        purpose: 'new_id_booking',
        phone: otpResponse.data?.data?.phone || cleanPhone,
        otpId: otpResponse.data?.data?.otpId,
        finalRequest: {
          method: 'post',
          url: '/api/bookings',
          payload
        },
        successPath: '/dashboard/user/my-appointments',
        successMessage: `${service.name} booking submitted successfully.`
      }));
      toast.success('OTP sent.');
      navigate('/otp-verification?purpose=new_id_booking');
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Could not send OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={pageShellClass}>
      <div className="mx-auto max-w-6xl">
        <Link to="/dashboard/user/services" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50">
          <FiArrowLeft />
          Back to services
        </Link>

        <section className={`${panelClass} mt-5`}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">National ID Service</p>
          <h1 className="mt-2 text-3xl font-black text-[#0B3A75]">{service?.name || 'Service Booking'}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {service?.description || 'Book this service at your preferred Banaadir service center.'}
          </p>
        </section>

        {loading ? (
          <div className={`${panelClass} mt-5 text-sm font-semibold text-slate-600`}>Loading service...</div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
            <section className={panelClass}>
              <div className="mb-5 flex items-start gap-3 border-b border-blue-100 pb-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FiBriefcase className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-black text-[#0B3A75]">Request Details</h2>
                  <p className="mt-1 text-sm text-slate-600">Choose the center, date, and time for this service.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name" icon={FiUser} value={form.fullName} onChange={(value) => updateForm('fullName', value.replace(/[^A-Za-z\s'-]/g, ''))} />
                <Field label="Phone Number" icon={FiPhone} value={form.phone} onChange={(value) => updateForm('phone', value)} />
                <label className="sm:col-span-2">
                  <span className={labelClass}>Service Center</span>
                  <select value={form.centerId} onChange={(event) => updateForm('centerId', event.target.value)} className={inputClass}>
                    <option value="">Choose any National ID center</option>
                    {centers.map((center) => (
                      <option key={idFrom(center)} value={idFrom(center)}>
                        {center.name}{getDistrict(center) ? ` - ${getDistrict(center)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Appointment Date</span>
                  <input type="date" value={form.date} disabled={!form.centerId} min={todayKey()} max={maxDateKey()} onChange={(event) => updateForm('date', event.target.value)} className={inputClass} />
                </label>
                <label>
                  <span className={labelClass}>Appointment Time</span>
                  <select value={form.timeSlot} disabled={!form.date} onChange={(event) => updateForm('timeSlot', event.target.value)} className={inputClass}>
                    <option value="">Choose a time</option>
                    {availableSlots.map((slot) => {
                      const slotIsFull = bookedSlots.includes(slot);
                      const slotIsPast = isPastTimeSlot(form.date, slot);
                      return (
                        <option key={slot} value={slot} disabled={slotIsFull || slotIsPast}>
                          {slot}{slotIsFull ? ' - Full' : slotIsPast ? ' - Past' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>Notes</span>
                  <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} rows={4} className={`${inputClass} resize-none`} placeholder="Add any extra information for the center." />
                </label>
              </div>
            </section>

            <aside className={`${panelClass} h-fit`}>
              <h2 className="text-lg font-black text-[#0B3A75]">Booking Summary</h2>
              <div className="mt-4 space-y-3">
                <Info label="Service" value={service?.name} />
                <Info label="Center" value={selectedCenter?.name || 'Not selected'} />
                <Info label="District" value={selectedCenter ? getDistrict(selectedCenter) : 'Not selected'} />
                <Info label="Date" value={formatDate(form.date)} />
                <Info label="Time" value={form.timeSlot || 'Not selected'} />
              </div>
              <button disabled={submitting} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Sending OTP...' : 'Submit Request'}
              </button>
            </aside>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, icon: Icon, value, onChange }) => (
  <label>
    <span className={labelClass}>{label}</span>
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} pl-10`} />
    </div>
  </label>
);

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
    <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">{label}</p>
    <p className="mt-1 text-sm font-semibold text-slate-900">{value || 'Not selected'}</p>
  </div>
);

export default GenericServiceBooking;
