import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSearch
} from 'react-icons/fi';
import { useDashboard, useTheme, useAuth, useOtpGate } from '../hooks';
import api from '../api/axiosInstance';
import { apiClient } from '../api/apiClient';
import OtpGateModal from '../components/OtpGateModal';
import {
  ActiveOperatorsCard,
  AddWidgetModal,
  CenterPopularityCard,
  CenterPerformanceTable,
  DonutLegend,
  formatNumber,
  KpiCard,
  KPI_META,
  KPI_ROUTES,
  OperationalInsightsCard,
  QueueOverviewCard,
  QuickActionsCard,
  RecentActivityCard,
  ServiceBreakdownCard,
  StatTile,
  SystemAlertsCard,
  WidgetShell
} from '../dashboard/admin/AdminDashboardParts';
import { FiUserPlus, FiEdit3, FiCreditCard } from 'react-icons/fi';
import {
  loadWidgetOrder,
  resetWidgetLayout,
  saveWidgetOrder,
  WIDGET_CATALOG
} from '../dashboard/admin/widgetConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const periodOptions = ['Today', 'This Week', 'This Month', 'All Time'];
const chartPeriodOptions = ['Today', 'This Week', 'This Month', 'Custom'];

const dateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const displayDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getCenterName = (appointment = {}) => (
  appointment.center?.name ||
  appointment.centerName ||
  appointment.registrationDetails?.selectedCenter ||
  appointment.existingRegistration?.centerName ||
  'Unassigned Center'
);

const getDistrict = (appointment = {}) => (
  appointment.district ||
  appointment.center?.district ||
  appointment.registrationDetails?.district ||
  appointment.registrationDetails?.centerDistrict ||
  appointment.replacementDetails?.district ||
  appointment.updateDetails?.district ||
  'Not provided'
);

const getCitizenName = (appointment = {}) => (
  appointment.citizenName ||
  appointment.citizen?.name ||
  appointment.citizen?.fullName ||
  appointment.registrationDetails?.fullName ||
  appointment.replacementDetails?.fullName ||
  appointment.updateDetails?.fullName ||
  'Citizen'
);

const getServiceLabel = (requestType = '') => {
  if (requestType === 'update_information') return 'Update Information';
  if (requestType === 'lost_replacement') return 'Lost ID Replacement';
  if (requestType === 'collection') return 'ID Collection';
  return 'New Registration';
};

const normalizeStatus = (appointment = {}) => (
  (() => {
    const raw = appointment.requestStatus || appointment.status || 'Waiting';
    const normalized = String(raw || '').trim().toLowerCase();
    if (normalized === 'in progress' || normalized === 'being served') return 'Now Serving';
    return raw;
  })()
);

const statusStyles = {
  Waiting: 'nqs-ad-badge-amber',
  Pending: 'nqs-ad-badge-amber',
  Approved: 'nqs-ad-badge-green',
  Completed: 'nqs-ad-badge-green',
  Cancelled: 'nqs-ad-badge-rose',
  Rejected: 'nqs-ad-badge-rose',
  'Correction Required': 'nqs-ad-badge-orange',
  'Resubmission Required': 'nqs-ad-badge-orange',
  Resubmitted: 'nqs-ad-badge-blue',
  'Now Serving': 'nqs-ad-badge-blue',
  'Being Served': 'nqs-ad-badge-blue',
  'In Progress': 'nqs-ad-badge-blue',
  'On Hold': 'nqs-ad-badge-slate',
  'No Show': 'nqs-ad-badge-rose'
};

const chartColors = {
  newId: '#1B4F91'
};

function AdminDashboard() {
  const { loading, adminStats } = useDashboard();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const adminName = user?.name || user?.fullName || user?.username || 'Admin';
  const [appointments, setAppointments] = useState([]);
  const [centers, setCenters] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  
  const [showCitizens, setShowCitizens] = useState(false);
  const [citizensData, setCitizensData] = useState([]);
  const [loadingCitizens, setLoadingCitizens] = useState(false);
  const citizensRef = React.useRef(null);

  const loadCitizens = useCallback(async () => {
    setLoadingCitizens(true);
    try {
      const res = await api.get('/api/users', { params: { role: 'citizen' } });
      setCitizensData(res.data.data || []);
      setTimeout(() => citizensRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCitizens(false);
    }
  }, []);

  const handleShowCitizens = useCallback(() => {
    setShowCitizens(true);
    loadCitizens();
  }, [loadCitizens]);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [chartPeriod, setChartPeriod] = useState('This Week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [widgetOrder, setWidgetOrder] = useState(() => loadWidgetOrder());
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    district: '',
    center: '',
    serviceType: '',
    date: '',
    period: 'This Week'
  });
  const [actionBusy, setActionBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const {
    otpFlow, otpDigits, otpSeconds, otpRequesting, otpVerifying, otpError,
    requestOtp, updateOtpDigit, verifyOtpGate, resendOtpGate, closeOtpGate
  } = useOtpGate();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    saveWidgetOrder(widgetOrder);
  }, [widgetOrder]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const [bookingsRes, centersRes, analyticsRes] = await Promise.all([
        api.get('/api/bookings/admin/all'),
        apiClient.get('/api/centers/list'),
        api.get('/api/reports/analytics').catch(() => ({ data: { data: null } }))
      ]);
      setAppointments(Array.isArray(bookingsRes.data?.data) ? bookingsRes.data.data : []);
      const centerRows = Array.isArray(centersRes.data?.data)
        ? centersRes.data.data
        : Array.isArray(centersRes.data)
          ? centersRes.data
          : [];
      setCenters(centerRows);
      setAnalytics(analyticsRes.data?.data || null);
    } catch {
      setAppointments([]);
      setCenters([]);
      setAnalytics(null);
      setRecordsError('Unable to load dashboard appointments. Please retry.');
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const normalizedAppointments = useMemo(() => (
    appointments.map((appointment) => ({
      id: appointment.id || appointment._id,
      ticketId: appointment.ref || appointment.ticketId || appointment.id || appointment._id || 'TKT-PENDING',
      citizenName: getCitizenName(appointment),
      district: getDistrict(appointment),
      centerName: getCenterName(appointment),
      centerId: typeof appointment.center === 'object' ? (appointment.center.id || appointment.center._id) : appointment.center || '',
      requestType: appointment.requestType || 'new_national_id',
      serviceType: getServiceLabel(appointment.requestType),
      status: normalizeStatus(appointment),
      queueStatus: appointment.status || '',
      queueNumber: appointment.queueNumber || appointment.queueNo || appointment.ticketNumber || '--',
      date: dateKey(appointment.date || appointment.appointmentDate || appointment.createdAt),
      time: appointment.timeSlot || appointment.time || appointment.registrationDetails?.timeSlot || '',
      raw: appointment
    }))
  ), [appointments]);

  const todayKey = dateKey(new Date());
  const thisWeekStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6);
    return dateKey(date);
  }, []);
  const thisMonthStart = useMemo(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return dateKey(date);
  }, []);

  const inPeriod = useCallback((date, period, from = '', to = '') => {
    if (!date) return false;
    if (period === 'Today') return date === todayKey;
    if (period === 'This Week') return date >= thisWeekStart;
    if (period === 'This Month') return date >= thisMonthStart;
    if (period === 'Custom') {
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    }
    return true;
  }, [thisMonthStart, thisWeekStart, todayKey]);

  const filteredAppointments = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return normalizedAppointments.filter((appointment) => {
      const searchable = [
        appointment.ticketId,
        appointment.citizenName,
        appointment.district,
        appointment.centerName,
        appointment.serviceType,
        appointment.status,
        appointment.queueNumber
      ].join(' ').toLowerCase();

      if (term && !searchable.includes(term)) return false;
      if (filters.status && appointment.status !== filters.status) return false;
      if (filters.district && appointment.district !== filters.district) return false;
      if (filters.center && appointment.centerId !== filters.center && appointment.centerName !== filters.center) return false;
      if (filters.serviceType && appointment.requestType !== filters.serviceType) return false;
      if (filters.date && appointment.date !== filters.date) return false;
      if (filters.period !== 'All Time' && !inPeriod(appointment.date, filters.period)) return false;
      return true;
    });
  }, [filters, inPeriod, normalizedAppointments]);

  useEffect(() => {
    setPage(1);
  }, [filters, rowsPerPage]);

  const kpi = useMemo(() => ({
    // Live /api/reports/stats only. On API failure adminStats is null → 0 (no stale values).
    citizens: adminStats?.totalUsers ?? 0,
    appointments: adminStats?.totalBookings ?? 0,
    waiting: adminStats?.waitingQueue ?? 0,
    completedToday: adminStats?.completedToday ?? 0,
    updates: adminStats?.updateRequests ?? 0,
    lost: adminStats?.lostIdRequests ?? 0,
    cancelled: adminStats?.cancelledAppointments ?? 0,
    centers: adminStats?.serviceCenters ?? centers.length
  }), [adminStats, centers.length]);

  const completedAll = useMemo(() => (
    normalizedAppointments.filter((item) => ['Completed', 'Approved'].includes(item.status)).length
  ), [normalizedAppointments]);

  const serviceBreakdown = useMemo(() => {
    const groups = [
      { key: 'new_national_id', label: 'New Registration', icon: FiUserPlus, tone: 'blue', to: '/admin-appointments?requestType=new_national_id' },
      { key: 'update_information', label: 'Update Information', icon: FiEdit3, tone: 'purple', to: KPI_ROUTES.updates },
      { key: 'lost_replacement', label: 'Lost ID Replacement', icon: FiCreditCard, tone: 'orange', to: KPI_ROUTES.lost }
    ];
    return groups.map((group) => {
      const items = normalizedAppointments.filter((item) => (
        group.key === 'new_national_id'
          ? (item.requestType === 'new_national_id' || item.requestType === 'new_id_registration')
          : item.requestType === group.key
      ));
      return {
        ...group,
        requests: items.length,
        wait: items.filter((item) => item.status === 'Waiting' || item.queueStatus === 'Waiting').length,
        done: items.filter((item) => ['Completed', 'Approved'].includes(item.status)).length,
        drop: items.filter((item) => ['Cancelled', 'Rejected'].includes(item.status)).length
      };
    });
  }, [normalizedAppointments]);

  const queue = useMemo(() => ({
    waiting: adminStats?.waitingQueue ?? normalizedAppointments.filter((item) => item.queueStatus === 'Waiting' || item.status === 'Waiting').length,
    serving: adminStats?.nowServing ?? normalizedAppointments.filter((item) => item.queueStatus === 'Being Served' || item.status === 'Being Served' || item.status === 'In Progress').length,
    onHold: normalizedAppointments.filter((item) => item.queueStatus === 'On Hold' || item.status === 'On Hold').length,
    noShow: normalizedAppointments.filter((item) => /no\s*show/i.test(item.status) || /no\s*show/i.test(item.queueStatus)).length,
    completedToday: kpi.completedToday
  }), [adminStats, kpi.completedToday, normalizedAppointments]);

  const nowServingTicket = useMemo(() => {
    const serving = normalizedAppointments.find((item) => (
      item.queueStatus === 'Being Served' || item.status === 'Being Served' || item.status === 'In Progress'
    ));
    return serving ? { ticketId: serving.ticketId, centerName: serving.centerName } : null;
  }, [normalizedAppointments]);

  const nextUpTicket = useMemo(() => {
    const next = normalizedAppointments.find((item) => item.queueStatus === 'Waiting' || item.status === 'Waiting');
    return next ? { ticketId: next.ticketId } : null;
  }, [normalizedAppointments]);

  const operatorStats = useMemo(() => {
    const total = adminStats?.totalOperators ?? 0;
    const active = adminStats?.activeOperators ?? 0;
    const enabled = adminStats?.enabledOperators ?? 0;
    const pending = adminStats?.pendingOperators ?? 0;
    return {
      total,
      active,
      inactive: Math.max(0, total - enabled - pending),
      serving: adminStats?.nowServing ?? queue.serving
    };
  }, [adminStats, queue.serving]);

  const chartScoped = useMemo(() => (
    normalizedAppointments.filter((item) => inPeriod(item.date, chartPeriod, customFrom, customTo))
  ), [chartPeriod, customFrom, customTo, inPeriod, normalizedAppointments]);

  const activityTrendChart = useMemo(() => {
    const labelsSet = new Set(chartScoped.map((item) => item.date).filter(Boolean));
    const labels = [...labelsSet].sort();
    const data = labels.map((day) => chartScoped.filter((item) => item.date === day).length);
    return {
      labels: labels.map((value) => displayDate(value)),
      datasets: [{
        label: 'Appointments',
        data,
        backgroundColor: '#60A5FA',
        hoverBackgroundColor: chartColors.newId,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 42
      }]
    };
  }, [chartScoped]);

  const centersChart = useMemo(() => {
    const map = new Map();
    chartScoped.forEach((item) => {
      const key = item.centerName || 'Unassigned';
      if (!map.has(key)) map.set(key, { name: key, district: item.district, total: 0, waiting: 0, completed: 0 });
      const row = map.get(key);
      row.total += 1;
      if (item.status === 'Waiting' || item.queueStatus === 'Waiting') row.waiting += 1;
      if (['Completed', 'Approved'].includes(item.status) || item.queueStatus === 'Completed') row.completed += 1;
    });
    const rows = [...map.values()].sort((a, b) => b.total - a.total).slice(0, 8);
    return {
      labels: rows.map((row) => row.name),
      datasets: [
        { label: 'Total', data: rows.map((row) => row.total), backgroundColor: '#1B4F91' },
        { label: 'Waiting', data: rows.map((row) => row.waiting), backgroundColor: '#D97706' },
        { label: 'Completed', data: rows.map((row) => row.completed), backgroundColor: '#168A5B' }
      ],
      rows
    };
  }, [chartScoped]);

  const serviceColorFor = (label = '') => {
    const text = label.toLowerCase();
    if (/update/.test(text)) return '#8B5CF6';
    if (/lost/.test(text)) return '#F59E0B';
    if (/new|registration/.test(text)) return '#1F6FC2';
    return '#94A3B8';
  };

  const distributionChart = useMemo(() => {
    const fromAnalytics = analytics?.appointmentsByService || analytics?.serviceDistribution;
    if (Array.isArray(fromAnalytics) && fromAnalytics.length) {
      const labels = fromAnalytics.map((row) => row.service || row.name);
      const values = fromAnalytics.map((row) => row.count ?? row.percentage ?? 0);
      return {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(serviceColorFor),
          borderWidth: 0
        }]
      };
    }
    const counts = {
      'New Registration': chartScoped.filter((item) => item.requestType === 'new_national_id' || item.requestType === 'new_id_registration').length,
      'Update Information': chartScoped.filter((item) => item.requestType === 'update_information').length,
      'Lost ID Replacement': chartScoped.filter((item) => item.requestType === 'lost_replacement').length
    };
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: Object.keys(counts).map(serviceColorFor),
        borderWidth: 0
      }]
    };
  }, [analytics, chartScoped]);

  const insights = useMemo(() => {
    const list = [];
    const busiest = centersChart.rows?.[0];
    if (busiest) list.push(`${busiest.name} has the most appointments in the selected period (${busiest.total}).`);
    const waitingCenter = [...(centersChart.rows || [])].sort((a, b) => b.waiting - a.waiting)[0];
    if (waitingCenter?.waiting) list.push(`${waitingCenter.name} currently leads waiting volume (${waitingCenter.waiting}).`);
    if (kpi.updates) list.push(`${formatNumber(kpi.updates)} update information requests need attention.`);
    if (operatorStats.inactive) list.push(`${formatNumber(operatorStats.inactive)} operators are inactive.`);
    if (kpi.completedToday) list.push(`${formatNumber(kpi.completedToday)} appointments were completed today.`);
    if (busiest?.completed) list.push(`${busiest.name} leads completed appointments (${busiest.completed}) in this view.`);
    return list.slice(0, 7);
  }, [centersChart.rows, kpi.completedToday, kpi.updates, operatorStats.inactive]);

  const districts = useMemo(() => (
    [...new Set(centers.map((center) => center.district).filter(Boolean))].sort()
  ), [centers]);

  const statusOptions = useMemo(() => (
    [...new Set(normalizedAppointments.map((item) => item.status).filter(Boolean))].sort()
  ), [normalizedAppointments]);

  const centerOptions = useMemo(() => {
    const scoped = filters.district
      ? centers.filter((center) => center.district === filters.district)
      : centers;
    return scoped
      .map((center) => ({ id: center.id || center._id || center.name, name: center.name }))
      .filter((item) => item.id && item.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [centers, filters.district]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / rowsPerPage));
  const visibleRows = filteredAppointments.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const exportCsv = () => {
    const headings = ['Request Number', 'Citizen Name', 'Service', 'Center', 'Appointment Date', 'Queue Number', 'Status'];
    const rows = filteredAppointments.map((item) => [
      item.ticketId,
      item.citizenName,
      item.serviceType,
      item.centerName,
      `${displayDate(item.date)} ${item.time}`.trim(),
      item.queueNumber,
      item.status
    ]);
    const csv = [headings, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nqs-admin-appointments-${dateKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addWidget = (id) => {
    setWidgetOrder((current) => (current.includes(id) ? current : [...current, id]));
  };

  const removeWidget = (id) => {
    if (WIDGET_CATALOG[id]?.required) return;
    setWidgetOrder((current) => current.filter((item) => item !== id));
  };

  const onDragStart = (id) => {
    if (isMobile) return;
    setDragId(id);
  };

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId || isMobile) return;
    setWidgetOrder((current) => {
      const next = [...current];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
    setDragId(null);
  };

  const handleStatusAction = async (appointment, status) => {
    if (!appointment?.id) return;
    setActionBusy(`${appointment.id}-${status}`);
    setActionMessage('');
    try {
      let otpToken = '';
      if (status === 'Completed' || status === 'Cancelled') {
        otpToken = await requestOtp({
          purpose: status === 'Completed' ? 'complete_service' : 'cancel_service',
          ticketId: appointment.id,
          ticketRef: appointment.ticketId,
          title: status === 'Completed' ? 'Verify to Complete' : 'Verify to Cancel',
          description: `Ask the citizen for the 6-digit code sent to their phone to ${status === 'Completed' ? 'complete' : 'cancel'} ${appointment.ticketId || 'this request'}.`
        });
        if (!otpToken) {
          setActionMessage(status === 'Completed' ? 'Complete service cancelled.' : 'Cancellation aborted.');
          return;
        }
      }
      await api.put(`/api/bookings/admin/${appointment.id}/status`, {
        status,
        otpToken,
        cancellationReason: status === 'Cancelled' ? 'Cancelled from admin dashboard.' : undefined
      });
      setActionMessage(`${appointment.ticketId} marked ${status}.`);
      await loadRecords();
    } catch {
      setActionMessage(`Unable to update ${appointment.ticketId}.`);
    } finally {
      setActionBusy('');
    }
  };

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: isDark ? '#D5E4F5' : '#6B7280',
          usePointStyle: true,
          boxWidth: 8,
          padding: 16
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: isDark ? '#A8BDD4' : '#6B7280' },
        grid: { display: false }
      },
      y: {
        stacked: true,
        ticks: { color: isDark ? '#A8BDD4' : '#6B7280' },
        grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)' }
      }
    }
  }), [isDark]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: { legend: { display: false } }
  }), []);

  const lineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: isDark ? '#A8BDD4' : '#6B7280' },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { color: isDark ? '#A8BDD4' : '#6B7280' },
        grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.06)' }
      }
    }
  }), [isDark]);

  const renderWidget = (id) => {
    const meta = WIDGET_CATALOG[id];
    if (!meta) return null;
    const removable = !meta.required;
    const dragProps = isMobile ? null : {
      draggable: true,
      onDragStart: () => onDragStart(id)
    };

    const shell = (title, children, extra = {}) => (
      <div
        key={id}
        className={`nqs-ad-slot nqs-ad-size-${meta.size}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onDrop(id)}
      >
        <WidgetShell
          title={title}
          removable={removable}
          onRemove={() => removeWidget(id)}
          dragHandleProps={dragProps}
          {...extra}
        >
          {children}
        </WidgetShell>
      </div>
    );

    if (id === 'kpi_row') {
      return (
        <div key={id} className="nqs-ad-slot nqs-ad-size-full" onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(id)}>
          <div className="nqs-ad-stat-grid">
            <button type="button" className="nqs-ad-stat-trigger" onClick={handleShowCitizens} aria-label="Open Total Citizens">
              <StatTile {...KPI_META.citizens} value={kpi.citizens} />
            </button>
            <StatTile {...KPI_META.appointments} value={kpi.appointments} to={KPI_ROUTES.appointments} />
            <StatTile {...KPI_META.waiting} value={kpi.waiting} to={KPI_ROUTES.waiting} />
            <StatTile {...KPI_META.completed} value={completedAll} to={KPI_ROUTES.completed} />
            <StatTile {...KPI_META.cancelled} value={kpi.cancelled} to={KPI_ROUTES.cancelled} />
            <StatTile {...KPI_META.operators} value={operatorStats.active} to={KPI_ROUTES.operators} />
            <StatTile {...KPI_META.centers} value={kpi.centers} to={KPI_ROUTES.centers} />
          </div>
        </div>
      );
    }

    if (id === 'service_breakdown') {
      return (
        <div key={id} className="nqs-ad-slot nqs-ad-size-xlarge" onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(id)}>
          <div className="nqs-ad-service-grid">
            {serviceBreakdown.map((service) => (
              <ServiceBreakdownCard key={service.key} service={service} />
            ))}
          </div>
        </div>
      );
    }

    if (id.startsWith('kpi_') || id === 'cancelled_requests') {
      const map = {
        kpi_citizens: ['citizens', kpi.citizens],
        kpi_appointments: ['appointments', kpi.appointments],
        kpi_waiting: ['waiting', kpi.waiting],
        kpi_completed: ['completed', kpi.completedToday],
        kpi_updates: ['updates', kpi.updates],
        kpi_lost: ['lost', kpi.lost],
        cancelled_requests: ['cancelled', kpi.cancelled]
      };
      const [key, value] = map[id] || [];
      if (!key) return null;
      return shell(KPI_META[key].label, <KpiCard {...KPI_META[key]} value={value} to={KPI_ROUTES[key]} />);
    }

    if (id === 'chart_activity') {
      return shell('Appointment Volume Overview', (
        <>
          <div className="nqs-ad-chart-filters">
            {chartPeriodOptions.map((period) => (
              <button
                key={period}
                type="button"
                className={chartPeriod === period ? 'is-active' : ''}
                onClick={() => setChartPeriod(period)}
              >
                {period === 'Custom' ? 'Custom Date' : period}
              </button>
            ))}
            {chartPeriod === 'Custom' ? (
              <div className="nqs-ad-custom-range">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" />
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" />
              </div>
            ) : null}
          </div>
          <div className="nqs-ad-chart-canvas nqs-ad-chart-main">
            {activityTrendChart.labels?.length ? (
              <Bar data={activityTrendChart} options={lineChartOptions} />
            ) : (
              <p className="nqs-ad-empty">No appointment activity for this period.</p>
            )}
          </div>
        </>
      ), { subtitle: `${formatNumber(chartScoped.length)} appointments in selected period` });
    }

    if (id === 'center_performance') {
      return shell('Service Center Performance', (
        <CenterPerformanceTable rows={centersChart.rows} />
      ), { subtitle: `${formatNumber(centersChart.rows?.length || 0)} centers in selected period` });
    }

    if (id === 'chart_centers') {
      return shell('Busiest Service Centers', (
        <div className="nqs-ad-chart-canvas nqs-ad-chart-sm">
          {centersChart.labels?.length ? (
            <Bar data={centersChart} options={chartOptions} />
          ) : (
            <p className="nqs-ad-empty">No center performance data available.</p>
          )}
        </div>
      ));
    }

    if (id === 'chart_distribution') {
      const distTotal = distributionChart.datasets?.[0]?.data?.reduce((sum, value) => sum + Number(value || 0), 0) || 0;
      return shell('Request Type', (
        distTotal > 0 ? (
          <>
            <div className="nqs-ad-donut-wrap">
              <div className="nqs-ad-chart-canvas nqs-ad-chart-donut">
                <Doughnut data={distributionChart} options={doughnutOptions} />
              </div>
              <div className="nqs-ad-donut-center">
                <span>Total</span>
                <strong>{formatNumber(distTotal)}</strong>
              </div>
            </div>
            <DonutLegend
              labels={distributionChart.labels}
              values={distributionChart.datasets[0].data}
              colors={distributionChart.datasets[0].backgroundColor}
            />
          </>
        ) : (
          <p className="nqs-ad-empty">No request distribution data available.</p>
        )
      ));
    }

    if (id === 'center_popularity') {
      return shell('Center Popularity', <CenterPopularityCard rows={centersChart.rows} />);
    }

    if (id === 'recent_activity') {
      return shell('Recent Activity', <RecentActivityCard logs={(adminStats?.recentLogs || []).slice(0, 6)} />);
    }

    if (id === 'queue_overview') {
      return shell('Live Queue Status', (
        <QueueOverviewCard queue={queue} nowServing={nowServingTicket} nextUp={nextUpTicket} />
      ), { className: 'nqs-ad-widget-live-queue' });
    }

    if (id === 'active_operators') {
      return shell('Active Operators', <ActiveOperatorsCard stats={operatorStats} />);
    }

    if (id === 'operational_insights') {
      return shell('Operational Insights', <OperationalInsightsCard insights={insights} />);
    }

    if (id === 'system_alerts') {
      return shell('System Alerts', <SystemAlertsCard insights={insights} />);
    }

    if (id === 'quick_actions') {
      return shell('Quick Actions', <QuickActionsCard />);
    }

    if (id === 'recent_appointments') {
      return (
        <div key={id} className="nqs-ad-slot nqs-ad-size-full" onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(id)}>
          <WidgetShell
            title="Upcoming Appointments"
            removable={false}
            dragHandleProps={dragProps}
            actions={(
              <>
                <Link to="/admin-appointments" className="nqs-ad-see-all">See All</Link>
                <button type="button" className="nqs-ad-ghost-btn" onClick={exportCsv}>
                  <FiDownload /> Export
                </button>
              </>
            )}
          >
            <div className="nqs-ad-table-filters">
              <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} aria-label="Status filter">
                <option value="">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={filters.serviceType} onChange={(e) => updateFilter('serviceType', e.target.value)} aria-label="Service filter">
                <option value="">All services</option>
                <option value="new_national_id">New Registration</option>
                <option value="update_information">Update Information</option>
                <option value="lost_replacement">Lost ID Replacement</option>
              </select>
              <select value={filters.district} onChange={(e) => updateFilter('district', e.target.value)} aria-label="District filter">
                <option value="">All districts</option>
                {districts.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
              <select value={filters.center} onChange={(e) => updateFilter('center', e.target.value)} aria-label="Center filter">
                <option value="">All centers</option>
                {centerOptions.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
              <input type="date" value={filters.date} onChange={(e) => updateFilter('date', e.target.value)} aria-label="Date filter" />
              <span className="nqs-ad-filter-hint"><FiFilter /> Filters</span>
            </div>

            {actionMessage ? <p className="nqs-ad-action-msg">{actionMessage}</p> : null}

            <div className="nqs-ad-table-wrap">
              <table>
                <thead>
                  <tr>
                    {['Request Number', 'Citizen Name', 'Service', 'Center', 'Appointment Date', 'Queue Number', 'Status', 'Actions'].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="nqs-ad-empty-cell">No appointments match the selected filters.</td>
                    </tr>
                  ) : visibleRows.map((appointment) => (
                    <tr key={appointment.id || appointment.ticketId}>
                      <td className="nqs-ad-ticket">{appointment.ticketId}</td>
                      <td>{appointment.citizenName}</td>
                      <td>{appointment.serviceType}</td>
                      <td>{appointment.centerName}</td>
                      <td>
                        <div className="nqs-ad-date-cell">
                          <span>{displayDate(appointment.date)}</span>
                          <small>{appointment.time || '--'}</small>
                        </div>
                      </td>
                      <td>{appointment.queueNumber}</td>
                      <td>
                        <span className={`nqs-ad-badge ${statusStyles[appointment.status] || 'nqs-ad-badge-blue'}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td>
                        <div className="nqs-ad-row-actions">
                          <Link to="/admin-appointments" className="nqs-ad-link-btn">View</Link>
                          <button
                            type="button"
                            disabled={actionBusy === `${appointment.id}-Completed`}
                            onClick={() => handleStatusAction(appointment, 'Completed')}
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy === `${appointment.id}-Cancelled`}
                            onClick={() => handleStatusAction(appointment, 'Cancelled')}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="nqs-ad-pagination">
              <span>
                Showing {filteredAppointments.length ? ((page - 1) * rowsPerPage) + 1 : 0}
                {' '}to {Math.min(page * rowsPerPage, filteredAppointments.length)} of {filteredAppointments.length}
              </span>
              <div className="nqs-ad-page-btns">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                  <FiChevronLeft />
                </button>
                <span>{page} / {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                  <FiChevronRight />
                </button>
              </div>
              <label>
                Rows
                <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}>
                  {[5, 10, 25].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
          </WidgetShell>
        </div>
      );
    }

    return null;
  };

  if (loading || recordsLoading) {
    return (
      <main className="nqs-admin-dashboard">
        <div className="nqs-ad-loading" role="status" aria-live="polite">
          <span className="nqs-ad-spinner" />
          Loading admin dashboard…
        </div>
      </main>
    );
  }

  return (
    <main className="nqs-admin-dashboard">
      <header className="nqs-ad-toolbar">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {adminName}! Here&apos;s what&apos;s happening with your National ID queue today.</p>
        </div>
        <div className="nqs-ad-toolbar-controls">
          <label className="nqs-ad-period-wrap">
            <FiCalendar aria-hidden="true" />
            <select
              value={filters.period}
              onChange={(e) => updateFilter('period', e.target.value)}
              aria-label="Date range filter"
              className="nqs-ad-period"
            >
              {periodOptions.map((period) => <option key={period} value={period}>{period}</option>)}
            </select>
          </label>
          <button type="button" className="nqs-ad-primary-btn" onClick={exportCsv}>
            <FiDownload /> Export
          </button>
          <button type="button" className="nqs-ad-ghost-btn" onClick={() => setAddOpen(true)}>
            <FiPlus /> Add Widget
          </button>
          <button
            type="button"
            className="nqs-ad-ghost-btn"
            onClick={() => setWidgetOrder(resetWidgetLayout())}
            aria-label="Reset dashboard layout"
          >
            <FiRefreshCw />
          </button>
        </div>
      </header>

      <div className="nqs-ad-search-row">
        <label className="nqs-ad-search">
          <FiSearch aria-hidden="true" />
          <input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search citizens, requests, appointments, centers..."
            aria-label="Global dashboard search"
          />
        </label>
      </div>

      {(recordsError) ? (
        <div className="nqs-ad-error" role="alert">
          <span>{recordsError}</span>
          <button type="button" onClick={loadRecords}>Retry</button>
        </div>
      ) : null}

      <div className="nqs-ad-grid">
        {widgetOrder.map((id) => renderWidget(id))}
      </div>

      {showCitizens && (
        <section ref={citizensRef} className="nqs-ad-section nqs-ad-citizens-section" style={{ marginTop: '24px' }}>
          <div className="nqs-ad-slot nqs-ad-size-full">
            <WidgetShell title="Registered Citizens" removable={true} onRemove={() => setShowCitizens(false)}>
              <div className="nqs-ad-table-wrap">
                {loadingCitizens ? <p style={{ padding: '24px' }}>Loading citizens...</p> : (
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>National ID</th>
                        <th>Registration Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citizensData.length === 0 ? (
                        <tr><td colSpan={5} className="nqs-ad-empty-cell">No citizens found.</td></tr>
                      ) : citizensData.map((c) => (
                        <tr key={c.id || c._id}>
                          <td>{c.username}</td>
                          <td>{c.name || c.citizenProfile?.fullName || '--'}</td>
                          <td>{c.phone || c.citizenProfile?.phone || '--'}</td>
                          <td>{c.nationalId || c.citizenProfile?.nationalId || '--'}</td>
                          <td>{displayDate(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </WidgetShell>
          </div>
        </section>
      )}

      <AddWidgetModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        order={widgetOrder}
        onAdd={addWidget}
        catalog={WIDGET_CATALOG}
      />

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
    </main>
  );
}

export default AdminDashboard;
