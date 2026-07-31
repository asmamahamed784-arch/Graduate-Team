import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import api from '../api/axiosInstance';
import { useAuth } from '../hooks';
import {
  canCancelAppointment,
  canCompleteAppointment,
} from '../utils/appointmentActions';
import { INCORRECT_FIELD_OPTIONS } from '../utils/cancellationFields';
import { getChangedUpdateFields } from '../utils/updateRequestFields';
import {
  FaBuilding,
  FaCheck,
  FaCheckDouble,
  FaPhoneAlt,
  FaQrcode,
  FaChartBar,
  FaTicketAlt,
  FaTimesCircle,
  FaUserClock,
  FaUsers,
  FaEye,
  FaRedo,
} from 'react-icons/fa';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const SERVICE_SECTIONS = [
  {
    key: 'new_national_id',
    title: 'New National ID Registration',
    helper: 'Show only new National ID appointments',
  },
  {
    key: 'update_information',
    title: 'Update National ID Information',
    helper: 'Show only information update requests',
  },
  {
    key: 'lost_replacement',
    title: 'Lost National ID Replacement',
    helper: 'Show only lost ID replacement requests',
  },
];

const BANAADIR_DISTRICTS = [
  'Abdulaziz',
  'Boondheere',
  'Dayniile',
  'Dharkenley',
  'Garasbaaley',
  'Heliwaa',
  'Hodan',
  'Howlwadaag',
  'Kaaraan',
  'Kaxda',
  'Shangaani',
  'Shibis',
  'Waaberi',
  'Wadajir',
  'Wardhiigley',
  'Xamar Jajab',
  'Xamar Weyne',
  'Yaqshiid',
];

const getRequestTypeLabel = (requestType) => {
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'update_information') return 'Update Information Request';
  return 'New Registration';
};

const FILTER_LABELS = {
  all: 'All appointments',
  staff: 'Center staff',
  pending: 'Pending appointments',
  waiting: 'Waiting appointments',
  nowServing: 'Now Serving',
  completed: 'Completed services',
  cancelled: 'Cancelled appointments',
  noShow: 'No Show appointments',
  requests: 'Request breakdown',
  new_national_id: 'New National ID Registration',
  update_information: 'Update National ID Information',
  lost_replacement: 'Lost National ID Replacement',
};

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const statusLabel = (status) => (status === 'Being Served' ? 'Now Serving' : status || 'Waiting');

const statusKey = (value = '') => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const matchesAnyStatus = (ticket = {}, statuses = []) => {
  const wanted = statuses.map(statusKey);
  return wanted.includes(statusKey(ticket.status)) || wanted.includes(statusKey(ticket.requestStatus));
};

const statusBadge = (status) => {
  const base = 'px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block';
  if (status === 'Being Served') return `${base} bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400`;
  if (status === 'Waiting') return `${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400`;
  if (status === 'On Hold') return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400`;
  if (status === 'Completed') return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400`;
  if (status === 'Cancelled') return `${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400`;
  return `${base} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`;
};

const staffRoleLabel = (member = {}) => {
  const type = String(member.operatorType || member.role || '').toLowerCase();
  if (type === 'super_operator' || type === 'center_manager') return 'Center Manager';
  return 'Operator';
};

const nameFrom = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.name || value.title || fallback;
};

const idFrom = (value) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id || value.id;
};

const normalizeRequestType = (ticket) => {
  if (ticket.requestType) return ticket.requestType;
  const serviceName = nameFrom(ticket.service, ticket.serviceName || '').toLowerCase();
  if (serviceName.includes('update')) return 'update_information';
  if (serviceName.includes('lost') || serviceName.includes('replace')) return 'lost_replacement';
  return 'new_national_id';
};

const cleanCitizenName = (value) => {
  const name = String(value || '').trim();
  if (!name || /^citizen\s*\d+$/i.test(name)) return 'No Data';
  return name;
};

const getCitizenName = (ticket) => cleanCitizenName(
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizen?.name ||
  ticket.citizenName
);

const getCitizenPhone = (ticket) => (
  ticket.registrationDetails?.phone ||
  ticket.replacementDetails?.phone ||
  ticket.updateDetails?.phone ||
  ticket.citizen?.phone ||
  'No Data'
);

const getQueueNumber = (ticket) => {
  if (!ticket) return 0;
  if (ticket.queueNumber) return Number.parseInt(String(ticket.queueNumber).replace(/\D/g, ''), 10) || 0;
  const suffix = ticket.ref?.split('-').pop();
  return Number.parseInt(suffix, 10) || 0;
};

const timeToMinutes = (value) => {
  if (!value) return 24 * 60;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 24 * 60;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const sortTickets = (tickets) => [...tickets].sort((a, b) => {
  const dateA = a.date || '9999-12-31';
  const dateB = b.date || '9999-12-31';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const timeDiff = timeToMinutes(a.timeSlot) - timeToMinutes(b.timeSlot);
  if (timeDiff !== 0) return timeDiff;

  return getQueueNumber(a) - getQueueNumber(b);
});

const isServiceFilter = (filter) => SERVICE_SECTIONS.some((section) => section.key === filter);

const formatDate = (value) => {
  if (!value) return 'Review request';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fieldKey = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const valueOrDash = (value) => {
  if (value === 0) return 0;
  return value ? value : '--';
};

const formatMaritalStatus = (value) => {
  if (value === 'SINGLE') return 'Single';
  if (value === 'MARRIED') return 'Married';
  if (value === 'DIVORCED') return 'Divorced';
  if (value === 'WIDOWED') return 'Widowed';
  return value || '--';
};

const getOriginalRegistrationDetails = (ticket = {}) => (
  ticket.existingRegistration?.registrationDetails || {}
);

const getOriginalValueByField = (ticket = {}, field = '', fallback = '') => {
  const details = getOriginalRegistrationDetails(ticket);
  const existing = ticket.existingRegistration || {};
  const values = {
    name: details.fullName || existing.citizenName,
    fullname: details.fullName || existing.citizenName,
    mothersname: details.motherName,
    mothername: details.motherName,
    dateofbirth: formatDate(details.dateOfBirth),
    birthdate: formatDate(details.dateOfBirth),
    phone: details.phone || existing.citizenPhone,
    phonenumber: details.phone || existing.citizenPhone,
    address: details.fullAddress || details.address,
    fulladdress: details.fullAddress || details.address,
    maritalstatus: formatMaritalStatus(details.maritalStatus),
    district: details.district || existing.originalDistrict,
    gender: details.gender,
    nearestlandmark: details.nearestLandmark,
    nationalidnumber: existing.nationalIdNumber || details.nationalIdNumber
  };

  return valueOrDash(values[fieldKey(field)] || fallback);
};

const getUpdateChangeList = (ticket = {}) => {
  const details = ticket.updateDetails || {};
  return details.changes?.length
    ? details.changes
    : details.fieldToUpdate
      ? [{
          field: details.fieldToUpdate,
          currentValue: details.currentValue,
          newValue: details.newValue,
          reason: details.reason
        }]
      : [];
};

const normalizeCompareValue = (field = '', value = '') => {
  const text = String(value ?? '').trim();
  if (!text || text === '--') return '';
  const key = fieldKey(field);
  if (key.includes('marital')) return text.toUpperCase();
  if (key.includes('date')) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return text.toLowerCase().replace(/\s+/g, ' ');
};

const getUpdateComparisonRows = (ticket = {}) => getUpdateChangeList(ticket).map((change, index) => {
  const originalValue = getOriginalValueByField(ticket, change.field, change.currentValue);
  const newValue = valueOrDash(change.newValue);
  const changed = normalizeCompareValue(change.field, originalValue) !== normalizeCompareValue(change.field, newValue);
  return {
    ...change,
    index,
    originalValue,
    newValue,
    changed
  };
});

const hasValidUpdateChanges = (ticket = {}) => (
  getUpdateComparisonRows(ticket).some((row) => row.changed)
);

const getDisplayStatus = (ticket = {}) => {
  const requestStatus = ticket.requestStatus || 'Pending';
  if (requestStatus === 'Resubmission Required') return 'Correction Required';
  if (requestStatus === 'Approved') return ticket.status || 'Waiting';
  if (ticket.status === 'Being Served') return 'Serving';
  return ticket.status || requestStatus || 'Pending';
};

const normalizeTicket = (ticket) => ({
  ...ticket,
  id: ticket._id || ticket.id,
  serviceId: idFrom(ticket.service) || ticket.serviceId,
  centerId: idFrom(ticket.center) || ticket.centerId,
  serviceName: nameFrom(ticket.service, ticket.serviceName || 'National ID Service'),
  centerName: nameFrom(ticket.center, ticket.centerName || 'Assigned Center'),
  requestType: normalizeRequestType(ticket),
  citizenDisplayName: getCitizenName(ticket),
  citizenPhone: getCitizenPhone(ticket),
});

const StatCardSkeleton = () => (
  <div className="animate-pulse rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
    <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700" />
    <div className="mt-3 h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="mt-2 h-5 w-14 rounded bg-slate-200 dark:bg-slate-700" />
  </div>
);

const OperatorDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const autoOpenedTicketRef = useRef('');
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('new_national_id');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [centerSummary, setCenterSummary] = useState(null);
  const [cancelModalTicket, setCancelModalTicket] = useState(null);
  const [selectedCancelReasons, setSelectedCancelReasons] = useState([]);
  const [cancelNotes, setCancelNotes] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  const activeCenter = typeof user?.center === 'object' ? user.center?.name : (user?.center || 'Assigned Center');
  const activeCenterId =
    idFrom(user?.center) ||
    idFrom(user?.assignedCenter) ||
    user?.centerId ||
    user?.assignedCenterId ||
    '';
  const isCenterManager = user?.role === 'super_operator' || user?.role === 'center_manager';
  const canManageAppointments = ['operator', 'super_operator', 'center_manager'].includes(user?.role);

  const fetchDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get('/api/operator/dashboard');
      const payload = response.data?.data || {};
      const nextTickets = (payload.tickets || payload.allCenterTickets || []).map(normalizeTicket);
      setTickets(sortTickets(nextTickets));
      setStaff(payload.staff || []);
      setCenterSummary(payload.centerStats || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load operator dashboard.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(true);
    const intervalId = window.setInterval(() => fetchDashboard(false), 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!activeCenterId) return undefined;

    const socket = io(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || undefined);
    socket.emit('joinCenter', String(activeCenterId));

    const refreshCenterDashboard = (payload = {}) => {
      if (!payload.centerId || String(payload.centerId) === String(activeCenterId)) {
        fetchDashboard(false);
      }
    };

    socket.on('queueUpdate', refreshCenterDashboard);
    return () => {
      socket.off('queueUpdate', refreshCenterDashboard);
      socket.disconnect();
    };
  }, [activeCenterId, fetchDashboard]);

  useEffect(() => {
    const ticketQuery = String(searchParams.get('ticket') || '').trim().toUpperCase();
    const requestTypeQuery = String(searchParams.get('requestType') || '').trim().toLowerCase();

    if (requestTypeQuery && FILTER_LABELS[requestTypeQuery]) {
      setActiveFilter(requestTypeQuery);
    }

    if (!ticketQuery || !tickets.length || autoOpenedTicketRef.current === ticketQuery) return;

    const matchedTicket = tickets.find((ticket) => (
      String(ticket.ref || '').toUpperCase() === ticketQuery ||
      String(ticket.id || '').toUpperCase() === ticketQuery
    ));

    if (matchedTicket) {
      autoOpenedTicketRef.current = ticketQuery;
      setActiveFilter(matchedTicket.requestType || requestTypeQuery || 'all');
      setSelectedTicket(matchedTicket);
    }
  }, [searchParams, tickets]);

  const stats = useMemo(() => {
    const sorted = sortTickets(tickets);
    const pendingTickets = sorted.filter((ticket) => matchesAnyStatus(ticket, ['Pending']));
    const waitingTickets = sorted.filter((ticket) => matchesAnyStatus(ticket, ['Waiting']));
    const nowServingTickets = sorted.filter((ticket) => matchesAnyStatus(ticket, ['Being Served', 'In Progress']));
    const completedServices = sorted.filter((ticket) => matchesAnyStatus(ticket, ['Completed']));
    const cancelledTickets = sorted.filter((ticket) => matchesAnyStatus(ticket, ['Cancelled', 'Canceled', 'Rejected']));
    const noShowTickets = sorted.filter((ticket) => matchesAnyStatus(ticket, ['No Show', 'No-Show', 'NoShow']));
    const requestBreakdown = SERVICE_SECTIONS.reduce((acc, section) => {
      acc[section.key] = sorted.filter((ticket) => ticket.requestType === section.key).length;
      return acc;
    }, {});
    const summary = centerSummary || {};

    return {
      pendingTickets,
      pendingCount: summary.pending ?? pendingTickets.length,
      waitingTickets,
      ticketsWaitingCount: summary.waiting ?? waitingTickets.length,
      nowServingTickets,
      nowServingCount: summary.nowServing ?? nowServingTickets.length,
      completedServices,
      completedServicesCount: summary.completed ?? completedServices.length,
      cancelledTickets,
      cancelledCount: summary.cancelled ?? cancelledTickets.length,
      noShowTickets,
      noShowCount: summary.noShow ?? noShowTickets.length,
      requestBreakdown,
      totalRequestsCount: summary.totalAppointments ?? sorted.length,
    };
  }, [centerSummary, tickets]);

  const visibleTickets = useMemo(() => {
    const sorted = sortTickets(tickets);

    if (activeFilter === 'pending') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Pending']));
    }

    if (activeFilter === 'waiting') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Waiting']));
    }

    if (activeFilter === 'nowServing') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Being Served', 'In Progress']));
    }

    if (activeFilter === 'completed') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Completed']));
    }

    if (activeFilter === 'cancelled') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Cancelled', 'Canceled', 'Rejected']));
    }

    if (activeFilter === 'noShow') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['No Show', 'No-Show', 'NoShow']));
    }

    if (activeFilter === 'staff') {
      return [];
    }

    if (isServiceFilter(activeFilter)) {
      return sorted.filter((ticket) => ticket.requestType === activeFilter);
    }

    return sorted;
  }, [activeFilter, tickets]);

  const visibleCount = activeFilter === 'staff' ? staff.length : visibleTickets.length;

  const groupedTickets = useMemo(() => {
    const grouped = SERVICE_SECTIONS.reduce((acc, section) => {
      acc[section.key] = [];
      return acc;
    }, {});

    visibleTickets.forEach((ticket) => {
      const key = grouped[ticket.requestType] ? ticket.requestType : 'new_national_id';
      grouped[key].push(ticket);
    });

    return grouped;
  }, [visibleTickets]);

  const visibleSections = useMemo(() => {
    if (isServiceFilter(activeFilter)) {
      return SERVICE_SECTIONS.filter((section) => section.key === activeFilter);
    }
    return SERVICE_SECTIONS.filter((section) => (groupedTickets[section.key] || []).length > 0);
  }, [activeFilter, groupedTickets]);

  const callTicket = async (ticket) => {
    if (!ticket?.ref) return;
      setActionLoading(`call-${ticket.ref}`);
    try {
      await api.put(`/api/queue/${ticket.id}/call`);
      toast.success(`Now serving ${ticket.ref}.`);
      await fetchDashboard(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to call this ticket.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCallNext = async () => {
    const nextTicket = stats.waitingTickets[0];
    if (!nextTicket) {
      toast.info('No waiting appointments available.');
      return;
    }
    await callTicket(nextTicket);
  };

  const handleComplete = async (ticket) => {
    if (!ticket?.id) return;
    if (!canCompleteAppointment(ticket)) {
      toast.info('This appointment is already completed or closed.');
      return;
    }
    setActionLoading(`complete-${ticket.ref}`);
    try {
      const otpRequest = await api.post('/api/otp/request', {
        purpose: 'complete_service',
        ticketId: ticket.id
      });
      const code = window.prompt(`Enter OTP sent to citizen for ${ticket.ref}`);
      if (!code) {
        toast.info('Complete service cancelled.');
        return;
      }
      const otpRes = await api.post('/api/otp/verify', {
        purpose: 'complete_service',
        ticketId: ticket.id,
        otpId: otpRequest.data?.data?.otpId,
        code
      });
      await api.put(`/api/bookings/admin/${ticket.id}/status`, {
        status: 'Completed',
        otpToken: otpRes.data.data?.verificationToken
      });
      toast.success(`Ticket ${ticket.ref} completed.`);

      await fetchDashboard(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to complete this appointment.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (ticket, cancelData = {}) => {
    if (!ticket?.ref) return;
    setActionLoading(`cancel-${ticket.ref}`);
    try {
      await api.put(`/api/bookings/${ticket.id}/cancel`, {
        cancellationReason: cancelData.cancellationReason || 'Cancelled by center staff',
        cancellationReasons: cancelData.cancellationReasons || [],
        additionalNotes: cancelData.additionalNotes || '',
      });
      toast.success(`Ticket ${ticket.ref} cancelled. Citizen has been notified.`);
      setCancelModalTicket(null);
      setSelectedCancelReasons([]);
      setCancelNotes('');
      setCustomCancelReason('');
      setShowCancelConfirmation(false);
      await fetchDashboard(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to cancel this appointment.');
    } finally {
      setActionLoading('');
    }
  };

  const openCancelModal = (ticket) => {
    if (!canCancelAppointment(ticket)) {
      toast.info('This appointment is already closed and cannot be cancelled.');
      return;
    }
    setCancelModalTicket(ticket);
    setSelectedCancelReasons([]);
    setCancelNotes('');
    setCustomCancelReason('');
    setShowCancelConfirmation(false);
  };

  const closeCancelModal = () => {
    setCancelModalTicket(null);
    setSelectedCancelReasons([]);
    setCancelNotes('');
    setCustomCancelReason('');
    setShowCancelConfirmation(false);
  };

  const toggleCancelReason = (reason) => {
    setShowCancelConfirmation(false);
    setSelectedCancelReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason]
    );
  };

  const selectedReasonLabels = () =>
    selectedCancelReasons.filter((reason) => INCORRECT_FIELD_OPTIONS.includes(reason));

  const submitCancel = () => {
    if (!cancelModalTicket) return;
    const isUpdateReq = cancelModalTicket.requestType === 'update_information';

    if (isUpdateReq) {
      const changedFields = getChangedUpdateFields(cancelModalTicket);
      if (!changedFields.length) {
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
      handleCancel(cancelModalTicket, {
        cancellationReasons: [reason],
        cancellationReason: reason,
        additionalNotes: '',
      });
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
    handleCancel(cancelModalTicket, {
      cancellationReasons: validReasons,
      cancellationReason: validReasons.join(', '),
      additionalNotes: cancelNotes.trim(),
    });
  };

  const handleReturn = async (ticket) => {
    if (!ticket?.id) return;
    setActionLoading(`return-${ticket.ref}`);
    try {
      await api.put(`/api/bookings/admin/${ticket.id}/status`, { status: 'Waiting' });
      toast.success(`Ticket ${ticket.ref} returned to waiting.`);
      setSelectedTicket(null);
      await fetchDashboard(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to return this request.');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (ticket) => {
    if (!ticket?.id) return;
    setActionLoading(`reject-${ticket.ref}`);
    try {
      await api.put(`/api/bookings/admin/${ticket.id}/status`, { status: 'Rejected' });
      toast.success(`Ticket ${ticket.ref} rejected.`);
      setSelectedTicket(null);
      await fetchDashboard(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reject this request.');
    } finally {
      setActionLoading('');
    }
  };

  const statsData = [
    ...(isCenterManager ? [{
      label: 'Staff / Operators',
      value: staff.length.toString(),
      helper: 'Staff assigned to this center',
      icon: FaUsers,
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500',
      filter: 'staff',
    }] : []),
    {
      label: 'Total Appointments',
      value: stats.totalRequestsCount.toString(),
      helper: 'All center appointments',
      icon: FaChartBar,
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-500',
      filter: 'all',
    },
    {
      label: 'Pending',
      value: stats.pendingCount.toString(),
      helper: 'Requests awaiting action',
      icon: FaUserClock,
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-300',
      border: 'border-amber-500',
      filter: 'pending',
    },
    {
      label: 'Waiting',
      value: stats.ticketsWaitingCount.toString(),
      helper: 'Waiting appointments',
      icon: FaTicketAlt,
      bg: 'bg-yellow-100 dark:bg-yellow-900/40',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-500',
      filter: 'waiting',
    },
    {
      label: 'Now Serving',
      value: stats.nowServingCount.toString(),
      helper: 'Currently being served',
      icon: FaPhoneAlt,
      bg: 'bg-cyan-100 dark:bg-cyan-900/40',
      iconColor: 'text-cyan-600 dark:text-cyan-300',
      border: 'border-cyan-500',
      filter: 'nowServing',
    },
    {
      label: 'Completed',
      value: stats.completedServicesCount.toString(),
      helper: 'Completed appointments',
      icon: FaCheckDouble,
      bg: 'bg-green-100 dark:bg-green-900/40',
      iconColor: 'text-green-600 dark:text-green-400',
      border: 'border-green-500',
      filter: 'completed',
    },
    {
      label: 'Cancelled',
      value: stats.cancelledCount.toString(),
      helper: 'Cancelled or rejected',
      icon: FaTimesCircle,
      bg: 'bg-red-100 dark:bg-red-900/40',
      iconColor: 'text-red-600 dark:text-red-300',
      border: 'border-red-500',
      filter: 'cancelled',
    },
    {
      label: 'No Show',
      value: stats.noShowCount.toString(),
      helper: 'Missed appointments',
      icon: FaTimesCircle,
      bg: 'bg-slate-100 dark:bg-slate-700',
      iconColor: 'text-slate-600 dark:text-slate-300',
      border: 'border-slate-500',
      filter: 'noShow',
    },
  ];

  if ((authLoading || loading) && tickets.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-2 dark:bg-slate-950 sm:p-3">
        <div className="mx-auto max-w-none space-y-3">
          <div className="animate-pulse rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800">
            <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-64 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="nqs-operator-dashboard min-h-screen bg-slate-50 p-2 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-none space-y-3">
        <motion.div variants={item} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-950 dark:text-white sm:text-xl">
              {isCenterManager ? 'Center Dashboard' : 'Operator Dashboard'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
              <FaBuilding className="text-blue-500" />
              <span>{activeCenter}</span>
              <span className="mx-1">|</span>
              <span>{today}</span>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {isCenterManager && (
              <>
                <Link
                  to="/dashboard/operator/staff"
                  className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 dark:border-blue-500/40 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700 sm:text-sm"
                >
                  <FaUserClock className="text-sm" />
                  Manage Staff
                </Link>
                <Link
                  to="/dashboard/operator/center-schedule"
                  className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 dark:border-blue-500/40 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700 sm:text-sm"
                >
                  <FaBuilding className="text-sm" />
                  Center Schedule
                </Link>
              </>
            )}
            <Link
              to="/dashboard/operator/qr-scan"
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-800 sm:text-sm"
            >
              <FaQrcode className="text-sm" />
              Scan QR Ticket
            </Link>
            <button
              type="button"
              onClick={handleCallNext}
              disabled={Boolean(actionLoading) || stats.ticketsWaitingCount === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:text-sm"
            >
              <FaPhoneAlt className="text-sm" />
              Call Next Ticket
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat) => {
            const isActive = activeFilter === stat.filter;
            return (
              <motion.button
                key={stat.label}
                variants={item}
                type="button"
                onClick={() => setActiveFilter((current) => (current === stat.filter ? 'new_national_id' : stat.filter))}
                className={`flex min-h-[70px] items-center gap-2 rounded-lg border bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 ${isActive ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700'} border-l-4 ${stat.border}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${stat.bg}`}>
                  <stat.icon className={`text-sm ${stat.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-950 dark:text-white">{stat.value}</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{stat.label}</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{stat.helper}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.section variants={item} className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {SERVICE_SECTIONS.map((section) => {
            const isActive = activeFilter === section.key;
            const count = stats.requestBreakdown[section.key] || 0;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveFilter(section.key)}
                className={`rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/50'
                    : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-black uppercase tracking-wide ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {section.title}
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{count}</p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Requests in this center</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                    Open
                  </span>
                </div>
                <p className="mt-3 text-[11px] font-bold text-blue-700 dark:text-blue-300">{section.helper}</p>
              </button>
            );
          })}
        </motion.section>

        <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Showing: {FILTER_LABELS[activeFilter]} ({visibleCount})
          </span>
          {!isServiceFilter(activeFilter) && (
            <button
              type="button"
              onClick={() => setActiveFilter('new_national_id')}
              className="rounded-md border border-blue-200 px-3 py-1 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              Back to New Registration
            </button>
          )}
        </motion.div>

        {activeFilter === 'staff' ? (
          <motion.section variants={item} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <FaUsers className="text-blue-500" />
                Center Staff / Operators
              </h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                {staff.length} staff
              </span>
            </div>
            {staff.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No staff operators created for this center yet.</p>
            ) : (
              <div className="overflow-x-auto p-2">
                <table className="min-w-full text-left text-sm">
                  <thead className="rounded-md bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Username</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {staff.map((member) => (
                      <tr key={member._id || member.id} className="hover:bg-blue-50 dark:hover:bg-slate-700/60">
                        <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">{member.name || 'No name'}</td>
                        <td className="px-3 py-3 font-mono text-blue-700 dark:text-blue-300">{member.username || '--'}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{member.phone || '--'}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{staffRoleLabel(member)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                            {member.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>
        ) : (
          <>
            {activeFilter === 'requests' ? (
              <motion.div variants={item} className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-center shadow-sm dark:border-blue-500/40 dark:bg-blue-950/30">
                <FaChartBar className="mx-auto text-2xl text-blue-600 dark:text-blue-300" />
                <p className="mt-2 text-base font-bold text-slate-950 dark:text-white">Choose a service type above</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  New Registration, Update Information, and Lost ID Replacement are now separated. Click one card to open only that service's records.
                </p>
              </motion.div>
            ) : visibleTickets.length === 0 ? (
          <motion.div variants={item} className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <FaTicketAlt className="mx-auto text-3xl text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">
              {tickets.length === 0 ? 'No appointments available.' : `No records found for ${FILTER_LABELS[activeFilter].toLowerCase()}.`}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Appointments booked for your assigned center will appear here automatically.</p>
          </motion.div>
            ) : (
          <div className="space-y-3">
            {visibleSections.map((section) => {
              const sectionTickets = groupedTickets[section.key] || [];
              return (
                <motion.section
                  key={section.key}
                  variants={item}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                      <FaTicketAlt className="text-yellow-500" />
                      {section.title}
                    </h2>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      {sectionTickets.length} appointment{sectionTickets.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {sectionTickets.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">No appointments available.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase text-slate-700 dark:bg-[#0b2444] dark:text-slate-100">
                          <tr>
                            <th className="px-4 py-3">Ticket Number</th>
                            <th className="px-4 py-3">Citizen Name</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Appointment Date</th>
                            <th className="px-4 py-3">Queue Number</th>
                            <th className="px-4 py-3">Status</th>
                            {canManageAppointments && <th className="px-4 py-3">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {sectionTickets.map((ticket) => {
                            const canComplete = canCompleteAppointment(ticket);
                            const canCancel = canCancelAppointment(ticket);

                            return (
                              <tr key={ticket.id || ticket.ref} className="bg-white transition-colors hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700/60">
                                <td className="px-4 py-3 font-mono font-black text-[#4189DD]">{ticket.ref}</td>
                                <td className="px-4 py-3 font-bold text-slate-950 dark:text-white">{ticket.citizenDisplayName}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{ticket.citizenPhone}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                  {formatDate(ticket.date)}
                                  <span className="block text-xs text-slate-500 dark:text-slate-400">{ticket.timeSlot || '--'}</span>
                                </td>
                                <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-100">{getQueueNumber(ticket) || '--'}</td>
                                <td className="px-4 py-3">
                                  <span className={statusBadge(ticket.status)}>{getDisplayStatus(ticket)}</span>
                                </td>
                                {canManageAppointments && (
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedTicket(ticket)}
                                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                        >
                                          <FaEye /> View
                                        </button>
                                        {canComplete && (
                                          <button
                                            type="button"
                                            onClick={() => handleComplete(ticket)}
                                            disabled={Boolean(actionLoading)}
                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                                          >
                                            <FaCheck /> Complete
                                          </button>
                                        )}
                                        {canCancel && (
                                          <button
                                            type="button"
                                            onClick={() => openCancelModal(ticket)}
                                            disabled={Boolean(actionLoading)}
                                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                                          >
                                            <FaTimesCircle /> Cancel
                                          </button>
                                        )}
                                  </div>
                                </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.section>
              );
            })}
          </div>
            )}
          </>
        )}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7CB8FF]">Appointment Details</p>
                  <h2 className="mt-1 text-2xl font-black">{selectedTicket.ref}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-black text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Citizen Name', selectedTicket.citizenDisplayName],
                  ['Phone', selectedTicket.citizenPhone],
                  ['Service', selectedTicket.serviceName],
                  ['Center', selectedTicket.centerName],
                  ['Appointment Date', formatDate(selectedTicket.date)],
                  ['Appointment Time', selectedTicket.timeSlot || '--'],
                  ['Queue Number', getQueueNumber(selectedTicket) || '--'],
                  ['Status', getDisplayStatus(selectedTicket)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>
                    <span className="mt-1 block font-bold text-white">{value || '--'}</span>
                  </div>
                ))}
              </div>

              {selectedTicket.requestType === 'update_information' && (
                <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-white">Old Data vs New Data</h3>
                      <p className="text-sm text-slate-300">Review changed fields before accepting this update request.</p>
                    </div>
                    <span className={hasValidUpdateChanges(selectedTicket) ? 'rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200' : 'rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200'}>
                      {hasValidUpdateChanges(selectedTicket) ? 'Valid changes found' : 'No valid change'}
                    </span>
                  </div>
                  <p className="mb-3 text-sm">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400">National ID Number</span>
                    {selectedTicket.updateDetails?.nationalIdNumber || selectedTicket.existingRegistration?.nationalIdNumber || '--'}
                  </p>

                  {getUpdateComparisonRows(selectedTicket).length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Field</th>
                            <th className="px-3 py-2">Old Data</th>
                            <th className="px-3 py-2">New Data</th>
                            <th className="px-3 py-2">Reason</th>
                            <th className="px-3 py-2">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {getUpdateComparisonRows(selectedTicket).map((change) => (
                            <tr
                              key={`${change.field}-${change.index}`}
                              className={change.changed ? 'bg-emerald-500/5' : 'bg-red-500/5'}
                            >
                              <td className="px-3 py-3 font-bold text-[#7CB8FF]">{change.field || 'Update Field'}</td>
                              <td className="px-3 py-3 text-slate-200">{change.originalValue}</td>
                              <td className={change.changed ? 'px-3 py-3 font-black text-emerald-200' : 'px-3 py-3 font-black text-red-200'}>
                                {change.newValue}
                              </td>
                              <td className="px-3 py-3 text-slate-300">{change.reason || '--'}</td>
                              <td className="px-3 py-3">
                                <span className={change.changed ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-black text-emerald-200' : 'rounded-full bg-red-500/15 px-2 py-1 text-xs font-black text-red-200'}>
                                  {change.changed ? 'Changed' : 'No change'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
                      No updated fields recorded.
                    </p>
                  )}

                  <p className="mt-4 text-sm">
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-400">Supporting Notes</span>
                    {selectedTicket.updateDetails?.notes || 'None'}
                  </p>
                  {!hasValidUpdateChanges(selectedTicket) && (
                    <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">
                      This request has no valid changed field. Ask the citizen to submit a different value.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {cancelModalTicket && (() => {
          const isUpdateReq = cancelModalTicket.requestType === 'update_information';
          const changedFields = isUpdateReq ? getChangedUpdateFields(cancelModalTicket) : [];
          const hasNoChanges = isUpdateReq && changedFields.length === 0;

          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white ${isUpdateReq ? 'max-w-lg' : 'max-w-2xl'}`}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Operator Action</p>
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
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-950/40">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Ticket Reference</p>
                    <p className="mt-1 font-mono text-sm font-black text-blue-700 dark:text-[#7CB8FF]">{cancelModalTicket.ref}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Citizen</p>
                    <p className="mt-1 text-sm font-black">{cancelModalTicket.citizenDisplayName || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Request Type</p>
                    <p className="mt-1 text-sm font-black">{getRequestTypeLabel(cancelModalTicket.requestType)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Current Status</p>
                    <p className="mt-1 text-sm font-black">{getDisplayStatus(cancelModalTicket)}</p>
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
                  onClick={submitCancel}
                  disabled={Boolean(actionLoading) || hasNoChanges}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionLoading ? 'Cancelling...' : (isUpdateReq ? 'Confirm Cancel Update' : 'Confirm Cancellation')}
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </motion.div>
  );
};

export default OperatorDashboard;
