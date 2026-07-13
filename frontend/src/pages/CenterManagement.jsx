import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FaBuilding,
  FaCalendarAlt,
  FaEdit,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaPlus,
  FaSave,
  FaTimes,
  FaTrashAlt
} from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
import DataTable from '../components/ui/DataTable';

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

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const centerOptions = [
  { name: 'Banaadir National ID Center', district: 'Hodan' },
  ...BANAADIR_DISTRICTS.map((district) => ({
    name: `${district} National ID Center`,
    district
  }))
];

const districtFromCenterName = (name = '') => {
  const normalized = String(name).replace(/\s+National ID Center$/i, '').trim();
  if (/^Banaadir$/i.test(normalized)) return 'Hodan';
  if (/^Hamar Weyne$/i.test(normalized)) return 'Xamar Weyne';
  if (/^Hamar Jajab$/i.test(normalized)) return 'Xamar Jajab';
  if (/^Waberi$/i.test(normalized)) return 'Waaberi';
  if (/^Hawl-Wadaag$/i.test(normalized)) return 'Howlwadaag';
  return BANAADIR_DISTRICTS.find((district) => district.toLowerCase() === normalized.toLowerCase()) || 'Hodan';
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
  specialUnavailableDates: [],
  isActive: true
};

const emptyForm = {
  name: 'Banaadir National ID Center',
  district: 'Hodan',
  address: '',
  city: 'Banaadir',
  phone: '',
  counters: 1,
  capacity: 100,
  hours: '08:00 - 16:00',
  status: 'Active',
  schedule: defaultSchedule
};

const normalizeSchedule = (schedule = {}) => ({
  ...defaultSchedule,
  ...schedule,
  breakTime: {
    start: schedule.breakTime?.start || '',
    end: schedule.breakTime?.end || ''
  },
  workingDays: schedule.workingDays?.length ? schedule.workingDays : defaultSchedule.workingDays,
  closedDays: schedule.closedDays?.length ? schedule.closedDays : WEEK_DAYS.filter((day) => !(schedule.workingDays || defaultSchedule.workingDays).includes(day)),
  closedDates: Array.isArray(schedule.closedDates) ? schedule.closedDates : [],
  specialUnavailableDates: Array.isArray(schedule.specialUnavailableDates) ? schedule.specialUnavailableDates : []
});

const statusBadge = (status) => {
  const base = 'rounded-full px-2.5 py-1 text-xs font-black';
  if (status === 'Active') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`;
  if (status === 'Inactive' || status === 'Closed') return `${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`;
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

const CenterManagement = () => {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [closedDateInput, setClosedDateInput] = useState('');
  const [specialDateInput, setSpecialDateInput] = useState('');

  const loadCenters = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/centers/list');
      setCenters(res.data || []);
    } catch (_err) {
      toast.error('Failed to load centers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCenters();
  }, []);

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

  const addScheduleDate = (field, value, clear) => {
    if (!value) return;
    const current = form.schedule[field] || [];
    if (!current.includes(value)) {
      setSchedule({ [field]: [...current, value].sort() });
    }
    clear('');
  };

  const removeScheduleDate = (field, value) => {
    setSchedule({ [field]: (form.schedule[field] || []).filter((date) => date !== value) });
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setClosedDateInput('');
    setSpecialDateInput('');
    setModalOpen(true);
  };

  const openEdit = (center) => {
    const schedule = normalizeSchedule(center.schedule || {});
    setEditing(center._id || center.id);
    setForm({
      name: center.name || emptyForm.name,
      district: center.district || districtFromCenterName(center.name),
      address: center.address || '',
      city: 'Banaadir',
      phone: center.phone || '',
      counters: center.counters || 1,
      capacity: center.capacity || schedule.maxAppointmentsPerDay,
      hours: center.hours || `${schedule.startTime} - ${schedule.endTime}`,
      status: center.status === 'Closed' || center.status === 'Maintenance' ? 'Inactive' : center.status || 'Active',
      schedule
    });
    setClosedDateInput('');
    setSpecialDateInput('');
    setModalOpen(true);
  };

  const handleNameChange = (name) => {
    const selected = centerOptions.find((center) => center.name === name);
    setForm((current) => ({
      ...current,
      name,
      district: selected?.district || current.district
    }));
  };

  const buildPayload = () => ({
    ...form,
    city: 'Banaadir',
    capacity: Number(form.schedule.maxAppointmentsPerDay || form.capacity || 100),
    hours: `${form.schedule.startTime} - ${form.schedule.endTime}`,
    counters: Number(form.counters || 1),
    schedule: {
      ...form.schedule,
      slotDuration: Number(form.schedule.slotDuration || 30),
      maxBookingsPerSlot: Number(form.schedule.maxBookingsPerSlot || 1),
      maxAppointmentsPerDay: Number(form.schedule.maxAppointmentsPerDay || 1),
      isActive: form.status === 'Active'
    }
  });

  const validateForm = () => {
    if (!form.name) return 'Center name is required.';
    if (!BANAADIR_DISTRICTS.includes(form.district)) return 'Please select a Banaadir district.';
    if (!form.address.trim()) return 'Address is required.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (!form.schedule.workingDays.length) return 'Select at least one working day.';
    if (!form.schedule.startTime || !form.schedule.endTime) return 'Start and end time are required.';
    if (form.schedule.startTime >= form.schedule.endTime) return 'Opening time must be before closing time.';
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
        await apiClient.put(`/api/centers/${editing}`, payload);
        toast.success('Center schedule updated.');
      } else {
        await apiClient.post('/api/centers', payload);
        toast.success('Center added.');
      }
      await loadCenters();
      setModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save center.');
    }
  };

  const handleDelete = async (center) => {
    if (!window.confirm(`Delete ${center.name}?`)) return;
    try {
      await apiClient.delete(`/api/centers/${center._id || center.id}`);
      toast.success('Center deleted.');
      await loadCenters();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete center.');
    }
  };

  const columns = [
    {
      header: 'Center',
      accessor: 'name',
      render: (center) => (
        <div>
          <div className="font-black text-slate-950 dark:text-white">{center.name}</div>
          <div className="mt-1 max-w-sm truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{center.address}</div>
        </div>
      )
    },
    { header: 'District', accessor: 'district', render: (center) => center.district || 'Banaadir' },
    {
      header: 'Phone',
      accessor: 'phone',
      render: (center) => (
        <span className="inline-flex items-center gap-2">
          <FaPhoneAlt className="text-blue-600 dark:text-blue-300" /> {center.phone || 'Not set'}
        </span>
      )
    },
    { header: 'Counters', accessor: 'counters', render: (center) => center.counters || 1 },
    {
      header: 'Working Days',
      accessor: 'workingDays',
      sortValue: (center) => normalizeSchedule(center.schedule || {}).workingDays.join(', '),
      render: (center) => <span className="text-xs font-semibold">{normalizeSchedule(center.schedule || {}).workingDays.join(', ')}</span>
    },
    {
      header: 'Time',
      accessor: 'hours',
      render: (center) => {
        const schedule = normalizeSchedule(center.schedule || {});
        return `${schedule.startTime} - ${schedule.endTime}`;
      }
    },
    {
      header: 'Slot Capacity',
      accessor: 'capacity',
      render: (center) => {
        const schedule = normalizeSchedule(center.schedule || {});
        return `${schedule.maxBookingsPerSlot}/slot, ${schedule.maxAppointmentsPerDay}/day`;
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (center) => <span className={statusBadge(center.status)}>{center.status || 'Active'}</span>
    },
    {
      header: 'Actions',
      accessor: 'actions',
      sortable: false,
      render: (center) => (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openEdit(center)}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300"
          >
            <FaEdit /> Edit
          </button>
          <button
            onClick={() => handleDelete(center)}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300"
          >
            <FaTrashAlt /> Delete
          </button>
        </div>
      )
    }
  ];

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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Admin Center Management</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-[#0B3A75] dark:text-white sm:text-3xl">
              <FaBuilding className="text-blue-700 dark:text-blue-300" />
              Manage Centers and Schedules
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
              Create centers and manage each center's available days, hours, and slot capacity.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
          >
            <FaPlus /> Add Center
          </button>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Active Centers" value={centers.filter((center) => center.status === 'Active').length} color="emerald" />
          <SummaryCard label="Inactive Centers" value={centers.filter((center) => center.status !== 'Active').length} color="red" />
          <SummaryCard label="Districts Covered" value={new Set(centers.map((center) => center.district).filter(Boolean)).size} color="blue" />
        </section>

        <section>
          <DataTable
            columns={columns}
            data={centers}
            loading={loading}
            searchPlaceholder="Search by center, district, address, or phone..."
            toolbar={(
              <button
                onClick={openAdd}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white hover:bg-blue-800"
              >
                <FaPlus /> Add Center
              </button>
            )}
            emptyTitle="No centers configured"
            emptyText="Create at least one Banaadir National ID center to begin scheduling appointments."
          />
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
                <h2 className="text-xl font-black text-[#0B3A75] dark:text-white">{editing ? 'Edit Center' : 'Add Center'}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Manage center details and appointment schedule.</p>
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
                  <select value={form.name} onChange={(event) => handleNameChange(event.target.value)} className={inputClass}>
                    {centerOptions.map((center) => (
                      <option key={center.name} value={center.name}>{center.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="District">
                  <select value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} className={inputClass}>
                    <option value="">Select district</option>
                    {BANAADIR_DISTRICTS.map((district) => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Address">
                  <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={inputClass} placeholder="District office, Mogadishu" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Phone Number">
                    <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputClass} placeholder="+252 61 000 1000" />
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={inputClass}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </Field>
                  <Field label="Number of Counters">
                    <input type="number" min="1" value={form.counters} onChange={(event) => setForm({ ...form, counters: event.target.value })} className={inputClass} />
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
                  <Field label="Slot Duration">
                    <select value={form.schedule.slotDuration} onChange={(event) => setSchedule({ slotDuration: event.target.value })} className={inputClass}>
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  </Field>
                  <Field label="Max Bookings Per Slot">
                    <input type="number" min="1" value={form.schedule.maxBookingsPerSlot} onChange={(event) => setSchedule({ maxBookingsPerSlot: event.target.value })} className={inputClass} />
                  </Field>
                </div>

                <DateListEditor
                  title="Closed Dates"
                  value={closedDateInput}
                  onChange={setClosedDateInput}
                  dates={form.schedule.closedDates}
                  onAdd={() => addScheduleDate('closedDates', closedDateInput, setClosedDateInput)}
                  onRemove={(date) => removeScheduleDate('closedDates', date)}
                />
                <DateListEditor
                  title="Special Unavailable Dates"
                  value={specialDateInput}
                  onChange={setSpecialDateInput}
                  dates={form.schedule.specialUnavailableDates}
                  onAdd={() => addScheduleDate('specialUnavailableDates', specialDateInput, setSpecialDateInput)}
                  onRemove={(date) => removeScheduleDate('specialUnavailableDates', date)}
                />
              </section>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button onClick={handleSave} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800">
                <FaSave /> {editing ? 'Save Schedule' : 'Add Center'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, color }) => {
  const colorMap = {
    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    red: 'border-red-500 bg-red-50 text-red-700',
    blue: 'border-blue-500 bg-blue-50 text-blue-700'
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border-l-4 ${colorMap[color]}`}>
        <FaBuilding />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">{label}</p>
    </div>
  );
};

const DateListEditor = ({ title, value, onChange, dates, onAdd, onRemove }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
    <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{title}</p>
    <div className="flex gap-2">
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      <button type="button" onClick={onAdd} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800">
        Add
      </button>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {dates.length ? dates.map((date) => (
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

export default CenterManagement;
