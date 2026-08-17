import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFilter,
  FiMapPin,
  FiPhone,
  FiPower,
  FiSave,
  FiSearch,
  FiShield,
  FiUser,
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

const staffTypeValue = (operator = {}) => (
  staffTypeLabel(operator) === 'Center Manager' ? 'center_manager' : 'operator'
);

const statusLabel = (status = '') => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending_approval') return 'Pending Approval';
  if (normalized === 'active') return 'Active';
  if (normalized === 'inactive') return 'Inactive';
  if (normalized === 'rejected') return 'Rejected';
  return status || 'Unknown';
};

const isPendingOrRejected = (operator = {}) => ['pending_approval', 'rejected'].includes(String(operator.status || '').toLowerCase());

const isOperatorActiveToday = (operator = {}) => {
  if (String(operator.status || '').toLowerCase() !== 'active') return false;
  if (!operator.lastActiveAt) return false;
  const seen = new Date(operator.lastActiveAt);
  if (Number.isNaN(seen.getTime())) return false;
  const now = new Date();
  return seen.getFullYear() === now.getFullYear() && seen.getMonth() === now.getMonth() && seen.getDate() === now.getDate();
};

const effectiveStatus = (operator = {}) => (
  isPendingOrRejected(operator) ? String(operator.status || '').toLowerCase() : (isOperatorActiveToday(operator) ? 'active' : 'inactive')
);

const operatorRowStatusLabel = (operator = {}) => {
  if (isPendingOrRejected(operator)) return statusLabel(operator.status);
  return isOperatorActiveToday(operator) ? 'Active' : 'Inactive';
};

// Sitewide soft pastel tone system (see styles/nqs-theme-system.css): every
// card/badge on this page pulls from the same nqs-card-tone-*/nqs-badge-tone-*
// classes so the palette stays consistent across the whole app.
const statusBadgeClass = (status = '') => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active') return 'nqs-badge-tone-green';
  if (normalized === 'pending_approval') return 'nqs-badge-tone-purple';
  if (normalized === 'inactive') return 'nqs-badge-tone-pink';
  if (normalized === 'rejected') return 'nqs-badge-tone-pink';
  return 'nqs-badge-tone-blue';
};

const typeBadgeClass = 'nqs-badge-tone-blue';

const AVATAR_TONES = [
  'nqs-badge-tone-blue',
  'nqs-badge-tone-purple',
  'nqs-badge-tone-green',
  'nqs-badge-tone-pink'
];

const initials = (name = '') => (
  name.trim().split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '--'
);

const CARD_ICON_TONE = {
  blue: 'nqs-card-tone-icon-blue',
  green: 'nqs-card-tone-icon-green',
  purple: 'nqs-card-tone-icon-purple',
  pink: 'nqs-card-tone-icon-pink',
  cyan: 'nqs-card-tone-icon-cyan'
};

// Soft pastel card backgrounds for the top filter/stat cards, from the sitewide
// nqs-card-tone-* system (styles/nqs-theme-system.css) — thin matching border included.
const CARD_BG_TONE = {
  blue: 'nqs-card-tone-blue',
  pink: 'nqs-card-tone-pink',
  purple: 'nqs-card-tone-purple',
  green: 'nqs-card-tone-green',
  cyan: 'nqs-card-tone-cyan'
};

const centerDistrict = (operator = {}) => operator.assignedDistrict || operator.center?.district || '';

const centerName = (operator = {}) => operator.center?.name || 'Unassigned';

const entityId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
};

const OperatorManagement = () => {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [operators, setOperators] = useState([]);
  const [centers, setCenters] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staffFilters, setStaffFilters] = useState({ search: '', center: '' });
  const [systemUsers, setSystemUsers] = useState([]);
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const isCenterManager = role === 'super_operator' || role === 'center_manager';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [approvingId, setApprovingId] = useState('');
  const statusFilterParam = searchParams.get('status') || '';
  const [statusFilter, setStatusFilter] = useState(statusFilterParam);
  const notifiedOperatorId = searchParams.get('operator') || '';

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || '');
    setTypeFilter(searchParams.get('type') || '');
  }, [searchParams]);
  const assignedCenterId =
    (typeof user?.assignedCenter === 'object' ? user.assignedCenter?._id : user?.assignedCenter) ||
    (typeof user?.center === 'object' ? user.center?._id : user?.center) ||
    user?.assignedCenterId ||
    user?.centerId ||
    '';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [operatorsRes, centersRes] = await Promise.all([
        api.get('/api/operators'),
        isCenterManager ? api.get('/api/centers/assigned/me') : api.get('/api/centers')
      ]);
      setOperators(operatorsRes.data.data || []);
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

  useEffect(() => {
    if (isCenterManager) return;
    let cancelled = false;
    api.get('/api/users', { params: { role: 'system' } })
      .then((res) => {
        if (!cancelled) setSystemUsers(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setSystemUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isCenterManager]);

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
        toast.success(isCenterManager ? 'Operator created and sent for Super Admin approval.' : 'Operator created and activated.');
      }
      setForm(isCenterManager ? { ...emptyForm, center: assignedCenterId || '', operatorType: 'operator' } : emptyForm);
      setEditingId('');
      setOperatorModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save operator.');
    }
  };

  const staffStats = useMemo(() => ({
    total: operators.length,
    pending: operators.filter((op) => String(op.status || '').toLowerCase() === 'pending_approval').length,
    active: operators.filter((op) => effectiveStatus(op) === 'active').length,
    inactive: operators.filter((op) => effectiveStatus(op) === 'inactive').length
  }), [operators]);

  const centerOptions = useMemo(() => (
    centers
      .map((center) => ({ id: center._id || center.id, name: center.name, district: center.district }))
      .filter((center) => center.id && center.name)
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [centers]);

  const displayedOperators = useMemo(() => {
    const searchTerm = staffFilters.search.trim().toLowerCase();
    return operators.filter((operator) => {
      const searchText = [
        operator.name,
        operator.username,
        operator.phone,
        staffTypeLabel(operator),
        centerName(operator),
        centerDistrict(operator)
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesStatus = !statusFilter || effectiveStatus(operator) === statusFilter.toLowerCase();
      const matchesSearch = !searchTerm || searchText.includes(searchTerm);
      const matchesCenter = !staffFilters.center || entityId(operator.center) === staffFilters.center;
      const matchesType = !typeFilter || staffTypeValue(operator) === typeFilter;
      return matchesStatus && matchesSearch && matchesCenter && matchesType;
    });
  }, [operators, staffFilters, statusFilter, typeFilter]);

  const staffTypeCards = useMemo(() => {
    const centerManagerCount = operators.filter((operator) => staffTypeValue(operator) === 'center_manager').length;
    const operatorCount = operators.filter((operator) => staffTypeValue(operator) === 'operator').length;
    return [
      { key: '', label: 'All Staff', value: operators.length, tone: 'blue' },
      { key: 'center_manager', label: 'Center Managers', value: centerManagerCount, tone: 'purple' },
      { key: 'operator', label: 'Operators', value: operatorCount, tone: 'green' }
    ];
  }, [operators]);

  const systemAccountCards = useMemo(() => ([
    {
      key: 'user_management',
      label: 'User Management',
      value: systemUsers.length,
      note: 'All system accounts',
      icon: <FiShield />,
      tone: 'blue',
      onClick: () => navigate('/user-management')
    },
    {
      key: 'admins',
      label: 'Admins',
      value: systemUsers.filter((account) => ['admin', 'super_admin'].includes(account.role)).length,
      note: 'Admin + Super Admin',
      icon: <FiUser />,
      tone: 'cyan',
      onClick: () => navigate('/user-management')
    },
    {
      key: 'managers',
      label: 'Managers',
      value: systemUsers.filter((account) => account.role === 'user_manager').length,
      note: 'User Manager accounts',
      icon: <FiUsers />,
      tone: 'purple',
      onClick: () => navigate('/user-management')
    }
  ]), [navigate, systemUsers]);

  const openOperatorDetail = useCallback((operator) => {
    const operatorId = operator._id || operator.id;
    if (!operatorId) return;
    navigate(`/operator-management/${encodeURIComponent(operatorId)}`);
  }, [navigate]);

  const openStaffPage = useCallback((status = '') => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    navigate(`/operator-management${params.toString() ? `?${params.toString()}` : ''}`);
  }, [navigate]);

  const staffMetricCards = useMemo(() => ([
    {
      key: 'all_staff',
      label: 'Total Staff',
      value: staffStats.total,
      status: '',
      onClick: () => openStaffPage(),
      icon: <FiUsers />,
      tone: 'blue',
      note: 'Registered operator accounts'
    },
    {
      key: 'active_staff',
      label: 'Active Staff',
      value: staffStats.active,
      status: 'active',
      onClick: () => openStaffPage('active'),
      icon: <FiUserCheck />,
      tone: 'green',
      note: 'Logged in today'
    },
    {
      key: 'pending_staff',
      label: 'Pending Approval',
      value: staffStats.pending,
      status: 'pending_approval',
      onClick: () => openStaffPage('pending_approval'),
      icon: <FiClock />,
      tone: 'purple',
      note: 'Awaiting Super Admin review'
    },
    {
      key: 'inactive_staff',
      label: 'Inactive',
      value: staffStats.inactive,
      status: 'inactive',
      onClick: () => openStaffPage('inactive'),
      icon: <FiPower />,
      tone: 'pink',
      note: 'Not logged in today'
    }
  ]), [openStaffPage, staffStats]);

  const openCreateOperator = () => {
    setEditingId('');
    setForm({
      ...emptyForm,
      center: isCenterManager ? assignedCenterId || '' : '',
      operatorType: 'operator'
    });
    setOperatorModalOpen(true);
  };

  const changeOperatorStatus = async (id, action) => {
    const actionCopy = {
      approve: { endpoint: 'approve', success: 'Staff account approved.', error: 'Unable to approve staff account.' },
      activate: { endpoint: 'activate', success: 'Staff account activated.', error: 'Unable to activate staff account.' },
      deactivate: { endpoint: 'deactivate', success: 'Staff account deactivated.', error: 'Unable to deactivate staff account.' }
    }[action];
    if (!actionCopy) return;

    if (action === 'deactivate' && !window.confirm('Deactivate this staff account?')) {
      return;
    }

    try {
      if (action === 'approve') setApprovingId(id);
      await api.put(`/api/operators/${id}/${actionCopy.endpoint}`);
      if (action === 'approve') {
        setOperators((current) => current.map((operator) => {
          const operatorId = operator._id || operator.id;
          return operatorId === id ? { ...operator, status: 'active' } : operator;
        }));
      }
      toast.success(actionCopy.success);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || actionCopy.error);
    } finally {
      if (action === 'approve') setApprovingId('');
    }
  };

  const notifiedOperator = useMemo(() => {
    if (!notifiedOperatorId) return null;
    return operators.find((operator) => {
      const id = operator._id || operator.id;
      return id === notifiedOperatorId && String(operator.status || '').toLowerCase() === 'pending_approval';
    }) || null;
  }, [notifiedOperatorId, operators]);

  return (
    <div className="nqs-operator-mgmt min-h-screen bg-[var(--bg-app)] p-4 text-[var(--text-main)] sm:p-6">
      <div className="w-full max-w-none space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] sm:text-3xl">
              {isCenterManager ? 'Center Staff' : 'Operator Management'}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              {isCenterManager
                ? 'Create staff operators for your center. New operators wait for Super Admin approval before login.'
                : 'Create staff accounts, review approvals, and see who has logged in today.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateOperator}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[var(--color-primary-hover)]"
          >
            <FiUserPlus />
            {isCenterManager ? 'Add Staff' : 'Add Operator'}
          </button>
        </header>

        {notifiedOperator && (
          <div className="flex flex-col gap-3 rounded-2xl border nqs-card-tone-purple p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg nqs-card-tone-icon-purple">
                <FiClock />
              </span>
              <div>
                <p className="text-sm font-black text-[var(--text-main)]">
                  {notifiedOperator.name || notifiedOperator.username} is awaiting your approval
                </p>
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  @{notifiedOperator.username || '--'} - {centerName(notifiedOperator)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => changeOperatorStatus(notifiedOperator._id || notifiedOperator.id, 'approve')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[var(--color-primary-hover)]"
            >
              <FiCheckCircle /> Approve
            </button>
          </div>
        )}

        <section className="space-y-5">
          <div className="flex flex-wrap gap-3">
            {staffTypeCards.map((card) => {
              const selected = typeFilter === card.key;
              return (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => setTypeFilter(card.key)}
                  className={`inline-flex items-center gap-2.5 rounded-xl border ${CARD_BG_TONE[card.tone]} px-4 py-2.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    selected ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)]' : 'border-[var(--border-light)]'
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${CARD_ICON_TONE[card.tone]}`}>
                    {card.value}
                  </span>
                  <span className="font-black text-[var(--text-main)]">{card.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {staffMetricCards.map((item) => {
              const selected = statusFilter === item.status;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={`flex min-h-[128px] flex-col justify-between gap-4 rounded-2xl border ${CARD_BG_TONE[item.tone]} p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    selected ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)]' : 'border-[var(--border-light)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{item.label}</span>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${CARD_ICON_TONE[item.tone]}`}>
                      {item.icon}
                    </span>
                  </div>
                  <div>
                    <span className="block text-3xl font-black leading-none text-[var(--text-main)]">{item.value}</span>
                    <span className="mt-1.5 block text-xs font-semibold text-[var(--text-muted)]">{item.note}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {!isCenterManager && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">User Management</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {systemAccountCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={card.onClick}
                    className={`flex min-h-[110px] flex-col justify-between gap-3 rounded-xl border ${CARD_BG_TONE[card.tone]} p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{card.label}</span>
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${CARD_ICON_TONE[card.tone]}`}>
                        {card.icon}
                      </span>
                    </div>
                    <div>
                      <span className="block text-2xl font-black leading-none text-[var(--text-main)]">{card.value}</span>
                      <span className="mt-1 block text-xs font-semibold text-[var(--text-muted)]">{card.note}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 pr-1 text-sm font-black text-[var(--text-muted)]">
                <FiFilter /> Filters:
              </span>
              <label className="relative block">
                <FiMapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <select
                  className={`${inputClass} min-w-[180px] pl-9`}
                  value={staffFilters.center}
                  onChange={(event) => setStaffFilters((current) => ({ ...current, center: event.target.value }))}
                >
                  <option value="">All Centers</option>
                  {centerOptions.map((center) => (
                    <option key={center.id} value={center.id}>{center.district ? `${center.district} - ` : ''}{center.name}</option>
                  ))}
                </select>
              </label>
              <label className="relative block">
                <FiUserCheck className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <select
                  className={`${inputClass} min-w-[170px] pl-9`}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
            <label className="relative mt-3 block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Search by operator name or username..."
                value={staffFilters.search}
                onChange={(event) => setStaffFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </label>
          </div>

          <div className="w-full max-w-none overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-[var(--nqs-panel-soft)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    {[
                      ['Operator Name', 'w-[15%]'],
                      ['Username', 'w-[13%]'],
                      ['Phone', 'w-[11%]'],
                      ['Center', 'w-[14%]'],
                      ['Operator Type', 'w-[9%]'],
                      ['Status', 'w-[10%]'],
                    ].map(([heading, width]) => (
                      <th key={heading} className={`px-4 py-2.5 font-black ${width}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {loading ? (
                    <tr><td colSpan="6" className="px-4 py-10 text-center text-[var(--text-muted)]">Loading staff accounts...</td></tr>
                  ) : displayedOperators.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-10 text-center text-[var(--text-muted)]">No staff accounts match the selected filters.</td></tr>
                  ) : displayedOperators.map((operator, index) => {
                    const operatorId = operator._id || operator.id;
                    return (
                      <tr
                        key={operatorId}
                        onClick={() => openOperatorDetail(operator)}
                        className="cursor-pointer transition hover:bg-[var(--color-primary-soft)]"
                        tabIndex={0}
                        role="button"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openOperatorDetail(operator);
                          }
                        }}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
                              {initials(operator.name)}
                            </span>
                            <span className="max-w-[140px] truncate font-semibold text-[var(--text-main)]" title={operator.name || '--'}>{operator.name || '--'}</span>
                          </div>
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-2 text-[var(--text-muted)]" title={`@${operator.username || '--'}`}>@{operator.username || '--'}</td>
                        <td className="px-4 py-2 text-[var(--text-muted)]">{operator.phone || '--'}</td>
                        <td className="max-w-[160px] px-4 py-2">
                          <div className="truncate font-semibold text-[var(--text-main)]" title={centerName(operator)}>{centerName(operator)}</div>
                          {centerDistrict(operator) ? (
                            <div className="truncate text-xs text-[var(--text-muted)]" title={centerDistrict(operator)}>{centerDistrict(operator)}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${typeBadgeClass}`}>
                            {staffTypeLabel(operator)}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {isAdmin && effectiveStatus(operator) === 'pending_approval' ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                changeOperatorStatus(operatorId, 'approve');
                              }}
                              disabled={approvingId === operatorId}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-[11px] font-black text-emerald-600 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <FiCheckCircle />
                              {approvingId === operatorId ? 'Approving' : 'Approve'}
                            </button>
                          ) : (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusBadgeClass(effectiveStatus(operator))}`}>
                              {operatorRowStatusLabel(operator)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && (
              <div className="border-t border-[var(--border-light)] bg-[var(--nqs-panel-soft)]/50 px-4 py-3 text-xs font-semibold text-[var(--text-muted)]">
                Showing {displayedOperators.length} of {operators.length} operators
              </div>
            )}
          </div>
        </section>
      </div>

      {operatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-2xl shadow-black/20"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
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
                <input className={inputClass} placeholder="Operator full name" value={form.name} onChange={(event) => updateField('name', event.target.value.replace(/[^A-Za-z\s'-]/g, ''))} />
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
                  {centers.map((center) => {
                    const centerId = center._id || center.id;
                    return <option key={centerId} value={centerId}>{center.district ? `${center.district} - ` : ''}{center.name}</option>;
                  })}
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
                className="nqs-om-cancel-btn rounded-xl border border-[var(--border-light)] px-5 py-2.5 text-sm font-bold text-[var(--text-main)] transition hover:bg-blue-500/10"
              >
                Cancel
              </button>
              <button className="nqs-om-submit-btn inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[var(--color-primary-hover)]" type="submit">
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
