import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaBuilding,
  FaCalendarAlt,
  FaClipboardList,
  FaEdit,
  FaKey,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes,
  FaTrashAlt
} from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const localDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayDateKey = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return localDateKey(today);
};

const isPastDateKey = (date = '') => /^\d{4}-\d{2}-\d{2}$/.test(date) && date < todayDateKey();

const districtFromCenterName = (name = '') => {
  const normalized = String(name).replace(/\s+National ID Center$/i, '').trim();
  if (/^Banaadir$/i.test(normalized)) return 'Hodan';
  if (/^Hamar Weyne$/i.test(normalized)) return 'Xamar Weyne';
  if (/^Hamar Jajab$/i.test(normalized)) return 'Xamar Jajab';
  if (/^Waberi$/i.test(normalized)) return 'Waaberi';
  if (/^Hawl-Wadaag$/i.test(normalized)) return 'Howlwadaag';
  return normalized;
};

const displayCenterName = (center = {}) => {
  const name = String(center.name || '').trim();
  const district = center.district || districtFromCenterName(name);

  if (/^Banaadir National ID Center$/i.test(name) && district) {
    return `${district} National ID Center`;
  }

  return name || `${district} National ID Center`;
};

const defaultSchedule = {
  workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  startTime: '08:00',
  endTime: '16:00',
  breakTime: { start: '', end: '' },
  slotDuration: 30,
  maxBookingsPerSlot: 5,
  maxAppointmentsPerDay: 100,
  closedDays: ['Friday'],
  closedDates: [],
  isActive: true
};

const createDefaultSchedule = () => ({
  ...defaultSchedule,
  workingDays: [...defaultSchedule.workingDays],
  breakTime: { ...defaultSchedule.breakTime },
  closedDays: [...defaultSchedule.closedDays],
  closedDates: []
});

const createEmptyForm = () => ({
  name: '',
  district: '',
  address: '',
  city: 'Banaadir',
  phone: '',
  counters: 1,
  capacity: 100,
  hours: '08:00 - 16:00',
  status: 'Active',
  schedule: createDefaultSchedule(),
  managerCredentials: {
    name: '',
    username: '',
    phone: '',
    temporaryPassword: ''
  }
});

const normalizeSchedule = (schedule = {}) => {
  const workingDays = Array.isArray(schedule.workingDays) && schedule.workingDays.length
    ? [...schedule.workingDays]
    : [...defaultSchedule.workingDays];

  return {
    ...defaultSchedule,
    ...schedule,
    breakTime: {
      start: schedule.breakTime?.start || '',
      end: schedule.breakTime?.end || ''
    },
    workingDays,
    closedDays: Array.isArray(schedule.closedDays) && schedule.closedDays.length
      ? [...schedule.closedDays]
      : WEEK_DAYS.filter((day) => !workingDays.includes(day)),
    closedDates: Array.isArray(schedule.closedDates) ? [...schedule.closedDates] : [],
    slotDuration: Number(schedule.slotDuration || defaultSchedule.slotDuration),
    maxBookingsPerSlot: Number(schedule.maxBookingsPerSlot || defaultSchedule.maxBookingsPerSlot),
    maxAppointmentsPerDay: Number(schedule.maxAppointmentsPerDay || defaultSchedule.maxAppointmentsPerDay),
    isActive: schedule.isActive !== false
  };
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
      {label}
    </span>
    {children}
  </label>
);

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400';

const credentialUsernameFrom = (center = {}) => {
  const source = center.name || center.district || 'center';
  return `${String(source)
    .toLowerCase()
    .replace(/\bnational\b/g, '')
    .replace(/\bid\b/g, '')
    .replace(/\bcenter\b/g, '')
    .replace(/[^a-z0-9]+/g, '')}center`;
};

const getCenterId = (center = {}) => String(center._id || center.id || '');

const formatManagerPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('25261')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('061')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('61')) return `+252${digits.slice(0, 9)}`;
  return `+25261${digits.slice(0, 7)}`;
};

const isValidManagerPhone = (value = '') => /^\+25261\d{7}$/.test(formatManagerPhone(value));

const phoneTailFromValue = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('25261')) return digits.slice(5, 12);
  if (digits.startsWith('061')) return digits.slice(3, 10);
  if (digits.startsWith('61')) return digits.slice(2, 9);
  return digits.slice(0, 7);
};

const SomaliPhoneField = ({ value, onChange, disabled = false }) => (
  <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-blue-400">
    <span className="flex items-center gap-2 border-r border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <FaPhoneAlt className="text-slate-400" />
      +252 61
    </span>
    <input
      type="tel"
      inputMode="numeric"
      maxLength={7}
      autoComplete="off"
      value={phoneTailFromValue(value)}
      disabled={disabled}
      onChange={(event) => onChange(formatManagerPhone(event.target.value.replace(/\D/g, '').slice(0, 7)))}
      placeholder="8318172"
      className="min-w-0 flex-1 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900"
    />
  </div>
);

const CenterManagement = () => {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm());
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [credentialCenter, setCredentialCenter] = useState(null);
  const [credentialForm, setCredentialForm] = useState({
    name: '',
    username: '',
    phone: '',
    temporaryPassword: ''
  });
  const [credentialManagerId, setCredentialManagerId] = useState(null);
  const [operators, setOperators] = useState([]);
  const isOperator = role === 'operator';
  const isCenterManager = role === 'super_operator' || role === 'center_manager';
  const isCenterScoped = isOperator || isCenterManager;
  const assignedCenter = typeof user?.center === 'object' ? user.center : null;
  const assignedCenterId = assignedCenter?._id || user?.center;

  const loadCenters = useCallback(async () => {
    try {
      setLoading(true);
      if (isCenterScoped) {
        const res = await apiClient.get('/api/centers/assigned/me');
        setCenters(res.data ? [{ ...res.data, name: displayCenterName(res.data) }] : []);
        return;
      }
      const res = await apiClient.get('/api/centers/list');
      setCenters((res.data || []).map((center) => ({ ...center, name: displayCenterName(center) })));
    } catch (_err) {
      toast.error('Failed to load centers.');
    } finally {
      setLoading(false);
    }
  }, [isCenterScoped]);

  useEffect(() => {
    loadCenters();
  }, [loadCenters]);

  const loadOperators = useCallback(async () => {
    if (isCenterScoped) return;
    try {
      const res = await apiClient.get('/api/operators');
      setOperators(res.data || []);
    } catch (_err) {
      // Non-fatal: the credentials modal just falls back to "create new" if this fails.
    }
  }, [isCenterScoped]);

  useEffect(() => {
    loadOperators();
  }, [loadOperators]);

  const findExistingManager = useCallback((center) => {
    const centerId = getCenterId(center);
    if (!centerId) return null;
    return operators.find((operator) => (
      operator.operatorType === 'center_manager' &&
      String(operator.center?._id || operator.center?.id || operator.center || '') === centerId
    )) || null;
  }, [operators]);

  const manageableCenters = useMemo(() => {
    if (!isCenterScoped) return centers;
    const exactMatch = centers.filter((center) => (center._id || center.id)?.toString() === assignedCenterId?.toString());
    if (exactMatch.length) return exactMatch;
    return assignedCenter?._id ? [assignedCenter] : [];
  }, [assignedCenter, assignedCenterId, centers, isCenterScoped]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byDistrict = districtFilter
      ? manageableCenters.filter((center) => center.district === districtFilter)
      : manageableCenters;
    if (!term) return byDistrict;
    return byDistrict.filter((center) => (
      center.name?.toLowerCase().includes(term) ||
      center.district?.toLowerCase().includes(term) ||
      center.address?.toLowerCase().includes(term) ||
      center.phone?.toLowerCase().includes(term)
    ));
  }, [districtFilter, manageableCenters, search]);

  const districtOptions = useMemo(
    () => [...new Set([
      ...manageableCenters.map((center) => center.district).filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b)),
    [manageableCenters]
  );

  const setSchedule = (patch) => {
    setForm((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        ...patch
      }
    }));
  };

  const syncClosedDays = (workingDays) => WEEK_DAYS.filter((day) => !workingDays.includes(day));

  const toggleWorkingDay = (day) => {
    const workingDays = form.schedule.workingDays.includes(day)
      ? form.schedule.workingDays.filter((item) => item !== day)
      : [...form.schedule.workingDays, day];
    setSchedule({
      workingDays,
      closedDays: syncClosedDays(workingDays)
    });
  };

  const removeScheduleDate = (field, value) => {
    setSchedule({ [field]: (form.schedule[field] || []).filter((date) => date !== value) });
  };

  const addScheduleDates = (field, values = []) => {
    const cleanDates = values
      .map((value) => String(value || '').trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
    if (!cleanDates.length) {
      toast.error('Select or enter at least one valid date.');
      return;
    }
    if (cleanDates.some(isPastDateKey)) {
      toast.error('Past dates are not allowed.');
      return;
    }
    const current = form.schedule[field] || [];
    const merged = [...new Set([...current, ...cleanDates])].sort();
    setSchedule({ [field]: merged });
    toast.success(`${merged.length - current.length} closed date(s) added.`);
  };

  const setManagerCredential = (field, value) => {
    setForm((current) => ({
      ...current,
      managerCredentials: {
        ...current.managerCredentials,
        [field]: value
      }
    }));
  };

  const setCenterField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (!editing && ['name', 'district'].includes(field)) {
        const currentSuggestedUsername = credentialUsernameFrom(current);
        const nextSuggestedUsername = credentialUsernameFrom(next);
        const currentUsername = current.managerCredentials.username;
        const shouldAutoFill = !currentUsername || currentUsername === currentSuggestedUsername;
        if (shouldAutoFill) {
          next.managerCredentials = {
            ...current.managerCredentials,
            username: nextSuggestedUsername
          };
        }
      }
      if (!editing && field === 'phone' && !current.managerCredentials.phone) {
        next.managerCredentials = {
          ...next.managerCredentials,
          phone: value
        };
      }
      return next;
    });
  };

  // Auto-save draft for Add Center to prevent data loss if modal accidentally closes
  useEffect(() => {
    if (modalOpen && !editing) {
      sessionStorage.setItem('nqs_add_center_draft', JSON.stringify(form));
    }
  }, [form, editing, modalOpen]);

  const openAdd = () => {
    if (isCenterScoped) {
      toast.info('Only admins can create service centers.');
      return;
    }
    setEditing(null);
    try {
      const draft = sessionStorage.getItem('nqs_add_center_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setForm(parsed);
      } else {
        setForm(createEmptyForm());
      }
    } catch {
      setForm(createEmptyForm());
    }
    setModalOpen(true);
  };

  const openEdit = (center) => {
    const schedule = normalizeSchedule(center.schedule || {});
    setEditing(center._id || center.id);
    setForm({
      name: displayCenterName(center),
      district: center.district || districtFromCenterName(center.name),
      address: center.address || '',
      city: 'Banaadir',
      phone: center.phone || '',
      counters: center.counters || 1,
      capacity: center.capacity || schedule.maxAppointmentsPerDay,
      hours: center.hours || `${schedule.startTime} - ${schedule.endTime}`,
      status: 'Active',
      schedule
    });
    setModalOpen(true);
  };

  const buildPayload = () => {
    const counters = Math.max(1, Number(form.counters || 1));
    return {
    name: form.name.trim(),
    district: form.district.trim(),
    address: form.address.trim(),
    city: 'Banaadir',
    phone: formatManagerPhone(form.phone),
    counters,
    status: 'Active',
    capacity: Number(form.schedule.maxAppointmentsPerDay || form.capacity || 100),
    hours: `${form.schedule.startTime} - ${form.schedule.endTime}`,
    schedule: {
      ...form.schedule,
      slotDuration: Number(defaultSchedule.slotDuration),
      maxBookingsPerSlot: counters,
      maxAppointmentsPerDay: Number(form.schedule.maxAppointmentsPerDay || 1),
      closedDates: form.schedule.closedDates || [],
      specialUnavailableDates: [],
      isActive: true
    },
    ...(!editing ? {
      managerCredentials: {
        name: form.managerCredentials.name.trim(),
        username: form.managerCredentials.username.trim().toLowerCase(),
        phone: formatManagerPhone(form.managerCredentials.phone),
        temporaryPassword: form.managerCredentials.temporaryPassword
      }
    } : {})
  };
  };

  const validateForm = () => {
    if (!form.name.trim()) return 'Center name is required.';
    if (!form.district.trim()) return 'District is required.';
    if (!form.address.trim()) return 'Address is required.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!isValidManagerPhone(form.phone)) return 'Phone number must be a valid Somali number.';
    if (!editing) {
      if (!form.managerCredentials.name.trim()) return 'Center manager name is required.';
      if (!form.managerCredentials.username.trim()) return 'Center manager username is required.';
      if (!form.managerCredentials.phone.trim()) return 'Center manager phone is required.';
      if (!isValidManagerPhone(form.managerCredentials.phone)) return 'Center manager phone must be a valid Somali number.';
      if (!form.managerCredentials.temporaryPassword || form.managerCredentials.temporaryPassword.length < 6) return 'Temporary password must be at least 6 characters.';
    }
    if (!form.schedule.workingDays.length) return 'Select at least one working day.';
    if (!form.schedule.startTime || !form.schedule.endTime) return 'Start and end time are required.';
    return '';
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      const payload = buildPayload();
      if (editing) {
        await apiClient.put(`/api/centers/update/${editing}`, payload);
        toast.success('Center schedule updated.');
      } else {
        await apiClient.post('/api/centers/create', payload);
        toast.success('Center added.');
      }
      
      // Clear draft on successful save
      if (!editing) {
        sessionStorage.removeItem('nqs_add_center_draft');
      }

      await loadCenters();
      setModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save center.');
    }
  };

  const handleDelete = async (center) => {
    if (isCenterScoped) {
      toast.error('Only admins can delete centers.');
      return;
    }
    if (!window.confirm(`Delete ${displayCenterName(center)}?`)) return;
    try {
      await apiClient.delete(`/api/centers/delete/${center._id || center.id}`);
      toast.success('Center deleted.');
      await loadCenters();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete center.');
    }
  };

  const openCredentials = (center) => {
    if (isCenterScoped) {
      toast.error('Only admins can manage center credentials.');
      return;
    }
    const existingManager = findExistingManager(center);
    setCredentialCenter(center);
    setCredentialManagerId(existingManager?.id || existingManager?._id || null);
    setCredentialForm({
      name: existingManager?.name || `${displayCenterName(center)} Manager`,
      username: existingManager?.username || credentialUsernameFrom(center),
      phone: existingManager?.phone || center.phone || '',
      temporaryPassword: ''
    });
  };

  const openCenterAppointments = (center) => {
    const params = new URLSearchParams({ requestType: 'new_national_id' });
    const centerId = center._id || center.id;
    if (centerId) params.set('center', String(centerId));
    if (center.district) params.set('district', center.district);
    navigate(`/admin-appointments/center?${params.toString()}`);
  };

  const handleCredentialSave = async () => {
    if (!credentialCenter) return;

    if (credentialManagerId) {
      if (!credentialForm.temporaryPassword || credentialForm.temporaryPassword.length < 6) {
        toast.error('Temporary password must be at least 6 characters.');
        return;
      }
      try {
        await apiClient.put(`/api/operators/${credentialManagerId}/reset-password`, {
          temporaryPassword: credentialForm.temporaryPassword
        });
        toast.success('Center manager password updated.');
        setCredentialCenter(null);
        loadOperators();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update center manager password.');
      }
      return;
    }

    if (!credentialForm.name.trim() || !credentialForm.username.trim() || !credentialForm.phone.trim() || !credentialForm.temporaryPassword) {
      toast.error('Name, username, phone, and temporary password are required.');
      return;
    }
    if (!isValidManagerPhone(credentialForm.phone)) {
      toast.error('Phone number must be a valid Somali number.');
      return;
    }

    try {
      await apiClient.post('/api/operators', {
        ...credentialForm,
        phone: formatManagerPhone(credentialForm.phone),
        center: credentialCenter._id || credentialCenter.id,
        operatorType: 'center_manager',
        status: 'pending_approval'
      });
      toast.success('Center manager credentials created and sent for approval.');
      setCredentialCenter(null);
      loadOperators();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create center credentials.');
    }
  };

  if (loading && centers.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-950 dark:bg-slate-950 dark:text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
              {isCenterScoped ? 'Center Schedule' : 'Admin Center Management'}
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#0B3A75] dark:text-white sm:text-3xl">
              <FaBuilding className="text-blue-700 dark:text-blue-300" />
              {isCenterScoped ? 'Assigned Center Schedule' : 'Manage Centers and Schedules'}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
              {isOperator
                ? 'View your assigned center, available appointment times, daily schedule, and queue access.'
                : isCenterManager
                  ? 'Update the available days, working hours, closed dates, and appointment capacity for your assigned center.'
                : "Create centers, assign districts, and manage each center's available days, hours, and daily capacity."}
            </p>
          </div>
          {!isCenterScoped && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={openAdd}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
              >
                <FaPlus /> Add Center
              </button>
            </div>
          )}
        </section>

        {!isCenterScoped && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
          <label className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by center, district, address, or phone"
              className={`${inputClass} pl-11`}
            />
          </label>
          <select
            value={districtFilter}
            onChange={(event) => setDistrictFilter(event.target.value)}
            className={inputClass}
          >
            <option value="">All Districts</option>
            {districtOptions.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </select>
        </section>
        )}

        {isCenterScoped && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
            {isOperator
              ? 'You can view only your assigned center schedule and queue. Other centers are not accessible from this account.'
              : 'You are managing your assigned center only. Staff operators can view and process appointments, but they cannot edit this schedule.'}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard label={isCenterScoped ? 'Assigned Center' : 'Total Centers'} value={manageableCenters.length} color="emerald" />
          <SummaryCard label="Districts Covered" value={new Set(manageableCenters.map((center) => center.district).filter(Boolean)).size} color="blue" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-lg font-black text-[#0B3A75] dark:text-white">District Centers</h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Centers created from Add Center are listed here only.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Center</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Counters</th>
                  <th className="px-4 py-3">Working Days</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Daily Capacity</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((center) => {
                  const schedule = normalizeSchedule(center.schedule || {});
                  return (
                    <tr key={center._id || center.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-950 dark:text-white">{center.name}</div>
                        <div className="mt-1 max-w-xs truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{center.address}</div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-700 dark:text-slate-300">{center.district || 'Banaadir'}</td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-2"><FaPhoneAlt className="text-blue-600" /> {center.phone}</span>
                      </td>
                      <td className="px-4 py-4 font-black">{center.counters}</td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">{schedule.workingDays.join(', ')}</td>
                      <td className="px-4 py-4 font-semibold text-slate-700 dark:text-slate-300">{schedule.startTime} - {schedule.endTime}</td>
                      <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{schedule.maxAppointmentsPerDay}/day</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {!isCenterManager && (
                            <button
                              onClick={() => openCenterAppointments(center)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 transition hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300"
                            >
                              <FaClipboardList /> Appointments
                            </button>
                          )}
                          {isOperator ? (
                            <button
                              onClick={() => navigate('/queue-management')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                            >
                              <FaClipboardList /> Queue Management
                            </button>
                          ) : (
                            <button
                              onClick={() => openEdit(center)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                              <FaEdit /> Edit
                            </button>
                          )}
                          {!isCenterScoped && (
                            <button
                              onClick={() => openCredentials(center)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                            >
                              <FaKey /> Credentials
                            </button>
                          )}
                          {!isCenterScoped && (
                            <button
                              onClick={() => handleDelete(center)}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                            >
                              <FaTrashAlt /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                      No regular center matches your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black text-[#0B3A75] dark:text-white">
                  {isCenterManager ? 'Edit Center Schedule' : editing ? 'Edit Center' : 'Add Center'}
                </h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                  {isCenterManager
                    ? 'Only schedule and appointment availability can be changed from this account.'
                    : 'Manage center details and appointment schedule.'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                <FaTimes />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_1fr]">
              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-[#0B3A75] dark:text-white">
                  <FaMapMarkerAlt className="text-blue-700 dark:text-blue-300" />
                  Center Details
                </h3>
                <Field label="Center Name">
                  <input
                    value={form.name}
                    onChange={(event) => setCenterField('name', event.target.value)}
                    className={inputClass}
                    placeholder="Example: Hodan National ID Center"
                    disabled={isCenterManager}
                  />
                </Field>
                <Field label="District">
                  <input
                    value={form.district}
                    onChange={(event) => setCenterField('district', event.target.value)}
                    className={inputClass}
                    placeholder="Type district name"
                    disabled={isCenterManager}
                  />
                </Field>
                <Field label="Address">
                  <input value={form.address} onChange={(event) => setCenterField('address', event.target.value)} className={inputClass} placeholder="District office, Mogadishu" disabled={isCenterManager} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Phone Number">
                    <SomaliPhoneField
                      value={form.phone}
                      onChange={(value) => setCenterField('phone', value)}
                      disabled={isCenterManager}
                    />
                  </Field>
                  <Field label="Number of Counters">
                    <input
                      type="number"
                      min="1"
                      value={form.counters}
                      onChange={(event) => {
                        const counters = event.target.value;
                        setForm((current) => ({
                          ...current,
                          counters,
                          schedule: {
                            ...current.schedule,
                            // 1 counter = 1 registration allowed in the same time slot.
                            maxBookingsPerSlot: Math.max(1, Number(counters) || 1),
                          },
                        }));
                      }}
                      className={inputClass}
                      disabled={isCenterManager}
                    />
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      If counters = 1, only 1 citizen can register for the same appointment time at this center.
                    </p>
                  </Field>
                  <Field label="Maximum Appointments Per Day">
                    <input
                      type="number"
                      min="1"
                      value={form.schedule.maxAppointmentsPerDay}
                      onChange={(event) => setSchedule({ maxAppointmentsPerDay: event.target.value })}
                      className={inputClass}
                    />
                  </Field>
                </div>
                {!editing && !isCenterManager && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                      <FaKey /> Center Manager Login
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Manager Name">
                        <input
                          autoComplete="off"
                          value={form.managerCredentials.name}
                          onChange={(event) => setManagerCredential('name', event.target.value.replace(/[^A-Za-z\s'-]/g, ''))}
                          className={inputClass}
                          placeholder="Manager full name"
                        />
                      </Field>
                      <Field label="Manager Phone">
                        <SomaliPhoneField
                          value={form.managerCredentials.phone}
                          onChange={(value) => setManagerCredential('phone', value)}
                        />
                      </Field>
                      <Field label="Username">
                        <input
                          name="center-manager-username"
                          autoComplete="username"
                          value={form.managerCredentials.username}
                          onChange={(event) => setManagerCredential('username', event.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                          className={inputClass}
                          placeholder="hodanmanager"
                        />
                      </Field>
                      <Field label="Temporary Password">
                        <input
                          type="password"
                          name="center-manager-temporary-password"
                          autoComplete="new-password"
                          value={form.managerCredentials.temporaryPassword}
                          onChange={(event) => setManagerCredential('temporaryPassword', event.target.value)}
                          className={inputClass}
                          placeholder="Minimum 6 characters"
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-[#0B3A75] dark:text-white">
                  <FaCalendarAlt className="text-blue-700 dark:text-blue-300" />
                  Schedule
                </h3>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Working Days</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {WEEK_DAYS.map((day) => (
                      <label key={day} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={form.schedule.workingDays.includes(day)}
                          onChange={() => toggleWorkingDay(day)}
                          className="rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Opening Time">
                    <input type="time" value={form.schedule.startTime} onChange={(event) => setSchedule({ startTime: event.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Closing Time">
                    <input type="time" value={form.schedule.endTime} onChange={(event) => setSchedule({ endTime: event.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Break Start Optional">
                    <input type="time" value={form.schedule.breakTime.start} onChange={(event) => setSchedule({ breakTime: { ...form.schedule.breakTime, start: event.target.value } })} className={inputClass} />
                  </Field>
                  <Field label="Break End Optional">
                    <input type="time" value={form.schedule.breakTime.end} onChange={(event) => setSchedule({ breakTime: { ...form.schedule.breakTime, end: event.target.value } })} className={inputClass} />
                  </Field>
                </div>

                <DateListEditor
                  title="Closed Dates"
                  dates={form.schedule.closedDates}
                  onAddMany={(dates) => addScheduleDates('closedDates', dates)}
                  onRemove={(date) => removeScheduleDate('closedDates', date)}
                />
              </section>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleSave} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800">
                <FaSave /> {isCenterManager || editing ? 'Save Schedule' : 'Add Center'}
              </button>
            </div>
          </div>
        </div>
      )}

      {credentialCenter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCredentialCenter(null)}>
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Center Credentials</p>
              <h2 className="mt-1 text-xl font-black text-[#0B3A75] dark:text-white">{credentialCenter.name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                {credentialManagerId
                  ? `This center already has a manager account (@${credentialForm.username}). Set a new temporary password to reset it — the username stays the same.`
                  : 'Create a center manager account for this center. This account can manage staff and schedule for this center only.'}
              </p>
            </div>

            <div className="space-y-4">
              <Field label="Manager Name">
                <input
                  value={credentialForm.name}
                  onChange={(event) => setCredentialForm({ ...credentialForm, name: event.target.value.replace(/[^A-Za-z\s'-]/g, '') })}
                  className={inputClass}
                  placeholder="Center manager full name"
                  disabled={!!credentialManagerId}
                />
              </Field>
              <Field label="Username">
                <input
                  value={credentialForm.username}
                  onChange={(event) => setCredentialForm({ ...credentialForm, username: event.target.value.toLowerCase().replace(/[^a-z]/g, '') })}
                  className={inputClass}
                  placeholder="centerusername"
                  disabled={!!credentialManagerId}
                />
              </Field>
              <Field label="Phone Number">
                <SomaliPhoneField
                  value={credentialForm.phone}
                  onChange={(value) => setCredentialForm({ ...credentialForm, phone: value })}
                  disabled={!!credentialManagerId}
                />
              </Field>
              <Field label={credentialManagerId ? 'New Password' : 'Temporary Password'}>
                <input
                  type="password"
                  value={credentialForm.temporaryPassword}
                  onChange={(event) => setCredentialForm({ ...credentialForm, temporaryPassword: event.target.value })}
                  className={inputClass}
                  placeholder={credentialManagerId ? 'Set new password' : 'Set temporary password'}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCredentialCenter(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCredentialSave}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
              >
                <FaKey /> {credentialManagerId ? 'Reset Password' : 'Create Credentials'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sitewide soft-pastel card tone system (styles/nqs-theme-system.css).
const SummaryCard = ({ label, value, color }) => {
  const cardTone = {
    emerald: 'nqs-card-tone-green',
    red: 'nqs-card-tone-pink',
    blue: 'nqs-card-tone-blue'
  };
  const iconTone = {
    emerald: 'nqs-card-tone-icon-green',
    red: 'nqs-card-tone-icon-pink',
    blue: 'nqs-card-tone-icon-blue'
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${cardTone[color]}`}>
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconTone[color]}`}>
        <FaBuilding />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p>
    </div>
  );
};

const dateRange = (start, end) => {
  if (!start || !end) return [];
  const first = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return [];
  const dates = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    dates.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const monthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const addMonths = (date, amount) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const calendarMonthDates = (monthValue) => {
  const [year, month] = String(monthValue || todayDateKey().slice(0, 7)).split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDateKey(date);
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      past: key < todayDateKey()
    };
  });
};

const DateListEditor = ({ title, dates, onAddMany, onRemove }) => {
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(todayDateKey().slice(0, 7));
  const [selectedDates, setSelectedDates] = useState([]);
  const activeDates = Array.isArray(dates) ? dates : [];
  const calendarDates = calendarMonthDates(calendarMonth);

  const toggleCalendarDate = (date) => {
    if (date.past) return;
    setSelectedDates((current) => (
      current.includes(date.key)
        ? current.filter((item) => item !== date.key)
        : [...current, date.key].sort()
    ));
  };

  const addSelectedDates = () => {
    if (!selectedDates.length) {
      toast.error('Select at least one closed date.');
      return;
    }
    onAddMany(selectedDates);
    setSelectedDates([]);
    setPickerOpen(false);
  };

  const addRange = () => {
    const values = dateRange(rangeStart, rangeEnd);
    if (!values.length) {
      toast.error('Select a valid start and end date.');
      return;
    }
    onAddMany(values);
    setRangeStart('');
    setRangeEnd('');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{title}</p>
      <div className="grid gap-3">
        <div className="relative grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            className={`${inputClass} flex items-center justify-between text-left`}
          >
            <span>{selectedDates.length ? `${selectedDates.length} date(s) selected` : 'Select closed dates'}</span>
            <FaCalendarAlt className="text-slate-400" />
          </button>
          <button type="button" onClick={addSelectedDates} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">
            Add Date
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(monthKey(addMonths(new Date(`${calendarMonth}-01T00:00:00`), -1)))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Prev
                </button>
                <input
                  type="month"
                  min={todayDateKey().slice(0, 7)}
                  value={calendarMonth}
                  onChange={(event) => setCalendarMonth(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setCalendarMonth(monthKey(addMonths(new Date(`${calendarMonth}-01T00:00:00`), 1)))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <span key={day} className="py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{day}</span>
                ))}
                {calendarDates.map((date) => {
                  const selected = selectedDates.includes(date.key);
                  const alreadyClosed = activeDates.includes(date.key);
                  return (
                    <button
                      key={date.key}
                      type="button"
                      disabled={date.past}
                      onClick={() => toggleCalendarDate(date)}
                      className={`min-h-9 rounded-lg border px-1 text-xs font-black transition ${
                        selected
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : alreadyClosed
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : date.inMonth
                              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                              : 'border-transparent bg-transparent text-slate-300 dark:text-slate-700'
                      } ${date.past ? 'cursor-not-allowed opacity-40' : ''}`}
                    >
                      {date.day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedDates.length ? `${selectedDates.length} selected` : 'No dates selected'}
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedDates([])} className="text-xs font-black text-slate-500 hover:text-slate-700 dark:text-slate-400">
                    Clear
                  </button>
                  <button type="button" onClick={() => setPickerOpen(false)} className="text-xs font-black text-blue-600 hover:text-blue-800 dark:text-blue-300">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Add Date Range</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="date" min={todayDateKey()} value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} className={inputClass} />
            <input type="date" min={rangeStart || todayDateKey()} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} className={inputClass} />
            <button type="button" onClick={addRange} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 dark:bg-blue-700 dark:hover:bg-blue-800">
              Add Range
            </button>
          </div>
        </div>

      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeDates.length ? activeDates.map((date) => (
          <span key={date} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
            {date}
            <button type="button" onClick={() => onRemove(date)} className="text-red-500 hover:text-red-700">
              <FaTimes />
            </button>
          </span>
        )) : <span className="text-xs font-semibold text-slate-500">No dates added.</span>}
      </div>
    </div>
  );
};

export default CenterManagement;
