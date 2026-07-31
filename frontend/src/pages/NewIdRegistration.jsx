import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  formatSomaliPhone,
  formatDate,
  getDistrict,
  isValidSomaliPhone,
  isBeforeToday,
  isPastTimeSlot,
  maxDateKey,
  todayKey
} from './appointments/appointmentShared';

const pageClass = 'nqs-new-id-page min-h-screen bg-[#F8FAFC] px-3 py-6 text-slate-950 sm:px-5 lg:px-6';
const cardClass = 'nqs-new-id-card rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)] sm:p-6';
const compactCardClass = 'nqs-new-id-receipt-row rounded-xl border border-blue-100 bg-[#F8FAFC] p-3';
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-600';

const BANAADIR_DISTRICTS = [
  'Abdulaziz',
  'Boondheere',
  'Dayniile',
  'Dharkenley',
  'Garasbaaley',
  'Heliwaa',
  'Hodan',
  'Howlwadaag',
  'Kaaraan',
  'Kaxda',
  'Shangaani',
  'Shibis',
  'Waaberi',
  'Wadajir',
  'Wardhiigley',
  'Xamar Jajab',
  'Xamar Weyne',
  'Yaqshiid'
];

const cleanText = (value) => String(value || '').trim();
const cleanSpacedText = (value) => cleanText(value).replace(/\s+/g, ' ');
const idFrom = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return value.id || value._id || '';
  return value;
};
const lettersAndSpacesOnly = (value) => /^[A-Za-z\s]+$/.test(value);
const lettersNumbersSpacesOnly = (value) => /^[A-Za-z0-9\s]+$/.test(value);
const addressCharsOnly = (value) => /^[A-Za-z0-9\s,]+$/.test(value);
const REQUIRED_RESUBMIT_FIELDS = new Set([
  'fullName',
  'motherName',
  'dateOfBirth',
  'phone',
  'gender',
  'maritalStatus',
  'district',
  'nearestLandmark',
  'address',
  'centerId',
  'date',
  'timeSlot'
]);
const NEW_ID_DRAFT_PREFIX = 'nqs_new_id_registration_draft';

const getDraftKey = (user) => `${NEW_ID_DRAFT_PREFIX}:${user?.id || user?._id || user?.username || 'guest'}`;

const emptyNewIdForm = (user = {}) => ({
  fullName: user?.name || '',
  motherName: '',
  dateOfBirth: '',
  age: '',
  phone: formatSomaliPhone(user?.phone),
  gender: '',
  maritalStatus: user?.maritalStatus || '',
  district: '',
  address: user?.address || '',
  nearestLandmark: '',
  centerId: '',
  date: '',
  timeSlot: ''
});

const loadSavedNewIdDraft = (user) => {
  try {
    const saved = localStorage.getItem(getDraftKey(user));
    if (!saved) return emptyNewIdForm(user);
    const parsed = JSON.parse(saved);
    return {
      ...emptyNewIdForm(user),
      ...parsed,
      age: parsed.dateOfBirth ? calculateAge(parsed.dateOfBirth) : parsed.age || ''
    };
  } catch {
    return emptyNewIdForm(user);
  }
};

const hasMinimumWords = (value, minWords = 2) => {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  return words.length >= minWords;
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
  wardhiigleey: 'Wardhiigley',
  wardhigley: 'Wardhiigley',
  wardhigleey: 'Wardhiigley',
  banaadir: 'Hodan'
};

const normalizeDistrictValue = (value, districtOptions = BANAADIR_DISTRICTS) => {
  const key = districtKey(value);
  const directMatch = districtOptions.find((district) => districtKey(district) === key);
  if (directMatch) return directMatch;
  const alias = DISTRICT_ALIASES[key];
  return districtOptions.find((district) => districtKey(district) === districtKey(alias)) || '';
};

const correctionReasonsFromTicket = (ticketOrReason = '') => {
  if (typeof ticketOrReason === 'string') return [ticketOrReason].filter(Boolean);
  const ticket = ticketOrReason || {};
  const reasons = Array.isArray(ticket.cancellationReasons) ? ticket.cancellationReasons : [];
  return [
    ...reasons,
    ticket.cancellationReason,
    ticket.additionalCancellationReason,
    ticket.cancellationNotes
  ].filter(Boolean);
};

const editableFieldsForReason = (ticketOrReason = '') => {
  const value = correctionReasonsFromTicket(ticketOrReason).join(' ').toLowerCase();
  const fields = new Set();

  if (value.includes('first name') || value.includes('middle name') || value.includes('last name') || value.includes('full name') || value.includes('name')) fields.add('fullName');
  if (value.includes('mother')) fields.add('motherName');
  if (value.includes('birth')) fields.add('dateOfBirth');
  if (value.includes('phone')) fields.add('phone');
  if (value.includes('gender')) fields.add('gender');
  if (value.includes('marital')) fields.add('maritalStatus');
  if (value.includes('district')) fields.add('district');
  if (value.includes('address')) fields.add('address');
  if (value.includes('landmark')) fields.add('nearestLandmark');
  if (value.includes('center')) fields.add('centerId');
  if (value.includes('appointment date')) fields.add('date');
  if (value.includes('appointment time')) fields.add('timeSlot');

  return fields.size
    ? fields
    : new Set(['fullName', 'motherName', 'dateOfBirth', 'phone', 'gender', 'maritalStatus', 'district', 'nearestLandmark', 'address', 'centerId', 'date', 'timeSlot']);
};

const unwrapBookingPayload = (payload = {}) => payload?.data?.ticket || payload?.ticket || payload?.data || payload;

const canResubmitTicket = (ticket = {}) => {
  const status = String(ticket.status || '').trim().toLowerCase();
  const requestStatus = String(ticket.requestStatus || '').trim().toLowerCase();
  return (
    ['cancelled', 'canceled', 'needs_correction', 'needs correction', 'correction required', 'resubmitted'].includes(status)
    || ['needs_correction', 'needs correction', 'correction required'].includes(requestStatus)
    || Boolean(ticket.needsResubmission)
  );
};

const isCancelledTicket = canResubmitTicket;

const buildExistingTicketInfo = (ticket = {}) => ({
  ticket: ticket._id || ticket.id || ticket.ref || ticket.ticketNumber || null,
  ticketNumber: ticket.ref || ticket.ticketNumber || '',
  queueNumber: String(ticket.ref || '').split('-').pop() || ticket.queueNumber || '',
  serviceType: ticket.service?.name || ticket.serviceName || 'New National ID Registration',
  centerName: ticket.center?.name || ticket.centerName || ticket.registrationDetails?.selectedCenter || '',
  centerId: idFrom(ticket.center),
  date: ticket.date || ticket.registrationDetails?.appointmentDate || '',
  timeSlot: ticket.timeSlot || ticket.registrationDetails?.appointmentTime || '',
  status: ticket.status || '',
  needsResubmission: Boolean(ticket.needsResubmission),
  cancellationReason: ticket.cancellationReason || '',
  cancellationReasons: ticket.cancellationReasons || [],
  additionalCancellationReason: ticket.additionalCancellationReason || '',
  cancellationNotes: ticket.cancellationNotes || ''
});

const isNewRegistrationRecord = (ticket = {}) => {
  const requestType = String(ticket.requestType || '').toLowerCase();
  const serviceName = String(ticket.service?.name || ticket.serviceName || '').toLowerCase();

  if (requestType === 'new_national_id' || requestType === 'new_registration') return true;
  if (requestType && requestType !== 'national_id_registration') return false;
  if (serviceName.includes('lost') || serviceName.includes('replacement') || serviceName.includes('update')) return false;
  return serviceName.includes('new national id') || serviceName.includes('national id registration');
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

const isFutureDate = (value) => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

const NewIdRegistration = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resubmitId = searchParams.get('resubmit');
  const [services, setServices] = useState([]);
  const [centers, setCenters] = useState([]);
  const [availability, setAvailability] = useState({});
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingExistingRegistration, setCheckingExistingRegistration] = useState(!resubmitId);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [existingTicket, setExistingTicket] = useState(null);
  const [existingRegistrationLocked, setExistingRegistrationLocked] = useState(false);
  const [resubmitTicket, setResubmitTicket] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [confirmedAccuracy, setConfirmedAccuracy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState(() => loadSavedNewIdDraft(user));

  const service = useMemo(() => findService(services, NEW_ID_SERVICE_NAME), [services]);
  const selectedCenter = useMemo(
    () => centers.find((center) => (center._id || center.id) === form.centerId),
    [centers, form.centerId]
  );
  const selectedCenterDistrict = useMemo(
    () => normalizeDistrictValue(getDistrict(selectedCenter)),
    [selectedCenter]
  );
  const districtOptions = useMemo(() => {
    const options = [];
    const addOption = (value) => {
      const label = String(value || '').trim();
      if (label && !options.some((item) => districtKey(item) === districtKey(label))) {
        options.push(label);
      }
    };

    centers.forEach((center) => {
      const rawDistrict = getDistrict(center);
      const normalized = normalizeDistrictValue(rawDistrict, options);
      addOption(normalized || rawDistrict);

      const centerName = String(center?.name || '').trim();
      const isCustomDistrictCenter = centerName && !/national\s+id\s+center/i.test(centerName);
      if (isCustomDistrictCenter) addOption(centerName);
    });

    return options.sort((a, b) => a.localeCompare(b));
  }, [centers]);
  const selectedDistrict = normalizeDistrictValue(form.district, districtOptions);
  const districtCenterOptions = useMemo(() => {
    return [...centers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [centers]);
  const bookedSlots = form.date ? availability[form.date]?.bookedSlots || [] : [];
  const availableDateOptions = useMemo(
    () => Object.entries(availability)
      .filter(([, info]) => info?.status === 'available')
      .map(([date]) => date)
      .sort(),
    [availability]
  );
  const editableFields = useMemo(
    () => (resubmitTicket ? editableFieldsForReason(resubmitTicket) : null),
    [resubmitTicket]
  );
  const canEditField = (field) => {
    if (!editableFields) return true;
    if (editableFields.has(field)) return true;
    if (resubmitTicket && REQUIRED_RESUBMIT_FIELDS.has(field) && !cleanText(form[field])) return true;
    return false;
  };
  const hasIssuedNationalId = ['ACTIVE', 'COMPLETED', 'ISSUED'].includes(String(user?.nationalIdStatus || '').toUpperCase());

  useEffect(() => {
    if (!centers.length || !form.district) return;
    if (normalizeDistrictValue(form.district, districtOptions)) return;
    setForm((current) => ({ ...current, district: '', centerId: '', date: '', timeSlot: '' }));
  }, [centers.length, districtOptions, form.district]);

  useEffect(() => {
    if (ticket) return;
    try {
      localStorage.setItem(getDraftKey(user), JSON.stringify(form));
    } catch {
      // Draft persistence is best-effort only.
    }
  }, [form, ticket, user]);

  const fillFormFromCancelledTicket = useCallback((existing) => {
    const details = existing.registrationDetails || {};
    setResubmitTicket(existing);
    setExistingTicket(null);
    setExistingRegistrationLocked(false);
    setTicket(null);
    setReviewMode(false);
    setConfirmedAccuracy(false);
    setForm({
      fullName: details.fullName || existing.citizenName || user?.name || '',
      motherName: details.motherName || '',
      dateOfBirth: details.dateOfBirth ? String(details.dateOfBirth).slice(0, 10) : '',
      age: details.age || calculateAge(details.dateOfBirth),
          phone: formatSomaliPhone(details.phone || existing.citizen?.phone || user?.phone),
      gender: details.gender || '',
      maritalStatus: details.maritalStatus || '',
      district: normalizeDistrictValue(details.district),
      address: details.fullAddress || details.address || user?.address || '',
      nearestLandmark: details.nearestLandmark || '',
      centerId: idFrom(existing.center),
      date: existing.date ? String(existing.date).slice(0, 10) : '',
      timeSlot: existing.timeSlot || ''
    });
  }, [user?.address, user?.name, user?.phone]);

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
    if (resubmitId) {
      setCheckingExistingRegistration(false);
      return undefined;
    }

    let mounted = true;
    const loadExistingRegistration = async () => {
      try {
        const res = await api.get('/api/bookings/my');
        const records = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
            ? res.data
            : [];
        const existingNewRegistration = records.find((record) => isNewRegistrationRecord(record));
        if (mounted && existingNewRegistration) {
          if (canResubmitTicket(existingNewRegistration)) {
            fillFormFromCancelledTicket(existingNewRegistration);
            return;
          }
          setExistingTicket(buildExistingTicketInfo(existingNewRegistration));
          setExistingRegistrationLocked(true);
        }
      } catch {
        // Backend validation still prevents duplicate registration if this lookup fails.
      } finally {
        if (mounted) {
          setCheckingExistingRegistration(false);
        }
      }
    };

    loadExistingRegistration();
    return () => {
      mounted = false;
    };
  }, [fillFormFromCancelledTicket, resubmitId]);

  useEffect(() => {
    if (!resubmitId || centers.length === 0) return;

    let mounted = true;
    const loadResubmitTicket = async () => {
      try {
        const res = await api.get(`/api/bookings/${resubmitId}`);
        const existing = unwrapBookingPayload(res.data);
        if (!mounted || !existing) return;

        if (!canResubmitTicket(existing)) {
          toast.error('Only cancelled or correction-required appointments can be resubmitted.');
          return;
        }

        fillFormFromCancelledTicket(existing);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Could not load the cancelled appointment.');
      }
    };

    loadResubmitTicket();
    return () => {
      mounted = false;
    };
  }, [centers.length, fillFormFromCancelledTicket, resubmitId]);

  useEffect(() => {
    if (!form.centerId) {
      setAvailability({});
      setAvailableSlots([]);
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
        setAvailableSlots(res.data?.timeSlots?.length ? res.data.timeSlots : []);
      } catch {
        setAvailability({});
        setAvailableSlots([]);
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
    if (!existingRegistrationLocked) {
      setExistingTicket(null);
    }
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'dateOfBirth') {
        next.age = isFutureDate(value) ? '' : calculateAge(value);
        if (isFutureDate(value)) {
          setFieldErrors((errors) => ({ ...errors, dateOfBirth: 'Date of birth cannot be in the future.' }));
        }
      }
      if (field === 'date') {
        next.timeSlot = '';
      }
      if (field === 'district') {
        const normalizedDistrict = normalizeDistrictValue(value, districtOptions);
        if (!current.centerId) {
          const recommendedCenter = centers.find((center) => normalizeDistrictValue(getDistrict(center), districtOptions) === normalizedDistrict);
          next.centerId = recommendedCenter ? (recommendedCenter._id || recommendedCenter.id) : '';
          next.date = '';
          next.timeSlot = '';
        }
      }
      if (field === 'centerId') {
        const center = centers.find((item) => (item._id || item.id) === value);
        const recommendedDistrict = normalizeDistrictValue(getDistrict(center), districtOptions);
        if (recommendedDistrict && canEditField('district')) {
          next.district = recommendedDistrict;
        }
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
    else if (isFutureDate(form.dateOfBirth)) errors.dateOfBirth = 'Date of birth cannot be in the future.';
    else if (!isRealBirthDate(form.dateOfBirth)) errors.dateOfBirth = 'Date of birth must be a real valid date.';

    if (!phone) errors.phone = 'Phone number is required.';
    else if (!isValidSomaliPhone(phone)) errors.phone = 'Enter a valid Somali phone number.';

    if (!form.gender) errors.gender = 'Gender is required.';
    else if (!['Male', 'Female'].includes(form.gender)) errors.gender = 'Gender must be Male or Female.';

    if (!form.maritalStatus) errors.maritalStatus = 'Please select your marital status.';
    else if (!['SINGLE', 'MARRIED'].includes(form.maritalStatus)) errors.maritalStatus = 'Please select your marital status.';

    if (!district) errors.district = 'District is required.';
    else if (!normalizeDistrictValue(district, districtOptions)) errors.district = 'Please select your district from the list.';

    if (!nearestLandmark) errors.nearestLandmark = 'Nearest landmark is required.';
    else if (!lettersNumbersSpacesOnly(nearestLandmark)) errors.nearestLandmark = 'Nearest landmark can contain letters, numbers, and spaces only.';

    if (!address) errors.address = 'Full address is required.';
    else if (!addressCharsOnly(address)) errors.address = 'Full address can contain letters, numbers, spaces, and commas only.';

    if (!form.centerId) errors.centerId = 'Please select a center.';
    if (!form.date) errors.date = 'Please choose an appointment date.';
    else if (isBeforeToday(form.date)) errors.date = 'Past appointment dates cannot be selected.';
    else if (availability[form.date]?.status === 'closed') errors.date = 'This center is not available on this date.';
    else if (availability[form.date]?.status === 'full') errors.date = 'Appointments are full for this date. Please choose another date.';
    if (!form.timeSlot) errors.timeSlot = 'Please choose an appointment time.';
    else if (isPastTimeSlot(form.date, form.timeSlot)) errors.timeSlot = 'Past appointment times cannot be selected.';
    else if (!availableSlots.includes(form.timeSlot)) errors.timeSlot = 'Selected time is outside this center schedule.';
    else if (bookedSlots.includes(form.timeSlot)) errors.timeSlot = 'Appointments are full for this time. Please choose another available slot.';

    return errors;
  };

  const validateForm = () => {
    const errors = getValidationErrors();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error(Object.values(errors)[0] || 'Please correct the highlighted fields.');
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
      phone: formatSomaliPhone(current.phone),
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
      phone: formatSomaliPhone(form.phone),
      gender: form.gender,
      maritalStatus: form.maritalStatus,
      district: cleanSpacedText(form.district),
      address: cleanSpacedText(form.address),
      nearestLandmark: cleanSpacedText(form.nearestLandmark),
      dateOfBirth: form.dateOfBirth,
      age: Number(form.age),
      centerId: idFrom(form.centerId),
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

      const resubmitTicketId = resubmitTicket?._id || resubmitTicket?.id || resubmitTicket?.ref || resubmitId;
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
        localStorage.removeItem(getDraftKey(user));
        toast.success('Appointment resubmitted successfully.');
        return;
      }

      const otpResponse = await api.post('/api/otp/request', {
        purpose: 'new_id_booking',
        phone: cleanForm.phone
      });
      sessionStorage.setItem('nqs_pending_otp_flow', JSON.stringify({
        purpose: 'new_id_booking',
        phone: otpResponse.data?.data?.phone || cleanForm.phone,
        otpId: otpResponse.data?.data?.otpId,
        finalRequest: {
          method: 'post',
          url: '/api/bookings',
          payload
        },
        clearDraftKey: getDraftKey(user),
        successPath: '/dashboard/user/appointments',
        successMessage: 'Booking Successful'
      }));
      localStorage.setItem(getDraftKey(user), JSON.stringify(cleanForm));
      toast.success('OTP sent.');
      navigate('/otp-verification?purpose=new_id_booking');
    } catch (error) {
      const duplicateTicket = error.response?.data?.data?.existingTicket;
      if (error.response?.status === 409 && duplicateTicket) {
        if (canResubmitTicket(duplicateTicket)) {
          const existingTicketId = duplicateTicket.ticket || duplicateTicket._id || duplicateTicket.id || duplicateTicket.ticketNumber || duplicateTicket.ref || duplicateTicket.ticketRef;
          if (existingTicketId) {
            try {
              const detailRes = await apiClient.get(`/api/bookings/${existingTicketId}`);
              fillFormFromCancelledTicket(unwrapBookingPayload(detailRes.data) || duplicateTicket);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            } catch {
              // Fall back to the correction summary if the full ticket cannot be loaded.
            }
          }
          fillFormFromCancelledTicket(duplicateTicket);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        setExistingTicket(duplicateTicket);
        setExistingRegistrationLocked(true);
        setReviewMode(false);
        setConfirmedAccuracy(false);
        return;
      }
      if (error.response?.status === 409) {
        toast.error(error.response?.data?.message || 'You have already registered for a National ID service. Please use your existing ticket or contact support.');
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

  if (loading || checkingExistingRegistration) {
    return (
      <div className={pageClass}>
        <div className="mx-auto max-w-5xl">
          <div className={cardClass}>Checking your appointment record...</div>
        </div>
      </div>
    );
  }

  if (hasIssuedNationalId && !resubmitId && !ticket && !resubmitTicket) {
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
            <div className={`flex items-center gap-2 ${isCancelledTicket(existingTicket) ? 'text-red-600' : 'text-amber-600'}`}>
              <FiCheckCircle />
              <span className="text-sm font-bold">{isCancelledTicket(existingTicket) ? 'Correction required' : 'Existing National ID registration found'}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              {isCancelledTicket(existingTicket) ? 'Correct your cancelled appointment' : 'Use your existing ticket'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {isCancelledTicket(existingTicket)
                ? 'Your previous National ID appointment was cancelled. Please correct the information requested by the office and resubmit the same appointment.'
                : 'You have already registered for a National ID service. Please use your existing ticket or contact support.'}
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
            {isCancelledTicket(existingTicket) && correctionReasonsFromTicket(existingTicket).length > 0 && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="font-black">Admin feedback</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {correctionReasonsFromTicket(existingTicket).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {isCancelledTicket(existingTicket) ? (
                <Link
                  to={`/dashboard/user/new-id-registration?resubmit=${encodeURIComponent(existingTicket.ticket)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
                >
                  Correct and Resubmit
                </Link>
              ) : (
                <>
                  <Link to="/dashboard/user/track" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">
                    <FiClock /> Check Queue Status
                  </Link>
                  <Link to="/dashboard/user/update-information" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50">
                    Update Information
                  </Link>
                  <Link to="/dashboard/user/replace-lost-id" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-50">
                    Replace Lost ID
                  </Link>
                </>
              )}
              {!existingRegistrationLocked && (
                <button
                  type="button"
                  onClick={() => setExistingTicket(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Edit Details
                </button>
              )}
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
                    <Field label="Date of Birth" required type="date" max={todayKey()} icon={<FiCalendar />} value={form.dateOfBirth} error={fieldErrors.dateOfBirth} disabled={!canEditField('dateOfBirth')} onChange={(value) => updateForm('dateOfBirth', value)} />
                    <Field label="Age" required type="number" placeholder="Auto calculated" icon={<FiHash />} value={form.age} readOnly onChange={() => {}} />
                    <PhoneField value={form.phone} error={fieldErrors.phone} disabled={!canEditField('phone')} onChange={(value) => updateForm('phone', formatSomaliPhone(value))} />
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
                    <DistrictSelect value={form.district} districts={districtOptions} error={fieldErrors.district} disabled={!canEditField('district')} onChange={(value) => updateForm('district', value)} />
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
                        disabled={!canEditField('centerId')}
                        onChange={(event) => updateForm('centerId', event.target.value)}
                        className={`${inputClass} ${fieldErrors.centerId ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      >
                        <option value="">Choose any National ID center</option>
                        {districtCenterOptions.map((center) => {
                          const centerDistrict = normalizeDistrictValue(getDistrict(center), districtOptions) || getDistrict(center);
                          return (
                            <option key={center._id || center.id} value={center._id || center.id}>
                              {center.name}{centerDistrict ? ` - ${centerDistrict}` : ''}
                            </option>
                          );
                        })}
                      </select>
                      {fieldErrors.centerId && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.centerId}</p>}
                    </label>
                    <label className="block">
                      <RequiredLabel label="Appointment Date" />
                      <input
                        type="date"
                        value={form.date}
                        disabled={!canEditField('date') || !form.centerId}
                        min={todayKey()}
                        max={maxDateKey()}
                        onChange={(event) => updateForm('date', event.target.value)}
                        className={`${inputClass} ${fieldErrors.date ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                      />
                      {form.centerId && availableDateOptions.length === 0 && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600">No available dates for this center in the next 12 months.</p>
                      )}
                      {form.date && availability[form.date]?.status === 'closed' && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600">This center is not available on this date.</p>
                      )}
                      {form.date && availability[form.date]?.status === 'full' && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600">Appointments are full for this date. Please choose another date.</p>
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
                        {availableSlots.map((slot) => {
                          const slotIsFull = bookedSlots.includes(slot);
                          const slotIsPast = isPastTimeSlot(form.date, slot);
                          return (
                            <option
                              key={slot}
                              value={slot}
                              disabled={!form.date || availability[form.date]?.status !== 'available' || slotIsFull || slotIsPast}
                            >
                              {slot}{slotIsFull ? ' - Full' : slotIsPast ? ' - Past' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {form.centerId && availableSlots.length === 0 && (
                        <p className="mt-1.5 text-xs font-semibold text-amber-600">No appointment times are configured for this center.</p>
                      )}
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
                <Info label="District" value={selectedDistrict || 'Not selected'} />
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

const DistrictSelect = ({ value, onChange, disabled = false, error = '', districts = BANAADIR_DISTRICTS }) => {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredDistricts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return districts;
    return districts.filter((district) => district.toLowerCase().includes(term));
  }, [districts, query]);

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
    const selectedIndex = districts.findIndex((district) => district === value);
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
                    <span className="flex min-w-0 items-center gap-2">
                      <span>{district}</span>
                    </span>
                    {value === district && <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />}
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

const phoneTailFromValue = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('25261')) return digits.slice(5, 12);
  if (digits.startsWith('061')) return digits.slice(3, 10);
  if (digits.startsWith('61')) return digits.slice(2, 9);
  return digits.slice(0, 7);
};

const PhoneField = ({ value, onChange, error = '', disabled = false }) => (
  <label className="block">
    <RequiredLabel label="Phone Number" required />
    <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
      <span className="flex items-center gap-2 border-r border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700">
        <FiPhone className="h-4 w-4 text-slate-400" />
        +252 61
      </span>
      <input
        type="tel"
        value={phoneTailFromValue(value)}
        inputMode="numeric"
        maxLength={7}
        disabled={disabled}
        placeholder="8318172"
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 7))}
        className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
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
