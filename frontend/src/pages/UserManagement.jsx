import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiShield,
  FiSlash,
  FiUser,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiX
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';

const emptyAdminForm = {
  name: '',
  username: '',
  phone: '',
  role: 'admin',
  password: ''
};

const managedRoleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'user_manager', label: 'User Manager' }
];

const roleLabel = (role = '') => managedRoleOptions.find((item) => item.value === role)?.label || role || '--';

const isUserActive = (user) => String(user?.status || '').toLowerCase() === 'active';

// The Status badge shows real presence, not just the enabled/disabled toggle: an
// enabled account only reads "Active" if the person actually signed in today. The
// Activate/Deactivate button still reflects the real enabled/disabled state (isUserActive)
// since that's an admin action unrelated to today's login.
const isUserActiveToday = (user) => {
  if (!isUserActive(user) || !user?.lastActiveAt) return false;
  const seen = new Date(user.lastActiveAt);
  if (Number.isNaN(seen.getTime())) return false;
  const now = new Date();
  return seen.getFullYear() === now.getFullYear() && seen.getMonth() === now.getMonth() && seen.getDate() === now.getDate();
};

const isCenterManagerType = (operator = {}) => {
  const type = String(operator.operatorType || operator.role || '').toLowerCase();
  return type === 'super_operator' || type === 'center_manager';
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { role: currentRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [details, setDetails] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [operators, setOperators] = useState([]);
  const canSeeOperators = currentRole === 'admin' || currentRole === 'super_admin';

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) {
      setRoleFilter(roleParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!canSeeOperators) return;
    let cancelled = false;
    api.get('/api/operators')
      .then((res) => {
        if (!cancelled) setOperators(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setOperators([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeOperators]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/users', { params: { search, role: roleFilter || 'system' } });
      setUsers(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => ['admin', 'super_admin'].includes(user.role)).length,
    managers: users.filter((user) => user.role === 'user_manager').length
  }), [users]);

  const operatorStats = useMemo(() => {
    const centerManagers = operators.filter(isCenterManagerType).length;
    return {
      total: operators.length,
      centerManagers,
      operatorsOnly: operators.length - centerManagers,
      pending: operators.filter((op) => String(op.status || '').toLowerCase() === 'pending_approval').length
    };
  }, [operators]);

  const systemAccountCards = useMemo(() => ([
    {
      key: 'user_management',
      label: 'User Management',
      value: counts.total,
      note: 'All system accounts',
      icon: <FiShield />,
      tone: 'blue'
    },
    {
      key: 'admins',
      label: 'Admins',
      value: counts.admins,
      note: 'Admin + Super Admin',
      icon: <FiUser />,
      tone: 'cyan'
    },
    {
      key: 'managers',
      label: 'Managers',
      value: counts.managers,
      note: 'User Manager accounts',
      icon: <FiUsers />,
      tone: 'purple'
    }
  ]), [counts]);

  const operatorOverviewCards = useMemo(() => ([
    {
      key: 'total_operators',
      label: 'Operators',
      value: operatorStats.total,
      note: 'All center staff accounts',
      icon: <FiBriefcase />,
      tone: 'green',
      onClick: () => navigate('/operator-management')
    },
    {
      key: 'center_managers',
      label: 'Center Managers',
      value: operatorStats.centerManagers,
      note: 'Managing a center',
      icon: <FiUserCheck />,
      tone: 'purple',
      onClick: () => navigate('/operator-management?type=center_manager')
    },
    {
      key: 'pending_operators',
      label: 'Pending Approval',
      value: operatorStats.pending,
      note: 'Awaiting Super Admin review',
      icon: <FiClock />,
      tone: 'pink',
      onClick: () => navigate('/operator-management?status=pending_approval')
    }
  ]), [navigate, operatorStats]);

  const openDetails = async (user) => {
    try {
      setSelectedUser(user);
      setDetails(null);
      const res = await api.get(`/api/users/${user.id || user._id}`);
      setDetails(res.data.data || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load user profile.');
    }
  };

  const toggleUserStatus = async (user) => {
    const id = user.id || user._id;
    const nextStatus = isUserActive(user) ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'active' ? 'Activate' : 'Deactivate';
    if (!window.confirm(`${actionLabel} ${roleLabel(user.role)} ${user.name || user.username}?`)) return;
    try {
      setBusyId(id);
      await api.put(`/api/users/${id}/status`, { status: nextStatus });
      toast.success(nextStatus === 'active' ? 'Account activated.' : 'Account deactivated.');
      await loadUsers();
      if (selectedUser && (selectedUser.id || selectedUser._id) === id) {
        setSelectedUser((current) => (current ? { ...current, status: nextStatus } : current));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Unable to ${actionLabel.toLowerCase()} account.`);
    } finally {
      setBusyId('');
    }
  };

  const updateAdminField = (field, value) => {
    setAdminForm((current) => ({ ...current, [field]: value }));
  };

  const createAdmin = async (event) => {
    event.preventDefault();
    try {
      const res = await api.post('/api/users/admins', adminForm);
      setGeneratedPassword({
        name: res.data?.data?.name || adminForm.name,
        username: res.data?.data?.username || adminForm.username,
        role: res.data?.data?.role || adminForm.role,
        password: res.data?.temporaryPassword
      });
      toast.success('Account created. Copy the generated password now.');
      setAdminForm(emptyAdminForm);
      setAdminModalOpen(false);
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create admin account.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-black">Role Management</h1>
              <p className="mt-1 text-sm text-slate-300">Create system users, assign roles, and manage admin access.</p>
            </div>
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700"
            >
              <FiUserPlus /> Create Account
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">User Management</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {systemAccountCards.map((card) => (
              <div
                key={card.key}
                className={`flex min-h-[110px] flex-col justify-between gap-3 rounded-xl border nqs-card-tone-${card.tone} p-4 shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{card.label}</span>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base nqs-card-tone-icon-${card.tone}`}>
                    {card.icon}
                  </span>
                </div>
                <div>
                  <span className="block text-2xl font-black leading-none text-[var(--text-main)]">{card.value}</span>
                  <span className="mt-1 block text-xs font-semibold text-[var(--text-muted)]">{card.note}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {canSeeOperators && (
          <section className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Operators</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {operatorOverviewCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  className={`flex min-h-[110px] flex-col justify-between gap-3 rounded-xl border nqs-card-tone-${card.tone} p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{card.label}</span>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base nqs-card-tone-icon-${card.tone}`}>
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
          </section>
        )}

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <label className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin name, phone, or username"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">All roles</option>
              {managedRoleOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <button onClick={loadUsers} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold hover:bg-blue-700">
              <FiRefreshCw /> Refresh
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase text-slate-300">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="w-px whitespace-nowrap px-4 py-3">Status</th>
                  <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">Loading accounts...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400"><FiUsers className="mx-auto mb-2" />No managed accounts found.</td></tr>
                ) : users.map((user) => {
                  const id = user.id || user._id;
                  const active = isUserActive(user);
                  const activeToday = isUserActiveToday(user);
                  return (
                    <tr key={id} className="border-t border-slate-800 hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-bold">{user.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{user.username || '--'}</td>
                      <td className="px-4 py-3 text-slate-300">{user.phone || '--'}</td>
                      <td className="px-4 py-3 text-slate-300">{roleLabel(user.role)}</td>
                      <td className="w-px whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${activeToday ? 'bg-emerald-600/15 text-emerald-300' : 'bg-slate-600/25 text-slate-300'}`}>
                          {activeToday ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex flex-nowrap justify-end gap-2">
                          <button onClick={() => openDetails(user)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-slate-800">View</button>
                          {active ? (
                            <button
                              disabled={busyId === id}
                              onClick={() => toggleUserStatus(user)}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-600/15 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-600/25 disabled:opacity-50"
                            >
                              <FiSlash /> Deactivate
                            </button>
                          ) : (
                            <button
                              disabled={busyId === id}
                              onClick={() => toggleUserStatus(user)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/25 disabled:opacity-50"
                            >
                              <FiCheckCircle /> Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          >
            <section
              className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{selectedUser.name}</h2>
                  <p className="text-sm text-slate-400">{selectedUser.username} - {selectedUser.phone || 'No phone'}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold hover:bg-slate-800">Close</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-400">Role</p><p className="font-bold">{roleLabel(details?.user?.role || selectedUser.role)}</p></div>
                <div className="rounded-lg bg-slate-950 p-3"><p className="text-xs text-slate-400">Created</p><p className="font-bold">{details?.user?.createdAt ? new Date(details.user.createdAt).toLocaleDateString() : '--'}</p></div>
              </div>
            </section>
          </div>
        )}

        {adminModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
            <form onSubmit={createAdmin} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    <FiShield />
                  </span>
                  <div>
                    <h2 className="text-xl font-black">Create System Account</h2>
                    <p className="mt-1 text-sm text-slate-400">Set the login password, or leave it blank to generate one.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminModalOpen(false);
                    setAdminForm(emptyAdminForm);
                  }}
                  className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-red-400 hover:text-red-300"
                  aria-label="Close admin form"
                >
                  <FiX />
                </button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-slate-300">Full Name</span>
                  <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-blue-400" value={adminForm.name} onChange={(event) => updateAdminField('name', event.target.value.replace(/[^A-Za-z\s'-]/g, ''))} placeholder="Full name" required />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-slate-300">Username</span>
                  <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-blue-400" value={adminForm.username} onChange={(event) => updateAdminField('username', event.target.value)} placeholder="admin username" autoComplete="username" required />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-slate-300">Phone</span>
                  <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-blue-400" value={adminForm.phone} onChange={(event) => updateAdminField('phone', event.target.value)} placeholder="+25261..." required />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-slate-300">Login Password</span>
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                    value={adminForm.password}
                    onChange={(event) => updateAdminField('password', event.target.value)}
                    placeholder="Enter password or leave blank"
                    autoComplete="new-password"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">If blank, the server generates a one-time password.</p>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
                <button type="button" onClick={() => { setAdminModalOpen(false); setAdminForm(emptyAdminForm); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800">Cancel</button>
                <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black hover:bg-blue-700">
                  <FiSave /> Create Account
                </button>
              </div>
            </form>
          </div>
        )}

        {generatedPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-amber-400/40 bg-slate-900 p-5 text-white shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">One-time login password</p>
                  <h2 className="mt-1 text-xl font-black">{generatedPassword.name}</h2>
                  <p className="mt-1 text-sm text-slate-300">{roleLabel(generatedPassword.role)} - {generatedPassword.username}</p>
                </div>
                <button onClick={() => setGeneratedPassword(null)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-red-400 hover:text-red-300" aria-label="Close generated password">
                  <FiX />
                </button>
              </div>
              <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-sm font-bold text-amber-200">Use this password to sign in. It will not be displayed again.</p>
                <p className="mt-3 select-all rounded-lg bg-slate-950 px-4 py-3 font-mono text-lg font-black tracking-wide text-amber-100">
                  {generatedPassword.password}
                </p>
              </div>
              <div className="mt-5 flex justify-end">
                <button onClick={() => setGeneratedPassword(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black hover:bg-blue-700">
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
