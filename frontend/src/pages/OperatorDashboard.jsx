import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import api from '../api/axiosInstance';
import { useAuth, useCountUp, useOtpGate } from '../hooks';
import OtpGateModal from '../components/OtpGateModal';
import {
  canCancelAppointment,
  canCompleteAppointment,
  canReacceptAppointment,
} from '../utils/appointmentActions';
import { getCancellationFeedbackText, getCancellationReasonList } from '../utils/cancellationDisplay';
import LostIdCancelDetails from '../components/LostIdCancelDetails';
import {
  getIncorrectFieldOptionsForTicket,
  isLostReplacementRequest,
} from '../utils/cancellationFields';
import { getChangedUpdateFields } from '../utils/updateRequestFields';
import {
  FaBuilding,
  FaCalendarAlt,
  FaCheck,
  FaCheckDouble,
  FaPhoneAlt,
  FaQrcode,
  FaChartBar,
  FaTicketAlt,
  FaTimesCircle,
  FaUserClock,
  FaUsers,
  FaUserCheck,
  FaClipboardList,
  FaEye,
  FaSyncAlt,
} from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

function AnimatedStatValue({ value }) {
  const animated = useCountUp(Number(value) || 0);
  return animated.toLocaleString();
}

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

const today = new Date().toLocaleString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
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
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (normalized === 'single' || normalized === 'singe') return 'Single';
  if (normalized === 'married' || normalized === 'marrid') return 'Married';
  if (normalized === 'divorced') return 'Divorced';
  if (normalized === 'widowed') return 'Widowed';
  return value || '--';
};

const getOriginalRegistrationDetails = (ticket = {}) => (
  ticket.updateDetails?.previousData ||
  ticket.updateDetails?.oldDataSnapshot ||
  ticket.existingRegistration?.registrationDetails ||
  {}
);

const getOriginalValueByField = (ticket = {}, field = '', fallback = '') => {
  if (fallback && fallback !== '--' && fallback !== 'Not recorded in current record') return valueOrDash(fallback);
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

const getPreviousDataRows = (ticket = {}) => {
  const previous = ticket.updateDetails?.previousData || ticket.updateDetails?.oldDataSnapshot || {};
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
  if (key.includes('marital')) return formatMaritalStatus(text).toUpperCase();
  if (key.includes('date')) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return text.toLowerCase().replace(/\s+/g, ' ');
};

const getUpdateComparisonRows = (ticket = {}) => getUpdateChangeList(ticket).map((change, index) => {
  const originalValue = getOriginalValueByField(ticket, change.field, change.currentValue);
  const isMaritalStatus = fieldKey(change.field).includes('marital');
  const newValue = isMaritalStatus ? formatMaritalStatus(change.newValue) : valueOrDash(change.newValue);
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
  const navigate = useNavigate();
  const location = useLocation();
  const autoOpenedTicketRef = useRef('');
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const {
    otpFlow, otpDigits, otpSeconds, otpRequesting, otpVerifying, otpError,
    requestOtp, updateOtpDigit, verifyOtpGate, resendOtpGate, closeOtpGate
  } = useOtpGate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [highlightedSection, setHighlightedSection] = useState('');
  const sectionRefs = useRef({});
  const highlightTimeoutRef = useRef(null);
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
      setCenterSummary(payload.centerStats || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load operator dashboard.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // /api/operator/dashboard never returns a staff list, so center managers
  // (already authorized for /api/operators, auto-scoped server-side to their
  // own center) fetch their roster from there instead.
  const fetchStaff = useCallback(async () => {
    if (!isCenterManager) return;
    try {
      const response = await api.get('/api/operators');
      setStaff(response.data?.data || []);
    } catch {
      setStaff([]);
    }
  }, [isCenterManager]);

  useEffect(() => {
    fetchDashboard(true);
    const intervalId = window.setInterval(() => fetchDashboard(false), 5000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboard]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

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

  const scrollToSection = useCallback((sectionKey) => {
    window.requestAnimationFrame(() => {
      sectionRefs.current[sectionKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setHighlightedSection(sectionKey);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedSection(''), 1800);
  }, []);

  // Which service section holds the first ticket matching a given status —
  // used so clicking a status card (Completed, Cancelled, ...) scrolls to
  // wherever those tickets actually are, not always the same section.
  const findSectionForStatus = useCallback((status) => {
    const matches = (ticket) => {
      if (status === 'all') return true;
      if (status === 'pending') return matchesAnyStatus(ticket, ['Pending']);
      if (status === 'waiting') return matchesAnyStatus(ticket, ['Waiting']);
      if (status === 'nowServing') return matchesAnyStatus(ticket, ['Being Served', 'In Progress']);
      if (status === 'completed') return matchesAnyStatus(ticket, ['Completed']);
      if (status === 'cancelled') return matchesAnyStatus(ticket, ['Cancelled', 'Canceled', 'Rejected']);
      if (status === 'noShow') return matchesAnyStatus(ticket, ['No Show', 'No-Show', 'NoShow']);
      return true;
    };
    return (
      SERVICE_SECTIONS.find((section) => tickets.some((ticket) => ticket.requestType === section.key && matches(ticket)))
      || SERVICE_SECTIONS[0]
    );
  }, [tickets]);

  useEffect(() => {
    const viewQuery = String(searchParams.get('view') || '').trim().toLowerCase();
    const ticketQuery = String(searchParams.get('ticket') || '').trim().toUpperCase();
    const requestTypeQuery = String(searchParams.get('requestType') || '').trim().toLowerCase();

    if (viewQuery && FILTER_LABELS[viewQuery]) {
      setStatusFilter(viewQuery);
      if (viewQuery === 'staff') {
        window.setTimeout(() => scrollToSection('staff'), 0);
      } else if (viewQuery !== 'all') {
        scrollToSection(findSectionForStatus(viewQuery).key);
      }
    } else if (requestTypeQuery && isServiceFilter(requestTypeQuery)) {
      setStatusFilter('all');
      scrollToSection(requestTypeQuery);
    }

    if (!ticketQuery || !tickets.length || autoOpenedTicketRef.current === ticketQuery) return;

    const matchedTicket = tickets.find((ticket) => (
      String(ticket.ref || '').toUpperCase() === ticketQuery ||
      String(ticket.id || '').toUpperCase() === ticketQuery
    ));

    if (matchedTicket) {
      autoOpenedTicketRef.current = ticketQuery;
      setStatusFilter('all');
      scrollToSection(matchedTicket.requestType || 'new_national_id');
      setSelectedTicket(matchedTicket);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tickets]);

  const goToFilter = useCallback((filter) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', filter);
    params.delete('requestType');
    params.delete('ticket');
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`
    });
  }, [location.pathname, navigate, searchParams]);

  const goToRequestType = useCallback((requestType) => {
    const params = new URLSearchParams(searchParams);
    params.set('requestType', requestType);
    params.delete('view');
    params.delete('ticket');
    setStatusFilter('all');
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`
    });
    scrollToSection(requestType);
  }, [location.pathname, navigate, scrollToSection, searchParams]);

  const handleStatCardClick = useCallback((filterKey, isActive, alwaysOpen = false) => {
    if (filterKey === 'staff') {
      if (isActive && !alwaysOpen) {
        goToFilter('all');
        return;
      }
      goToFilter('staff');
      window.setTimeout(() => scrollToSection('staff'), 0);
      return;
    }
    if (isActive && !alwaysOpen) {
      goToFilter('all');
      return;
    }
    goToFilter(filterKey);
    scrollToSection(findSectionForStatus(filterKey).key);
  }, [findSectionForStatus, goToFilter, scrollToSection]);

  const handleServiceCardClick = useCallback((sectionKey) => {
    goToRequestType(sectionKey);
  }, [goToRequestType]);

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
    const citizensServed = new Set(
      completedServices.map((ticket) => ticket.citizenPhone || ticket.citizenDisplayName).filter(Boolean)
    );
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
      citizensServedCount: citizensServed.size,
      requestBreakdown,
      totalRequestsCount: summary.totalAppointments ?? sorted.length,
    };
  }, [centerSummary, tickets]);

  const weekDays = useMemo(() => {
    const monday = new Date();
    const day = monday.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-US', { weekday: 'short' }) };
    });
  }, []);

  const dailyAppointmentsChart = useMemo(() => ({
    labels: weekDays.map((day) => day.label),
    datasets: [{
      label: 'Appointments',
      data: weekDays.map((day) => tickets.filter((ticket) => ticket.date === day.key).length),
      backgroundColor: '#1F6FC2',
      borderRadius: 8,
      borderSkipped: false,
      maxBarThickness: 40
    }]
  }), [tickets, weekDays]);

  const queueActivityChart = useMemo(() => ({
    labels: weekDays.map((day) => day.label),
    datasets: [{
      label: 'Average Queue Size',
      data: weekDays.map((day) => tickets.filter((ticket) => (
        ticket.date === day.key && !matchesAnyStatus(ticket, ['Cancelled', 'Canceled', 'Rejected', 'No Show', 'No-Show', 'NoShow'])
      )).length),
      borderColor: '#1F6FC2',
      backgroundColor: 'rgba(31, 111, 194, 0.14)',
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: '#fff',
      pointBorderColor: '#1F6FC2',
      pointBorderWidth: 2,
      pointHoverRadius: 6
    }]
  }), [tickets, weekDays]);

  const requestDistributionChart = useMemo(() => ({
    labels: ['Pending', 'Waiting', 'Now Serving', 'Completed', 'Cancelled', 'No Show'],
    datasets: [{
      data: [
        stats.pendingCount,
        stats.ticketsWaitingCount,
        stats.nowServingCount,
        stats.completedServicesCount,
        stats.cancelledCount,
        stats.noShowCount
      ],
      backgroundColor: ['#F59E0B', '#60A5FA', '#8B5CF6', '#22C55E', '#F472B6', '#EF4444'],
      borderWidth: 0
    }]
  }), [stats]);

  const distributionTotal = requestDistributionChart.datasets[0].data.reduce((sum, value) => sum + value, 0);

  const recentAppointments = useMemo(() => (
    [...tickets].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 8)
  ), [tickets]);

  // Status-only filter — service is never filtered out here, since all three
  // service sections stay permanently visible and are split out afterward.
  const visibleTickets = useMemo(() => {
    const sorted = sortTickets(tickets);

    if (statusFilter === 'pending') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Pending']));
    }

    if (statusFilter === 'waiting') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Waiting']));
    }

    if (statusFilter === 'nowServing') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Being Served', 'In Progress']));
    }

    if (statusFilter === 'completed') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Completed']));
    }

    if (statusFilter === 'cancelled') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['Cancelled', 'Canceled', 'Rejected']));
    }

    if (statusFilter === 'noShow') {
      return sorted.filter((ticket) => matchesAnyStatus(ticket, ['No Show', 'No-Show', 'NoShow']));
    }

    return sorted;
  }, [statusFilter, tickets]);

  const visibleCount = statusFilter === 'staff' ? staff.length : visibleTickets.length;

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

  // All three service sections are always shown, stacked, one below another —
  // never hidden based on the active filter.
  const visibleSections = SERVICE_SECTIONS;

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
      const otpToken = await requestOtp({
        purpose: 'complete_service',
        ticketId: ticket.id,
        ticketRef: ticket.ref,
        title: 'Verify to Complete',
        description: `Ask the citizen for the 6-digit code sent to their phone to complete ${ticket.ref}.`
      });
      if (!otpToken) {
        toast.info('Complete service cancelled.');
        return;
      }
      await api.put(`/api/bookings/admin/${ticket.id}/status`, {
        status: 'Completed',
        otpToken
      });
      toast.success(`Request ${ticket.ref} completed.`);

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
      const otpToken = await requestOtp({
        purpose: 'cancel_service',
        ticketId: ticket.id,
        ticketRef: ticket.ref,
        title: 'Verify to Cancel',
        description: `Ask the citizen for the 6-digit code sent to their phone to cancel ${ticket.ref}.`
      });
      if (!otpToken) {
        toast.info('Cancellation aborted.');
        return;
      }
      await api.put(`/api/bookings/${ticket.id}/cancel`, {
        cancellationReason: cancelData.cancellationReason || 'Cancelled by center staff',
        cancellationReasons: cancelData.cancellationReasons || [],
        additionalNotes: cancelData.additionalNotes || '',
        otpToken
      });
      toast.success(`Request ${ticket.ref} cancelled. Citizen has been notified.`);
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

  const selectedReasonLabels = (ticket = cancelModalTicket) => {
    const allowed = getIncorrectFieldOptionsForTicket(ticket);
    return selectedCancelReasons.filter((reason) => allowed.includes(reason));
  };

  const submitCancel = () => {
    if (!cancelModalTicket) return;
    const isUpdateReq = cancelModalTicket.requestType === 'update_information';
    const isLostReq = isLostReplacementRequest(cancelModalTicket);

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

    const validReasons = selectedReasonLabels(cancelModalTicket);
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
    handleCancel(cancelModalTicket, {
      cancellationReasons: validReasons,
      cancellationReason: validReasons.join(', '),
      additionalNotes: cancelNotes.trim(),
    });
  };

  const handleReturn = async (ticket) => {
    if (!ticket?.id) return;
    if (!canReacceptAppointment(ticket)) {
      toast.info('Re-accept is available only after the appointment is completed.');
      return;
    }
    const confirmed = window.confirm(`Re-accept ${ticket.ref}? This will return it to Waiting so it can be handled again.`);
    if (!confirmed) return;
    setActionLoading(`return-${ticket.ref}`);
    try {
      await api.put(`/api/bookings/admin/${ticket.id}/status`, { status: 'Waiting' });
      toast.success(`Request ${ticket.ref} returned to waiting.`);
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
      toast.success(`Request ${ticket.ref} rejected.`);
      setSelectedTicket(null);
      await fetchDashboard(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reject this request.');
    } finally {
      setActionLoading('');
    }
  };

  // Sitewide soft-pastel card tone system (styles/nqs-theme-system.css): tone
  // names map to nqs-card-tone-{tone} / nqs-card-tone-icon-{tone} classes below.
  const statsData = isCenterManager ? [
    {
      label: 'Total Appointments',
      value: stats.totalRequestsCount,
      helper: 'All center appointments',
      icon: FaChartBar,
      tone: 'purple',
      filter: 'all',
    },
    {
      label: 'Waiting',
      value: stats.ticketsWaitingCount,
      helper: 'Waiting appointments',
      icon: FaTicketAlt,
      tone: 'blue',
      filter: 'waiting',
    },
    {
      label: 'Completed',
      value: stats.completedServicesCount,
      helper: 'Completed appointments',
      icon: FaCheckDouble,
      tone: 'green',
      filter: 'completed',
    },
    {
      label: 'Cancelled',
      value: stats.cancelledCount,
      helper: 'Cancelled or rejected',
      icon: FaTimesCircle,
      tone: 'pink',
      filter: 'cancelled',
    },
    {
      label: 'No Show',
      value: stats.noShowCount,
      helper: 'Missed appointments',
      icon: FaTimesCircle,
      tone: 'pink',
      filter: 'noShow',
    },
    {
      label: 'Operators',
      value: staff.length,
      helper: 'Staff assigned to this center',
      icon: FaUserCheck,
      tone: 'cyan',
      filter: 'staff',
    },
    {
      label: 'Citizens Served',
      value: stats.citizensServedCount,
      helper: 'Unique citizens completed',
      icon: FaUsers,
      tone: 'blue',
      filter: 'completed',
      alwaysOpen: true,
    },
  ] : [
    {
      label: 'Total Appointments',
      value: stats.totalRequestsCount,
      helper: 'All center appointments',
      icon: FaChartBar,
      tone: 'purple',
      filter: 'all',
    },
    {
      label: 'Pending',
      value: stats.pendingCount,
      helper: 'Requests awaiting action',
      icon: FaUserClock,
      tone: 'orange',
      filter: 'pending',
    },
    {
      label: 'Waiting',
      value: stats.ticketsWaitingCount,
      helper: 'Waiting appointments',
      icon: FaTicketAlt,
      tone: 'blue',
      filter: 'waiting',
    },
    {
      label: 'Now Serving',
      value: stats.nowServingCount,
      helper: 'Currently being served',
      icon: FaPhoneAlt,
      tone: 'purple',
      filter: 'nowServing',
    },
    {
      label: 'Completed',
      value: stats.completedServicesCount,
      helper: 'Completed appointments',
      icon: FaCheckDouble,
      tone: 'green',
      filter: 'completed',
    },
    {
      label: 'Cancelled',
      value: stats.cancelledCount,
      helper: 'Cancelled or rejected',
      icon: FaTimesCircle,
      tone: 'pink',
      filter: 'cancelled',
    },
    {
      label: 'No Show',
      value: stats.noShowCount,
      helper: 'Missed appointments',
      icon: FaTimesCircle,
      tone: 'pink',
      filter: 'noShow',
    },
  ];

  const chartAxisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: 'var(--ad-muted)' }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: 'var(--ad-muted)' }, grid: { color: 'rgba(15, 45, 87, 0.06)' } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: { legend: { display: false } }
  };

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

  const serviceTone = { new_national_id: 'blue', update_information: 'purple', lost_replacement: 'orange' };

  return (
    <motion.div
      className="nqs-operator-dashboard nqs-admin-dashboard"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-none space-y-3">
        <motion.div variants={item} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold sm:text-xl" style={{ color: 'var(--ad-navy)' }}>
              {isCenterManager ? 'Center Dashboard' : 'Operator Dashboard'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm" style={{ color: 'var(--ad-muted)' }}>
              <FaCalendarAlt className="text-[#1F6FC2]" />
              <span>{today}</span>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {isCenterManager && (
              <>
                <Link to="/dashboard/operator/staff" className="nqs-ad-ghost-btn">
                  <FaUserClock className="text-sm" />
                  Manage Staff
                </Link>
                <Link to="/dashboard/operator/center-schedule" className="nqs-ad-ghost-btn">
                  <FaBuilding className="text-sm" />
                  Center Schedule
                </Link>
                <Link to="/dashboard/operator/report" className="nqs-ad-ghost-btn">
                  <FaChartBar className="text-sm" />
                  Reports
                </Link>
              </>
            )}
            <Link to="/dashboard/operator/qr-scan" className="nqs-ad-primary-btn">
              <FaQrcode className="text-sm" />
              Scan QR Request
            </Link>
            <button
              type="button"
              onClick={handleCallNext}
              disabled={Boolean(actionLoading) || stats.ticketsWaitingCount === 0}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:text-sm"
            >
              <FaPhoneAlt className="text-sm" />
              Call Next Request
            </button>
          </div>
        </motion.div>

        <div className="nqs-ad-stat-grid">
          {statsData.map((stat) => {
            const isActive = statusFilter === stat.filter;
            return (
              <button
                key={stat.label}
                type="button"
                onClick={() => handleStatCardClick(stat.filter, isActive, stat.alwaysOpen)}
                className={`nqs-ad-stat nqs-ad-stat-${stat.tone} ${isActive ? 'ring-2 ring-[#1F6FC2]/30' : ''}`}
              >
                <div className="nqs-ad-stat-top">
                  <span className="nqs-ad-stat-label">{stat.label}</span>
                  <span className="nqs-ad-stat-icon"><stat.icon /></span>
                </div>
                <strong className="nqs-ad-stat-value"><AnimatedStatValue value={stat.value} /></strong>
                <span className="nqs-ad-stat-note">{stat.helper}</span>
              </button>
            );
          })}
        </div>

        <motion.section variants={item} className="nqs-ad-service-grid">
          {SERVICE_SECTIONS.map((section) => {
            const isActive = highlightedSection === section.key;
            const count = stats.requestBreakdown[section.key] || 0;
            const tone = serviceTone[section.key];
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => handleServiceCardClick(section.key)}
                className={isActive ? 'nqs-ad-service-card nqs-od-service-active' : `nqs-ad-service-card nqs-ad-service-${tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wide">{section.title}</p>
                  <span className={isActive ? 'rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-bold text-white' : 'rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold'} style={isActive ? {} : { color: 'var(--ad-primary)' }}>
                    Open
                  </span>
                </div>
                <strong className="nqs-ad-service-total"><AnimatedStatValue value={count} /></strong>
                <span className="nqs-ad-service-total-label">Requests in this center</span>
                <p className="mt-2 text-[11px] font-bold">{section.helper}</p>
              </button>
            );
          })}
        </motion.section>

        <motion.div variants={item} className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="nqs-ad-widget xl:col-span-2">
            <div className="nqs-ad-widget-head">
              <div>
                <h3>Daily Appointments</h3>
                <p>This week</p>
              </div>
            </div>
            <div className="nqs-ad-widget-body">
              <div className="nqs-ad-chart-canvas" style={{ height: 125 }}>
                <Bar data={dailyAppointmentsChart} options={chartAxisOptions} />
              </div>
            </div>
          </div>

          <div className="nqs-ad-widget">
            <div className="nqs-ad-widget-head">
              <div>
                <h3>Request Status Distribution</h3>
              </div>
            </div>
            <div className="nqs-ad-widget-body">
              {distributionTotal > 0 ? (
                <>
                  <div className="nqs-ad-donut-wrap">
                    <div className="nqs-ad-chart-canvas nqs-ad-chart-donut">
                      <Doughnut data={requestDistributionChart} options={doughnutOptions} />
                    </div>
                    <div className="nqs-ad-donut-center">
                      <span>Total</span>
                      <strong>{distributionTotal}</strong>
                    </div>
                  </div>
                  <ul className="nqs-ad-donut-legend">
                    {requestDistributionChart.labels.map((label, index) => (
                      <li key={label}>
                        <span className="nqs-ad-dot" style={{ background: requestDistributionChart.datasets[0].backgroundColor[index] }} />
                        <span className="nqs-ad-donut-legend-label">{label}</span>
                        <strong>{Math.round((requestDistributionChart.datasets[0].data[index] / distributionTotal) * 100)}%</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <p className="nqs-ad-empty">No requests recorded yet.</p>}
            </div>
          </div>

          <div className="nqs-ad-widget xl:col-span-3">
            <div className="nqs-ad-widget-head">
              <div>
                <h3>Queue Activity</h3>
                <p>This week</p>
              </div>
            </div>
            <div className="nqs-ad-widget-body">
              <div className="nqs-ad-chart-canvas" style={{ height: 110 }}>
                <Line data={queueActivityChart} options={chartAxisOptions} />
              </div>
            </div>
          </div>
        </motion.div>

        {isCenterManager && (
          <motion.div variants={item} className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="nqs-ad-widget">
              <div className="nqs-ad-widget-head">
                <div>
                  <h3>Operator Performance</h3>
                  <p>{staff.length} staff assigned to this center</p>
                </div>
              </div>
              <div className="nqs-ad-widget-body">
                {staff.length === 0 ? (
                  <p className="nqs-ad-empty">No staff operators created for this center yet.</p>
                ) : (
                  <ul className="nqs-ad-activity-list">
                    {staff.map((member) => (
                      <li key={member._id || member.id}>
                        <span className="nqs-ad-stat-icon nqs-card-tone-icon-cyan"><FaUserCheck /></span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center justify-between gap-2">
                            <span>{member.name || 'No name'} · {staffRoleLabel(member)}</span>
                            <span className={member.status === 'active' ? 'nqs-badge-tone-green' : 'nqs-badge-tone-pink'} style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                              {member.status || 'active'}
                            </span>
                          </p>
                          <span>{member.phone || member.username || '--'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="nqs-ad-widget">
              <div className="nqs-ad-widget-head">
                <div>
                  <h3>Recent Appointments</h3>
                  <p>Latest activity in this center</p>
                </div>
              </div>
              <div className="nqs-ad-widget-body">
                {recentAppointments.length === 0 ? (
                  <p className="nqs-ad-empty">No appointments recorded yet.</p>
                ) : (
                  <ul className="nqs-ad-activity-list">
                    {recentAppointments.map((ticket) => (
                      <li key={ticket.id || ticket.ref}>
                        <span className="nqs-ad-activity-dot"><FaClipboardList /></span>
                        <div className="min-w-0 flex-1">
                          <p>{ticket.citizenDisplayName} · {getRequestTypeLabel(ticket.requestType)}</p>
                          <span>{ticket.ref} · {getDisplayStatus(ticket)} · {formatDate(ticket.date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Showing: {FILTER_LABELS[statusFilter]} ({visibleCount})
          </span>
          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => goToFilter('all')}
              className="rounded-md border border-blue-200 px-3 py-1 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              Clear filter
            </button>
          )}
        </motion.div>

        {statusFilter === 'staff' ? (
          <motion.section ref={(node) => { sectionRefs.current.staff = node; }} variants={item} className="scroll-mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
            {tickets.length === 0 ? (
          <motion.div variants={item} className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <FaTicketAlt className="mx-auto text-3xl text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-base font-semibold text-slate-950 dark:text-white">No appointments available.</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Appointments booked for your assigned center will appear here automatically.</p>
          </motion.div>
            ) : (
          <div className="space-y-5">
            {visibleSections.map((section) => {
              const sectionTickets = groupedTickets[section.key] || [];
              const isHighlighted = highlightedSection === section.key;
              return (
                <motion.section
                  key={section.key}
                  ref={(node) => { sectionRefs.current[section.key] = node; }}
                  id={`section-${section.key}`}
                  variants={item}
                  className={`scroll-mt-4 overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-500 dark:bg-slate-800 ${
                    isHighlighted
                      ? 'border-[#2F80ED] ring-4 ring-[#2F80ED]/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
                      <FaTicketAlt className="text-yellow-500" />
                      {section.title}
                    </h2>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      {sectionTickets.length} appointment{sectionTickets.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {sectionTickets.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {statusFilter === 'all'
                        ? 'No appointments in this service yet.'
                        : `No ${FILTER_LABELS[statusFilter].toLowerCase()} in this service.`}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-xs uppercase text-slate-700 dark:bg-[#0b2444] dark:text-slate-100">
                          <tr>
                            <th className="px-4 py-3">Request Number</th>
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
                            const canReaccept = canReacceptAppointment(ticket);

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
                                        <button
                                          type="button"
                                          onClick={() => handleReturn(ticket)}
                                          disabled={Boolean(actionLoading) || !canReaccept}
                                          title={canReaccept ? 'Return completed appointment to Waiting' : 'Available after Complete'}
                                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold !text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:!text-white"
                                        >
                                          <FaSyncAlt /> Re-accept
                                        </button>
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

              {getCancellationReasonList(selectedTicket).length > 0 && (
                <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <span className="block text-xs font-black uppercase tracking-[0.16em] text-red-300">
                    Cancellation / Correction Feedback
                  </span>
                  <p className="mt-2 text-sm font-semibold leading-6 text-red-100">
                    {getCancellationFeedbackText(selectedTicket, 'No cancellation reason was provided.')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {getCancellationReasonList(selectedTicket).map((reason) => (
                      <span key={reason} className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-100">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

                  {getPreviousDataRows(selectedTicket).length > 0 && (
                    <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <h4 className="mb-3 text-sm font-black text-white">Previous National ID Data</h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {getPreviousDataRows(selectedTicket).map(([label, value]) => (
                          <p key={label}>
                            <span className="block text-xs font-black uppercase tracking-wide text-slate-400">{label}</span>
                            <span className="text-slate-100">{value || '--'}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

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
          const isLostReq = isLostReplacementRequest(cancelModalTicket);
          const fieldOptions = getIncorrectFieldOptionsForTicket(cancelModalTicket);
          const changedFields = isUpdateReq ? getChangedUpdateFields(cancelModalTicket) : [];
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
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Operator Action</p>
                  <h2 className="mt-1 text-2xl font-black">{modalTitle}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{modalHelp}</p>
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
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Request Reference</p>
                    <p className="mt-1 font-mono text-sm font-black text-blue-700 dark:text-[#7CB8FF]">{cancelModalTicket.ref}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Full Name</p>
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

              {isLostReq && <LostIdCancelDetails ticket={cancelModalTicket} />}

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
                      : `You selected the following incorrect fields: ${selectedReasonLabels(cancelModalTicket).join(', ')}. Are you sure you want to cancel this ${isLostReq ? 'Lost ID request' : 'appointment'}?`}
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
                  {actionLoading
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
    </motion.div>
  );
};

export default OperatorDashboard;
