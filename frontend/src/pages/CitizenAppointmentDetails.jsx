import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiGrid,
  FiRepeat,
  FiSearch,
  FiSlash,
  FiUser,
  FiUserPlus,
  FiXCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { canCancelAppointment, canCompleteAppointment, canReacceptAppointment } from '../utils/appointmentActions';
import { classifyAppointment, STATUS_CATEGORY_META, getStatusLabel, statusClass } from '../utils/appointmentStatus';
import {
  formatDate,
  getQueueNumber,
  getRequestTypeLabel,
  getAppointmentCenterName,
  getAppointmentCenterDistrict,
  getCitizenPhone,
  getCitizenName
} from '../utils/appointmentDisplay';
import { getCitizenKey } from '../utils/citizenIdentity';
import { getCancellationFeedbackText, getCancellationReasonList } from '../utils/cancellationDisplay';

// Sitewide soft-pastel card tone system (styles/nqs-theme-system.css) — the same
// blue/green/purple/pink/orange classes used elsewhere in the app (Operator
// Management, Operator Appointments, dashboards). Scoped to just this page's
// cards; AdminAppointments.jsx keeps its own existing (non-pastel) card style.
const STATUS_CARD_TONE = {
  '': 'blue',
  waiting: 'purple',
  inProgress: 'blue',
  completed: 'green',
  cancelled: 'pink',
  noShow: 'pink'
};

// This page's own short label for "cancelled" ("Cancelled" instead of the shared
// "Cancelled / Rejected" used on AdminAppointments.jsx) — kept local so the shared
// utils/appointmentStatus.js meta (and the parent page that also uses it) is untouched.
const STATUS_CARD_LABEL = {
  cancelled: 'Cancelled'
};

const SERVICE_TABS = [
  { key: 'new_national_id', label: 'New Registration', icon: FiUserPlus },
  { key: 'update_information', label: 'Update Information', icon: FiEdit3 },
  { key: 'lost_replacement', label: 'Lost ID Replacement', icon: FiCreditCard }
];

const CitizenAppointmentDetails = () => {
  const { citizenKey = '' } = useParams();
  const decodedCitizenKey = decodeURIComponent(citizenKey);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [search, setSearch] = useState('');
  const [activeService, setActiveService] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const statusCategory = searchParams.get('status') || '';

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      // No citizen-id filter exists on GET /api/bookings/admin/all, so — same
      // approach as OperatorAppointments.jsx — fetch broadly and narrow down to
      // this one citizen client-side via the shared getCitizenKey() matcher.
      const res = await api.get('/api/bookings/admin/all');
      setAllAppointments(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load appointments.');
      setAllAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const citizenAppointments = useMemo(
    () => allAppointments.filter((appointment) => getCitizenKey(appointment) === decodedCitizenKey),
    [allAppointments, decodedCitizenKey]
  );

  const citizenInfo = useMemo(() => {
    if (!citizenAppointments.length) return null;
    // Prefer the most recently created record for the freshest contact/booking snapshot.
    const latest = [...citizenAppointments].sort((a, b) => (
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    ))[0];
    const latestDate = latest.date || latest.createdAt || latest.submissionDate;
    return {
      name: getCitizenName(latest),
      phone: getCitizenPhone(latest),
      nationalId: latest.citizen?.nationalId || '',
      latestService: getRequestTypeLabel(latest.requestType),
      latestCenter: getAppointmentCenterName(latest),
      latestCenterDistrict: getAppointmentCenterDistrict(latest),
      latestDateTime: `${formatDate(latestDate)}${latest.timeSlot ? ` · ${latest.timeSlot}` : ''}`,
      latestQueue: getQueueNumber(latest.ref),
      latestStatus: getStatusLabel(latest)
    };
  }, [citizenAppointments]);

  const serviceCounts = useMemo(() => {
    const counts = { new_national_id: 0, update_information: 0, lost_replacement: 0 };
    citizenAppointments.forEach((appointment) => {
      if (counts[appointment.requestType] !== undefined) counts[appointment.requestType] += 1;
    });
    return counts;
  }, [citizenAppointments]);

  const categorized = useMemo(() => {
    const groups = { waiting: [], inProgress: [], completed: [], cancelled: [], correctionRequired: [], noShow: [] };
    citizenAppointments.forEach((appointment) => {
      const category = classifyAppointment(appointment);
      const visibleCategory = category === 'inProgress' || category === 'correctionRequired' ? 'waiting' : category;
      groups[visibleCategory].push(appointment);
    });
    return groups;
  }, [citizenAppointments]);

  const statusCards = useMemo(() => ([
    { key: '', label: 'Total Appointments', value: citizenAppointments.length, tone: STATUS_CARD_TONE[''], icon: FiGrid },
    ...Object.entries(STATUS_CATEGORY_META).map(([key, meta]) => ({
      key,
      label: STATUS_CARD_LABEL[key] || meta.label,
      value: categorized[key]?.length || 0,
      tone: STATUS_CARD_TONE[key],
      icon: meta.icon
    }))
  ]), [categorized, citizenAppointments.length]);

  const activeCardLabel = statusCards.find((card) => card.key === statusCategory)?.label || 'All Appointment Bookings';

  const displayedAppointments = useMemo(() => {
    const base = statusCategory ? (categorized[statusCategory] || []) : citizenAppointments;
    const byService = activeService ? base.filter((appointment) => appointment.requestType === activeService) : base;
    const term = search.trim().toLowerCase();
    if (!term) return byService;
    return byService.filter((appointment) => {
      const haystack = [
        appointment.ref,
        getRequestTypeLabel(appointment.requestType),
        getAppointmentCenterName(appointment),
        getAppointmentCenterDistrict(appointment),
        getStatusLabel(appointment),
        getQueueNumber(appointment.ref)
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [activeService, categorized, citizenAppointments, search, statusCategory]);

  const selectStatusCategory = (key) => {
    const params = new URLSearchParams(searchParams);
    if (key) params.set('status', key); else params.delete('status');
    setSearchParams(params);
  };

  const appointmentIdOf = (appointment = {}) => appointment._id || appointment.id || appointment.ref;

  const actionTicketOf = (appointment = {}) => ({
    ...appointment,
    displayStatus: getStatusLabel(appointment)
  });

  const updateAppointmentStatus = async (appointment, status) => {
    const appointmentId = appointmentIdOf(appointment);
    if (!appointmentId) return;

    const actionTicket = actionTicketOf(appointment);
    if (status === 'Completed' && !canCompleteAppointment(actionTicket)) {
      toast.info('Complete is available only for active appointments whose scheduled time has arrived.');
      return;
    }
    if (status === 'Cancelled' && !canCancelAppointment(actionTicket)) {
      toast.info('This appointment is already closed and cannot be cancelled.');
      return;
    }
    if (status === 'Waiting' && !canReacceptAppointment(actionTicket)) {
      toast.info('Re-accept is available only after the appointment is completed.');
      return;
    }

    if (status === 'Cancelled' && !window.confirm(`Cancel ${appointment.ref}? The citizen will be notified.`)) return;
    if (status === 'Waiting' && !window.confirm(`Re-accept ${appointment.ref}? This will return it to Waiting so it can be handled again.`)) return;

    try {
      setUpdatingId(appointmentId);
      await api.put(`/api/bookings/admin/${appointmentId}/status`, {
        status,
        ...(status === 'Cancelled' ? { cancellationReason: 'Cancelled from citizen appointment details.' } : {})
      });
      toast.success(
        status === 'Waiting'
          ? `Request ${appointment.ref} returned to Waiting.`
          : status === 'Completed'
            ? `Request ${appointment.ref} completed.`
            : `Request ${appointment.ref} cancelled.`
      );
      setSelectedAppointment((current) => (
        current && appointmentIdOf(current) === appointmentId ? null : current
      ));
      await loadAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update appointment.');
    } finally {
      setUpdatingId('');
    }
  };

  if (!loading && !citizenAppointments.length) {
    return (
      <div className="nqs-admin-appointments min-h-screen bg-[var(--nqs-bg,#fff)] p-8 text-[var(--nqs-text,#06194a)]">
        <button
          type="button"
          onClick={() => navigate('/admin-appointments')}
          className="mb-6 inline-flex items-center gap-2 rounded-md border border-[#bfd0e6] bg-white px-3.5 py-2 text-xs font-black text-[#2563eb] hover:border-[#2563eb]"
        >
          <FiArrowLeft /> Back to Appointments
        </button>
        <div className="rounded-md border border-dashed border-[#bfd0e6] bg-white px-4 py-10 text-center text-[#62708a]">
          No appointments found for this citizen.
        </div>
      </div>
    );
  }

  return (
    <div className="nqs-admin-appointments min-h-screen bg-[var(--nqs-bg,#fff)] p-0 text-[var(--nqs-text,#06194a)]">
      <div className="mx-auto max-w-none">
        <div className="nqs-admin-appointments-hero border-b border-[var(--nqs-border,#cbd8ea)] bg-[var(--nqs-card,#fff)] px-8 py-6">
          <button
            type="button"
            onClick={() => navigate('/admin-appointments')}
            className="mb-4 inline-flex items-center gap-2 rounded-md border border-[#bfd0e6] bg-white px-3.5 py-2 text-xs font-black text-[#2563eb] hover:border-[#2563eb]"
          >
            <FiArrowLeft /> Back to Appointments
          </button>

          {loading || !citizenInfo ? (
            <p className="text-sm text-[#62708a]">Loading citizen...</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-50 text-lg font-black text-[#2563eb]">
                  <FiUser />
                </span>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-[var(--nqs-text,#06194a)] sm:text-2xl">{citizenInfo.name}</h1>
                  <p className="text-xs text-[var(--nqs-muted,#243b63)]">Citizen appointment history — this citizen only.</p>
                </div>
              </div>

              {/* Citizen personal information, directly under the header. */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Full Name', citizenInfo.name],
                  ['Phone', citizenInfo.phone],
                  ['National ID', citizenInfo.nationalId || 'Not on file'],
                  ['Service Type', citizenInfo.latestService],
                  ['Center', `${citizenInfo.latestCenter}${citizenInfo.latestCenterDistrict ? ` · ${citizenInfo.latestCenterDistrict}` : ''}`],
                  ['Appointment Date & Time', citizenInfo.latestDateTime],
                  ['Queue Number', citizenInfo.latestQueue],
                  ['Current Status', citizenInfo.latestStatus]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-[#e2eaf4] bg-[#f8fbff] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#7d93b2]">{label}</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-[#06194a]" title={String(value)}>{value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="nqs-admin-appointments-body bg-white px-8 py-6">
          {/* Services this citizen has booked. */}
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveService('')}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-black transition-all ${activeService === '' ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-[#bfd0e6] bg-white text-[#06194a] hover:border-[#2563eb]'}`}
            >
              <FiGrid className="h-4 w-4" /> All Services
            </button>
            {SERVICE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeService === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveService(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-black transition-all ${isActive ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-[#bfd0e6] bg-white text-[#06194a] hover:border-[#2563eb]'}`}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                  <span className={isActive ? 'text-white/80' : 'text-[#62708a]'}>({serviceCounts[tab.key]})</span>
                </button>
              );
            })}
          </div>

          {/* Status cards — soft pastel tones, filter the table below. */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-7">
            {statusCards.map((card) => {
              const isActive = statusCategory === card.key;
              const Icon = card.icon;
              return (
                <button
                  key={card.key || 'total'}
                  type="button"
                  onClick={() => selectStatusCategory(card.key)}
                  className={`flex items-center gap-3 rounded-md border p-3.5 text-left transition-all nqs-card-tone-${card.tone} ${isActive ? 'ring-2 ring-blue-500/25' : ''}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base nqs-card-tone-icon-${card.tone}`}>
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-black text-[#06194a]">{card.value}</span>
                    <span className="block truncate text-[11px] font-bold text-[#3a4b63]">{card.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Small search/filter area for this citizen's appointments. */}
          <label className="relative mb-5 block max-w-md">
            <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7d93b2]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this citizen's appointments (request, service, center)"
              className="w-full rounded-md border border-[#bfd0e6] bg-white py-2.5 pl-10 pr-3 text-sm font-medium text-[#06194a] outline-none placeholder:text-[#8ea0ba] focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
            />
          </label>

          {loading ? (
            <div className="rounded-md border border-[#d7e1ee] bg-white px-4 py-10 text-center text-[#62708a]">
              Loading appointments...
            </div>
          ) : (
            <section className="overflow-hidden rounded-md border border-[#d7e1ee] bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-[#d7e1ee] bg-[#f8fbff] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-black text-[#06194a]">{activeCardLabel}</h2>
                <span className="w-fit rounded-md border border-[#d7e1ee] bg-white px-3 py-1 text-xs font-black text-[#243b63]">
                  {displayedAppointments.length} appointment{displayedAppointments.length === 1 ? '' : 's'}
                </span>
              </div>

              {displayedAppointments.length === 0 ? (
                <div className="px-4 py-10 text-center text-[#62708a]">
                  No appointments match the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f5f8ff] text-xs uppercase tracking-wide text-[#62708a]">
                      <tr>
                        {['Request', 'Full Name', 'Service', 'Center', 'Date & Time', 'Queue', 'Status', 'Actions'].map((heading) => (
                          <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d7e1ee]">
                      {displayedAppointments.map((appointment) => {
                        const appointmentDate = appointment.date || appointment.createdAt || appointment.submissionDate;
                        const appointmentId = appointmentIdOf(appointment);
                        const actionTicket = actionTicketOf(appointment);
                        const canComplete = canCompleteAppointment(actionTicket);
                        const canCancel = canCancelAppointment(actionTicket);
                        const canReaccept = canReacceptAppointment(actionTicket);
                        const isBusy = updatingId === appointmentId;
                        return (
                          <tr
                            key={appointment._id || appointment.id}
                            onClick={() => setSelectedAppointment(appointment)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedAppointment(appointment);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className="cursor-pointer bg-white hover:bg-[#f8fbff]"
                          >
                            <td className="px-4 py-3 font-mono font-bold text-[#2563eb]">{appointment.ref}</td>
                            <td className="px-4 py-3 font-semibold text-[#06194a]">{getCitizenName(appointment)}</td>
                            <td className="px-4 py-3 text-[#243b63]">{getRequestTypeLabel(appointment.requestType)}</td>
                            <td className="px-4 py-3 font-semibold text-[#06194a]">
                              {getAppointmentCenterName(appointment)}
                              {getAppointmentCenterDistrict(appointment) ? (
                                <span className="block text-xs font-normal text-[#62708a]">{getAppointmentCenterDistrict(appointment)}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-[#243b63]">
                              {formatDate(appointmentDate)}
                              {appointment.timeSlot ? <span className="block text-xs text-[#62708a]">{appointment.timeSlot}</span> : null}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-[#06194a]">{getQueueNumber(appointment.ref)}</td>
                            <td className="px-4 py-3">
                              <span className={statusClass(appointment)}>{getStatusLabel(appointment)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedAppointment(appointment)}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                  <FiEye /> View
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy || !canComplete}
                                  onClick={() => updateAppointmentStatus(appointment, 'Completed')}
                                  title={canComplete ? 'Mark as Completed' : 'Disabled until this appointment can be completed'}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  <FiCheckCircle /> Complete
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy || !canCancel}
                                  onClick={() => updateAppointmentStatus(appointment, 'Cancelled')}
                                  title={canCancel ? 'Cancel appointment' : 'This appointment cannot be cancelled'}
                                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  <FiXCircle /> Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy || !canReaccept}
                                  onClick={() => updateAppointmentStatus(appointment, 'Waiting')}
                                  title={canReaccept ? 'Return completed appointment to Waiting' : 'Available after Complete'}
                                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold !text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
                                >
                                  <FiRepeat /> Re-accept
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl">
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
              <p><span className="block text-xs font-bold uppercase text-slate-400">Full Name</span>{getCitizenName(selectedAppointment)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Phone</span>{getCitizenPhone(selectedAppointment)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Request Number</span>{selectedAppointment.ref}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Queue Number</span>{getQueueNumber(selectedAppointment.ref)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Service</span>{getRequestTypeLabel(selectedAppointment.requestType)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Center</span>{getAppointmentCenterName(selectedAppointment)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Date</span>{formatDate(selectedAppointment.date)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Time</span>{selectedAppointment.timeSlot || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Current Status</span>{getStatusLabel(selectedAppointment)}</p>
              {getCancellationReasonList(selectedAppointment).length > 0 && (
                <div className="sm:col-span-2">
                  <span className="block text-xs font-bold uppercase text-slate-400">Cancellation / Correction Feedback</span>
                  <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                    {getCancellationFeedbackText(selectedAppointment, 'No cancellation reason was provided.')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getCancellationReasonList(selectedAppointment).map((reason) => (
                      <span key={reason} className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <h3 className="mb-3 text-sm font-bold text-white">Appointment History</h3>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Booked / Created', formatDate(selectedAppointment.createdAt)],
                  ['Last Updated', formatDate(selectedAppointment.updatedAt)],
                  ...(selectedAppointment.completedAt ? [['Completed', formatDate(selectedAppointment.completedAt)]] : []),
                  ...(selectedAppointment.cancelledAt ? [['Cancelled', formatDate(selectedAppointment.cancelledAt)]] : []),
                  ...(selectedAppointment.cancellationReason ? [['Cancellation Reason', selectedAppointment.cancellationReason]] : [])
                ].map(([label, value]) => (
                  <p key={label}>
                    <span className="block text-xs font-bold uppercase text-slate-400">{label}</span>
                    {value}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenAppointmentDetails;
