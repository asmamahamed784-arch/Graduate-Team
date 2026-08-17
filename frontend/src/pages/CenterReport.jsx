import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import {
  FaArrowLeft,
  FaArrowDown,
  FaArrowUp,
  FaBuilding,
  FaCalendarAlt,
  FaCheckDouble,
  FaClipboardList,
  FaClock,
  FaCreditCard,
  FaDownload,
  FaEdit,
  FaEye,
  FaFileDownload,
  FaMinus,
  FaPauseCircle,
  FaPhoneAlt,
  FaTimesCircle,
  FaUserCheck,
  FaUserClock,
  FaUserPlus,
  FaUsers
} from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
import api from '../api/axiosInstance';
import { useAuth, useCountUp } from '../hooks';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const idFrom = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const SERVICE_META = [
  { key: 'new_national_id', label: 'New National ID Registration', tone: 'blue', icon: FaUserPlus },
  { key: 'update_information', label: 'Update Information', tone: 'purple', icon: FaEdit },
  { key: 'lost_replacement', label: 'Lost ID Replacement', tone: 'orange', icon: FaCreditCard }
];

const dateKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const displayDate = (value) => {
  if (!value) return '--';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const timeAgo = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getServiceLabel = (requestType) => {
  const meta = SERVICE_META.find((section) => section.key === requestType);
  return meta ? meta.label : 'New National ID Registration';
};

const getDisplayStatus = (ticket = {}) => {
  const requestStatus = ticket.requestStatus || 'Pending';
  if (requestStatus === 'Resubmission Required') return 'Correction Required';
  if (/no\s*show/i.test(ticket.status || '')) return 'No Show';
  if (['Cancelled', 'Canceled', 'Rejected'].includes(ticket.status)) return 'Cancelled';
  if (ticket.status === 'Being Served' || ticket.status === 'In Progress') return 'Now Serving';
  return ticket.status || requestStatus || 'Waiting';
};

const getCitizenName = (ticket = {}) => (
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizen?.name ||
  ticket.citizenName ||
  'Citizen'
);

const getCitizenPhone = (ticket = {}) => (
  ticket.registrationDetails?.phone ||
  ticket.replacementDetails?.phone ||
  ticket.updateDetails?.phone ||
  ticket.citizen?.phone ||
  '--'
);

function AnimatedValue({ value }) {
  const animated = useCountUp(Number(value) || 0);
  return animated.toLocaleString();
}

function Trend({ percent }) {
  if (percent === null || Number.isNaN(percent)) {
    return <span className="nqs-cr-trend nqs-cr-trend-flat"><FaMinus /> No change</span>;
  }
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) {
    return <span className="nqs-cr-trend nqs-cr-trend-flat"><FaMinus /> No change</span>;
  }
  const up = rounded > 0;
  return (
    <span className={up ? 'nqs-cr-trend nqs-cr-trend-up' : 'nqs-cr-trend nqs-cr-trend-down'}>
      {up ? <FaArrowUp /> : <FaArrowDown />} {Math.abs(rounded)}% vs last week
    </span>
  );
}

export default function CenterReport() {
  const { centerId: routeCenterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isScopedManager = user?.role === 'super_operator' || user?.role === 'center_manager';
  const ownCenterId = idFrom(user?.center) || idFrom(user?.assignedCenter) || user?.centerId || user?.assignedCenterId || '';
  // A scoped manager viewing their own "My Report" link (no :centerId in the URL) always resolves to
  // their own center. Only an explicit, mismatched :centerId in the URL is treated as forbidden — the
  // backend independently re-enforces this on every data fetch regardless of what the frontend does.
  const isForbidden = isScopedManager && ownCenterId && routeCenterId && String(ownCenterId) !== String(routeCenterId);
  const centerId = routeCenterId || (isScopedManager ? ownCenterId : '');
  const [center, setCenter] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeLabel, setRangeLabel] = useState('This Week');
  const [raSearch, setRaSearch] = useState('');
  const [raService, setRaService] = useState('');
  const [raStatus, setRaStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [centersRes, ticketsRes, operatorsRes] = await Promise.all([
        apiClient.get('/api/centers/list'),
        api.get('/api/bookings/admin/all', { params: { center: centerId } }),
        api.get('/api/operators').catch(() => ({ data: { data: [] } }))
      ]);
      const centerRows = Array.isArray(centersRes.data?.data)
        ? centersRes.data.data
        : Array.isArray(centersRes.data)
          ? centersRes.data
          : [];
      const matchedCenter = centerRows.find((row) => String(row._id || row.id) === String(centerId));
      setCenter(matchedCenter || null);

      const rawTickets = Array.isArray(ticketsRes.data?.data) ? ticketsRes.data.data : [];
      setTickets(rawTickets);

      const allOperators = Array.isArray(operatorsRes.data?.data) ? operatorsRes.data.data : [];
      const centerOperators = allOperators.filter((op) => {
        const opCenterId = typeof op.center === 'object' ? (op.center?.id || op.center?._id) : op.center;
        return String(opCenterId || '') === String(centerId);
      });
      setOperators(centerOperators);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load this center report.');
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    if (isForbidden) { setLoading(false); return; }
    load();
  }, [load, isForbidden]);

  const todayKey = dateKey(new Date());
  const weekStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6);
    return dateKey(date);
  }, []);
  const lastWeekStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 13);
    return dateKey(date);
  }, []);
  const monthStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    return dateKey(date);
  }, []);

  const thisWeekTickets = useMemo(() => tickets.filter((t) => t.date >= weekStart), [tickets, weekStart]);
  const lastWeekTickets = useMemo(
    () => tickets.filter((t) => t.date >= lastWeekStart && t.date < weekStart),
    [tickets, lastWeekStart, weekStart]
  );

  const periodTickets = useMemo(() => {
    if (rangeLabel === 'Today') return tickets.filter((t) => t.date === todayKey);
    if (rangeLabel === 'This Month') return tickets.filter((t) => t.date >= monthStart);
    return tickets.filter((t) => t.date >= weekStart);
  }, [tickets, rangeLabel, todayKey, monthStart, weekStart]);

  const pctChange = useCallback((current, previous) => {
    if (!previous) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  }, []);

  const countBy = (list, predicate) => list.filter(predicate).length;
  const isWaiting = (t) => t.status === 'Waiting' || t.status === 'Pending';
  const isCompleted = (t) => t.status === 'Completed';
  const isCancelled = (t) => ['Cancelled', 'Canceled', 'Rejected'].includes(t.status);
  const isCorrection = (t) => t.requestStatus === 'Resubmission Required';
  const isNoShow = (t) => /no\s*show/i.test(t.status || '');
  const isServing = (t) => t.status === 'Being Served' || t.status === 'In Progress';

  const kpis = useMemo(() => {
    const total = periodTickets.length;
    const waiting = countBy(periodTickets, isWaiting);
    const completed = countBy(periodTickets, isCompleted);
    const cancelled = countBy(periodTickets, isCancelled);
    const correction = countBy(periodTickets, isCorrection);
    const noShow = countBy(periodTickets, isNoShow);
    const citizensServed = new Set(
      periodTickets.filter(isCompleted).map((t) => getCitizenPhone(t) || getCitizenName(t))
    ).size;

    const twTotal = thisWeekTickets.length;
    const lwTotal = lastWeekTickets.length;
    const twWaiting = countBy(thisWeekTickets, isWaiting);
    const lwWaiting = countBy(lastWeekTickets, isWaiting);
    const twCompleted = countBy(thisWeekTickets, isCompleted);
    const lwCompleted = countBy(lastWeekTickets, isCompleted);
    const twCancelled = countBy(thisWeekTickets, isCancelled);
    const lwCancelled = countBy(lastWeekTickets, isCancelled);
    const twCorrection = countBy(thisWeekTickets, isCorrection);
    const lwCorrection = countBy(lastWeekTickets, isCorrection);
    const twNoShow = countBy(thisWeekTickets, isNoShow);
    const lwNoShow = countBy(lastWeekTickets, isNoShow);
    const twServed = new Set(thisWeekTickets.filter(isCompleted).map((t) => getCitizenPhone(t) || getCitizenName(t))).size;
    const lwServed = new Set(lastWeekTickets.filter(isCompleted).map((t) => getCitizenPhone(t) || getCitizenName(t))).size;

    return {
      total, waiting, completed, cancelled, correction, noShow, citizensServed,
      operators: operators.length,
      trend: {
        total: pctChange(twTotal, lwTotal),
        waiting: pctChange(twWaiting, lwWaiting),
        completed: pctChange(twCompleted, lwCompleted),
        cancelled: pctChange(twCancelled, lwCancelled),
        correction: pctChange(twCorrection, lwCorrection),
        noShow: pctChange(twNoShow, lwNoShow),
        citizensServed: pctChange(twServed, lwServed)
      }
    };
  }, [periodTickets, thisWeekTickets, lastWeekTickets, operators.length, pctChange]);

  const serviceBreakdown = useMemo(() => SERVICE_META.map((meta) => {
    const items = periodTickets.filter((t) => t.requestType === meta.key);
    return {
      ...meta,
      total: items.length,
      waiting: countBy(items, isWaiting),
      completed: countBy(items, isCompleted),
      cancelled: countBy(items, isCancelled)
    };
  }), [periodTickets]);

  const activityDays = useMemo(() => {
    const monday = new Date();
    monday.setDate(monday.getDate() - 6);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { key: dateKey(date), label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    });
  }, []);

  const activityChart = useMemo(() => ({
    labels: activityDays.map((d) => d.label),
    datasets: [
      {
        label: 'New Registration',
        data: activityDays.map((d) => tickets.filter((t) => t.date === d.key && t.requestType === 'new_national_id').length),
        backgroundColor: '#1F6FC2',
        borderRadius: 6,
        maxBarThickness: 20
      },
      {
        label: 'Update Information',
        data: activityDays.map((d) => tickets.filter((t) => t.date === d.key && t.requestType === 'update_information').length),
        backgroundColor: '#8B5CF6',
        borderRadius: 6,
        maxBarThickness: 20
      },
      {
        label: 'Lost ID Replacement',
        data: activityDays.map((d) => tickets.filter((t) => t.date === d.key && t.requestType === 'lost_replacement').length),
        backgroundColor: '#F59E0B',
        borderRadius: 6,
        maxBarThickness: 20
      },
      {
        label: 'Completed',
        data: activityDays.map((d) => tickets.filter((t) => t.date === d.key && isCompleted(t)).length),
        backgroundColor: '#22C55E',
        borderRadius: 6,
        maxBarThickness: 20
      }
    ]
  }), [activityDays, tickets]);

  const activityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { color: 'var(--ad-muted)', usePointStyle: true, boxWidth: 8, padding: 14, font: { size: 11 } }
      }
    },
    scales: {
      x: { ticks: { color: 'var(--ad-muted)' }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: 'var(--ad-muted)' }, grid: { color: 'rgba(15, 45, 87, 0.06)' } }
    }
  };

  const queueOverview = useMemo(() => {
    const waitingList = tickets.filter(isWaiting);
    const servingTicket = tickets.find(isServing);
    const onHold = countBy(tickets, (t) => t.status === 'On Hold');
    const noShowToday = countBy(tickets, (t) => isNoShow(t) && t.date === todayKey);
    const completedToday = countBy(tickets, (t) => isCompleted(t) && t.date === todayKey);
    const now = Date.now();
    const elapsedMinutes = waitingList
      .map((t) => (t.createdAt ? Math.max(0, Math.round((now - new Date(t.createdAt).getTime()) / 60000)) : null))
      .filter((v) => v !== null);
    const avgWait = elapsedMinutes.length ? Math.round(elapsedMinutes.reduce((a, b) => a + b, 0) / elapsedMinutes.length) : 0;
    const longestWait = elapsedMinutes.length ? Math.max(...elapsedMinutes) : 0;

    return {
      current: waitingList[0]?.ref || '--',
      serving: servingTicket?.ref || '--',
      onHold,
      noShowToday,
      completedToday,
      avgWait,
      longestWait
    };
  }, [tickets, todayKey]);

  const capacity = useMemo(() => {
    const dailyCapacity = center?.capacity || center?.schedule?.maxAppointmentsPerDay || 100;
    const bookedToday = countBy(tickets, (t) => t.date === todayKey);
    const percent = dailyCapacity ? Math.min(100, Math.round((bookedToday / dailyCapacity) * 100)) : 0;
    return {
      dailyCapacity,
      bookedToday,
      remaining: Math.max(0, dailyCapacity - bookedToday),
      percent
    };
  }, [center, tickets, todayKey]);

  const capacityChart = {
    labels: ['Used', 'Remaining'],
    datasets: [{
      data: [capacity.percent, Math.max(0, 100 - capacity.percent)],
      backgroundColor: [capacity.percent >= 90 ? '#EF4444' : capacity.percent >= 70 ? '#F59E0B' : '#22C55E', 'rgba(148, 163, 184, 0.22)'],
      borderWidth: 0
    }]
  };

  const statusDistribution = useMemo(() => {
    const rows = [
      { label: 'Waiting', value: kpis.waiting, color: '#60A5FA' },
      { label: 'Completed', value: kpis.completed, color: '#22C55E' },
      { label: 'Cancelled', value: kpis.cancelled, color: '#F472B6' },
      { label: 'No Show', value: kpis.noShow, color: '#EF4444' }
    ];
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return { rows, total };
  }, [kpis]);

  const serviceDistribution = useMemo(() => {
    const total = serviceBreakdown.reduce((sum, row) => sum + row.total, 0);
    return { rows: serviceBreakdown, total };
  }, [serviceBreakdown]);

  const operatorRoster = useMemo(() => operators.map((op) => ({
    id: op.id || op._id,
    name: op.name || op.username || 'Operator',
    role: op.operatorType === 'center_manager' || op.role === 'center_manager' || op.role === 'super_operator' ? 'Center Manager' : 'Operator',
    status: op.status === 'active' ? 'Online' : 'Offline'
  })), [operators]);

  const raStatusOptions = useMemo(() => (
    [...new Set(tickets.map((t) => getDisplayStatus(t)).filter(Boolean))].sort()
  ), [tickets]);

  const recentAppointments = useMemo(() => {
    const term = raSearch.trim().toLowerCase();
    return [...periodTickets]
      .filter((t) => !raService || t.requestType === raService)
      .filter((t) => !raStatus || getDisplayStatus(t) === raStatus)
      .filter((t) => {
        if (!term) return true;
        return (
          String(t.ref || '').toLowerCase().includes(term) ||
          getCitizenName(t).toLowerCase().includes(term) ||
          getCitizenPhone(t).toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8);
  }, [periodTickets, raSearch, raService, raStatus]);

  const raFiltersActive = Boolean(raSearch || raService || raStatus);

  const recentActivity = useMemo(() => {
    const events = tickets.map((t) => {
      if (isServing(t)) return { ref: t.ref, text: `Appointment ${t.ref} is now being served`, time: t.updatedAt };
      if (isCompleted(t)) return { ref: t.ref, text: `Appointment ${t.ref} was completed`, time: t.completedAt || t.updatedAt };
      if (isCorrection(t)) return { ref: t.ref, text: `Correction request submitted for ${t.ref}`, time: t.updatedAt };
      if (isCancelled(t)) return { ref: t.ref, text: `Appointment ${t.ref} was cancelled`, time: t.cancelledAt || t.updatedAt };
      return { ref: t.ref, text: `New appointment ${t.ref} was created`, time: t.createdAt };
    });
    return events
      .filter((event) => event.time)
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6);
  }, [tickets]);

  const exportCsv = () => {
    const headings = ['Request', 'Full Name', 'Phone', 'Service', 'Date', 'Queue', 'Status'];
    const rows = periodTickets.map((t) => [
      t.ref, getCitizenName(t), getCitizenPhone(t), getServiceLabel(t.requestType), displayDate(t.date), t.queueNumber || '--', getDisplayStatus(t)
    ]);
    const csv = [headings, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${center?.name || 'center'}-report-${todayKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => window.print();

  const centerName = center?.name || 'Service Center';
  const centerStatus = center?.status || 'Active';
  const backTarget = isScopedManager ? '/dashboard/operator' : '/center-management';

  if (isForbidden) {
    return (
      <main className="nqs-admin-dashboard">
        <div className="nqs-ad-widget" style={{ maxWidth: 480, margin: '48px auto', textAlign: 'center' }}>
          <div className="nqs-ad-widget-body !pt-6">
            <p className="text-sm font-bold" style={{ color: 'var(--ad-navy)' }}>You can only view the report for your own center.</p>
            <button type="button" onClick={() => navigate(backTarget)} className="nqs-ad-primary-btn" style={{ margin: '16px auto 0' }}>
              <FaArrowLeft /> Back to my dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="nqs-admin-dashboard">
        <div className="nqs-ad-loading" role="status" aria-live="polite">
          <span className="nqs-ad-spinner" />
          Loading center report…
        </div>
      </main>
    );
  }

  return (
    <main className="nqs-admin-dashboard nqs-center-report">
      <header className="nqs-ad-toolbar">
        <div>
          <button type="button" onClick={() => navigate(backTarget)} className="nqs-cr-back">
            <FaArrowLeft /> Back
          </button>
          <h1>Center Report</h1>
          <p>Home / Service Centers / Center Report</p>
        </div>
        <div className="nqs-ad-toolbar-controls">
          <label className="nqs-ad-period-wrap">
            <FaCalendarAlt aria-hidden="true" />
            <select value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)} className="nqs-ad-period" aria-label="Date range">
              {['Today', 'This Week', 'This Month'].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <button type="button" className="nqs-ad-ghost-btn" onClick={printReport}>
            <FaFileDownload /> Export PDF
          </button>
          <button type="button" className="nqs-ad-primary-btn" style={{ background: '#16A34A' }} onClick={exportCsv}>
            <FaDownload /> Export Excel
          </button>
        </div>
      </header>

      {error && <p className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      <div className="nqs-ad-widget nqs-cr-header-card">
        <div className="nqs-ad-widget-body flex flex-wrap items-center gap-6 !pt-5">
          <span className="nqs-ad-stat-icon nqs-card-tone-icon-blue" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
            <FaBuilding />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-lg" style={{ color: 'var(--ad-navy)' }}>{centerName}</strong>
              <span className="nqs-badge-tone-green" style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{centerStatus}</span>
            </div>
          </div>
          <div className="nqs-cr-header-fields">
            <div><span>District</span><strong>{center?.district || '--'}</strong></div>
            <div><span>Address</span><strong>{center?.address || '--'}</strong></div>
            <div><span>Phone</span><strong><FaPhoneAlt className="inline text-[#1F6FC2]" /> {center?.phone || '--'}</strong></div>
            <div><span>Working Days</span><strong>{center?.schedule?.workingDays?.join(', ') || 'Sun - Thu'}</strong></div>
            <div><span>Opening Time</span><strong>{center?.startTime || '08:00 AM'}</strong></div>
            <div><span>Closing Time</span><strong>{center?.endTime || '04:00 PM'}</strong></div>
            <div><span>Daily Capacity</span><strong>{capacity.dailyCapacity}</strong></div>
            <div><span>Total Staff</span><strong>{operators.length}</strong></div>
          </div>
        </div>
      </div>

      <div className="nqs-ad-stat-grid">
        <div className="nqs-ad-stat nqs-ad-stat-blue">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">Total Appointments</span><span className="nqs-ad-stat-icon"><FaClipboardList /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.total} /></strong>
          <Trend percent={kpis.trend.total} />
        </div>
        <div className="nqs-ad-stat nqs-ad-stat-orange">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">Waiting</span><span className="nqs-ad-stat-icon"><FaUserClock /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.waiting} /></strong>
          <Trend percent={kpis.trend.waiting} />
        </div>
        <div className="nqs-ad-stat nqs-ad-stat-green">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">Completed</span><span className="nqs-ad-stat-icon"><FaCheckDouble /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.completed} /></strong>
          <Trend percent={kpis.trend.completed} />
        </div>
        <div className="nqs-ad-stat nqs-ad-stat-pink">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">Cancelled</span><span className="nqs-ad-stat-icon"><FaTimesCircle /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.cancelled} /></strong>
          <Trend percent={kpis.trend.cancelled} />
        </div>
        <div className="nqs-ad-stat nqs-ad-stat-pink">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">No Show</span><span className="nqs-ad-stat-icon"><FaTimesCircle /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.noShow} /></strong>
          <Trend percent={kpis.trend.noShow} />
        </div>
        <div className="nqs-ad-stat nqs-ad-stat-cyan">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">Citizens Served</span><span className="nqs-ad-stat-icon"><FaUsers /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.citizensServed} /></strong>
          <Trend percent={kpis.trend.citizensServed} />
        </div>
        <div className="nqs-ad-stat nqs-ad-stat-orange">
          <div className="nqs-ad-stat-top"><span className="nqs-ad-stat-label">Total Operators</span><span className="nqs-ad-stat-icon"><FaUserCheck /></span></div>
          <strong className="nqs-ad-stat-value"><AnimatedValue value={kpis.operators} /></strong>
          <Trend percent={null} />
        </div>
      </div>

      <div className="nqs-ad-service-grid">
        {serviceBreakdown.map((service, index) => (
          <div key={service.key} className={`nqs-ad-service-card nqs-ad-service-${service.tone} nqs-cr-service-card`}>
            <div className="nqs-cr-service-head">
              <span className="nqs-cr-service-badge">{index + 1}</span>
              <p className="text-xs font-black uppercase tracking-wide">{service.label}</p>
              <Link
                to={isScopedManager ? `/dashboard/operator?requestType=${service.key}` : `/admin-appointments?requestType=${service.key}&center=${centerId}`}
                className="nqs-cr-view-details"
              >
                View Details
              </Link>
            </div>
            <div className="nqs-cr-service-metrics">
              <div><strong><AnimatedValue value={service.total} /></strong><span>Total Requests</span></div>
              <div><strong><AnimatedValue value={service.waiting} /></strong><span>Waiting</span></div>
              <div><strong><AnimatedValue value={service.completed} /></strong><span>Completed</span></div>
              <div><strong><AnimatedValue value={service.cancelled} /></strong><span>Cancelled</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head"><div><h3>Appointment Activity</h3></div></div>
          <div className="nqs-ad-widget-body">
            <div className="nqs-ad-chart-canvas" style={{ height: 260 }}>
              <Bar data={activityChart} options={activityOptions} />
            </div>
          </div>
        </div>

        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head"><div><h3>Queue Overview</h3></div><span className="nqs-cr-live-badge"><span className="nqs-ad-live-dot" /> Live</span></div>
          <div className="nqs-ad-widget-body nqs-cr-queue-grid">
            <div><span className="nqs-ad-stat-icon nqs-card-tone-icon-blue"><FaClipboardList /></span><div><strong>{queueOverview.current}</strong><span>Current Queue</span></div></div>
            <div><span className="nqs-ad-stat-icon nqs-card-tone-icon-green"><FaPhoneAlt /></span><div><strong>{queueOverview.serving}</strong><span>Now Serving</span></div></div>
            <div><span className="nqs-ad-stat-icon nqs-card-tone-icon-orange"><FaPauseCircle /></span><div><strong><AnimatedValue value={queueOverview.onHold} /></strong><span>On Hold</span></div></div>
            <div><span className="nqs-ad-stat-icon nqs-card-tone-icon-pink"><FaTimesCircle /></span><div><strong><AnimatedValue value={queueOverview.noShowToday} /></strong><span>No Show</span></div></div>
            <div><span className="nqs-ad-stat-icon nqs-card-tone-icon-green"><FaCheckDouble /></span><div><strong><AnimatedValue value={queueOverview.completedToday} /></strong><span>Completed Today</span></div></div>
            <div className="nqs-cr-queue-time">
              <span>Average Waiting Time</span><strong>{queueOverview.avgWait} mins</strong>
            </div>
            <div className="nqs-cr-queue-time">
              <span>Longest Waiting</span><strong>{queueOverview.longestWait} mins</strong>
            </div>
          </div>
        </div>

        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head"><div><h3>Center Capacity</h3></div></div>
          <div className="nqs-ad-widget-body">
            <div className="nqs-ad-donut-wrap">
              <div className="nqs-ad-chart-canvas nqs-ad-chart-donut">
                <Doughnut data={capacityChart} options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }} />
              </div>
              <div className="nqs-ad-donut-center">
                <strong>{capacity.percent}%</strong>
                <span>Capacity Used</span>
              </div>
            </div>
            <ul className="nqs-cr-capacity-list">
              <li><span>Daily Capacity</span><strong>{capacity.dailyCapacity}</strong></li>
              <li><span>Appointments Booked</span><strong>{capacity.bookedToday}</strong></li>
              <li><span>Remaining Slots</span><strong>{capacity.remaining}</strong></li>
            </ul>
            <p className={`nqs-cr-capacity-note ${capacity.percent >= 90 ? 'is-high' : capacity.percent >= 70 ? 'is-mid' : 'is-good'}`}>
              {capacity.percent >= 90 ? 'Near full capacity for today.' : capacity.percent >= 70 ? 'Approaching daily capacity.' : 'Good! Capacity is within normal limits.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head">
            <div><h3>Operator Performance</h3></div>
            <Link to="/operator-management" className="nqs-ad-see-all">View All Operators</Link>
          </div>
          <div className="nqs-ad-widget-body">
            {operatorRoster.length === 0 ? (
              <p className="nqs-ad-empty">No operators assigned to this center yet.</p>
            ) : (
              <div className="nqs-ad-table-wrap">
                <table className="nqs-cr-operator-table">
                  <thead>
                    <tr><th>Operator</th><th>Role</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {operatorRoster.map((op) => (
                      <tr key={op.id}>
                        <td className="nqs-ad-center-perf-name">{op.name}</td>
                        <td>{op.role}</td>
                        <td><span className={op.status === 'Online' ? 'nqs-badge-tone-green' : 'nqs-badge-tone-pink'} style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{op.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head"><div><h3>Status Distribution</h3></div></div>
          <div className="nqs-ad-widget-body">
            {statusDistribution.total > 0 ? (
              <>
                <div className="nqs-ad-donut-wrap">
                  <div className="nqs-ad-chart-canvas nqs-ad-chart-donut">
                    <Doughnut
                      data={{ labels: statusDistribution.rows.map((r) => r.label), datasets: [{ data: statusDistribution.rows.map((r) => r.value), backgroundColor: statusDistribution.rows.map((r) => r.color), borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }}
                    />
                  </div>
                  <div className="nqs-ad-donut-center"><span>Total</span><strong>{statusDistribution.total}</strong></div>
                </div>
                <ul className="nqs-ad-donut-legend">
                  {statusDistribution.rows.map((row) => (
                    <li key={row.label}>
                      <span className="nqs-ad-dot" style={{ background: row.color }} />
                      <span className="nqs-ad-donut-legend-label">{row.label}</span>
                      <strong>{Math.round((row.value / statusDistribution.total) * 100)}%</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="nqs-ad-empty">No appointments recorded yet.</p>}
          </div>
        </div>

        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head"><div><h3>Service Distribution</h3></div></div>
          <div className="nqs-ad-widget-body">
            {serviceDistribution.total > 0 ? (
              <>
                <div className="nqs-ad-donut-wrap">
                  <div className="nqs-ad-chart-canvas nqs-ad-chart-donut">
                    <Doughnut
                      data={{ labels: serviceDistribution.rows.map((r) => r.label), datasets: [{ data: serviceDistribution.rows.map((r) => r.total), backgroundColor: ['#1F6FC2', '#8B5CF6', '#F59E0B'], borderWidth: 0 }] }}
                      options={{ responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }}
                    />
                  </div>
                  <div className="nqs-ad-donut-center"><span>Total</span><strong>{serviceDistribution.total}</strong></div>
                </div>
                <ul className="nqs-ad-donut-legend">
                  {serviceDistribution.rows.map((row, index) => (
                    <li key={row.key}>
                      <span className="nqs-ad-dot" style={{ background: ['#1F6FC2', '#8B5CF6', '#F59E0B'][index] }} />
                      <span className="nqs-ad-donut-legend-label">{row.label}</span>
                      <strong>{Math.round((row.total / serviceDistribution.total) * 100)}%</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="nqs-ad-empty">No requests recorded yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="nqs-ad-widget xl:col-span-2">
          <div className="nqs-ad-widget-head"><div><h3>Recent Appointments</h3></div></div>
          <div className="nqs-ad-widget-body">
            <div className="nqs-ad-table-filters">
              <input
                type="text"
                value={raSearch}
                onChange={(e) => setRaSearch(e.target.value)}
                placeholder="Search request, citizen, or phone…"
                aria-label="Search appointments"
              />
              <select value={raService} onChange={(e) => setRaService(e.target.value)} aria-label="Service filter">
                <option value="">All services</option>
                {SERVICE_META.map((service) => <option key={service.key} value={service.key}>{service.label}</option>)}
              </select>
              <select value={raStatus} onChange={(e) => setRaStatus(e.target.value)} aria-label="Status filter">
                <option value="">All statuses</option>
                {raStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            {recentAppointments.length === 0 ? (
              <p className="nqs-ad-empty">{raFiltersActive ? 'No appointments match these filters.' : 'No appointments recorded yet.'}</p>
            ) : (
              <div className="nqs-ad-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {['Request', 'Full Name', 'Phone', 'Service', 'Date & Time', 'Queue', 'Status', 'Actions'].map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {recentAppointments.map((ticket) => (
                      <tr key={ticket.id || ticket._id || ticket.ref}>
                        <td className="nqs-ad-ticket">{ticket.ref}</td>
                        <td>{getCitizenName(ticket)}</td>
                        <td>{getCitizenPhone(ticket)}</td>
                        <td>{getServiceLabel(ticket.requestType)}</td>
                        <td>
                          <div className="nqs-ad-date-cell">
                            <span>{displayDate(ticket.date)}</span>
                            <small>{ticket.timeSlot || '--'}</small>
                          </div>
                        </td>
                        <td>{ticket.queueNumber || '--'}</td>
                        <td><span className={`nqs-ad-badge nqs-ad-badge-${getDisplayStatus(ticket) === 'Completed' ? 'green' : getDisplayStatus(ticket) === 'Cancelled' ? 'rose' : getDisplayStatus(ticket) === 'Now Serving' ? 'blue' : 'amber'}`}>{getDisplayStatus(ticket)}</span></td>
                        <td>
                          <Link
                            to={isScopedManager ? `/dashboard/operator?ticket=${encodeURIComponent(ticket.ref)}` : `/admin-appointments/citizen/${encodeURIComponent(ticket.citizen?.id || ticket.ref)}`}
                            className="nqs-ad-link-btn"
                          >
                            <FaEye /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="nqs-ad-widget xl:col-span-1">
          <div className="nqs-ad-widget-head"><div><h3>Recent Activity</h3></div></div>
          <div className="nqs-ad-widget-body">
            {recentActivity.length === 0 ? (
              <p className="nqs-ad-empty">No recent activity yet.</p>
            ) : (
              <ul className="nqs-ad-activity-list">
                {recentActivity.map((event) => (
                  <li key={`${event.ref}-${event.text}`}>
                    <span className="nqs-ad-activity-dot"><FaClock /></span>
                    <div>
                      <p>{event.text}</p>
                      <span>{timeAgo(event.time)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
