import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiDownload,
  FiHash,
  FiHome,
  FiMap,
  FiNavigation,
  FiPhone,
  FiShield,
  FiUser,
  FiUsers
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import { downloadTicketPdf } from '../utils/ticketPdf';
import {
  NEW_ID_SERVICE_NAME,
  activeCenters,
  calculateAge,
  findService,
  formatDate,
  getDistrict,
  maxDateKey,
  timeSlots,
  todayKey
} from './appointments/appointmentShared';

const pageClass = 'nqs-new-id-page min-h-screen bg-[#F8FAFC] px-3 py-6 text-slate-950 sm:px-5 lg:px-6';
const cardClass = 'nqs-new-id-card rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] sm:p-6';
const compactCardClass = 'nqs-new-id-receipt-row rounded-xl border border-blue-100 bg-[#F8FAFC] p-3';
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-600';

const BANAADIR_DISTRICTS = [
  'Hodan',
  'Howlwadaag',
  'Wadajir',
  'Dharkenley',
  'Dayniile',
  'Heliwaa',
  'Yaqshiid',
  'Kaaraan',
  'Shibis',
  'Boondheere',
  'Xamar Weyne',
  'Xamar Jajab',
  'Waaberi',
  'Wardhiigley',
  'Abdulaziz',
  'Shangaani',
  'Kaxda',
  'Garasbaaley'
];

const cleanText = (value) => String(value || '').trim();
const cleanSpacedText = (value) => cleanText(value).replace(/\s+/g, ' ');
const lettersAndSpacesOnly = (value) => /^[A-Za-z\s]+$/.test(value);
const lettersNumbersSpacesOnly = (value) => /^[A-Za-z0-9\s]+$/.test(value);
const addressCharsOnly = (value) => /^[A-Za-z0-9\s,]+$/.test(value);
const somaliPhoneRegex = /^(61|62|63|65|66|68|69)\d{7}$/;

const hasMinimumWords = (value, minWords = 2) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  return words.length >= minWords;
};

const isValidSomaliPhone = (value) => {
  return somaliPhoneRegex.test(cleanText(value));
};

const districtKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/\bdistrict\b/g, '')
  .replace(/[^a-z0-9]/g, '');

const DISTRICT_ALIASES = {
  hamarweyne: 'Xamar Weyne',
  hamarjajab: 'Xamar Jajab',
  hawlwadaag: 'Howlwadaag',
  waberi: 'Waaberi',
  karan: 'Kaaraan',
  karaan: 'Kaaraan',
  banaadir: 'Hodan'
};

const normalizeDistrictValue = (value) => {
  const key = districtKey(value);
  return BANAADIR_DISTRICTS.find((district) => districtKey(district) === key) || DISTRICT_ALIASES[key] || '';
};

const editableFieldsForReason = (reason = '') => {
  const value = String(reason).toLowerCase();
  if (value.includes('mother')) return new Set(['motherName']);
  if (value.includes('birth')) return new Set(['dateOfBirth']);
  if (value.includes('phone')) return new Set(['phone']);
  if (value.includes('marital')) return new Set(['maritalStatus']);
  if (value.includes('name')) return new Set(['fullName']);
  return new Set(['fullName', 'motherName', 'dateOfBirth', 'phone', 'gender', 'maritalStatus', 'district', 'nearestLandmark', 'address', 'centerId', 'date', 'timeSlot']);
};

const isRealBirthDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  const today = new Date();

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day &&
    parsed <= today &&
    year >= today.getFullYear() - 120
  );
};

const NewIdRegistration = () => {
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
  const [existingTicket, setExistingTicket] = useState(null);
  const [resubmitTicket, setResubmitTicket] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [confirmedAccuracy, setConfirmedAccuracy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    fullName: user?.name || '',
    motherName: '',
    dateOfBirth: '',
    age: '',
    phone: user?.phone || '',
    gender: '',
    maritalStatus: user?.maritalStatus || '',
    district: '',
    address: user?.address || '',
    nearestLandmark: '',
    centerId: '',
    date: '',
    timeSlot: ''
  });

  const service = useMemo(() => findService(services, NEW_ID_SERVICE_NAME), [services]);
  const selectedCenter = useMemo(
    () => centers.find((center) => (center._id || center.id) === form.centerId),
    [centers, form.centerId]
  );
  const selectedDistrict = normalizeDistrictValue(form.district);
  const filteredCenters = useMemo(
    () => centers.filter((center) => normalizeDistrictValue(getDistrict(center)) === selectedDistrict),
    [centers, selectedDistrict]
  );
  const bookedSlots = form.date ? availability[form.date]?.bookedSlots || [] : [];
  const availableDateOptions = useMemo(
    () => Object.entries(availability)
      .filter(([, info]) => info?.status === 'available')
      .map(([date]) => date)
      .sort(),
    [availability]
  );
  const editableFields = useMemo(
    () => (resubmitTicket ? editableFieldsForReason(resubmitTicket.cancellationReason) : null),
    [resubmitTicket]
  );
  const canEditField = (field) => !editableFields || editableFields.has(field);
  const hasIssuedNationalId = Boolean(user?.nationalId || ['ACTIVE', 'COMPLETED'].includes(user?.nationalIdStatus));

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
        toast.error(error.response?.data?.message || 'Could not load appointment options.');
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

        const details = existing.registrationDetails || {};
        setResubmitTicket(existing);
        setExistingTicket(null);
        setTicket(null);
        setReviewMode(false);
        setConfirmedAccuracy(false);
        setForm({
          fullName: details.fullName || existing.citizenName || user?.name || '',
          motherName: details.motherName || '',
          dateOfBirth: details.dateOfBirth ? String(details.dateOfBirth).slice(0, 10) : '',
          age: details.age || calculateAge(details.dateOfBirth),
          phone: details.phone || existing.citizen?.phone || user?.phone || '',
          gender: details.gender || '',
          maritalStatus: details.maritalStatus || '',
          district: normalizeDistrictValue(details.district),
          address: details.fullAddress || details.address || user?.address || '',
          nearestLandmark: details.nearestLandmark || '',
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
  }, [resubmitId, centers.length, user?.address, user?.name, user?.phone]);

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
    if (!canEditField(field)) return;
    setConfirmedAccuracy(false);
    setExistingTicket(null);
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'dateOfBirth') {
        next.age = calculateAge(value);
      }
      if (field === 'date') {
        next.timeSlot = '';
      }
      if (field === 'district') {
        next.centerId = '';
        next.date = '';
        next.timeSlot = '';
      }
      if (field === 'centerId') {
        next.date = '';
        next.timeSlot = '';
      }
      return next;
    });
  };

  const getValidationErrors = () => {
    const errors = {};
    const fullName = cleanSpacedText(form.fullName);
    const motherName = cleanSpacedText(form.motherName);
    const phone = cleanText(form.phone);
    const district = cleanSpacedText(form.district);
    const nearestLandmark = cleanSpacedText(form.nearestLandmark);
    const address = cleanSpacedText(form.address);

    if (!fullName) errors.fullName = 'Full name is required.';
    else if (!lettersAndSpacesOnly(fullName)) errors.fullName = 'Full Name must contain letters only.';
    else if (fullName.length < 5) errors.fullName = 'Full Name must be at least 5 characters.';
    else if (!hasMinimumWords(fullName)) errors.fullName = 'Full Name must contain at least two words.';

    if (!motherName) errors.motherName = "Mother's name is required.";
    else if (!lettersAndSpacesOnly(motherName)) errors.motherName = "Mother's Name must contain letters only.";
    else if (!hasMinimumWords(motherName)) errors.motherName = "Mother's Name must contain at least two words.";

    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.';
    else if (!isRealBirthDate(form.dateOfBirth)) errors.dateOfBirth = 'Date of birth must be a real past date.';
    else if (Number(calculateAge(form.dateOfBirth)) < 18) errors.dateOfBirth = 'You must be at least 18 years old to book this service.';

    if (!phone) errors.phone = 'Phone number is required.';
    else if (!isValidSomaliPhone(phone)) errors.phone = 'Enter a valid Somali phone number.';

    if (!form.gender) errors.gender = 'Gender is required.';
    else if (!['Male', 'Female'].includes(form.gender)) errors.gender = 'Gender must be Male or Female.';

    if (!form.maritalStatus) errors.maritalStatus = 'Please select your marital status.';
    else if (!['SINGLE', 'MARRIED'].includes(form.maritalStatus)) errors.maritalStatus = 'Please select your marital status.';

    if (!district) errors.district = 'District is required.';
    else if (!normalizeDistrictValue(district)) errors.district = 'Please select your district from the official Banaadir district list.';

    if (!nearestLandmark) errors.nearestLandmark = 'Nearest landmark is required.';
    else if (!lettersNumbersSpacesOnly(nearestLandmark)) errors.nearestLandmark = 'Nearest landmark can contain letters, numbers, and spaces only.';

    if (!address) errors.address = 'Full address is required.';
    else if (!addressCharsOnly(address)) errors.address = 'Full address can contain letters, numbers, spaces, and commas only.';

    if (!form.centerId) errors.centerId = 'Please select a center.';
    else if (selectedCenter && normalizeDistrictValue(getDistrict(selectedCenter)) !== normalizeDistrictValue(form.district)) {
      errors.centerId = 'The selected center does not belong to the selected district.';
    }
    if (!form.date) errors.date = 'Please choose an appointment date.';
    else if (availability[form.date]?.status === 'closed') errors.date = 'This center is not available on this date.';
    else if (availability[form.date]?.status === 'full') errors.date = 'Appointments are full for this date. Please choose another date.';
    if (!form.timeSlot) errors.timeSlot = 'Please choose an appointment time.';
    else if (bookedSlots.includes(form.timeSlot)) errors.timeSlot = 'Appointments are full for this time. Please choose another available slot.';

    return errors;
  };

  const validateForm = () => {
    const errors = getValidationErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error('Please correct the highlighted fields.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!service) {
      toast.error('New National ID Registration is not available right now.');
      return;
    }
    if (!validateForm()) return;
    if (!reviewMode) {
      setForm((current) => ({
        ...current,
        fullName: cleanSpacedText(current.fullName),
        motherName: cleanSpacedText(current.motherName),
        phone: cleanText(current.phone),
        district: cleanSpacedText(current.district),
        address: cleanSpacedText(current.address),
        nearestLandmark: cleanSpacedText(current.nearestLandmark)
      }));
      setReviewMode(true);
      setConfirmedAccuracy(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!confirmedAccuracy) {
      toast.error('Please confirm that the information you provided is true and accurate.');
      return;
    }

    const cleanForm = {
      fullName: cleanSpacedText(form.fullName),
      motherName: cleanSpacedText(form.motherName),
      phone: cleanText(form.phone),
      gender: form.gender,
      maritalStatus: form.maritalStatus,
      district: cleanSpacedText(form.district),
      address: cleanSpacedText(form.address),
      nearestLandmark: cleanSpacedText(form.nearestLandmark),
      dateOfBirth: form.dateOfBirth,
      age: Number(form.age),
      centerId: form.centerId,
      date: form.date,
      timeSlot: form.timeSlot
    };

    setSubmitting(true);
    try {
      const payload = {
        serviceId: service._id || service.id,
        centerId: cleanForm.centerId,
        date: cleanForm.date,
        timeSlot: cleanForm.timeSlot,
        citizenName: cleanForm.fullName,
        registrationDetails: {
          fullName: cleanForm.fullName,
          motherName: cleanForm.motherName,
          dateOfBirth: cleanForm.dateOfBirth,
          age: cleanForm.age,
          phone: cleanForm.phone,
          gender: cleanForm.gender,
          maritalStatus: cleanForm.maritalStatus,
          district: cleanForm.district,
          address: cleanForm.address,
          fullAddress: cleanForm.address,
          nearestLandmark: cleanForm.nearestLandmark,
          selectedCenter: selectedCenter?.name || '',
          centerDistrict: selectedCenter ? getDistrict(selectedCenter) : '',
          appointmentDate: cleanForm.date,
          appointmentTime: cleanForm.timeSlot
        }
      };

      const resubmitTicketId = resubmitTicket?._id || resubmitTicket?.id;
      if (resubmitTicketId) {
        const res = await apiClient.put(`/api/bookings/${resubmitTicketId}/resubmit`, payload);
        setTicket({
          ...(res.data || {}),
          service: 'New National ID Registration',
          center: selectedCenter?.name,
          date: cleanForm.date,
          timeSlot: cleanForm.timeSlot,
          status: res.data?.status || 'Waiting'
        });
        setResubmitTicket(null);
        toast.success('Appointment resubmitted successfully.');
        return;
      }

      const res = await apiClient.post('/api/bookings', {
        ...payload
      });
      setTicket({
        ...(res.data || {}),
        service: 'New National ID Registration',
        center: selectedCenter?.name,
        date: cleanForm.date,
        timeSlot: cleanForm.timeSlot,
        status: res.data?.status || 'Waiting'
      });
      toast.success('Appointment created successfully.');
    } catch (error) {
      const duplicateTicket = error.response?.data?.data?.existingTicket;
      if (error.response?.status === 409 && duplicateTicket) {
        setExistingTicket(duplicateTicket);
        setReviewMode(false);
        setConfirmedAccuracy(false);
        return;
      }
      if (error.response?.status === 409) {
        return;
      }
      toast.error(error.response?.data?.message || 'Could not create the appointment.');
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
      <div className={pageClass}>
        <div className="mx-auto max-w-5xl">
          <div className={cardClass}>Loading appointment form...</div>
        </div>
      </div>
    );
  }

  if (hasIssuedNationalId && !resubmitId && !ticket) {
    return (
      <div className={pageClass}>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <FiShield className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-black text-slate-950">National ID already issued</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
              You already have a National ID. You cannot register for a new National ID. You may only update your information or request a replacement for a lost ID.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/dashboard/user/update-information" className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800">
                Update Information
              </Link>
              <Link to="/dashboard/user/replace-lost-id" className="inline-flex items-center justify-center rounded-xl border border-blue-200 px-5 py-3 text-sm font-black text-blue-700 hover:bg-blue-50">
                Replace Lost ID
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageClass}>
      <div className="mx-auto max-w-7xl space-y-6">
        <Link to="/services" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-[#0B3A75]">
          <FiArrowLeft /> Back to services
        </Link>

        <section className="nqs-new-id-hero rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                National ID Registration
              </span>
              <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight text-[#0B3A75] sm:text-4xl">
                {resubmitTicket ? 'Resubmit New National ID Appointment' : 'Apply for a New National ID'}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                {resubmitTicket
                  ? 'Correct the information requested by the admin and submit your appointment again.'
                  : 'Complete your citizen details, choose a Banaadir National ID center, and confirm your appointment.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[420px]">
              {['Citizen details', 'Center', 'Date & time', 'Confirm'].map((step, index) => (
                <div key={step} className="rounded-2xl border border-blue-100 bg-[#F8FAFC] p-3 text-center">
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                    {index + 1}
                  </div>
                  <p className="mt-2 text-xs font-black text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {resubmitTicket && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            <p className="text-xs font-black uppercase tracking-wide text-red-600">Correction required</p>
            <p className="mt-1 text-sm font-semibold">
              Your appointment {resubmitTicket.ref} was cancelled. Reason: {resubmitTicket.cancellationReason || 'Please correct your information and resubmit your appointment.'}
            </p>
          </section>
        )}

        {ticket ? (
          <section className={`${cardClass} grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]`}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Appointment QR code" className="mx-auto h-44 w-44 object-contain" />
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-500">Generating QR code...</div>
              )}
            </div>
            <div>
              <div className="mb-4 flex items-center gap-2 text-emerald-600">
                <FiCheckCircle />
                <span className="text-sm font-bold">Appointment confirmed</span>
              </div>
              <h2 className="font-mono text-3xl font-black">{ticket.ref}</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Info label="Service" value="New National ID Registration" />
                <Info label="Center" value={ticket.center} />
                <Info label="Date" value={formatDate(ticket.date)} />
                <Info label="Time" value={ticket.timeSlot} />
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button onClick={handleDownload} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">
                  <FiDownload /> Download Ticket
                </button>
                <Link to="/dashboard/user/track" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <FiClock /> Check Queue Status
                </Link>
              </div>
            </div>
          </section>
        ) : existingTicket ? (
          <section className={cardClass}>
            <div className="flex items-center gap-2 text-amber-600">
              <FiCheckCircle />
              <span className="text-sm font-bold">Existing National ID registration found</span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">Use your existing ticket</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              You have already registered for a National ID service. Please use your existing ticket or contact support.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Ticket Number" value={existingTicket.ticketNumber} />
              <Info label="Queue Number" value={existingTicket.queueNumber} />
              <Info label="Service Type" value={existingTicket.serviceType} />
              <Info label="Center" value={existingTicket.centerName} />
              <Info label="Date" value={formatDate(existingTicket.date)} />
              <Info label="Time" value={existingTicket.timeSlot} />
              <Info label="Status" value={existingTicket.status} />
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link to="/dashboard/user/track" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">
                <FiClock /> Check Queue Status
              </Link>
              <button
                type="button"
                onClick={() => setExistingTicket(null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Edit Details
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className={cardClass}>
              {reviewMode ? (
                <div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          <FiShield className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-2xl font-black text-[#0B3A75]">Confirm Appointment Details</h2>
                          <p className="mt-1 text-sm text-slate-600">
                        Please check every detail before creating your appointment.
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewMode(false);
                        setConfirmedAccuracy(false);
                      }}
                      className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                    >
                      Edit Information
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ReviewItem label="Full Name" value={form.fullName} />
                    <ReviewItem label="Mother's Name" value={form.motherName} />
                    <ReviewItem label="Date of Birth" value={formatDate(form.dateOfBirth)} />
                    <ReviewItem label="Age" value={form.age} />
                    <ReviewItem label="Gender" value={form.gender} />
                    <ReviewItem label="Marital Status" value={form.maritalStatus === 'SINGLE' ? 'Single' : form.maritalStatus === 'MARRIED' ? 'Married' : ''} />
                    <ReviewItem label="Phone Number" value={form.phone} />
                    <ReviewItem label="District" value={form.district} />
                    <ReviewItem label="Full Address" value={form.address} />
                    <ReviewItem label="Nearest Landmark" value={form.nearestLandmark} />
                    <ReviewItem label="Selected National ID Center" value={selectedCenter?.name} />
                    <ReviewItem label="Appointment Date" value={formatDate(form.date)} />
                    <ReviewItem label="Appointment Time" value={form.timeSlot} />
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={confirmedAccuracy}
                      onChange={(event) => setConfirmedAccuracy(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-500 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span>I confirm that the information I provided is true and accurate.</span>
                  </label>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex items-start gap-3 border-b border-blue-100 pb-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <FiUser className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-2xl font-black text-[#0B3A75]">Citizen Information</h2>
                      <p className="mt-1 text-sm text-slate-600">Fill in the citizen details exactly as they should appear on the National ID record.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Full Name" required placeholder="Rakia Gaashaan Ibrahim" icon={<FiUser />} value={form.fullName} error={fieldErrors.fullName} disabled={!canEditField('fullName')} onChange={(value) => updateForm('fullName', value)} />
                    <Field label="Mother's Name" required placeholder="Amina Mohamed Ali" icon={<FiUsers />} value={form.motherName} error={fieldErrors.motherName} disabled={!canEditField('motherName')} onChange={(value) => updateForm('motherName', value)} />
                    <Field label="Date of Birth" required type="date" icon={<FiCalendar />} value={form.dateOfBirth} error={fieldErrors.dateOfBirth} disabled={!canEditField('dateOfBirth')} onChange={(value) => updateForm('dateOfBirth', value)} />
                    <Field label="Age" required type="number" placeholder="Auto calculated" icon={<FiHash />} value={form.age} readOnly onChange={() => {}} />
                    <Field label="Phone Number" required type="tel" placeholder="618467774" icon={<FiPhone />} value={form.phone} error={fieldErrors.phone} inputMode="numeric" maxLength={9} disabled={!canEditField('phone')} onChange={(value) => updateForm('phone', value)} />
                    <label className="block">
                      <RequiredLabel label="Gender" />
                      <select
                        value={form.gender}
                        disabled={!canEditField('gender')}
                        onChange={(event) => updateForm('gender', event.target.value)}
                        className={`${inputClass} ${fieldErrors.gender ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                      {fieldErrors.gender && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.gender}</p>}
                    </label>
                    <label className="block">
                      <RequiredLabel label="Marital Status" />
                      <select
                        value={form.maritalStatus}
                        disabled={!canEditField('maritalStatus')}
                        onChange={(event) => updateForm('maritalStatus', event.target.value)}
                        className={`${inputClass} ${fieldErrors.maritalStatus ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      >
                        <option value="">Select Marital Status</option>
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                      </select>
                      {fieldErrors.maritalStatus && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.maritalStatus}</p>}
                    </label>
                    <DistrictSelect value={form.district} error={fieldErrors.district} disabled={!canEditField('district')} onChange={(value) => updateForm('district', value)} />
                    <Field label="Nearest Landmark" required placeholder="KM4" icon={<FiNavigation />} value={form.nearestLandmark} error={fieldErrors.nearestLandmark} disabled={!canEditField('nearestLandmark')} onChange={(value) => updateForm('nearestLandmark', value)} />
                    <label className="sm:col-span-2">
                      <RequiredLabel label="Full Address" />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-4 text-slate-400">
                          <FiHome className="h-4 w-4" />
                        </span>
                        <textarea
                        value={form.address}
                        disabled={!canEditField('address')}
                        onChange={(event) => updateForm('address', event.target.value)}
                          rows={3}
                          placeholder="Hodan District, Near KM4, Mogadishu"
                          className={`${inputClass} min-h-[96px] resize-none pl-10 ${fieldErrors.address ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                        />
                      </div>
                      {fieldErrors.address && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.address}</p>}
                    </label>
                  </div>

                  <div className="mb-5 mt-8 flex items-start gap-3 border-b border-blue-100 pb-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <FiBriefcase className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-2xl font-black text-[#0B3A75]">Appointment Details</h2>
                      <p className="mt-1 text-sm text-slate-600">Choose where and when you want to visit.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                      <RequiredLabel label="Selected National ID Center" />
                      <select
                        value={form.centerId}
                        disabled={!canEditField('centerId') || !selectedDistrict}
                        onChange={(event) => updateForm('centerId', event.target.value)}
                        className={`${inputClass} ${fieldErrors.centerId ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      >
                        <option value="">{selectedDistrict ? `Choose a ${selectedDistrict} center` : 'Select your district first'}</option>
                        {filteredCenters.map((center) => (
                          <option key={center._id || center.id} value={center._id || center.id}>
                            {center.name}
                          </option>
                        ))}
                      </select>
                      {selectedDistrict && filteredCenters.length === 0 && (
                        <p className="mt-1 text-xs font-semibold text-amber-600">No active National ID centers found for {selectedDistrict}.</p>
                      )}
                      {fieldErrors.centerId && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.centerId}</p>}
                    </label>
                    <label className="block">
                      <RequiredLabel label="Appointment Date" />
                      <select
                        value={form.date}
                        disabled={!canEditField('date') || !form.centerId}
                        onChange={(event) => updateForm('date', event.target.value)}
                        className={`${inputClass} ${fieldErrors.date ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      >
                        <option value="">{form.centerId ? 'Choose an available date' : 'Select a center first'}</option>
                        {availableDateOptions.map((date) => (
                          <option key={date} value={date}>{formatDate(date)}</option>
                        ))}
                      </select>
                      {form.centerId && availableDateOptions.length === 0 && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600">No available dates for this center in the next 30 days.</p>
                      )}
                      {fieldErrors.date && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.date}</p>}
                    </label>
                    <label className="block">
                      <RequiredLabel label="Appointment Time" />
                      <select
                        value={form.timeSlot}
                        disabled={!canEditField('timeSlot')}
                        onChange={(event) => updateForm('timeSlot', event.target.value)}
                        className={`${inputClass} ${fieldErrors.timeSlot ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      >
                        <option value="">Choose a time</option>
                        {availableSlots.map((slot) => (
                          <option key={slot} value={slot} disabled={!form.date || availability[form.date]?.status !== 'available' || bookedSlots.includes(slot)}>
                            {slot}{bookedSlots.includes(slot) ? ' - Full' : ''}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.timeSlot && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.timeSlot}</p>}
                    </label>
                  </div>
                </>
              )}
            </section>

            <aside className={`${cardClass} h-fit lg:sticky lg:top-24`}>
              <div className="rounded-2xl border border-blue-100 bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Government service receipt</p>
                <h2 className="mt-2 text-2xl font-black text-[#0B3A75]">Booking Summary</h2>
                <p className="mt-1 text-sm text-slate-600">Your selected appointment details.</p>
              </div>
              <div className="mt-4 space-y-3">
                <Info label="Service" value="New National ID Registration" />
                <Info label="Center" value={selectedCenter?.name || 'Not selected'} />
                <Info label="District" value={selectedCenter ? getDistrict(selectedCenter) : 'Not selected'} />
                <Info label="Date" value={formatDate(form.date)} />
                <Info label="Time" value={form.timeSlot || 'Not selected'} />
                <Info label="Status" value={resubmitTicket ? 'Cancelled - correction required' : (reviewMode ? 'Ready for confirmation' : 'Draft')} />
              </div>
              <div className="mt-5 space-y-3">
                <button
                  disabled={submitting || (reviewMode && !confirmedAccuracy)}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
                    reviewMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting ? 'Submitting...' : reviewMode ? (resubmitTicket ? 'Resubmit Appointment' : 'Confirm Appointment') : 'Next'}
                </button>
                {reviewMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewMode(false);
                      setConfirmedAccuracy(false);
                    }}
                    className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    Previous
                  </button>
                ) : (
                  <Link
                    to="/services"
                    className="block w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    Previous
                  </Link>
                )}
              </div>
            </aside>
          </form>
        )}
      </div>
    </div>
  );
};

const RequiredLabel = ({ label, required = true }) => (
  <span className={labelClass}>
    {label}
    {required && <span className="ml-1 text-red-600">*</span>}
  </span>
);

const DistrictSelect = ({ value, onChange, disabled = false, error = '' }) => {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredDistricts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return BANAADIR_DISTRICTS;
    return BANAADIR_DISTRICTS.filter((district) => district.toLowerCase().includes(term));
  }, [query]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen, value]);

  useEffect(() => {
    if (activeIndex >= filteredDistricts.length) setActiveIndex(0);
  }, [activeIndex, filteredDistricts.length]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [value]);

  const selectDistrict = (district) => {
    onChange(district);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(0);
  };

  const openDropdown = () => {
    if (disabled) return;
    const selectedIndex = BANAADIR_DISTRICTS.findIndex((district) => district === value);
    setQuery('');
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const clearDistrict = () => {
    onChange('');
    setQuery('');
    setActiveIndex(0);
    setIsOpen(true);
  };

  const handleSearchChange = (event) => {
    setQuery(event.target.value);
    setIsOpen(true);
    setActiveIndex(0);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (!isOpen && ['ArrowDown', 'Enter'].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (filteredDistricts.length ? (current + 1) % filteredDistricts.length : 0));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (filteredDistricts.length ? (current - 1 + filteredDistricts.length) % filteredDistricts.length : 0));
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredDistricts[activeIndex]) selectDistrict(filteredDistricts[activeIndex]);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setQuery(value || '');
    }
  };

  return (
    <label className="block" ref={wrapperRef}>
      <RequiredLabel label="District Where You Live" />
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
          <FiMap className="h-4 w-4" />
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="district-options"
          aria-autocomplete="list"
          value={isOpen ? query : value}
          disabled={disabled}
          placeholder="Select your district"
          autoComplete="off"
          onFocus={openDropdown}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          className={`${inputClass} pl-10 ${value && !disabled ? 'pr-20' : 'pr-10'} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={clearDistrict}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-blue-700"
            aria-label="Clear selected district"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              setQuery('');
            } else {
              openDropdown();
            }
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
          aria-label="Show Banaadir districts"
        >
          <FiChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div
            id="district-options"
            role="listbox"
            className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-blue-100 bg-white p-1 shadow-xl"
          >
            {filteredDistricts.length ? (
              <>
                {value && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clearDistrict}
                    className="mb-1 flex w-full items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-blue-700 transition hover:bg-blue-100"
                  >
                    Change selected district
                    <span className="normal-case tracking-normal text-slate-500">{value}</span>
                  </button>
                )}
                {filteredDistricts.map((district, index) => (
                  <button
                    key={district}
                    type="button"
                    role="option"
                    aria-selected={value === district}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectDistrict(district)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
                      index === activeIndex ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{district}</span>
                    {value === district && <FiCheckCircle className="h-4 w-4 text-emerald-600" />}
                  </button>
                ))}
              </>
            ) : (
              <div className="px-3 py-3 text-sm font-semibold text-slate-500">No district found.</div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </label>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
  disabled = false,
  min,
  max,
  error = '',
  inputMode,
  maxLength,
  icon,
  placeholder = '',
  required = false
}) => (
  <label className="block">
    <RequiredLabel label={label} required={required} />
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {React.cloneElement(icon, { className: 'h-4 w-4' })}
        </span>
      )}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        inputMode={inputMode}
        maxLength={maxLength}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} ${icon ? 'pl-10' : ''} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
      />
    </div>
    {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
  </label>
);

const Info = ({ label, value }) => (
  <div className={compactCardClass}>
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-950">{value || 'Not selected'}</p>
  </div>
);

const ReviewItem = ({ label, value }) => (
  <div className={compactCardClass}>
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-950">{value || '--'}</p>
  </div>
);

export default NewIdRegistration;
