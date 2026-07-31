import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowRight,
  FiEdit3,
  FiFilter,
  FiMapPin,
  FiPhone,
  FiSave,
  FiSearch,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiX
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';

const emptyForm = {
  name: '',
  username: '',
  email: '',
  phone: '',
  center: '',
  operatorType: 'operator',
  status: 'pending_approval',
  temporaryPassword: ''
};

const inputClass = 'w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/15 disabled:opacity-70';

const formatSomaliPhone = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('25261')) return `+${digits.slice(0, 12)}`;
  if (digits.startsWith('061')) return `+252${digits.slice(1, 10)}`;
  if (digits.startsWith('61')) return `+252${digits.slice(0, 9)}`;
  return `+25261${digits.slice(0, 7)}`;
};

const isValidSomaliPhone = (value = '') => /^\+25261\d{7}$/.test(formatSomaliPhone(value));

const phoneTailFromValue = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('25261')) return digits.slice(5, 12);
  if (digits.startsWith('061')) return digits.slice(3, 10);
  if (digits.startsWith('61')) return digits.slice(2, 9);
  return digits.slice(0, 7);
};

const SomaliPhoneField = ({ value, onChange }) => (
  <div className="flex overflow-hidden rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] focus-within:border-[#2563EB] focus-within:ring-4 focus-within:ring-blue-500/15">
    <span className="flex items-center gap-2 border-r border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-3 text-sm font-black text-[var(--text-main)]">
      <FiPhone className="text-[var(--text-muted)]" />
      +252 61
    </span>
    <input
      type="tel"
      inputMode="numeric"
      maxLength={7}
      autoComplete="off"
      value={phoneTailFromValue(value)}
      onChange={(event) => onChange(formatSomaliPhone(event.target.value.replace(/\D/g, '').slice(0, 7)))}
      placeholder="8318172"
      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
    />
  </div>
);

const staffTypeLabel = (operator = {}) => {
  const type = String(operator.operatorType || operator.role || '').toLowerCase();
  if (type === 'super_operator' || type === 'center_manager') return 'Center Manager';
  return 'Operator';
};

const OperatorManagement = () => {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [operators, setOperators] = useState([]);
  const [centers, setCenters] = useState([]);
  const [centerStats, setCenterStats] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [centerFilters, setCenterFilters] = useState({ search: '', district: '', workload: '' });
  const isCenterManager = role === 'super_operator' || role === 'center_manager';
  const statusFilterParam = searchParams.get('status') || '';
  const [statusFilter, setStatusFilter] = useState(statusFilterParam);
  const assignedCenterId =
    (typeof user?.assignedCenter === 'object' ? user.assignedCenter?._id : user?.assignedCenter) ||
    (typeof user?.center === 'object' ? user.center?._id : user?.center) ||
    user?.assignedCenterId ||
    user?.centerId ||
    '';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [operatorsRes, centersRes, centerStatsRes] = await Promise.all([
        api.get('/api/operators'),
        isCenterManager ? api.get('/api/centers/assigned/me') : api.get('/api/centers'),
        isCenterManager ? Promise.resolve({ data: { data: [] } }) : api.get('/api/operators/center-stats')
      ]);
      setOperators(operatorsRes.data.data || []);
      setCenterStats(centerStatsRes.data.data || []);
      const centerData = isCenterManager
        ? (centersRes.data.data ? [centersRes.data.data] : [])
        : (centersRes.data.data || []);
      setCenters(centerData);
      if (isCenterManager && assignedCenterId) {
        setForm((current) => ({ ...current, center: assignedCenterId, operatorType: 'operator' }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load operators.');
    } finally {
      setLoading(false);
    }
  }, [assignedCenterId, isCenterManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidSomaliPhone(form.phone)) {
      toast.error('Phone number must be a valid Somali number.');
      return;
    }
    try {
      const payload = isCenterManager
        ? { ...form, phone: formatSomaliPhone(form.phone), center: assignedCenterId, operatorType: 'operator', email: undefined }
        : { ...form, phone: formatSomaliPhone(form.phone), operatorType: 'operator' };
      if (editingId) {
        await api.put(`/api/operators/${editingId}`, payload);
        toast.success('Operator updated.');
      } else {
        await api.post('/api/operators', payload);
        toast.success('Operator created and sent for Super Admin approval.');
      }
      setForm(isCenterManager ? { ...emptyForm, center: assignedCenterId || '', operatorType: 'operator' } : emptyForm);
      setEditingId('');
      setOperatorModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save operator.');
    }
  };

  const displayedOperators = statusFilter
    ? operators.filter((op) => String(op.status || '').toLowerCase() === statusFilter.toLowerCase())
    : operators;

  const districtOptions = Array.from(new Set(centerStats.map((center) => center.district).filter(Boolean))).sort();

  const filteredCenterStats = centerStats.filter((center) => {
    const stats = center.stats || {};
    const searchText = `${center.centerName || ''} ${center.district || ''} ${center.phone || ''}`.toLowerCase();
    const matchesSearch = !centerFilters.search || searchText.includes(centerFilters.search.toLowerCase());
    const matchesDistrict = !centerFilters.district || center.district === centerFilters.district;
    const matchesWorkload = !centerFilters.workload || Number(stats[centerFilters.workload] || 0) > 0;
    return matchesSearch && matchesDistrict && matchesWorkload;
  });

  const overviewStats = useMemo(() => {
    const totalCenters = centerStats.length;
    const totalStaff = centerStats.reduce((sum, center) => sum + Number(center.staffCount || 0), 0);
    const totalWaiting = centerStats.reduce((sum, center) => sum + Number(center.stats?.waiting || 0), 0);
    const totalCompleted = centerStats.reduce((sum, center) => sum + Number(center.stats?.completed || 0), 0);
    return { totalCenters, totalStaff, totalWaiting, totalCompleted };
  }, [centerStats]);

  const openCreateOperator = () => {
    setEditingId('');
    setForm({
      ...emptyForm,
      center: isCenterManager ? assignedCenterId || '' : '',
      operatorType: 'operator'
    });
    setOperatorModalOpen(true);
  };

  const editOperator = (operator) => {
    setEditingId(operator._id);
    setForm({
      name: operator.name || '',
      username: operator.username || '',
      email: operator.email || '',
      phone: operator.phone || '',
      center: operator.center?._id || operator.center || '',
      operatorType: 'operator',
      status: operator.status || 'active',
      temporaryPassword: ''
    });
    setOperatorModalOpen(true);
  };

  const approveOperator = async (id) => {
    try {
      await api.put(`/api/operators/${id}/approve`);
      toast.success('Operator approved.');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to approve operator.');
    }
  };

  void editOperator;
  void approveOperator;

  return (
    <div className="nqs-operator-mgmt min-h-screen bg-[var(--bg-app)] p-4 text-[var(--text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1d4ed8] via-[#3b82f6] to-[#60a5fa]" />
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#2563EB]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] text-2xl text-white shadow-lg shadow-blue-600/25">
                <FiUsers />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#2563EB]">Staff Control</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                  {isCenterManager ? 'Center Staff' : 'Operator Management'}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                  {isCenterManager
                    ? 'Create staff operators for your center. New operators wait for Super Admin approval before login.'
                    : 'Create operators, review center staffing, and open each center for assigned staff and workload.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateOperator}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-[#1d4ed8]"
            >
              <FiUserPlus />
              {isCenterManager ? 'Create Staff' : 'Create Operator'}
            </button>
          </div>

          {!isCenterManager && (
            <div className="grid gap-3 border-t border-[var(--border-light)] bg-[var(--nqs-panel-soft)]/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Centers', value: overviewStats.totalCenters, icon: <FiMapPin />, tone: 'text-[#2563EB]' },
                { label: 'Staff assigned', value: overviewStats.totalStaff, icon: <FiUserCheck />, tone: 'text-emerald-500' },
                { label: 'Waiting queue', value: overviewStats.totalWaiting, icon: <FiFilter />, tone: 'text-amber-500' },
                { label: 'Completed', value: overviewStats.totalCompleted, icon: <FiUsers />, tone: 'text-cyan-500' }
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl bg-[var(--nqs-panel-soft)] text-lg ${item.tone}`}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-xl font-black leading-none">{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </header>

        {!isCenterManager && (
          <section className="space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-lg font-black">Center Workload Overview</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Open a center to manage assigned staff, appointments, and queue activity.
                  </p>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:max-w-3xl">
                  <label className="relative block">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Search center"
                      value={centerFilters.search}
                      onChange={(event) => setCenterFilters((current) => ({ ...current, search: event.target.value }))}
                    />
                  </label>
                  <label className="relative block">
                    <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <select
                      className={`${inputClass} pl-9`}
                      value={centerFilters.district}
                      onChange={(event) => setCenterFilters((current) => ({ ...current, district: event.target.value }))}
                    >
                      <option value="">All districts</option>
                      {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                    </select>
                  </label>
                  <select
                    className={inputClass}
                    value={centerFilters.workload}
                    onChange={(event) => setCenterFilters((current) => ({ ...current, workload: event.target.value }))}
                  >
                    <option value="">All workload</option>
                    <option value="waiting">Has waiting</option>
                    <option value="completed">Has completed</option>
                    <option value="newRegistration">Has new registration</option>
                    <option value="updateInformation">Has updates</option>
                    <option value="replaceLostId">Has lost ID</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCenterStats.map((center) => {
                const stats = center.stats || {};
                return (
                  <button
                    key={center.centerId}
                    type="button"
                    onClick={() => navigate(`/dashboard/admin/operators/center/${encodeURIComponent(center.centerId)}`)}
                    className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#2563EB] hover:shadow-xl hover:shadow-blue-950/10"
                  >
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#2563EB] to-transparent opacity-0 transition group-hover:opacity-100" />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2563EB]">
                            <FiMapPin className="text-xs" />
                            {center.district || 'District'}
                          </div>
                          <h3 className="mt-3 text-lg font-black leading-snug tracking-tight text-[var(--text-main)]">
                            {center.centerName}
                          </h3>
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                            <FiPhone className="shrink-0" />
                            {center.phone || 'No phone recorded'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#2563EB] px-3 py-1.5 text-[11px] font-black text-white shadow-sm shadow-blue-600/20">
                          {stats.allAppointments || 0} total
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-2.5 py-2 text-center">
                          <p className="text-sm font-black text-amber-500">{stats.waiting || 0}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Waiting</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-2.5 py-2 text-center">
                          <p className="text-sm font-black text-emerald-500">{stats.completed || 0}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Done</p>
                        </div>
                        <div className="rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-2.5 py-2 text-center">
                          <p className="text-sm font-black text-[#2563EB]">{center.staffCount || 0}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Staff</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-5 py-3.5">
                      <span className="text-xs font-black text-[var(--text-main)]">
                        {center.staffCount || 0} staff assigned
                      </span>
                      <span className="inline-flex items-center gap-2 text-xs font-black text-[#2563EB]">
                        View assigned staff
                        <FiArrowRight className="transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </button>
                );
              })}
              {!loading && filteredCenterStats.length === 0 && (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--border-light)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)] md:col-span-2 xl:col-span-3">
                  No centers match the selected filters.
                </div>
              )}
            </div>
          </section>
        )}

        {isCenterManager && (
          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--nqs-panel-soft)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    {['Name', 'Username', 'Phone', 'District', 'Center', 'Type', 'Password'].map((heading) => (
                      <th key={heading} className="px-4 py-3.5 font-black">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {loading ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-[var(--text-muted)]">Loading operators...</td></tr>
                  ) : displayedOperators.length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-[var(--text-muted)]">No operators found for this center.</td></tr>
                  ) : displayedOperators.map((operator) => (
                    <tr key={operator._id} className="transition hover:bg-blue-500/5">
                      <td className="px-4 py-3 font-semibold">{operator.name}</td>
                      <td className="px-4 py-3 font-mono text-[#2563EB]">{operator.username}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{operator.phone}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{operator.assignedDistrict || operator.center?.district || '--'}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{operator.center?.name || '--'}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{staffTypeLabel(operator)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">Hidden</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {operatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-2xl shadow-black/20"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/15 text-[#2563EB]">
                  {editingId ? <FiEdit3 /> : <FiUserPlus />}
                </span>
                <div>
                  <h2 className="text-lg font-black">
                    {editingId ? 'Edit Operator Account' : isCenterManager ? 'Create Center Staff Account' : 'Create Operator Account'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Use username, phone, assigned center, role type, and temporary password.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOperatorModalOpen(false);
                  setEditingId('');
                  setForm(isCenterManager ? { ...emptyForm, center: assignedCenterId || '', operatorType: 'operator' } : emptyForm);
                }}
                className="rounded-xl border border-[var(--border-light)] p-2 text-[var(--text-muted)] transition hover:border-red-400 hover:text-red-500"
                aria-label="Close operator modal"
              >
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Full Name</span>
                <input className={inputClass} placeholder="Operator full name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Username</span>
                <input className={inputClass} placeholder="username" value={form.username} onChange={(event) => updateField('username', event.target.value)} disabled={Boolean(editingId)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Phone Number</span>
                <SomaliPhoneField value={form.phone} onChange={(value) => updateField('phone', value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Assigned Center</span>
                <select className={inputClass} value={form.center || (isCenterManager ? assignedCenterId || '' : '')} onChange={(event) => updateField('center', event.target.value)} disabled={isCenterManager}>
                  <option value="">Select assigned center</option>
                  {centers.map((center) => <option key={center._id} value={center._id}>{center.district ? `${center.district} - ` : ''}{center.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Account Type</span>
                <select className={inputClass} value="operator" onChange={(event) => updateField('operatorType', event.target.value)} disabled>
                  <option value="operator">Operator</option>
                </select>
              </label>
              {!editingId && (
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">Temporary Password</span>
                  <input className={inputClass} placeholder="Temporary password" type="password" value={form.temporaryPassword} onChange={(event) => updateField('temporaryPassword', event.target.value)} />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">The operator can change this password after login if required.</p>
                </label>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-light)] bg-[var(--nqs-panel-soft)]/50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setOperatorModalOpen(false);
                  setEditingId('');
                  setForm(isCenterManager ? { ...emptyForm, center: assignedCenterId || '', operatorType: 'operator' } : emptyForm);
                }}
                className="rounded-xl border border-[var(--border-light)] px-5 py-2.5 text-sm font-bold text-[var(--text-main)] transition hover:bg-blue-500/10"
              >
                Cancel
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#1d4ed8]" type="submit">
                <FiSave /> {editingId ? 'Save Changes' : isCenterManager ? 'Create Staff Operator' : 'Create Operator'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default OperatorManagement;
