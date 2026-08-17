import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiList,
  FiMapPin,
  FiPhone,
  FiX,
  FiXCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { getCancellationFeedbackText, getCancellationReasonList } from '../utils/cancellationDisplay';

const entityId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
};

const normalize = (value = '') => String(value || '').trim().toLowerCase();

const titleCase = (value = '') => String(value || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(' ');

const initials = (name = '') => (
  name.trim().split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '--'
);

// Sitewide soft pastel tone system (see styles/nqs-theme-system.css).
const CARD_ICON_TONE = {
  blue: 'nqs-card-tone-icon-blue',
  green: 'nqs-card-tone-icon-green',
  purple: 'nqs-card-tone-icon-purple',
  pink: 'nqs-card-tone-icon-pink',
  orange: 'nqs-card-tone-icon-orange'
};

const CARD_BG_TONE = {
  blue: 'nqs-card-tone-blue',
  green: 'nqs-card-tone-green',
  purple: 'nqs-card-tone-purple',
  pink: 'nqs-card-tone-pink',
  orange: 'nqs-card-tone-orange'
};

const BADGE_TONE = {
  blue: 'nqs-badge-tone-blue',
  green: 'nqs-badge-tone-green',
  purple: 'nqs-badge-tone-purple',
  pink: 'nqs-badge-tone-pink',
  orange: 'nqs-badge-tone-orange'
};

// Ticket status/requestStatus values follow the same vocabulary used across
// AdminAppointments / CenterOperatorDetail. Correction Required and Cancelled
// are kept distinct even though both read as "needs attention".
const classifyAppointment = (appointment = {}) => {
  const status = normalize(appointment.status);
  const requestStatus = normalize(appointment.requestStatus);

  if (requestStatus === 'resubmission required') return 'correctionRequired';
  if (status === 'completed' || requestStatus === 'completed') return 'completed';
  if (['cancelled', 'canceled', 'rejected', 'expired'].includes(status) || requestStatus === 'rejected') return 'cancelled';
  if (['being served', 'in progress'].includes(status)) return 'inProgress';
  return 'waiting';
};

const CATEGORY_LABEL = {
  waiting: 'Waiting',
  inProgress: 'Now Serving',
  completed: 'Completed',
  cancelled: 'Cancelled',
  correctionRequired: 'Correction Required'
};

const CATEGORY_TONE = {
  waiting: 'purple',
  inProgress: 'blue',
  completed: 'green',
  cancelled: 'pink',
  correctionRequired: 'orange'
};

const getDisplayStatus = (appointment = {}) => {
  const category = classifyAppointment(appointment);
  if (CATEGORY_LABEL[category]) return CATEGORY_LABEL[category];
  return appointment.status || appointment.requestStatus || 'Pending';
};

const statusBadgeClass = (appointment) => BADGE_TONE[CATEGORY_TONE[classifyAppointment(appointment)]] || BADGE_TONE.blue;

const roleLabel = (operator = {}) => {
  const type = String(operator.operatorType || operator.role || '').toLowerCase();
  if (type === 'super_operator' || type === 'center_manager') return 'Center Manager';
  return 'Operator';
};

const operatorStatusLabel = (status = '') => {
  const normalized = normalize(status);
  if (normalized === 'pending_approval') return 'Pending Approval';
  if (normalized === 'active') return 'Active';
  if (normalized === 'inactive') return 'Deactivated';
  if (normalized === 'rejected') return 'Rejected';
  return status || 'Unknown';
};

const operatorStatusBadgeClass = (status = '') => {
  const normalized = normalize(status);
  if (normalized === 'active') return BADGE_TONE.green;
  if (normalized === 'pending_approval') return BADGE_TONE.purple;
  return BADGE_TONE.pink;
};

const getAppointmentId = (appointment) => appointment?._id || appointment?.id || appointment?.ref;

const getQueueNumber = (appointment) => {
  if (appointment.queueNumber) return appointment.queueNumber;
  const digits = String(appointment.ref || '').replace(/\D/g, '');
  return digits || '--';
};

const formatAppointmentDate = (value) => {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getAppointmentDate = (appointment) => (
  appointment.date
  || appointment.registrationDetails?.appointmentDate
  || appointment.existingRegistration?.date
  || ''
);

const getAppointmentTime = (appointment) => (
  appointment.timeSlot
  || appointment.registrationDetails?.appointmentTime
  || appointment.existingRegistration?.timeSlot
  || '--'
);

const getCitizenPhone = (appointment) => (
  appointment.registrationDetails?.phone
  || appointment.replacementDetails?.phone
  || appointment.updateDetails?.phone
  || appointment.citizen?.phone
  || 'No Data'
);

const getCitizenName = (appointment) => titleCase(
  appointment.citizenName
  || appointment.registrationDetails?.fullName
  || appointment.replacementDetails?.fullName
  || appointment.updateDetails?.fullName
  || appointment.citizen?.name
  || 'No Data'
);

const getServiceName = (appointment) => appointment.service?.name || appointment.existingRegistration?.serviceType || 'National ID Service';

const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

const OperatorAppointments = () => {
  const { operatorId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [operator, setOperator] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const requestedCategory = searchParams.get('status') || 'total';
  const visibleCategories = new Set(['total', 'waiting', 'completed', 'cancelled']);
  const activeCategory = visibleCategories.has(requestedCategory) ? requestedCategory : 'total';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const operatorRes = await api.get(`/api/operators/${operatorId}`);
      const operatorRecord = operatorRes.data.data?.operator || null;
      setOperator(operatorRecord);

      const centerId = entityId(operatorRecord?.center);
      if (centerId) {
        const appointmentsRes = await api.get('/api/bookings/admin/all', { params: { center: centerId } });
        setAppointments(appointmentsRes.data.data || []);
      } else {
        setAppointments([]);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error(error.response?.data?.message || 'Unable to load operator appointments.');
      }
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categorized = useMemo(() => {
    const groups = { waiting: [], inProgress: [], completed: [], cancelled: [], correctionRequired: [] };
    appointments.forEach((appointment) => {
      groups[classifyAppointment(appointment)].push(appointment);
    });
    return groups;
  }, [appointments]);

const summaryCards = useMemo(() => ([
  { key: 'total', label: 'Total Appointments', value: appointments.length, icon: <FiList />, tone: 'blue', note: 'All appointments at this center' },
  { key: 'waiting', label: 'Waiting', value: categorized.waiting.length + categorized.inProgress.length + categorized.correctionRequired.length, icon: <FiClock />, tone: 'purple', note: 'Waiting or currently being served' },
  { key: 'completed', label: 'Completed', value: categorized.completed.length, icon: <FiCheckCircle />, tone: 'green', note: 'Finished services' },
  { key: 'cancelled', label: 'Cancelled', value: categorized.cancelled.length, icon: <FiXCircle />, tone: 'pink', note: 'Cancelled or rejected' }
]), [appointments.length, categorized]);

  const displayedAppointments = activeCategory === 'total'
    ? appointments
    : activeCategory === 'waiting'
      ? [...categorized.waiting, ...categorized.inProgress, ...categorized.correctionRequired]
      : (categorized[activeCategory] || []);
  const activeCardLabel = summaryCards.find((card) => card.key === activeCategory)?.label || 'Total Appointments';

  const selectCategory = (key) => {
    const params = new URLSearchParams(searchParams);
    if (key === 'total') {
      params.delete('status');
    } else {
      params.set('status', key);
    }
    setSearchParams(params);
  };

  if (!loading && (notFound || !operator)) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] p-4 text-[var(--text-main)] sm:p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black">Operator not found</h1>
          <p className="mt-2 text-[var(--text-muted)]">This operator record is no longer available or you do not have access to it.</p>
          <button
            type="button"
            onClick={() => navigate('/operator-management')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-white hover:bg-[var(--color-primary-hover)]"
          >
            <FiArrowLeft /> Back to Operators
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nqs-operator-appointments min-h-screen bg-[var(--bg-app)] p-4 text-[var(--text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/operator-management')}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-3.5 py-2 text-xs font-black text-[var(--text-main)] shadow-sm transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <FiArrowLeft /> Back to Operators
        </button>

        <header className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-sm sm:p-6">
          {loading || !operator ? (
            <div className="text-sm text-[var(--text-muted)]">Loading operator...</div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-blue-50 text-lg font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  {initials(operator.name)}
                </span>
                <div>
                  <h1 className="text-xl font-black tracking-tight sm:text-2xl">{titleCase(operator.name)}</h1>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">@{operator.username}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${BADGE_TONE.blue}`}>
                      {roleLabel(operator)}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${operatorStatusBadgeClass(operator.status)}`}>
                      {operatorStatusLabel(operator.status)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-3 py-1.5">
                  <FiPhone className="text-[var(--color-primary)]" /> {operator.phone || 'No phone recorded'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-3 py-1.5">
                  <FiMapPin className="text-[var(--color-primary)]" /> {operator.center?.name ? `${operator.center.district ? `${operator.center.district} - ` : ''}${operator.center.name}` : 'Unassigned center'}
                </span>
              </div>
            </div>
          )}
        </header>

        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {summaryCards.map((card) => {
              const selected = activeCategory === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => selectCategory(card.key)}
                  className={`flex min-h-[128px] flex-col justify-between gap-4 rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${CARD_BG_TONE[card.tone]} ${
                    selected ? 'ring-2 ring-[var(--color-primary-soft)]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{card.label}</span>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${CARD_ICON_TONE[card.tone]}`}>
                      {card.icon}
                    </span>
                  </div>
                  <div>
                    <span className="block text-3xl font-black leading-none text-[var(--text-main)]">{card.value}</span>
                    <span className="mt-1.5 block text-xs font-semibold text-[var(--text-muted)]">{card.note}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--border-light)] bg-[var(--nqs-panel-soft)]/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-tight">{activeCardLabel}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Appointments handled by this operator's center.</p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-[var(--color-primary-soft)] px-3.5 py-1.5 text-xs font-black text-[var(--color-primary)]">
                {displayedAppointments.length} record{displayedAppointments.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--nqs-panel-soft)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    {['Request Number', 'Citizen Name', 'Phone', 'Appointment Date', 'Queue Number', 'Status', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-3.5 font-black">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {loading ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-[var(--text-muted)]">Loading appointments...</td></tr>
                  ) : displayedAppointments.length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-[var(--text-muted)]">No {activeCardLabel.toLowerCase()} appointments for this operator.</td></tr>
                  ) : displayedAppointments.map((appointment) => {
                    const appointmentId = getAppointmentId(appointment);
                    return (
                      <tr key={appointmentId} className="transition hover:bg-[var(--color-primary-soft)]">
                        <td className="px-4 py-3 font-black text-[var(--color-primary)]">{appointment.ref || '--'}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{getCitizenName(appointment)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{getCitizenPhone(appointment)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">
                          <span className="block font-semibold text-[var(--text-main)]">{formatAppointmentDate(getAppointmentDate(appointment))}</span>
                          <span className="block text-xs">{getAppointmentTime(appointment)}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--text-main)]">{getQueueNumber(appointment)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusBadgeClass(appointment)}`}>
                            {getDisplayStatus(appointment)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedAppointment(appointment)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-light)] px-2.5 py-1.5 text-xs font-black text-[var(--text-main)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                          >
                            <FiEye /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-light)] bg-[var(--nqs-panel-soft)] px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">Appointment Details</p>
                <h2 className="mt-1 text-2xl font-black">{selectedAppointment.ref || 'Appointment'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="rounded-xl border border-[var(--border-light)] p-2 text-[var(--text-muted)] transition hover:border-red-400 hover:text-red-500"
                aria-label="Close appointment details"
              >
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 text-sm sm:grid-cols-2">
              {[
                ['Citizen Name', getCitizenName(selectedAppointment)],
                ['Phone', getCitizenPhone(selectedAppointment)],
                ['Service', getServiceName(selectedAppointment)],
                ['Appointment Date', formatAppointmentDate(getAppointmentDate(selectedAppointment))],
                ['Appointment Time', getAppointmentTime(selectedAppointment)],
                ['Queue Number', getQueueNumber(selectedAppointment)],
                ['Status', getDisplayStatus(selectedAppointment)],
                ['Request Type', getRequestTypeLabel(selectedAppointment.requestType)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-app)] p-3">
                  <span className="block text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
                  <span className="mt-1 block font-bold text-[var(--text-main)]">{value || '--'}</span>
                </div>
              ))}
            </div>

            {getCancellationReasonList(selectedAppointment).length > 0 && (
              <div className="px-5 pb-5">
                <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 dark:border-pink-500/20 dark:bg-pink-500/10">
                  <span className="block text-xs font-black uppercase tracking-wide text-pink-700 dark:text-pink-300">
                    Cancellation / Correction Feedback
                  </span>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-main)]">
                    {getCancellationFeedbackText(selectedAppointment, 'No cancellation reason was provided.')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {getCancellationReasonList(selectedAppointment).map((reason) => (
                      <span key={reason} className="rounded-full bg-pink-100 px-3 py-1 text-xs font-black text-pink-700 dark:bg-pink-500/20 dark:text-pink-300">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorAppointments;
