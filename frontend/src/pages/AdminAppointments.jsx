import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCheckCircle, FiEye, FiSlash, FiXCircle } from 'react-icons/fi';
import api from '../api/axiosInstance';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';

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
  const base = 'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  if (status === 'Cancelled' || status === 'Rejected') return `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`;
  if (status === 'Being Served') return `${base} bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300`;
  if (status === 'On Hold' || status === 'Pending') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
  return `${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getQueueNumber = (ref) => {
  if (!ref) return '—';
  return ref.split('-').pop();
};

const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

const filterField = 'rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:border-[#27476f] dark:bg-[#061225] dark:text-white';
const detailPanel = 'mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#1d355f] dark:bg-[#061225]/60';
const detailLabel = 'block text-xs font-bold uppercase text-slate-500 dark:text-slate-400';

function AdminAppointments() {
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [centers, setCenters] = useState([]);
  const [activeTab, setActiveTab] = useState('new_national_id');
  const [filters, setFilters] = useState({
    status: '',
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

  const columns = useMemo(() => {
    const base = [
      {
        header: 'Ticket Number',
        accessor: 'ref',
        render: (row) => <span className="whitespace-nowrap font-mono font-bold text-blue-700 dark:text-[#4189DD]">{row.ref}</span>,
      },
      {
        header: 'Citizen Name',
        accessor: 'citizenName',
        sortValue: (row) => row.citizen?.name || row.citizenName || '',
        render: (row) => <span className="font-semibold text-slate-900 dark:text-white">{row.citizen?.name || row.citizenName || '—'}</span>,
      },
    ];

    const byTab = {
      new_national_id: [
        {
          header: 'Phone',
          accessor: 'phone',
          sortValue: (row) => row.citizen?.phone || '',
          render: (row) => row.citizen?.phone || '—',
        },
        {
          header: 'Center',
          accessor: 'center',
          sortValue: (row) => row.center?.name || '',
          render: (row) => row.center?.name || '—',
        },
        {
          header: 'Appointment Date',
          accessor: 'date',
          sortValue: (row) => row.date || '',
          render: (row) => (
            <span className="whitespace-nowrap">
              {formatDate(row.date)}
              {row.timeSlot ? <span className="block text-xs text-slate-500 dark:text-slate-400">{row.timeSlot}</span> : null}
            </span>
          ),
        },
        {
          header: 'Queue No.',
          accessor: 'queueNumber',
          sortValue: (row) => getQueueNumber(row.ref),
          render: (row) => <span className="font-mono font-semibold">{getQueueNumber(row.ref)}</span>,
        },
      ],
      update_information: [
        {
          header: 'National ID Number',
          accessor: 'nationalIdNumber',
          sortValue: (row) => row.updateDetails?.nationalIdNumber || '',
          render: (row) => row.updateDetails?.nationalIdNumber || '—',
        },
        {
          header: 'Updated Fields',
          accessor: 'updatedFields',
          sortValue: (row) => getUpdatedFields(row),
          render: (row) => getUpdatedFields(row),
        },
        {
          header: 'Submission Date',
          accessor: 'submissionDate',
          sortValue: (row) => row.createdAt || row.date || '',
          render: (row) => <span className="whitespace-nowrap">{formatDate(row.createdAt || row.submissionDate || row.date)}</span>,
        },
      ],
      lost_replacement: [
        {
          header: 'National ID Number',
          accessor: 'nationalIdNumber',
          sortValue: (row) => row.replacementDetails?.nationalIdNumber || '',
          render: (row) => row.replacementDetails?.nationalIdNumber || '—',
        },
        {
          header: 'Police Report',
          accessor: 'policeReport',
          sortValue: (row) => row.replacementDetails?.policeReportNumber || '',
          render: (row) => row.replacementDetails?.policeReportNumber || '—',
        },
        {
          header: 'Submission Date',
          accessor: 'submissionDate',
          sortValue: (row) => row.createdAt || row.date || '',
          render: (row) => <span className="whitespace-nowrap">{formatDate(row.createdAt || row.submissionDate || row.date)}</span>,
        },
      ],
    };

    const tail = [
      {
        header: 'Status',
        accessor: 'displayStatus',
        sortValue: (row) => getDisplayStatus(row),
        render: (row) => <span className={statusClass(getDisplayStatus(row))}>{getDisplayStatus(row)}</span>,
      },
      {
        header: 'Actions',
        accessor: '_actions',
        sortable: false,
        render: (row) => {
          const isBusy = updatingId === row._id;
          const isManagedRequest = row.requestType !== 'new_national_id';
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedAppointment(row); }}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-sky-500/30 dark:bg-transparent dark:text-[#7CB8FF] dark:hover:bg-white/5"
              >
                <FiEye /> View
              </button>
              <button
                type="button"
                disabled={isBusy || (isManagedRequest ? row.requestStatus === 'Completed' : row.status === 'Completed')}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isManagedRequest) updateRequestStatus(row, 'Completed');
                  else updateAppointmentStatus(row, 'Completed');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiCheckCircle /> Complete
              </button>
              <button
                type="button"
                disabled={isBusy || row.status === 'Cancelled'}
                onClick={(e) => { e.stopPropagation(); openCancelModal(row); }}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiXCircle /> Cancel
              </button>
            </div>
          );
        },
      },
    ];

    return [...base, ...(byTab[activeTab] || []), ...tail];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, updatingId]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4">
      {/* Page header + domain filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">Appointments</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Review and manage National ID bookings, update requests, and replacements.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className={filterField}>
            {statusOptions.map((status) => (
              <option key={status || 'all'} value={status}>{status || 'All statuses'}</option>
            ))}
          </select>
          <select value={filters.requestStatus} onChange={(event) => updateFilter('requestStatus', event.target.value)} className={filterField}>
            {requestStatusOptions.map((status) => (
              <option key={status || 'all-request-statuses'} value={status}>{status || 'All request statuses'}</option>
            ))}
          </select>
          <select value={filters.center} onChange={(event) => updateFilter('center', event.target.value)} className={filterField}>
            <option value="">All centers</option>
            {centers.map((center) => (
              <option key={center._id} value={center._id}>{center.name}</option>
            ))}
          </select>
          <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} className={filterField} />
        </div>
      </div>

      <Tabs tabs={requestTabs} active={activeTab} onChange={setActiveTab} />

      <DataTable
        columns={columns}
        data={appointments}
        loading={loading}
        searchPlaceholder="Search ticket, name, or center..."
        emptyTitle="No appointments found"
        emptyText="No appointments match the selected filters."
      />

      {/* Cancel modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-[#1d355f] dark:bg-[#071a33] dark:text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">Admin Action</p>
                <h2 className="mt-1 text-2xl font-black">Cancel Appointment</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Select a clear reason. The citizen will receive this feedback and can resubmit from their dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Close cancel appointment modal"
              >
                <FiSlash />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-[#1d355f] dark:bg-[#061225]/60">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Ticket Reference</p>
              <p className="mt-1 font-mono text-lg font-black text-blue-700 dark:text-[#7CB8FF]">{cancelTarget.ref}</p>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold">Cancellation reason</span>
              <select
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className={`mt-2 w-full ${filterField}`}
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
                  className={`mt-2 w-full resize-none ${filterField}`}
                />
              </label>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-[#27476f] dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={confirmCancelAppointment}
                disabled={updatingId === cancelTarget._id}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingId === cancelTarget._id ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl dark:border-[#1d355f] dark:bg-[#071a33] dark:text-white">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Appointment Details</h2>
                <p className="font-mono text-sm font-semibold text-blue-700 dark:text-[#4189DD]">{selectedAppointment.ref}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                aria-label="Close appointment details"
              >
                <FiSlash />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className={detailLabel}>Citizen</span>{selectedAppointment.citizen?.name || selectedAppointment.citizenName || '—'}</p>
              <p><span className={detailLabel}>Email</span>{selectedAppointment.citizen?.email || '—'}</p>
              <p><span className={detailLabel}>Phone</span>{selectedAppointment.citizen?.phone || '—'}</p>
              <p><span className={detailLabel}>Center</span>{selectedAppointment.center?.name || '—'}</p>
              <p><span className={detailLabel}>Date</span>{formatDate(selectedAppointment.date)}</p>
              <p><span className={detailLabel}>Time</span>{selectedAppointment.timeSlot || '—'}</p>
              <p>
                <span className={detailLabel}>Queue Number</span>
                {selectedAppointment.requestType === 'update_information' ? '—' : getQueueNumber(selectedAppointment.ref)}
              </p>
              <p><span className={detailLabel}>Request Type</span>{getRequestTypeLabel(selectedAppointment.requestType)}</p>
              <p><span className={detailLabel}>Request Status</span>{selectedAppointment.requestStatus || 'Pending'}</p>
              <p><span className={detailLabel}>Status</span>{selectedAppointment.status}</p>
              {selectedAppointment.cancellationReason && (
                <p className="sm:col-span-2"><span className={detailLabel}>Cancellation Reason</span>{selectedAppointment.cancellationReason}</p>
              )}
            </div>

            <div className={detailPanel}>
              <h3 className="mb-3 text-sm font-bold">Existing Registration Lookup</h3>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Existing registration found', selectedAppointment.existingRegistration?.found ? 'Yes' : 'No'],
                  ['Previous Ticket Number', selectedAppointment.existingRegistration?.ticketNumber || '—'],
                  ['Previous Queue Number', selectedAppointment.existingRegistration?.queueNumber || '—'],
                  ['Previous Center', selectedAppointment.existingRegistration?.centerName || '—'],
                  ['Previous Status', selectedAppointment.existingRegistration?.status || '—']
                ].map(([label, value]) => (
                  <p key={label}>
                    <span className={detailLabel}>{label}</span>
                    {value}
                  </p>
                ))}
              </div>
            </div>

            {selectedAppointment.requestType === 'new_national_id' && (
              <div className={detailPanel}>
                <h3 className="mb-3 text-sm font-bold">Submitted National ID Details</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Full Name', selectedAppointment.registrationDetails?.fullName || selectedAppointment.citizenName || '—'],
                    ["Mother's Name", selectedAppointment.registrationDetails?.motherName || '—'],
                    ['Date of Birth', formatDate(selectedAppointment.registrationDetails?.dateOfBirth)],
                    ['Age', selectedAppointment.registrationDetails?.age ?? '—'],
                    ['Gender', selectedAppointment.registrationDetails?.gender || '—'],
                    ['Phone Number', selectedAppointment.registrationDetails?.phone || selectedAppointment.citizen?.phone || '—'],
                    ['District', selectedAppointment.registrationDetails?.district || '—'],
                    ['Full Address', selectedAppointment.registrationDetails?.fullAddress || selectedAppointment.registrationDetails?.address || '—'],
                    ['Nearest Landmark', selectedAppointment.registrationDetails?.nearestLandmark || '—'],
                    ['Selected National ID Center', selectedAppointment.registrationDetails?.selectedCenter || selectedAppointment.center?.name || '—'],
                    ['Center District', selectedAppointment.registrationDetails?.centerDistrict || selectedAppointment.center?.district || selectedAppointment.center?.city || '—'],
                    ['Appointment Date', formatDate(selectedAppointment.registrationDetails?.appointmentDate || selectedAppointment.date)],
                    ['Appointment Time', selectedAppointment.registrationDetails?.appointmentTime || selectedAppointment.timeSlot || '—']
                  ].map(([label, value]) => (
                    <p key={label}>
                      <span className={detailLabel}>{label}</span>
                      {value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {selectedAppointment.requestType === 'lost_replacement' && (
              <div className={detailPanel}>
                <h3 className="mb-3 text-sm font-bold">Lost National ID Details</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['National ID Number', selectedAppointment.replacementDetails?.nationalIdNumber || '—'],
                    ['Reason', selectedAppointment.replacementDetails?.reason || '—'],
                    ['Date Lost', formatDate(selectedAppointment.replacementDetails?.dateLost)],
                    ['Place Lost', selectedAppointment.replacementDetails?.placeLost || '—'],
                    ['Police Report Number', selectedAppointment.replacementDetails?.policeReportNumber || 'Not provided'],
                    ['Police Report Document', selectedAppointment.replacementDetails?.policeReportDocument || 'Not uploaded'],
                    ['Additional Notes', selectedAppointment.replacementDetails?.additionalNotes || 'None']
                  ].map(([label, value]) => (
                    <p key={label}>
                      <span className={detailLabel}>{label}</span>
                      {value}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {selectedAppointment.requestType === 'update_information' && (
              <div className={detailPanel}>
                <h3 className="mb-3 text-sm font-bold">Update Information Details</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <p><span className={detailLabel}>National ID Number</span>{selectedAppointment.updateDetails?.nationalIdNumber || '—'}</p>
                  {(selectedAppointment.updateDetails?.changes?.length ? selectedAppointment.updateDetails.changes : [{
                    field: selectedAppointment.updateDetails?.fieldToUpdate,
                    currentValue: selectedAppointment.updateDetails?.currentValue,
                    newValue: selectedAppointment.updateDetails?.newValue,
                    reason: selectedAppointment.updateDetails?.reason
                  }]).map((change, index) => (
                    <div key={`${change.field}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-[#1d355f] dark:bg-[#0b2444]/60 sm:col-span-2">
                      <p className="font-bold text-blue-700 dark:text-[#7CB8FF]">{change.field || 'Update Field'}</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300"><span className="text-slate-500">Current:</span> {change.currentValue || '—'}</p>
                      <p className="text-slate-700 dark:text-slate-300"><span className="text-slate-500">New:</span> {change.newValue || '—'}</p>
                      <p className="text-slate-700 dark:text-slate-300"><span className="text-slate-500">Reason:</span> {change.reason || '—'}</p>
                    </div>
                  ))}
                  <p className="sm:col-span-2"><span className={detailLabel}>Supporting Notes</span>{selectedAppointment.updateDetails?.notes || 'None'}</p>
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
