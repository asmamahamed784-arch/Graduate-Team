
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle,
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiGrid,
  FiRepeat,
  FiSearch,
  FiUserPlus,
  FiX,
  FiXCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { useOtpGate } from '../hooks';
import { canCancelAppointment, canCompleteAppointment, canReacceptAppointment, hasAppointmentTimeArrived } from '../utils/appointmentActions';
import { getCancellationFeedbackText, getCancellationReasonList } from '../utils/cancellationDisplay';
import LostIdCancelDetails from '../components/LostIdCancelDetails';
import OtpGateModal from '../components/OtpGateModal';
import {
  getIncorrectFieldOptionsForTicket,
  isLostReplacementRequest,
} from '../utils/cancellationFields';
import { getChangedUpdateFields } from '../utils/updateRequestFields';
import { classifyAppointment, STATUS_CATEGORY_META, getStatusLabel, statusClass } from '../utils/appointmentStatus';
import {
  formatDate,
  getQueueNumber,
  getRequestTypeLabel,
  getAppointmentCenterName,
  getAppointmentCenterDistrict,
  getCenterRecordId,
  getCitizenPhone
} from '../utils/appointmentDisplay';
import { getCitizenKey } from '../utils/citizenIdentity';

// Service tabs stay in sync with the "Service" filter dropdown via the same
// activeTab state — '' represents "All Services" (no requestType filter sent).
// Tone = sitewide soft-pastel card tone system (styles/nqs-theme-system.css),
// scoped to just the tabs/status cards on this page.
const requestTabs = [
  { key: '', label: 'All Services', icon: FiGrid, tone: 'blue' },
  { key: 'new_national_id', label: 'New Registration', icon: FiUserPlus, tone: 'green' },
  { key: 'update_information', label: 'Update Information', icon: FiEdit3, tone: 'purple' },
  { key: 'lost_replacement', label: 'Lost ID Replacement', icon: FiCreditCard, tone: 'orange' }
];

// Local card-only tone map for the status cards (the "All Status" filter dropdown
// keeps using the shared STATUS_CATEGORY_META untouched — only these cards change).
const STATUS_CARD_TONE = {
  '': 'blue',
  waiting: 'purple',
  completed: 'green',
  cancelled: 'pink',
  noShow: 'pink'
};

const formatMaritalStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (normalized === 'single' || normalized === 'singe') return 'Single';
  if (normalized === 'married' || normalized === 'marrid') return 'Married';
  return value || '--';
};

const getPreviousDataRows = (appointment = {}) => {
  const previous = appointment.updateDetails?.previousData || appointment.updateDetails?.oldDataSnapshot || {};
  const rows = [
    ['Full Name', previous.fullName],
    ["Mother's Name", previous.motherName],
    ['Date of Birth', formatDate(previous.dateOfBirth)],
    ['Phone', previous.phone],
    ['Gender', previous.gender],
    ['Marital Status', formatMaritalStatus(previous.maritalStatus)],
    ['District', previous.district],
    ['Full Address', previous.address || previous.fullAddress],
    ['Nearest Landmark', previous.nearestLandmark],
    ['National ID Number', previous.nationalIdNumber]
  ];
  return rows.filter(([, value]) => value && value !== '--');
};

function AdminAppointments() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedTicketRef = String(searchParams.get('ticket') || '').trim().toUpperCase();
  const requestedTicketId = String(searchParams.get('ticketId') || '').trim();
  const autoOpenedTicketRef = useRef('');
  const [appointments, setAppointments] = useState([]);
  const [centers, setCenters] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [statusCategory, setStatusCategory] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    center: '',
    date: ''
  });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const {
    otpFlow, otpDigits, otpSeconds, otpRequesting, otpVerifying, otpError,
    requestOtp, updateOtpDigit, verifyOtpGate, resendOtpGate, closeOtpGate
  } = useOtpGate();
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [selectedCancelReasons, setSelectedCancelReasons] = useState([]);
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  // Only search/center/date/service are sent to the backend (all already supported,
  // composable query params on GET /api/bookings/admin/all — see BookingService.getAllBookings).
  // Status-category filtering (the 7 status cards) happens client-side below because
  // it spans both the `status` and `requestStatus` columns, which the backend only
  // exact-matches one at a time.
  const activeFilters = useMemo(() => {
    const active = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value)
    );
    if (activeTab) active.requestType = activeTab;
    return active;
  }, [filters, activeTab]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const centerOptions = useMemo(
    () => [...centers].sort((a, b) => (
      String(a.district || '').localeCompare(String(b.district || '')) || a.name.localeCompare(b.name)
    )),
    [centers]
  );

  // Status cards + the "All Status" dropdown both filter this same categorized
  // set client-side (see comment on activeFilters above for why).
  const categorizedAppointments = useMemo(() => {
    const groups = { waiting: [], inProgress: [], completed: [], cancelled: [], correctionRequired: [], noShow: [] };
    appointments.forEach((appointment) => {
      const category = classifyAppointment(appointment);
      const visibleCategory = category === 'inProgress' || category === 'correctionRequired' ? 'waiting' : category;
      groups[visibleCategory].push(appointment);
    });
    return groups;
  }, [appointments]);

  const displayedAppointments = statusCategory
    ? (categorizedAppointments[statusCategory] || [])
    : appointments;

  useEffect(() => {
    if (!appointments.length) return;
    if (!requestedTicketRef && !requestedTicketId) return;

    const lookupKey = requestedTicketRef || requestedTicketId;
    if (autoOpenedTicketRef.current === lookupKey) return;

    const matched = appointments.find((appointment) => (
      String(appointment.ref || '').toUpperCase() === requestedTicketRef
      || String(appointment._id || '') === requestedTicketId
      || String(appointment.id || '') === requestedTicketId
    ));

    if (matched) {
      autoOpenedTicketRef.current = lookupKey;
      setSelectedAppointment(matched);
    }
  }, [appointments, requestedTicketId, requestedTicketRef]);

  useEffect(() => {
    const requestedType = searchParams.get('requestType');
    if (requestTabs.some((tab) => tab.key === requestedType)) {
      setActiveTab(requestedType);
    }

    // Links from Admin Dashboard KPI tiles (AdminDashboardParts.jsx KPI_ROUTES)
    // pass a raw backend status literal (e.g. ?status=Completed) — reuse the same
    // classifier to resolve it to the matching status-card category.
    const requestedStatus = searchParams.get('status');
    if (requestedStatus) {
      const requestedCategory = classifyAppointment({ status: requestedStatus });
      setStatusCategory(
        requestedCategory === 'inProgress' || requestedCategory === 'correctionRequired'
          ? 'waiting'
          : requestedCategory
      );
    }

    const requestedDate = searchParams.get('date');
    const requestedCenter = searchParams.get('center');

    setFilters((current) => ({
      ...current,
      ...(requestedDate === 'today' ? { date: new Date().toISOString().slice(0, 10) } : {}),
      ...(requestedDate && requestedDate !== 'today' ? { date: requestedDate } : {}),
      ...(requestedCenter !== null ? { center: requestedCenter } : {})
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const updateAppointmentStatus = async (appointment, status, extra = {}) => {
    if (status === 'Completed' && !canCompleteAppointment({
      ...appointment,
      displayStatus: getDisplayStatus(appointment)
    })) {
      toast.info(hasAppointmentTimeArrived(appointment)
        ? 'This appointment is already completed or closed.'
        : 'This appointment cannot be completed before its scheduled date and time.');
      return;
    }
    if (status === 'Cancelled' && !canCancelAppointment({
      ...appointment,
      displayStatus: getDisplayStatus(appointment)
    })) {
      toast.info('This appointment is already closed and cannot be cancelled.');
      return;
    }
    try {
      setUpdatingId(appointment._id);
      let otpToken = '';
      if (status === 'Completed' || status === 'Cancelled') {
        otpToken = await requestOtp({
          purpose: status === 'Completed' ? 'complete_service' : 'cancel_service',
          ticketId: appointment._id,
          ticketRef: appointment.ref,
          title: status === 'Completed' ? 'Verify to Complete' : 'Verify to Cancel',
          description: `Ask the citizen for the 6-digit code sent to their phone to ${status === 'Completed' ? 'complete' : 'cancel'} ${appointment.ref || 'this request'}.`
        });
        if (!otpToken) {
          toast.info(status === 'Completed' ? 'Complete service cancelled.' : 'Cancellation aborted.');
          return;
        }
      }
      const res = await api.put(`/api/bookings/admin/${appointment._id}/status`, { status, otpToken, ...extra });
      if (res.data.success) {
        toast.success(status === 'Cancelled'
          ? (res.data.message || 'The appointment was cancelled successfully, and the citizen has been notified.')
          : `Request ${appointment.ref} updated.`);
        await loadAppointments();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update appointment.');
    } finally {
      setUpdatingId('');
    }
  };

  const openCancelModal = (appointment) => {
    if (!canCancelAppointment({
      ...appointment,
      displayStatus: getDisplayStatus(appointment)
    })) {
      toast.info('This appointment is already closed and cannot be cancelled.');
      return;
    }
    setCancelTarget(appointment);
    setSelectedCancelReasons([]);
    setCustomCancelReason('');
    setCancelNotes('');
    setShowCancelConfirmation(false);
  };

  const closeCancelModal = () => {
    setCancelTarget(null);
    setSelectedCancelReasons([]);
    setCustomCancelReason('');
    setCancelNotes('');
    setShowCancelConfirmation(false);
  };

  const toggleCancelReason = (reason) => {
    setShowCancelConfirmation(false);
    setSelectedCancelReasons((current) => (
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason]
    ));
  };

  const selectedReasonLabels = (ticket = cancelTarget) => {
    const allowed = getIncorrectFieldOptionsForTicket(ticket);
    return selectedCancelReasons.filter((reason) => allowed.includes(reason));
  };

  const confirmCancelAppointment = async () => {
    if (!cancelTarget) return;
    const isUpdateReq = cancelTarget.requestType === 'update_information';
    const isLostReq = isLostReplacementRequest(cancelTarget);
    const changedUpdateFields = getChangedUpdateFields(cancelTarget);

    if (isUpdateReq) {
      if (changedUpdateFields.length === 0) {
        toast.error('No changes detected. Cancellation is not required.');
        return;
      }
      if (!customCancelReason.trim()) {
        toast.error('Please enter a cancellation reason.');
        return;
      }
      if (!showCancelConfirmation) {
        setShowCancelConfirmation(true);
        return;
      }
      const reason = customCancelReason.trim();
      await updateAppointmentStatus(cancelTarget, 'Cancelled', {
        cancellationReasons: [reason],
        additionalReason: '',
        additionalNotes: '',
        cancellationReason: reason
      });
      closeCancelModal();
      return;
    }

    const validReasons = selectedReasonLabels(cancelTarget);
    if (!validReasons.length) {
      toast.error(
        isLostReq
          ? 'Please select at least one incorrect Lost ID field.'
          : 'Please select at least one incorrect field.'
      );
      return;
    }
    if (!showCancelConfirmation) {
      setShowCancelConfirmation(true);
      return;
    }

    await updateAppointmentStatus(cancelTarget, 'Cancelled', {
      cancellationReasons: validReasons,
      additionalReason: '',
      additionalNotes: cancelNotes.trim(),
      cancellationReason: validReasons.join(', ')
    });
    closeCancelModal();
  };

  const updateRequestStatus = async (appointment, requestStatus) => {
    if (requestStatus === 'Completed' && !canCompleteAppointment({
      ...appointment,
      displayStatus: getDisplayStatus(appointment)
    })) {
      toast.info('This appointment is already completed or closed.');
      return;
    }
    try {
      setUpdatingId(appointment._id);
      let otpToken = '';
      if (requestStatus === 'Completed' || requestStatus === 'Cancelled') {
        otpToken = await requestOtp({
          purpose: requestStatus === 'Completed' ? 'complete_service' : 'cancel_service',
          ticketId: appointment._id,
          ticketRef: appointment.ref,
          title: requestStatus === 'Completed' ? 'Verify to Complete' : 'Verify to Cancel',
          description: `Ask the citizen for the 6-digit code sent to their phone to ${requestStatus === 'Completed' ? 'complete' : 'cancel'} ${appointment.ref || 'this request'}.`
        });
        if (!otpToken) {
          toast.info(requestStatus === 'Completed' ? 'Complete service cancelled.' : 'Cancellation aborted.');
          return;
        }
      }
      const res = await api.put(`/api/bookings/admin/${appointment._id}/request-status`, { requestStatus, otpToken });
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

  const reacceptAppointment = async (appointment) => {
    const actionTicket = {
      ...appointment,
      status: getDisplayStatus(appointment),
      requestStatus: appointment.requestStatus || getDisplayStatus(appointment),
      displayStatus: getDisplayStatus(appointment)
    };
    if (!canReacceptAppointment(actionTicket)) {
      toast.info('Re-accept is available only after the appointment is completed.');
      return;
    }
    const confirmed = window.confirm(`Re-accept ${appointment.ref}? This will return it to Waiting so it can be handled again.`);
    if (!confirmed) return;
    await updateAppointmentStatus(appointment, 'Waiting');
  };

  // One unified column set for all three services (the Service column tells them
  // apart), so "All Services" can list mixed request types in a single table.
  const tableHeadings = ['Request', 'Full Name', 'Phone', 'Service', 'Center', 'Date & Time', 'Queue', 'Status', 'Actions'];

  const renderAppointmentRow = (appointment) => {
    const citizen = appointment.citizen || {};
    const isBusy = updatingId === appointment._id;
    const isManagedRequest = appointment.requestType !== 'new_national_id';
    const displayStatus = getDisplayStatus(appointment);
    const statusLabel = getStatusLabel(appointment);
    const appointmentDate = appointment.date || appointment.createdAt || appointment.submissionDate;
    const actionTicket = {
      ...appointment,
      status: displayStatus,
      requestStatus: appointment.requestStatus || displayStatus,
      displayStatus
    };
    const canComplete = canCompleteAppointment(actionTicket);
    const canCancel = canCancelAppointment(actionTicket);
    const canReaccept = canReacceptAppointment(actionTicket);

    const openCitizenPage = () => navigate(`/admin-appointments/citizen/${encodeURIComponent(getCitizenKey(appointment))}`);

    return (
      <tr
        key={appointment._id}
        onClick={openCitizenPage}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openCitizenPage();
          }
        }}
        role="button"
        tabIndex={0}
        className="nqs-admin-appointment-row cursor-pointer bg-white hover:bg-[#f8fbff]"
      >
        <td className="px-4 py-3 font-mono font-bold text-[#2563eb]">{appointment.ref}</td>
        <td className="px-4 py-3 font-semibold text-[#06194a]">
          {citizen.name || appointment.citizenName || '--'}
        </td>
        <td className="px-4 py-3 text-[#243b63]">{getCitizenPhone(appointment)}</td>
        <td className="px-4 py-3 text-[#243b63]">{getRequestTypeLabel(appointment.requestType)}</td>
        <td className="px-4 py-3 text-[#243b63]">
          {getAppointmentCenterName(appointment)}
          {getAppointmentCenterDistrict(appointment) ? (
            <span className="block text-xs text-[#62708a]">{getAppointmentCenterDistrict(appointment)}</span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-[#243b63]">
          {formatDate(appointmentDate)}
          {appointment.timeSlot ? <span className="block text-xs text-[#62708a]">{appointment.timeSlot}</span> : null}
        </td>
        <td className="px-4 py-3 font-mono font-semibold text-[#06194a]">{getQueueNumber(appointment.ref)}</td>
        <td className="px-4 py-3">
          <span className={statusClass(appointment)}>{statusLabel}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedAppointment(appointment)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <FiEye /> View
            </button>
            {canComplete && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => isManagedRequest ? updateRequestStatus(appointment, 'Completed') : updateAppointmentStatus(appointment, 'Completed')}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiCheckCircle /> Complete
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => openCancelModal(appointment)}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiXCircle /> Cancel
              </button>
            )}
            <button
              type="button"
              disabled={isBusy || !canReaccept}
              onClick={() => reacceptAppointment(appointment)}
              title={canReaccept ? 'Return completed appointment to Waiting' : 'Available after Complete'}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold !text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
            >
              <FiRepeat /> Re-accept
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="nqs-admin-appointments min-h-screen bg-[var(--nqs-bg,#fff)] p-0 text-[var(--nqs-text,#06194a)]">
      <div className="mx-auto max-w-none">
        <div className="nqs-admin-appointments-hero border-b border-[var(--nqs-border,#cbd8ea)] bg-[var(--nqs-card,#fff)] px-8 py-9">
          <h1 className="text-2xl font-black tracking-tight text-[var(--nqs-text,#06194a)] sm:text-3xl">Admin Appointments</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--nqs-muted,#243b63)]">
            Review and manage National ID bookings from the database.
          </p>
        </div>

        <div className="nqs-admin-appointments-body bg-white px-8 py-7">
          <div className="nqs-admin-request-tabs mb-6 flex flex-wrap gap-3">
            {requestTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key || 'all-services'}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`nqs-admin-request-tab inline-flex items-center gap-3 rounded-md border px-5 py-3 text-sm font-black transition-all ${isActive ? 'is-active border-[#2563eb] bg-[#2563eb] text-white shadow-sm' : `nqs-card-tone-${tab.tone} hover:border-[#2563eb] hover:text-[#2563eb]`}`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { key: '', label: 'All Appointments', value: appointments.length, tone: STATUS_CARD_TONE[''], icon: FiGrid },
              ...Object.entries(STATUS_CATEGORY_META)
                .map(([key, meta]) => ({
                  key,
                  label: meta.label,
                  value: categorizedAppointments[key]?.length || 0,
                  tone: STATUS_CARD_TONE[key],
                  icon: meta.icon
                }))
            ].map((card) => {
              const isActive = statusCategory === card.key;
              const Icon = card.icon;
              return (
                <button
                  key={card.key || 'all-appointments'}
                  type="button"
                  onClick={() => setStatusCategory(card.key)}
                  className={`nqs-admin-status-card flex items-center gap-3 rounded-md border p-4 text-left transition-all nqs-card-tone-${card.tone} ${isActive ? 'ring-2 ring-blue-500/25' : ''}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg nqs-card-tone-icon-${card.tone}`}>
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl font-black text-[#06194a]">{card.value}</span>
                    <span className="block truncate text-xs font-bold text-[#62708a]">{card.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-6 rounded-md border border-[#d7e1ee] bg-[#f8fbff] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <label className="relative block xl:col-span-2">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#06194a]" />
                <input
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Search citizen, phone, request or queue number"
                  className="nqs-admin-filter-control w-full rounded-md border border-[#bfd0e6] bg-white py-3 pl-11 pr-3 text-sm font-medium text-[#06194a] outline-none placeholder:text-[#62708a] focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <select
                value={filters.center}
                onChange={(event) => updateFilter('center', event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">All Centers</option>
                {centerOptions.map((center) => {
                  const centerId = getCenterRecordId(center);
                  return (
                    <option key={centerId} value={centerId}>
                      {center.district ? `${center.district} - ` : ''}{center.name}
                    </option>
                  );
                })}
              </select>

              <select
                value={activeTab}
                onChange={(event) => setActiveTab(event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              >
                {requestTabs.map((tab) => (
                  <option key={tab.key || 'all-services'} value={tab.key}>{tab.label}</option>
                ))}
              </select>

              <select
                value={statusCategory}
                onChange={(event) => setStatusCategory(event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">All Status</option>
                {Object.entries(STATUS_CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>

              <input
                type="date"
                value={filters.date}
                onChange={(event) => updateFilter('date', event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          {loading && (
            <div className="rounded-md border border-[#d7e1ee] bg-white px-4 py-10 text-center text-[#62708a]">
              Loading appointments...
            </div>
          )}

          {!loading && (
            <section className="overflow-hidden rounded-md border border-[#d7e1ee] bg-white shadow-sm">
              <div className="flex items-center justify-end border-b border-[#d7e1ee] bg-[#f8fbff] px-5 py-4">
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
                        {tableHeadings.map((heading) => (
                          <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#d7e1ee]">
                      {displayedAppointments.map(renderAppointmentRow)}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="nqs-admin-page-footer mt-auto flex items-center justify-between border-t border-[#cbd8ea] bg-white px-8 py-6 text-sm text-[#243b63]">
        <span>© 2026 NQS National ID. All rights reserved.</span>
        <span>Version 1.0.0</span>
      </footer>

      {cancelTarget && (() => {
        const isUpdateReq = cancelTarget.requestType === 'update_information';
        const isLostReq = isLostReplacementRequest(cancelTarget);
        const fieldOptions = getIncorrectFieldOptionsForTicket(cancelTarget);
        const changedFields = isUpdateReq ? getChangedUpdateFields(cancelTarget) : [];
        const hasNoChanges = isUpdateReq && changedFields.length === 0;
        const modalTitle = isUpdateReq
          ? 'Cancel Update Request'
          : isLostReq
            ? 'Cancel Replace Lost National ID'
            : 'Cancel Appointment';
        const modalHelp = isUpdateReq
          ? 'Review the changed information and provide a cancellation reason for this update request.'
          : isLostReq
            ? 'Review the Lost ID details the citizen submitted, select incorrect fields, and add notes. The citizen will see this feedback and can resubmit.'
            : 'Select the incorrect fields. The citizen will receive this feedback and can resubmit from their dashboard.';

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white ${isUpdateReq ? 'max-w-lg' : 'max-w-2xl'}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Admin Action</p>
                <h2 className="mt-1 text-2xl font-black">{modalTitle}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{modalHelp}</p>
              </div>
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close cancel appointment modal"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/40">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Request Reference</p>
                  <p className="mt-1 font-mono text-sm font-black text-blue-700 dark:text-[#7CB8FF]">{cancelTarget.ref}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Full Name</p>
                  <p className="mt-1 text-sm font-black">{cancelTarget.citizen?.name || cancelTarget.citizenName || '--'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Request Type</p>
                  <p className="mt-1 text-sm font-black">{getRequestTypeLabel(cancelTarget.requestType)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Current Status</p>
                  <p className="mt-1 text-sm font-black">{getDisplayStatus(cancelTarget)}</p>
                </div>
              </div>
            </div>

            {isLostReq && <LostIdCancelDetails ticket={cancelTarget} />}

            {isUpdateReq ? (
              <div className="mt-5 space-y-4">
                {hasNoChanges ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                    No changes detected. Cancellation is not required.
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Changed Information</span>
                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 font-black uppercase text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          <tr>
                            <th className="px-3 py-2">Field</th>
                            <th className="px-3 py-2">Previous Information</th>
                            <th className="px-3 py-2">Requested Information</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                          {changedFields.map((field, index) => (
                            <tr key={`${field.field}-${index}`}>
                              <td className="px-3 py-2 font-bold text-blue-700 dark:text-[#7CB8FF]">{field.field}</td>
                              <td className="px-3 py-2 text-slate-500 line-through dark:text-slate-400">{field.oldValue}</td>
                              <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{field.newValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!hasNoChanges && (
                  <label className="block">
                    <span className="text-sm font-bold">Cancellation Reason</span>
                    <textarea
                      value={customCancelReason}
                      onChange={(event) => {
                        setShowCancelConfirmation(false);
                        setCustomCancelReason(event.target.value);
                      }}
                      rows={3}
                      placeholder="Enter the reason for cancelling this update request"
                      className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900/40"
                    />
                  </label>
                )}
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <span className="text-sm font-bold">
                    {isLostReq ? 'Select incorrect Lost ID fields' : 'Select incorrect fields'}
                  </span>
                  <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40 sm:grid-cols-2">
                    {fieldOptions.map((reason) => {
                      const checked = selectedCancelReasons.includes(reason);
                      return (
                        <label
                          key={reason}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            checked
                              ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-[#7CB8FF] dark:bg-blue-950/40 dark:text-[#B9D9FF]'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCancelReason(reason)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          />
                          <span>{reason}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm font-bold">Additional notes</span>
                  <textarea
                    value={cancelNotes}
                    onChange={(event) => {
                      setShowCancelConfirmation(false);
                      setCancelNotes(event.target.value);
                    }}
                    rows={3}
                    placeholder="Citizen may submit a corrected request."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900/40"
                  />
                </label>
              </>
            )}

            {showCancelConfirmation && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-black">Confirm cancellation</p>
                <p className="mt-2">
                  {isUpdateReq
                    ? `Cancellation reason: ${customCancelReason.trim()}. Are you sure you want to cancel this update request?`
                    : `You selected the following incorrect fields: ${selectedReasonLabels(cancelTarget).join(', ')}. Are you sure you want to cancel this ${isLostReq ? 'Lost ID request' : 'appointment'}?`}
                </p>
              </div>
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
                disabled={updatingId === cancelTarget._id || hasNoChanges}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updatingId === cancelTarget._id
                  ? 'Cancelling...'
                  : (isUpdateReq
                    ? 'Confirm Cancel Update'
                    : isLostReq
                      ? 'Confirm Cancel Lost ID'
                      : 'Confirm Cancellation')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

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
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className="block text-xs font-bold uppercase text-slate-400">Full Name</span>{selectedAppointment.citizen?.name || selectedAppointment.citizenName || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Email</span>{selectedAppointment.citizen?.email || '--'}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Phone</span>{getCitizenPhone(selectedAppointment)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Center</span>{getAppointmentCenterName(selectedAppointment)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Request Number</span>{selectedAppointment.ref}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Date</span>{formatDate(selectedAppointment.date)}</p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Time</span>{selectedAppointment.timeSlot || '--'}</p>
              <p>
                <span className="block text-xs font-bold uppercase text-slate-400">Queue Number</span>
                {selectedAppointment.requestType === 'update_information' ? '--' : getQueueNumber(selectedAppointment.ref)}
              </p>
              <p><span className="block text-xs font-bold uppercase text-slate-400">Service</span>{getRequestTypeLabel(selectedAppointment.requestType)}</p>
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

            {selectedAppointment && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-white">Existing Registration Lookup</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Existing registration found', selectedAppointment.existingRegistration?.found ? 'Yes' : 'No'],
                    ['Previous Request Number', selectedAppointment.existingRegistration?.originalTicketReference || selectedAppointment.existingRegistration?.ticketNumber || '--'],
                    ['Previous Queue Number', selectedAppointment.existingRegistration?.originalQueueNumber || selectedAppointment.existingRegistration?.queueNumber || '--'],
                    ['Previous Center', selectedAppointment.existingRegistration?.originalCenter || selectedAppointment.existingRegistration?.centerName || '--'],
                    ['Previous District', selectedAppointment.existingRegistration?.originalDistrict || '--'],
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
                    ['Marital Status', selectedAppointment.registrationDetails?.maritalStatus === 'SINGLE' ? 'Single' : selectedAppointment.registrationDetails?.maritalStatus === 'MARRIED' ? 'Married' : '--'],
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
                  {getPreviousDataRows(selectedAppointment).length > 0 && (
                    <div className="sm:col-span-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <h4 className="mb-3 text-sm font-black text-white">Previous National ID Data</h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {getPreviousDataRows(selectedAppointment).map(([label, value]) => (
                          <p key={label}>
                            <span className="block text-xs font-bold uppercase text-slate-400">{label}</span>
                            {value || '--'}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
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

      <OtpGateModal
        flow={otpFlow}
        digits={otpDigits}
        seconds={otpSeconds}
        requesting={otpRequesting}
        verifying={otpVerifying}
        error={otpError}
        onDigitChange={updateOtpDigit}
        onVerify={verifyOtpGate}
        onResend={resendOtpGate}
        onClose={closeOtpGate}
      />
    </div>
  );
}

export default AdminAppointments;
