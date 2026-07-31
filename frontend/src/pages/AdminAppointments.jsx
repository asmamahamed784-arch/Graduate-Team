
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle,
  FiArrowLeft,
  FiBriefcase,
  FiChevronRight,
  FiCreditCard,
  FiEdit3,
  FiEye,
  FiSearch,
  FiSlash,
  FiUserPlus,
  FiXCircle
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { canCancelAppointment, canCompleteAppointment } from '../utils/appointmentActions';
import { INCORRECT_FIELD_OPTIONS } from '../utils/cancellationFields';
import { getChangedUpdateFields } from '../utils/updateRequestFields';

const statusOptions = ['', 'Waiting', 'Being Served', 'On Hold', 'Completed', 'Cancelled'];
const requestStatusOptions = ['', 'Pending', 'Approved', 'Rejected', 'Completed', 'Resubmission Required'];
const requestTabs = [
  { key: 'new_national_id', label: 'New Registration', icon: FiUserPlus },
  { key: 'update_information', label: 'Update Information', icon: FiEdit3 },
  { key: 'lost_replacement', label: 'Lost ID Replacement', icon: FiCreditCard }
];
const getCancellationReasonList = (item = {}) => {
  const reasons = Array.isArray(item.cancellationReasons) ? item.cancellationReasons : [];
  if (reasons.length) return reasons.filter(Boolean);
  return item.cancellationReason ? [item.cancellationReason] : [];
};

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

const getAppointmentDistrict = (appointment) => (
  appointment.district ||
  appointment.registrationDetails?.district ||
  appointment.registrationDetails?.centerDistrict ||
  appointment.replacementDetails?.district ||
  appointment.center?.district ||
  'Not provided'
);

const getAppointmentCenterName = (appointment) => (
  appointment.center?.name ||
  appointment.registrationDetails?.selectedCenter ||
  appointment.existingRegistration?.centerName ||
  'No center assigned'
);

const getAppointmentCenterId = (appointment) => {
  if (!appointment.center) return '';
  if (typeof appointment.center === 'string') return appointment.center;
  return appointment.center._id || appointment.center.id || '';
};

const normalizeCenterKey = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, ' ');

const getCenterRecordId = (center = {}) => String(center._id || center.id || '');

function AdminAppointments() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isCenterDetailPage = location.pathname.startsWith('/admin-appointments/center');
  const requestedCenterName = searchParams.get('centerName') || '';
  const requestedTicketRef = String(searchParams.get('ticket') || '').trim().toUpperCase();
  const requestedTicketId = String(searchParams.get('ticketId') || '').trim();
  const autoOpenedTicketRef = useRef('');
  const [appointments, setAppointments] = useState([]);
  const [centers, setCenters] = useState([]);
  const [activeTab, setActiveTab] = useState('new_national_id');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    requestType: '',
    requestStatus: '',
    district: '',
    center: '',
    date: ''
  });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [selectedCancelReasons, setSelectedCancelReasons] = useState([]);
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const activeFilters = useMemo(() => {
    const active = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value)
    );
    active.requestType = activeTab;
    return active;
  }, [filters, activeTab]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'district' ? { center: '' } : {})
    }));
  };

  const openCenterAppointmentsPage = (group) => {
    const params = new URLSearchParams({
      requestType: activeTab,
      district: group.district,
      centerName: group.centerName
    });
    if (group.centerId) {
      params.set('center', group.centerId);
    }
    navigate(`/admin-appointments/center?${params.toString()}`);
  };

  const backToCenterCards = () => {
    const params = new URLSearchParams({ requestType: activeTab });
    if (filters.district) {
      params.set('district', filters.district);
    }
    navigate(`/admin-appointments?${params.toString()}`);
  };

  const centerOptions = useMemo(
    () => filters.district
      ? centers.filter((center) => center.district === filters.district)
      : centers,
    [centers, filters.district]
  );

  const districtOptions = useMemo(
    () => [...new Set(centers.map((center) => center.district).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [centers]
  );

  // Cards come only from centers created in Center Management — never from orphan appointment names.
  const groupedAppointments = useMemo(() => {
    const byCenterId = new Map();
    const byNameDistrict = new Map();

    appointments.forEach((appointment) => {
      const centerId = String(getAppointmentCenterId(appointment) || '');
      const district = getAppointmentDistrict(appointment);
      const centerName = getAppointmentCenterName(appointment);
      const nameKey = `${normalizeCenterKey(district)}__${normalizeCenterKey(centerName)}`;

      if (centerId) {
        if (!byCenterId.has(centerId)) byCenterId.set(centerId, []);
        byCenterId.get(centerId).push(appointment);
      }

      if (!byNameDistrict.has(nameKey)) byNameDistrict.set(nameKey, []);
      byNameDistrict.get(nameKey).push(appointment);
    });

    const visibleCenters = filters.district
      ? centers.filter((center) => center.district === filters.district)
      : centers;

    return visibleCenters
      .map((center) => {
        const centerId = getCenterRecordId(center);
        const nameKey = `${normalizeCenterKey(center.district)}__${normalizeCenterKey(center.name)}`;
        const matched = byCenterId.get(centerId) || byNameDistrict.get(nameKey) || [];
        return {
          key: centerId || nameKey,
          district: center.district || 'Not provided',
          centerName: center.name || 'Unnamed center',
          centerId,
          appointments: matched
        };
      })
      .filter((group) => group.appointments.length > 0)
      .sort((a, b) => (
        a.district.localeCompare(b.district) || a.centerName.localeCompare(b.centerName)
      ));
  }, [appointments, centers, filters.district]);

  const selectedGroup = useMemo(() => {
    if (!isCenterDetailPage) return null;

    const requestedCenter = searchParams.get('center') || filters.center || '';
    if (requestedCenter) {
      const byCenterId = groupedAppointments.find((group) => String(group.centerId || '') === String(requestedCenter));
      if (byCenterId) return byCenterId;
    }

    if (requestedCenterName) {
      const byName = groupedAppointments.find((group) => group.centerName === requestedCenterName);
      if (byName) return byName;
    }

    if (requestedTicketRef || requestedTicketId) {
      const byTicket = groupedAppointments.find((group) => group.appointments.some((appointment) => (
        String(appointment.ref || '').toUpperCase() === requestedTicketRef
        || String(appointment._id || '') === requestedTicketId
        || String(appointment.id || '') === requestedTicketId
      )));
      if (byTicket) return byTicket;
    }

    return groupedAppointments[0] || null;
  }, [
    filters.center,
    groupedAppointments,
    isCenterDetailPage,
    requestedCenterName,
    requestedTicketId,
    requestedTicketRef,
    searchParams
  ]);

  useEffect(() => {
    if (!isCenterDetailPage || !selectedGroup?.appointments?.length) return;
    if (!requestedTicketRef && !requestedTicketId) return;

    const lookupKey = requestedTicketRef || requestedTicketId;
    if (autoOpenedTicketRef.current === lookupKey) return;

    const matched = selectedGroup.appointments.find((appointment) => (
      String(appointment.ref || '').toUpperCase() === requestedTicketRef
      || String(appointment._id || '') === requestedTicketId
      || String(appointment.id || '') === requestedTicketId
    ));

    if (matched) {
      autoOpenedTicketRef.current = lookupKey;
      if (matched.requestType && requestTabs.some((tab) => tab.key === matched.requestType)) {
        setActiveTab(matched.requestType);
      }
      setSelectedAppointment(matched);
    }
  }, [isCenterDetailPage, requestedTicketId, requestedTicketRef, selectedGroup]);

  useEffect(() => {
    const requestedType = searchParams.get('requestType');
    if (requestTabs.some((tab) => tab.key === requestedType)) {
      setActiveTab(requestedType);
    }

    const requestedDate = searchParams.get('date');
    const requestedDistrict = searchParams.get('district');
    const requestedCenter = searchParams.get('center');

    setFilters((current) => ({
      ...current,
      ...(requestedDate === 'today' ? { date: new Date().toISOString().slice(0, 10) } : {}),
      ...(requestedDate && requestedDate !== 'today' ? { date: requestedDate } : {}),
      ...(requestedDistrict !== null ? { district: requestedDistrict } : {}),
      ...(requestedCenter !== null ? { center: requestedCenter } : {})
    }));
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
    if (status === 'Completed' && !canCompleteAppointment({
      ...appointment,
      displayStatus: getDisplayStatus(appointment)
    })) {
      toast.info('This appointment is already completed or closed.');
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
      const res = await api.put(`/api/bookings/admin/${appointment._id}/status`, { status, ...extra });
      if (res.data.success) {
        toast.success(status === 'Cancelled'
          ? (res.data.message || 'The appointment was cancelled successfully, and the citizen has been notified.')
          : `Ticket ${appointment.ref} updated.`);
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

  const selectedReasonLabels = () =>
    selectedCancelReasons.filter((reason) => INCORRECT_FIELD_OPTIONS.includes(reason));

  const confirmCancelAppointment = async () => {
    if (!cancelTarget) return;
    const isUpdateReq = cancelTarget.requestType === 'update_information';
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

    const validReasons = selectedReasonLabels();
    if (!validReasons.length) {
      toast.error('Please select at least one incorrect field.');
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

  const tableHeadings = activeTab === 'new_national_id'
    ? [
        'Ticket Number',
        'Citizen Name',
        'Phone',
        'Appointment Date',
        'Queue Number',
        'Status',
        'Actions'
      ]
    : activeTab === 'update_information'
      ? [
          'Ticket Number',
          'Citizen Name',
          'National ID Number',
          'Updated Fields',
          'Submission Date',
          'Status',
          'Actions'
        ]
      : [
          'Ticket Number',
          'Citizen Name',
          'National ID Number',
          'Police Report Number',
          'Uploaded Document',
          'Submission Date',
          'Status',
          'Actions'
        ];

  const renderAppointmentRow = (appointment) => {
    const citizen = appointment.citizen || {};
    const isBusy = updatingId === appointment._id;
    const isManagedRequest = appointment.requestType !== 'new_national_id';
    const displayStatus = getDisplayStatus(appointment);
    const submissionDate = formatDate(appointment.createdAt || appointment.submissionDate || appointment.date);
    const actionTicket = {
      ...appointment,
      status: displayStatus,
      requestStatus: appointment.requestStatus || displayStatus,
      displayStatus
    };
    const canComplete = canCompleteAppointment(actionTicket);
    const canCancel = canCancelAppointment(actionTicket);

    return (
      <tr key={appointment._id} className="nqs-admin-appointment-row bg-white hover:bg-[#f8fbff]">
        <td className="px-4 py-3 font-mono font-bold text-[#2563eb]">{appointment.ref}</td>
        <td className="px-4 py-3 font-semibold text-[#06194a]">
          {citizen.name || appointment.citizenName || '--'}
        </td>

        {activeTab === 'new_national_id' ? (
          <>
            <td className="px-4 py-3 text-[#243b63]">{citizen.phone || appointment.registrationDetails?.phone || '--'}</td>
            <td className="px-4 py-3 text-[#243b63]">
              {formatDate(appointment.date)}
              {appointment.timeSlot ? <span className="block text-xs text-[#62708a]">{appointment.timeSlot}</span> : null}
            </td>
            <td className="px-4 py-3 font-mono font-semibold text-[#06194a]">{getQueueNumber(appointment.ref)}</td>
          </>
        ) : activeTab === 'update_information' ? (
          <>
            <td className="px-4 py-3 text-[#243b63]">{appointment.updateDetails?.nationalIdNumber || '--'}</td>
            <td className="px-4 py-3 text-[#243b63]">{getUpdatedFields(appointment)}</td>
            <td className="px-4 py-3 text-[#243b63]">{submissionDate}</td>
          </>
        ) : (
          <>
            <td className="px-4 py-3 text-[#243b63]">{appointment.replacementDetails?.nationalIdNumber || '--'}</td>
            <td className="px-4 py-3 text-[#243b63]">{appointment.replacementDetails?.policeReportNumber || '--'}</td>
            <td className="px-4 py-3 text-[#243b63]">{appointment.replacementDetails?.policeReportDocument || '--'}</td>
            <td className="px-4 py-3 text-[#243b63]">{submissionDate}</td>
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
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="nqs-admin-appointments min-h-screen bg-[var(--nqs-bg,#fff)] p-0 text-[var(--nqs-text,#06194a)]">
      <div className="mx-auto max-w-none">
        <div className="nqs-admin-appointments-hero border-b border-[var(--nqs-border,#cbd8ea)] bg-[var(--nqs-card,#fff)] px-8 py-9">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-xs">
              <h1 className="text-2xl font-black tracking-tight text-[var(--nqs-text,#06194a)] sm:text-3xl">Admin Appointments</h1>
              <p className="mt-4 text-base leading-7 text-[var(--nqs-muted,#243b63)]">
                Review and manage National ID bookings from the database.
              </p>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="relative block">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#06194a]" />
                <input
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Search ticket #"
                  className="nqs-admin-filter-control w-full rounded-md border border-[#bfd0e6] bg-white py-3 pl-11 pr-3 text-sm font-medium text-[#06194a] outline-none placeholder:text-[#62708a] focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <select
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
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
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              >
                {requestStatusOptions.map((status) => (
                  <option key={status || 'all-request-statuses'} value={status}>
                    {status || 'All request statuses'}
                  </option>
                ))}
              </select>

              <select
                value={filters.district}
                onChange={(event) => updateFilter('district', event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">All districts</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>

              <select
                value={filters.center}
                onChange={(event) => updateFilter('center', event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">All centers</option>
                {centerOptions.map((center) => {
                  const centerId = getCenterRecordId(center);
                  return (
                    <option key={centerId} value={centerId}>
                      {center.name}
                    </option>
                  );
                })}
              </select>

              <input
                type="date"
                value={filters.date}
                onChange={(event) => updateFilter('date', event.target.value)}
                className="nqs-admin-filter-control rounded-md border border-[#bfd0e6] bg-white px-4 py-3 text-sm font-medium text-[#06194a] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>
        </div>

        <div className="nqs-admin-appointments-body bg-white px-8 py-7">
          <div className="nqs-admin-request-tabs mb-6 flex flex-wrap gap-3">
            {requestTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (isCenterDetailPage) {
                      navigate(`/admin-appointments?requestType=${tab.key}`);
                    }
                  }}
                  className={`nqs-admin-request-tab inline-flex items-center gap-3 rounded-md border px-5 py-3 text-sm font-black transition-all ${isActive ? 'is-active border-[#2563eb] bg-[#2563eb] text-white shadow-sm' : 'border-[#bfd0e6] bg-white text-[#06194a] hover:border-[#2563eb] hover:text-[#2563eb]'}`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="rounded-md border border-[#d7e1ee] bg-white px-4 py-10 text-center text-[#62708a]">
              Loading appointments...
            </div>
          )}

          {!loading && appointments.length === 0 && (
            <div className="rounded-md border border-[#d7e1ee] bg-white px-4 py-10 text-center text-[#62708a]">
              No appointments match the selected filters.
            </div>
          )}

          {!loading && appointments.length > 0 && groupedAppointments.length === 0 && !isCenterDetailPage && (
            <div className="rounded-md border border-[#d7e1ee] bg-white px-4 py-10 text-center text-[#62708a]">
              No appointments found for your created centers. Create centers in Manage Centers, or check that bookings use those centers.
            </div>
          )}

          {!loading && groupedAppointments.length > 0 && !isCenterDetailPage && (
            <div className="space-y-4">
              <div>
                <p className="nqs-admin-muted mb-6 text-sm font-semibold text-[#243b63]">
                  Select a district center to open its appointment page.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupedAppointments.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => openCenterAppointmentsPage(group)}
                        className="nqs-admin-center-card rounded-md border border-[#d7e1ee] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#2563eb] hover:shadow-md"
                      >
                        <div className="grid grid-cols-[54px_1fr_auto] items-center gap-5">
                          <span className="flex h-14 w-14 items-center justify-center rounded-md border border-[#e5ebf4] bg-[#f5f8ff] text-[#2563eb]">
                            <FiBriefcase className="h-7 w-7" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="nqs-admin-center-district text-xs font-black uppercase tracking-[0.06em] text-[#2563eb]">
                                {group.district} District
                              </p>
                              <span className="nqs-admin-center-count rounded-md border border-[#d7e1ee] bg-white px-2 py-0.5 text-xs font-black text-[#06194a]">
                                {group.appointments.length}
                              </span>
                            </div>
                            <h2 className="nqs-admin-center-name mt-3 truncate text-xl font-black text-[#06194a]">{group.centerName}</h2>
                            <p className="nqs-admin-center-helper mt-2 text-sm font-medium leading-6 text-[#243b63]">
                              Click to view this center&apos;s records only
                            </p>
                          </div>
                          <span className="text-[#06194a]">
                            <FiChevronRight className="h-6 w-6" />
                          </span>
                        </div>
                      </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && isCenterDetailPage && !selectedGroup && (
            <div className="rounded-md border border-dashed border-[#bfd0e6] bg-white px-4 py-10 text-center text-[#62708a]">
              No appointments found for this center.
            </div>
          )}

          {!loading && isCenterDetailPage && selectedGroup && (
            <section
              className="overflow-hidden rounded-md border border-[#d7e1ee] bg-white shadow-sm"
            >
              <div className="nqs-admin-center-detail-bar flex flex-col gap-3 border-b border-[var(--nqs-border,#d7e1ee)] bg-[var(--nqs-card-soft,#f8fbff)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={backToCenterCards}
                    className="mb-3 inline-flex items-center gap-2 rounded-md border border-[var(--nqs-border,#bfd0e6)] bg-[var(--nqs-card,#fff)] px-3 py-1.5 text-xs font-black text-[#2563eb] hover:border-[#2563eb]"
                  >
                    <FiArrowLeft /> Back to centers
                  </button>
                  <p className="nqs-admin-center-district text-xs font-black uppercase tracking-[0.08em] text-[#2563eb]">
                    {selectedGroup.district} District
                  </p>
                  <h2 className="mt-1 text-lg font-black text-[var(--nqs-text,#06194a)]">{selectedGroup.centerName}</h2>
                </div>
                <span className="nqs-admin-center-count w-fit rounded-md border border-[var(--nqs-border,#bfd0e6)] bg-[var(--nqs-card,#fff)] px-3 py-1 text-xs font-black text-[var(--nqs-text,#06194a)]">
                  {selectedGroup.appointments.length} appointment{selectedGroup.appointments.length === 1 ? '' : 's'}
                </span>
              </div>

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
                    {selectedGroup.appointments.map(renderAppointmentRow)}
                  </tbody>
                </table>
              </div>
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
        const changedFields = isUpdateReq ? getChangedUpdateFields(cancelTarget) : [];
        const hasNoChanges = isUpdateReq && changedFields.length === 0;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
          <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white ${isUpdateReq ? 'max-w-lg' : 'max-w-2xl'}`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Admin Action</p>
                <h2 className="mt-1 text-2xl font-black">
                  {isUpdateReq ? 'Cancel Update Request' : 'Cancel Appointment'}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {isUpdateReq
                    ? 'Review the changed information and provide a cancellation reason for this update request.'
                    : 'Select the incorrect fields. The citizen will receive this feedback and can resubmit from their dashboard.'}
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ticket Reference</p>
                  <p className="mt-1 font-mono text-sm font-black text-blue-700 dark:text-[#7CB8FF]">{cancelTarget.ref}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Citizen</p>
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
                  <span className="text-sm font-bold">Select incorrect fields</span>
                  <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40 sm:grid-cols-2">
                    {INCORRECT_FIELD_OPTIONS.map((reason) => {
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
                    : `You selected the following incorrect fields: ${selectedReasonLabels().join(', ')}. Are you sure you want to cancel this appointment?`}
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
                {updatingId === cancelTarget._id ? 'Cancelling...' : (isUpdateReq ? 'Confirm Cancel Update' : 'Confirm Cancellation')}
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
              {getCancellationReasonList(selectedAppointment).length > 0 && (
                <div className="sm:col-span-2">
                  <span className="block text-xs font-bold uppercase text-slate-400">Cancellation Reasons</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getCancellationReasonList(selectedAppointment).map((reason) => (
                      <span key={reason} className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">
                        {reason}
                      </span>
                    ))}
                  </div>
                  {selectedAppointment.cancellationNotes && (
                    <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-200">
                      <span className="block text-xs font-bold uppercase text-slate-400">Additional Admin Note</span>
                      {selectedAppointment.cancellationNotes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {selectedAppointment && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-white">Existing Registration Lookup</h3>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {[
                    ['Existing registration found', selectedAppointment.existingRegistration?.found ? 'Yes' : 'No'],
                    ['Previous Ticket Number', selectedAppointment.existingRegistration?.originalTicketReference || selectedAppointment.existingRegistration?.ticketNumber || '--'],
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
