import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiEdit3, FiRefreshCw, FiSave, FiUserPlus } from 'react-icons/fi';
import api from '../api/axiosInstance';

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

const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-black">Operator Management</h1>
          <p className="mt-1 text-sm text-slate-400">Create operators, assign centers, activate/deactivate accounts, and reset temporary passwords.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center gap-2">
            {editingId ? <FiEdit3 className="text-[#4189DD]" /> : <FiUserPlus className="text-[#4189DD]" />}
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
            <button className="inline-flex items-center gap-2 rounded-xl bg-[#4189DD] px-4 py-2 text-sm font-bold text-white hover:bg-blue-500" type="submit">
              <FiSave /> {editingId ? 'Update Operator' : 'Create Operator'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(''); setForm(emptyForm); }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                <tr>
                  {['Name', 'Username', 'Phone', 'Center', 'Type', 'Status', 'Password', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-slate-400">Loading operators...</td></tr>
                ) : operators.map((operator) => (
                  <tr key={operator._id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-semibold">{operator.name}</td>
                    <td className="px-4 py-3 font-mono text-[#7CB8FF]">{operator.username}</td>
                    <td className="px-4 py-3 text-slate-300">{operator.phone}</td>
                    <td className="px-4 py-3 text-slate-300">{operator.center?.name || '--'}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{operator.operatorType?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${operator.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                        {operator.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">Hidden</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => editOperator(operator)} className="rounded-lg border border-[#4189DD]/40 px-3 py-1.5 text-xs font-bold text-[#7CB8FF]">Edit</button>
                        <button onClick={() => setResetId(operator._id)} className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-200">Reset Password</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {resetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl">
            <h2 className="text-lg font-bold">Reset Operator Password</h2>
            <p className="mt-1 text-sm text-slate-400">Set a temporary password. The operator will be forced to change it after login.</p>
            <input className={`${inputClass} mt-4`} type="password" placeholder="Temporary password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setResetId(''); setResetPassword(''); }} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold">Cancel</button>
              <button onClick={resetOperatorPassword} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950"><FiRefreshCw /> Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorManagement;
