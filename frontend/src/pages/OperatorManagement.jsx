import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiEdit3, FiKey, FiRefreshCw, FiSave, FiUserPlus } from 'react-icons/fi';
import api from '../api/axiosInstance';
import DataTable from '../components/ui/DataTable';

const emptyForm = {
  name: '',
  username: '',
  email: '',
  phone: '',
  center: '',
  operatorType: 'operator',
  status: 'active',
  temporaryPassword: ''
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-[#27476f] dark:bg-[#061225] dark:text-white';

const OperatorManagement = () => {
  const [operators, setOperators] = useState([]);
  const [centers, setCenters] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetId, setResetId] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [operatorsRes, centersRes] = await Promise.all([
        api.get('/api/operators'),
        api.get('/api/centers')
      ]);
      setOperators(operatorsRes.data.data || []);
      setCenters(centersRes.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load operators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        await api.put(`/api/operators/${editingId}`, form);
        toast.success('Operator updated.');
      } else {
        await api.post('/api/operators', form);
        toast.success('Operator created.');
      }
      setForm(emptyForm);
      setEditingId('');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save operator.');
    }
  };

  const editOperator = (operator) => {
    setEditingId(operator._id);
    setForm({
      name: operator.name || '',
      username: operator.username || '',
      email: operator.email || '',
      phone: operator.phone || '',
      center: operator.center?._id || operator.center || '',
      operatorType: operator.operatorType || operator.role || 'operator',
      status: operator.status || 'active',
      temporaryPassword: ''
    });
  };

  const resetOperatorPassword = async () => {
    if (!resetId || !resetPassword) return;
    try {
      await api.put(`/api/operators/${resetId}/reset-password`, { temporaryPassword: resetPassword });
      toast.success('Temporary password set. Operator must change it on next login.');
      setResetId('');
      setResetPassword('');
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to reset password.');
    }
  };

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      render: (row) => <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>,
    },
    {
      header: 'Username',
      accessor: 'username',
      render: (row) => <span className="font-mono text-blue-700 dark:text-[#7CB8FF]">{row.username}</span>,
    },
    { header: 'Phone', accessor: 'phone' },
    {
      header: 'Center',
      accessor: 'center',
      sortValue: (row) => row.center?.name || '',
      render: (row) => row.center?.name || '—',
    },
    {
      header: 'Type',
      accessor: 'operatorType',
      render: (row) => <span className="capitalize">{(row.operatorType || '').replace('_', ' ')}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
          row.status === 'active'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
        }`}>
          {row.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: '_actions',
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); editOperator(row); }}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:border-[#4189DD]/40 dark:text-[#7CB8FF] dark:hover:bg-blue-950/40"
          >
            <FiEdit3 className="h-3 w-3" /> Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setResetId(row._id); }}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-950/30"
          >
            <FiKey className="h-3 w-3" /> Reset Password
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Operator Management</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Create operators, assign centers, activate/deactivate accounts, and reset temporary passwords.
        </p>
      </div>

      {/* Create / edit form */}
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1d355f] dark:bg-[#071a33]">
        <div className="mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
          {editingId ? <FiEdit3 className="text-blue-600 dark:text-[#4189DD]" /> : <FiUserPlus className="text-blue-600 dark:text-[#4189DD]" />}
          <h2 className="font-bold">{editingId ? 'Edit Operator' : 'Create Operator'}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder="Full name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <input className={inputClass} placeholder="Username" value={form.username} onChange={(event) => updateField('username', event.target.value)} disabled={Boolean(editingId)} />
          <input className={inputClass} placeholder="Email optional" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
          <input className={inputClass} placeholder="Phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <select className={inputClass} value={form.center} onChange={(event) => updateField('center', event.target.value)}>
            <option value="">Assigned center</option>
            {centers.map((center) => <option key={center._id} value={center._id}>{center.name}</option>)}
          </select>
          <select className={inputClass} value={form.operatorType} onChange={(event) => updateField('operatorType', event.target.value)}>
            <option value="operator">Operator</option>
            <option value="super_operator">Super Operator</option>
          </select>
          <select className={inputClass} value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {!editingId && (
            <input className={inputClass} placeholder="Temporary password" type="password" value={form.temporaryPassword} onChange={(event) => updateField('temporaryPassword', event.target.value)} />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700" type="submit">
            <FiSave /> {editingId ? 'Update Operator' : 'Create Operator'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(''); setForm(emptyForm); }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#27476f] dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <DataTable
        columns={columns}
        data={operators}
        loading={loading}
        searchPlaceholder="Search operators by name, username, or center..."
        emptyTitle="No operators yet"
        emptyText="Create the first operator account with the form above."
      />

      {/* Reset password modal */}
      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl dark:border-[#1d355f] dark:bg-[#071a33] dark:text-white">
            <h2 className="text-lg font-bold">Reset Operator Password</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Set a temporary password. The operator will be forced to change it after login.
            </p>
            <input className={`${inputClass} mt-4`} type="password" placeholder="Temporary password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setResetId(''); setResetPassword(''); }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-[#27476f] dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={resetOperatorPassword}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400"
              >
                <FiRefreshCw /> Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorManagement;
