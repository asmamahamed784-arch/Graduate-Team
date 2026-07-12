import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle,
  FiEye,
  FiSearch,
  FiSlash,
  FiXCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';

const statusOptions = ['', 'Waiting', 'Being Served', 'On Hold', 'Completed', 'Cancelled'];
const requestStatusOptions = ['', 'Pending', 'Approved', 'Rejected', 'Completed', 'Resubmission Required'];
const requestTabs = [
  { key: 'new_national_id', label: 'New Registration' },
  { key: 'update_information', label: 'Update Information' },
  { key: 'lost_replacement', label: 'Lost ID Replacement' }
];
const cancellationReasons = [
  'Name is incorrect',
  'Mother’s name is incorrect',
  'Birth date is incorrect',
  'Phone number is incorrect',
  'Missing document',
  'Other reason'
];

const statusClass = (status) => {
  const base = 'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Completed') return `${base} bg-emerald-500/15 text-emerald-300`;
  if (status === 'Cancelled') return `${base} bg-red-500/15 text-red-300`;
  if (status === 'Rejected') return `${base} bg-red-500/15 text-red-300`;
  if (status === 'Being Served') return `${base} bg-sky-500/15 text-sky-300`;
  if (status === 'On Hold') return `${base} bg-amber-500/15 text-amber-300`;
  if (status === 'Pending') return `${base} bg-amber-500/15 text-amber-300`;
  if (status === 'Approved') return `${base} bg-blue-500/15 text-blue-300`;
  return `${base} bg-blue-500/15 text-blue-300`;
};

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getQueueNumber = (ref) => {
  if (!ref) return '--';
  return ref.split('-').pop();
};

const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

function AdminAppointments() {
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [centers, setCenters] = useState([]);
  const [activeTab, setActiveTab] = useState('new_national_id');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    requestType: '',
    requestStatus: '',
    center: '',
    date: ''
  });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState(cancellationReasons[0]);
  const [customCancelReason, setCustomCancelReason] = useState('');

  const activeFilters = useMemo(() => {
    const active = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value)
    );
    active.requestType = activeTab;
    return active;
  }, [filters, activeTab]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    const requestedDate = searchParams.get('date');
    if (requestedDate === 'today') {
      updateFilter('date', new Date().toISOString().slice(0, 10));
    } else if (requestedDate) {
      updateFilter('date', requestedDate);
    }
  }, [searchParams]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const [appointmentsRes, centersRes] = await Promise.all([
        api.get('/api/bookings/admin/all', { params: activeFilters }),
        api.get('/api/centers')
      ]);
      setAppointments(appointmentsRes.data.data || []);
      setCenters(centersRes.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load appointments.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const getDisplayStatus = (appointment) => {
    if (appointment.requestType === 'new_national_id') {
      return appointment.status || 'Pending';
    }
    return appointment.requestStatus || appointment.status || 'Pending';
  };

  const getUpdatedFields = (appointment) => {
    if (!appointment.updateDetails?.changes?.length) {
      return appointment.updateDetails?.fieldToUpdate || 'Not specified';
    }
    return appointment.updateDetails.changes.map((change) => change.field).filter(Boolean).join(', ');
  };

  const updateAppointmentStatus = async (appointment, status, extra = {}) => {
    try {
      setUpdatingId(appointment._id);
      const res = await api.put(`/api/bookings/admin/${appointment._id}/status`, { status, ...extra });
      if (res.data.success) {
        toast.success(`Ticket ${appointment.ref} updated.`);
        await loadAppointments();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update appointment.');
    } finally {
      setUpdatingId('');
    }
  };

  const openCancelModal = (appointment) => {
    setCancelTarget(appointment);
    setCancelReason(cancellationReasons[0]);
    setCustomCancelReason('');
  };

  const closeCancelModal = () => {
    setCancelTarget(null);
    setCancelReason(cancellationReasons[0]);
    setCustomCancelReason('');
  };

  const confirmCancelAppointment = async () => {
    if (!cancelTarget) return;
    const selectedReason = cancelReason === 'Other reason' ? customCancelReason : cancelReason;
    if (!selectedReason?.trim()) {
      toast.error('Cancellation reason is required.');
      return;
    }
    await updateAppointmentStatus(cancelTarget, 'Cancelled', {
      cancellationReason: selectedReason.trim()
    });
    closeCancelModal();
  };

  const updateRequestStatus = async (appointment, requestStatus) => {
    try {
      setUpdatingId(appointment._id);
      const res = await api.put(`/api/bookings/admin/${appointment._id}/request-status`, { requestStatus });
      if (res.data.success) {
        toast.success(`Request ${appointment.ref} updated.`);
        await loadAppointments();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update replacement request.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 lg:p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl shadow-black/10 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin Appointments</h1>
              <p className="mt-1 text-sm text-slate-300">
                Review and manage National ID bookings from the database.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="relative block">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Search ticket or name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
                />
              </label>

              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
              >
                {statusOptions.map((status) => (
                  <option key={status || 'all'} value={status}>
                    {status || 'All statuses'}
                  </option>
                ))}
              </select>

              <select
                value={filters.requestStatus}
                onChange={(event) => updateFilter('requestStatus', event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
              >
                {requestStatusOptions.map((status) => (
                  <option key={status || 'all-request-statuses'} value={status}>
                    {status || 'All request statuses'}
                  </option>
                ))}
              </select>

              <select
                value={filters.center}
                onChange={(event) => updateFilter('center', event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
              >
                <option value="">All centers</option>
                {centers.map((center) => (
                  <option key={center._id} value={center._id}>
                    {center.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={filters.date}
                onChange={(event) => updateFilter('date', event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[#4189DD] focus:ring-4 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-2 shadow-xl shadow-black/10 backdrop-blur">
          <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
            {requestTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-[#4189DD] text-white shadow-lg shadow-blue-500/20' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/85">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    {activeTab === 'new_national_id' ? (
                      [
                        'Ticket Number',
                        'Citizen Name',
                        'Phone',
                        'Center',
                        'Appointment Date',
                        'Queue Number',
                        'Status',
                        'Actions'
                      ].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                      ))
                    ) : activeTab === 'update_information' ? (
                      [
                        'Ticket Number',
                        'Citizen Name',
                        'National ID Number',
                        'Updated Fields',
                        'Submission Date',
                        'Status',
                        'Actions'
                      ].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                      ))
                    ) : (
                      [
                        'Ticket Number',
                        'Citizen Name',
                        'National ID Number',
                        'Police Report Number',
                        'Uploaded Document',
                        'Submission Date',
                        'Status',
                        'Actions'
                      ].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading && (
                    <tr>
                      <td colSpan={activeTab === 'new_national_id' ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                        Loading appointments...
                      </td>
                    </tr>
                  )}

                  {!loading && appointments.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === 'new_national_id' ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                        No appointments match the selected filters.
                      </td>
                    </tr>
                  )}

                  {!loading && appointments.map((appointment) => {
                    const citizen = appointment.citizen || {};
                    const isBusy = updatingId === appointment._id;
                    const isManagedRequest = appointment.requestType !== 'new_national_id';
                    const displayStatus = getDisplayStatus(appointment);
                    const submissionDate = formatDate(appointment.createdAt || appointment.submissionDate || appointment.date);

                    return (
                      <tr key={appointment._id} className="hover:bg-slate-800/60">
                        <td className="px-4 py-3 font-mono font-bold text-[#4189DD]">{appointment.ref}</td>
                        <td className="px-4 py-3 font-semibold text-white">
                          {citizen.name || appointment.citizenName || '--'}
                        </td>

                        {activeTab === 'new_national_id' ? (
                          <>
                            <td className="px-4 py-3 text-slate-300">{citizen.phone || '--'}</td>
                            <td className="px-4 py-3 text-slate-300">{appointment.center?.name || '--'}</td>
                            <td className="px-4 py-3 text-slate-300">
                              {formatDate(appointment.date)}
                              {appointment.timeSlot ? <span className="block text-xs text-slate-400">{appointment.timeSlot}</span> : null}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-200">{getQueueNumber(appointment.ref)}</td>
                          </>
                        ) : activeTab === 'update_information' ? (
                          <>
                            <td className="px-4 py-3 text-slate-300">{appointment.updateDetails?.nationalIdNumber || '--'}</td>
                            <td className="px-4 py-3 text-slate-300">{getUpdatedFields(appointment)}</td>
                            <td className="px-4 py-3 text-slate-300">{submissionDate}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-slate-300">{appointment.replacementDetails?.nationalIdNumber || '--'}</td>
                            <td className="px-4 py-3 text-slate-300">{appointment.replacementDetails?.policeReportNumber || '--'}</td>
                            <td className="px-4 py-3 text-slate-300">{appointment.replacementDetails?.policeReportDocument || '--'}</td>
                            <td className="px-4 py-3 text-slate-300">{submissionDate}</td>
                          </>
                        )}

                        <td className="px-4 py-3">
                          <span className={statusClass(displayStatus)}>{displayStatus}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedAppointment(appointment)}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-[#4189DD] hover:bg-slate-800"
                            >
                              <FiEye /> View
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || (isManagedRequest ? appointment.requestStatus === 'Completed' : appointment.status === 'Completed')}
                              onClick={() => isManagedRequest ? updateRequestStatus(appointment, 'Completed') : updateAppointmentStatus(appointment, 'Completed')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <FiCheckCircle /> Complete
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || appointment.status === 'Cancelled'}
                              onClick={() => openCancelModal(appointment)}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <FiXCircle /> Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Admin Action</p>
                <h2 className="mt-1 text-2xl font-black">Cancel Appointment</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Select a clear reason. The citizen will receive this feedback and can resubmit from their dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close cancel appointment modal"
              >
                <FiSlash />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ticket Reference</p>
              <p className="mt-1 font-mono text-lg font-black text-blue-700 dark:text-[#7CB8FF]">{cancelTarget.ref}</p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold">Cancellation reason</span>
              <select
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900/40"
              >
                {cancellationReasons.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </label>

            {cancelReason === 'Other reason' && (
              <label className="mt-4 block">
                <span className="text-sm font-bold">Other reason</span>
                <textarea
                  value={customCancelReason}
                  onChange={(event) => setCustomCancelReason(event.target.value)}
                  rows={4}
                  placeholder="Write the reason for cancellation"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900/40"
                />
              </label>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={confirmCancelAppointment}
                disabled={updatingId === cancelTarget._id}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingId === cancelTarget._id ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl text-white">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Appointment Details</h2>
                <p className="font-mono text-sm font-semibold text-[#4189DD]">{selectedAppointment.ref}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                aria-label="Close appointment details"
              >
                <FiSlash />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className="block text-xs font-bold uppercase text-slate-400">Citizen</span>{selectedAppointment.citizen?.name || selectedAppointment.citizenName || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Email</span>{selectedAppointment.citizen?.email || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Phone</span>{selectedAppointment.citizen?.phone || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Center</span>{selectedAppointment.center?.name || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Date</span>{formatDate(selectedAppointment.date)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Time</span>{selectedAppointment.timeSlot || '--'}</p>
              <p>
                <span className="block text-xs font-bold uppercase text-slate-400">Queue Number</span>
                {selectedAppointment.requestType === 'update_information' ? '--' : getQueueNumber(selectedAppointment.ref)}
              </p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Request Type</span>{getRequestTypeLabel(selectedAppointment.requestType)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Request Status</span>{selectedAppointment.requestStatus || 'Pending'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Status</span>{selectedAppointment.status}</p>
              {selectedAppointment.cancellationReason && (
                <p className="sm:col-span-2"><span className="block text-xs font-bold uppercase text-slate-400">Cancellation Reason</span>{selectedAppointment.cancellationReason}</p>
              )}
            </div>

            {selectedAppointment && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-white">Existing Registration Lookup</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Existing registration found', selectedAppointment.existingRegistration?.found ? 'Yes' : 'No'],
                    ['Previous Ticket Number', selectedAppointment.existingRegistration?.ticketNumber || '--'],
                    ['Previous Queue Number', selectedAppointment.existingRegistration?.queueNumber || '--'],
                    ['Previous Center', selectedAppointment.existingRegistration?.centerName || '--'],
                    ['Previous Status', selectedAppointment.existingRegistration?.status || '--']
                  ].map(([label, value]) => (
                    <p key={label}>
                      <span className="block text-xs font-bold uppercase text-slate-400">{label}</span>
                      {value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {selectedAppointment.requestType === 'new_national_id' && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-white">Submitted National ID Details</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Full Name', selectedAppointment.registrationDetails?.fullName || selectedAppointment.citizenName || '--'],
                    ["Mother's Name", selectedAppointment.registrationDetails?.motherName || '--'],
                    ['Date of Birth', formatDate(selectedAppointment.registrationDetails?.dateOfBirth)],
                    ['Age', selectedAppointment.registrationDetails?.age ?? '--'],
                    ['Gender', selectedAppointment.registrationDetails?.gender || '--'],
                    ['Phone Number', selectedAppointment.registrationDetails?.phone || selectedAppointment.citizen?.phone || '--'],
                    ['District', selectedAppointment.registrationDetails?.district || '--'],
                    ['Full Address', selectedAppointment.registrationDetails?.fullAddress || selectedAppointment.registrationDetails?.address || '--'],
                    ['Nearest Landmark', selectedAppointment.registrationDetails?.nearestLandmark || '--'],
                    ['Selected National ID Center', selectedAppointment.registrationDetails?.selectedCenter || selectedAppointment.center?.name || '--'],
                    ['Center District', selectedAppointment.registrationDetails?.centerDistrict || selectedAppointment.center?.district || selectedAppointment.center?.city || '--'],
                    ['Appointment Date', formatDate(selectedAppointment.registrationDetails?.appointmentDate || selectedAppointment.date)],
                    ['Appointment Time', selectedAppointment.registrationDetails?.appointmentTime || selectedAppointment.timeSlot || '--']
                  ].map(([label, value]) => (
                    <p key={label}>
                      <span className="block text-xs font-bold uppercase text-slate-400">{label}</span>
                      {value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {selectedAppointment.requestType === 'lost_replacement' && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-white">Lost National ID Details</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['National ID Number', selectedAppointment.replacementDetails?.nationalIdNumber || '--'],
                    ['Reason', selectedAppointment.replacementDetails?.reason || '--'],
                    ['Date Lost', formatDate(selectedAppointment.replacementDetails?.dateLost)],
                    ['Place Lost', selectedAppointment.replacementDetails?.placeLost || '--'],
                    ['Police Report Number', selectedAppointment.replacementDetails?.policeReportNumber || 'Not provided'],
                    ['Police Report Document', selectedAppointment.replacementDetails?.policeReportDocument || 'Not uploaded'],
                    ['Additional Notes', selectedAppointment.replacementDetails?.additionalNotes || 'None']
                  ].map(([label, value]) => (
                    <p key={label}>
                      <span className="block text-xs font-bold uppercase text-slate-400">{label}</span>
                      {value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {selectedAppointment.requestType === 'update_information' && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-white">Update Information Details</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <p><span className="block text-xs font-bold uppercase text-slate-400">National ID Number</span>{selectedAppointment.updateDetails?.nationalIdNumber || '--'}</p>
                  {(selectedAppointment.updateDetails?.changes?.length ? selectedAppointment.updateDetails.changes : [{
                    field: selectedAppointment.updateDetails?.fieldToUpdate,
                    currentValue: selectedAppointment.updateDetails?.currentValue,
                    newValue: selectedAppointment.updateDetails?.newValue,
                    reason: selectedAppointment.updateDetails?.reason
                  }]).map((change, index) => (
                    <div key={`${change.field}-${index}`} className="sm:col-span-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <p className="font-bold text-[#7CB8FF]">{change.field || 'Update Field'}</p>
                      <p className="mt-1 text-slate-300"><span className="text-slate-500">Current:</span> {change.currentValue || '--'}</p>
                      <p className="text-slate-300"><span className="text-slate-500">New:</span> {change.newValue || '--'}</p>
                      <p className="text-slate-300"><span className="text-slate-500">Reason:</span> {change.reason || '--'}</p>
                    </div>
                  ))}
                  <p className="sm:col-span-2"><span className="block text-xs font-bold uppercase text-slate-400">Supporting Notes</span>{selectedAppointment.updateDetails?.notes || 'None'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAppointments;
