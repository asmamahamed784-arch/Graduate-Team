import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  Filler,
} from 'chart.js';
import {
  FaChartLine,
  FaClock,
  FaClipboardList,
  FaDownload,
  FaFilePdf,
  FaFilter,
  FaLock,
  FaShieldAlt,
  FaTable,
  FaUserCog,
  FaUsers,
} from 'react-icons/fa';
import api from '../api/axiosInstance';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const reportCards = [
  {
    title: 'Reports Home',
    description: 'Dashboard overview and key National ID service numbers.',
    path: '/dashboard/admin/reports',
    icon: FaChartLine,
  },
  {
    title: 'Applications & Requests',
    description: 'Track all National ID requests by type, center, date, and status.',
    path: '/dashboard/admin/reports/applications',
    icon: FaClipboardList,
  },
  {
    title: 'Operator Performance',
    description: 'Review operator activity, completed tickets, and service timing.',
    path: '/dashboard/admin/reports/operators',
    icon: FaUserCog,
  },
  {
    title: 'Citizen Demographics',
    description: 'Understand citizen requests by gender, age group, district, and center.',
    path: '/dashboard/admin/reports/citizens',
    icon: FaUsers,
  },
  {
    title: 'Security & Audit',
    description: 'Read-only audit report for login, admin, operator, and security events.',
    path: '/dashboard/admin/reports/security',
    icon: FaShieldAlt,
  },
];

const requestTypeLabels = {
  new_national_id: 'New ID Registration',
  lost_replacement: 'Lost ID Replacement',
  update_information: 'Update Information',
};

const chartColors = ['#2563eb', '#059669', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2', '#16a34a'];

const initialFilters = {
  service: '',
  district: '',
  center: '',
  status: '',
  requestType: '',
  requestStatus: '',
  resubmissionOnly: '',
  startDate: '',
  endDate: '',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const getPayload = (response) => response.data?.data || response.data || [];

const safeArray = (value) => (Array.isArray(value) ? value : []);

const toDateKey = (date) => date.toISOString().slice(0, 10);

const todayKey = toDateKey(new Date());

const parseWaitMinutes = (value) => {
  const minutes = Number.parseInt(String(value || '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(minutes) ? minutes : 0;
};

const minutesBetween = (start, end) => {
  const startMs = start ? new Date(start).getTime() : NaN;
  const endMs = end ? new Date(end).getTime() : NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60000);
};

const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const serviceName = (ticket) => ticket.service?.name || ticket.serviceName || 'National ID Service';

const centerName = (ticket) => ticket.center?.name || ticket.centerName || 'Not assigned';

const citizenName = (ticket) => (
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizen?.name ||
  ticket.citizenName ||
  'No data'
);

const normalizeGender = (value) => {
  const gender = String(value || '').trim().toLowerCase();
  if (['male', 'm'].includes(gender)) return 'male';
  if (['female', 'f'].includes(gender)) return 'female';
  return 'not_provided';
};

const citizenGenderKey = (ticket) => normalizeGender(ticket.registrationDetails?.gender || ticket.gender);

const citizenGender = (ticket) => {
  const gender = citizenGenderKey(ticket);
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  return 'Not provided';
};

const citizenDistrict = (ticket) => (
  ticket.district ||
  ticket.registrationDetails?.district ||
  ticket.registrationDetails?.centerDistrict ||
  ticket.replacementDetails?.district ||
  ticket.updateDetails?.district ||
  ticket.center?.district ||
  'Not provided'
);

const districtBreakdownRows = (rows) => Object.values(rows.reduce((map, ticket) => {
  const district = citizenDistrict(ticket);
  if (!map[district]) {
    map[district] = { label: district, count: 0, waiting: 0, completed: 0, cancelled: 0 };
  }
  map[district].count += 1;
  if (ticket.status === 'Waiting') map[district].waiting += 1;
  if (ticket.status === 'Completed' || ticket.requestStatus === 'Completed') map[district].completed += 1;
  if (ticket.status === 'Cancelled') map[district].cancelled += 1;
  return map;
}, {}));

const roleName = (value) => String(value || '').replace('_', ' ');

const makeCountMap = (rows, selector) => rows.reduce((map, row) => {
  const key = selector(row) || 'Not available';
  map[key] = (map[key] || 0) + 1;
  return map;
}, {});

const mapToChartRows = (map) => Object.entries(map).map(([label, count]) => ({ label, count }));

const average = (values) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
};

const filterTickets = (tickets, filters) => tickets.filter((ticket) => {
  if (filters.service && serviceName(ticket) !== filters.service) return false;
  if (filters.district && citizenDistrict(ticket) !== filters.district) return false;
  if (filters.center && centerName(ticket) !== filters.center) return false;
  if (filters.status && ticket.status !== filters.status) return false;
  if (filters.requestType && ticket.requestType !== filters.requestType) return false;
  if (filters.requestStatus && ticket.requestStatus !== filters.requestStatus) return false;
  if (
    filters.resubmissionOnly &&
    !ticket.needsResubmission &&
    ticket.requestStatus !== 'Resubmission Required' &&
    !ticket.resubmissionHistory?.length
  ) return false;
  if (filters.startDate && ticket.date < filters.startDate) return false;
  if (filters.endDate && ticket.date > filters.endDate) return false;
  return true;
});

const csvDownload = (filename, rows) => {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: { ticks: { color: '#475569', font: { size: 11 } }, grid: { display: false } },
    y: { ticks: { color: '#475569', font: { size: 11 } }, grid: { color: 'rgba(148,163,184,0.25)' } },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: '#334155', padding: 14, font: { size: 11 } },
    },
  },
};

const barData = (rows, label = 'Total') => ({
  labels: rows.map((row) => row.label),
  datasets: [{
    label,
    data: rows.map((row) => row.count),
    backgroundColor: chartColors,
    borderRadius: 8,
  }],
});

const doughnutData = (rows) => ({
  labels: rows.map((row) => row.label),
  datasets: [{
    data: rows.map((row) => row.count),
    backgroundColor: chartColors,
    borderWidth: 0,
  }],
});

const PageShell = ({ title, description, children, actions }) => (
  <motion.div
    className="min-h-screen bg-[#f5f8fc] p-3 text-slate-900 sm:p-4 lg:p-5"
    variants={container}
    initial="hidden"
    animate="show"
  >
    <div className="mx-auto max-w-none space-y-4">
      <motion.div variants={item} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Admin Reports</p>
          <h1 className="mt-1 text-xl font-black text-[#0B3A75] sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </motion.div>
      {children}
    </div>
  </motion.div>
);

const StatCard = ({ label, value, icon: Icon, accent = 'blue', to, onClick, active = false }) => {
  const colors = {
    blue: 'border-blue-600 bg-blue-50 text-blue-700',
    green: 'border-emerald-600 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-500 bg-amber-50 text-amber-700',
    red: 'border-red-500 bg-red-50 text-red-700',
    navy: 'border-[#0B3A75] bg-slate-50 text-[#0B3A75]',
  };
  const interactive = Boolean(to || onClick);

  const content = (
    <div className={`h-full rounded-xl border-l-4 bg-white p-4 shadow-sm transition ${interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''} ${active ? 'ring-2 ring-blue-600 ring-offset-2' : ''} ${colors[accent] || colors.blue}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[accent] || colors.blue}`}>
          <Icon className="text-lg" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-black text-slate-950">{value}</p>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div variants={item}>
      {to ? (
        <Link to={to} className="block h-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          {content}
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="block h-full w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {content}
        </button>
      ) : content}
    </motion.div>
  );
};

const ChartCard = ({ title, children }) => (
  <motion.div variants={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="text-sm font-black text-[#0B3A75]">{title}</h2>
    </div>
    <div className="h-72 p-4">{children}</div>
  </motion.div>
);

const ExportActions = ({ onExport, pdfLabel = 'PDF export not configured' }) => (
  <>
    <button
      type="button"
      onClick={onExport}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
    >
      <FaDownload /> Export CSV
    </button>
    <button
      type="button"
      disabled
      title={pdfLabel}
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-400"
    >
      <FaFilePdf /> PDF
    </button>
  </>
);

const Filters = ({ filters, setFilters, options, showRequestType = true }) => (
  <motion.div variants={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#0B3A75]">
      <FaFilter /> Filters
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-8">
      <select
        value={filters.service}
        onChange={(event) => setFilters((current) => ({ ...current, service: event.target.value }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="">All services</option>
        {options.services.map((service) => <option key={service} value={service}>{service}</option>)}
      </select>
      <select
        value={filters.district}
        onChange={(event) => setFilters((current) => ({ ...current, district: event.target.value, center: '' }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="">All districts</option>
        {(options.districts || []).map((district) => <option key={district} value={district}>{district}</option>)}
      </select>
      <select
        value={filters.center}
        onChange={(event) => setFilters((current) => ({ ...current, center: event.target.value }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="">All centers</option>
        {options.centers.map((center) => <option key={center} value={center}>{center}</option>)}
      </select>
      <select
        value={filters.status}
        onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="">All statuses</option>
        {options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      {showRequestType && (
        <select
          value={filters.requestType}
          onChange={(event) => setFilters((current) => ({ ...current, requestType: event.target.value }))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">All request types</option>
          {Object.entries(requestTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      )}
      <select
        value={filters.requestStatus}
        onChange={(event) => setFilters((current) => ({ ...current, requestStatus: event.target.value }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="">All request statuses</option>
        {(options.requestStatuses || []).map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <input
        type="date"
        value={filters.startDate}
        onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      />
      <input
        type="date"
        value={filters.endDate}
        onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      />
    </div>
    <button
      type="button"
      onClick={() => setFilters(initialFilters)}
      className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
    >
      Clear filters
    </button>
  </motion.div>
);

const RequestsTable = ({ rows, title = 'Requests' }) => (
  <motion.div variants={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-black text-[#0B3A75]"><FaTable /> {title}</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {['Ticket', 'Citizen', 'Gender', 'Request Type', 'Service', 'Center', 'Date', 'Status', 'Request Status'].map((heading) => (
              <th key={heading} className="px-4 py-3 font-black">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((ticket) => (
            <tr key={ticket._id || ticket.id || ticket.ref} className="hover:bg-blue-50/50">
              <td className="px-4 py-3 font-black text-blue-700">{ticket.ref}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{citizenName(ticket)}</td>
              <td className="px-4 py-3 text-slate-700">{citizenGender(ticket)}</td>
              <td className="px-4 py-3 text-slate-700">{requestTypeLabels[ticket.requestType] || 'New ID Registration'}</td>
              <td className="px-4 py-3 text-slate-700">{serviceName(ticket)}</td>
              <td className="px-4 py-3 text-slate-700">{centerName(ticket)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDate(ticket.date)}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{ticket.status || 'Waiting'}</span></td>
              <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{ticket.requestStatus || 'Pending'}</span></td>
            </tr>
          )) : (
            <tr>
              <td colSpan="9" className="px-4 py-8 text-center text-sm text-slate-500">No requests found for the selected filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const DistrictBreakdownTable = ({ rows }) => (
  <motion.div variants={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-black text-[#0B3A75]"><FaTable /> District Breakdown</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3 font-black">District</th>
            <th className="px-4 py-3 font-black">Requests</th>
            <th className="px-4 py-3 font-black">Waiting</th>
            <th className="px-4 py-3 font-black">Completed</th>
            <th className="px-4 py-3 font-black">Cancelled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((row) => (
            <tr key={row.label} className="hover:bg-blue-50/50">
              <td className="px-4 py-3 font-semibold text-slate-900">{row.label}</td>
              <td className="px-4 py-3 font-black text-blue-700">{row.count}</td>
              <td className="px-4 py-3 font-black text-amber-700">{row.waiting || 0}</td>
              <td className="px-4 py-3 font-black text-emerald-700">{row.completed || 0}</td>
              <td className="px-4 py-3 font-black text-red-700">{row.cancelled || 0}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-500">No district records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const AuditTable = ({ logs }) => (
  <motion.div variants={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-black text-[#0B3A75]"><FaLock /> Read-only Audit Table</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {['Time', 'User', 'Role', 'Action', 'Details', 'IP Address'].map((heading) => (
              <th key={heading} className="px-4 py-3 font-black">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.length ? logs.map((log) => (
            <tr key={log._id || log.id} className="hover:bg-blue-50/50">
              <td className="px-4 py-3 text-slate-700">{new Date(log.timestamp).toLocaleString()}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{log.user?.name || 'System'}</td>
              <td className="px-4 py-3 capitalize text-slate-700">{roleName(log.role)}</td>
              <td className="px-4 py-3 font-semibold text-blue-700">{log.action}</td>
              <td className="px-4 py-3 text-slate-700">{log.details}</td>
              <td className="px-4 py-3 text-slate-700">{log.ipAddress || 'N/A'}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan="6" className="px-4 py-8 text-center text-sm text-slate-500">No audit records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const Reports = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [operators, setOperators] = useState([]);
  const [audits, setAudits] = useState([]);
  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    let active = true;
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [statsRes, analyticsRes, bookingsRes, operatorsRes, auditsRes] = await Promise.all([
          api.get('/api/reports/stats'),
          api.get('/api/reports/analytics'),
          api.get('/api/bookings/admin/all'),
          api.get('/api/operators'),
          api.get('/api/audits', { params: { limit: 500 } }),
        ]);

        if (!active) return;
        setStats(getPayload(statsRes));
        setAnalytics(getPayload(analyticsRes));
        setTickets(safeArray(getPayload(bookingsRes)));
        setOperators(safeArray(getPayload(operatorsRes)));
        setAudits(safeArray(getPayload(auditsRes)));
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || 'Unable to load reports.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchReports();
    return () => {
      active = false;
    };
  }, []);

  const routeKey = useMemo(() => {
    if (location.pathname.endsWith('/applications')) return 'applications';
    if (location.pathname.endsWith('/operators')) return 'operators';
    if (location.pathname.includes('/dashboard/admin/reports/citizens')) return 'citizens';
    if (location.pathname.endsWith('/security')) return 'security';
    return 'home';
  }, [location.pathname]);

  const citizenReportMode = useMemo(() => {
    const lastSegment = location.pathname.split('/').filter(Boolean).pop();
    return ['all', 'male', 'female', 'districts'].includes(lastSegment) ? lastSegment : 'overview';
  }, [location.pathname]);

  const reportData = useMemo(() => {
    const filteredTickets = filterTickets(tickets, filters);
    const statuses = [...new Set(tickets.map((ticket) => ticket.status).filter(Boolean))].sort();
    const centers = [...new Set(tickets.map(centerName).filter(Boolean))].sort();
    const districts = [...new Set(tickets.map(citizenDistrict).filter(Boolean))].sort();
    const services = [...new Set(tickets.map(serviceName).filter(Boolean))].sort();
    const requestStatuses = [...new Set(tickets.map((ticket) => ticket.requestStatus).filter(Boolean))].sort();
    const pending = tickets.filter((ticket) => ticket.requestStatus === 'Pending').length;
    const completed = tickets.filter((ticket) => ticket.status === 'Completed' || ticket.requestStatus === 'Completed').length;
    const cancelled = tickets.filter((ticket) => ticket.status === 'Cancelled').length;
    const resubmitted = tickets.filter((ticket) => ticket.needsResubmission || ticket.requestStatus === 'Resubmission Required' || ticket.resubmissionHistory?.length).length;
    const waitingTimes = tickets.map((ticket) => parseWaitMinutes(ticket.waitTime));
    const serviceTimes = tickets.map((ticket) => minutesBetween(ticket.calledAt, ticket.completedAt)).filter((value) => value !== null);
    const genderRows = mapToChartRows(makeCountMap(tickets, citizenGender));
    const districtRows = districtBreakdownRows(tickets);
    const centerRows = mapToChartRows(makeCountMap(tickets, centerName));
    const serviceRows = analytics?.appointmentsByService?.map((row) => ({ label: row.service, count: row.count })) || mapToChartRows(makeCountMap(tickets, serviceName));
    const ageRows = mapToChartRows(makeCountMap(tickets, (ticket) => {
      const age = Number(ticket.registrationDetails?.age);
      if (!Number.isFinite(age) || age <= 0) return 'Not provided';
      if (age <= 25) return '18-25';
      if (age <= 35) return '26-35';
      if (age <= 50) return '36-50';
      return '51+';
    }));

    const completedByOperator = makeCountMap(
      audits.filter((log) => /complete/i.test(log.action || log.details || '')),
      (log) => log.user?.name || 'System'
    );
    const cancelledByOperator = makeCountMap(
      audits.filter((log) => /cancel/i.test(log.action || log.details || '')),
      (log) => log.user?.name || 'System'
    );
    const operatorActivityRows = operators.map((operator) => ({
      ...operator,
      completed: completedByOperator[operator.name] || 0,
      cancelled: cancelledByOperator[operator.name] || 0,
      avgService: average(serviceTimes),
      auditCount: audits.filter((log) => String(log.user?._id || log.user?.id) === String(operator._id || operator.id)).length,
    }));

    const actionRows = mapToChartRows(makeCountMap(audits, (log) => log.action || 'Unknown action'));
    const adminActions = audits.filter((log) => log.role === 'admin').length;
    const operatorActions = audits.filter((log) => ['operator', 'super_operator'].includes(log.role)).length;
    const failedLogins = audits.filter((log) => /failed|invalid/i.test(`${log.action} ${log.details}`)).length;
    const successfulLogins = audits.filter((log) => /login$/i.test(log.action || '') || /signed in/i.test(log.details || '')).length;
    const passwordChanges = audits.filter((log) => /password/i.test(`${log.action} ${log.details}`)).length;
    const unauthorizedAttempts = audits.filter((log) => /unauthorized|forbidden|403/i.test(`${log.action} ${log.details}`)).length;

    return {
      filteredTickets,
      options: { statuses, centers, districts, services, requestStatuses },
      pending,
      completed,
      cancelled,
      resubmitted,
      avgWait: average(waitingTimes),
      avgProcessing: average(serviceTimes),
      genderRows,
      districtRows,
      centerRows,
      serviceRows,
      ageRows,
      operatorActivityRows,
      actionRows,
      security: {
        failedLogins,
        successfulLogins,
        passwordChanges,
        unauthorizedAttempts,
        adminActions,
        operatorActions,
        criticalActions: audits.filter((log) => /delete|cancel|failed|unauthorized|password|qr/i.test(`${log.action} ${log.details}`)).length,
      },
    };
  }, [analytics, audits, filters, operators, tickets]);

  const weeklyLineData = useMemo(() => ({
    labels: analytics?.dailyTrend?.map((row) => row.date) || [],
    datasets: [{
      label: 'Appointments',
      data: analytics?.dailyTrend?.map((row) => row.count) || [],
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
    }],
  }), [analytics]);

  const exportTickets = () => csvDownload('nqs-applications-report.csv', [
    ['Ticket', 'Citizen', 'Gender', 'Request Type', 'Service', 'Center', 'Date', 'Status', 'Request Status'],
    ...reportData.filteredTickets.map((ticket) => [
      ticket.ref,
      citizenName(ticket),
      citizenGender(ticket),
      requestTypeLabels[ticket.requestType] || 'New ID Registration',
      serviceName(ticket),
      centerName(ticket),
      ticket.date,
      ticket.status,
      ticket.requestStatus,
    ]),
  ]);

  const exportOperators = () => csvDownload('nqs-operator-performance-report.csv', [
    ['Operator', 'Username', 'Status', 'Center', 'Completed', 'Cancelled', 'Audit Activity'],
    ...reportData.operatorActivityRows.map((operator) => [
      operator.name,
      operator.username,
      operator.status,
      operator.center?.name || 'Not assigned',
      operator.completed,
      operator.cancelled,
      operator.auditCount,
    ]),
  ]);

  const exportAudits = () => csvDownload('nqs-security-audit-report.csv', [
    ['Time', 'User', 'Role', 'Action', 'Details', 'IP Address'],
    ...audits.map((log) => [
      log.timestamp,
      log.user?.name || 'System',
      log.role,
      log.action,
      log.details,
      log.ipAddress,
    ]),
  ]);

  const applyApplicationFilter = (nextFilters = {}) => {
    setFilters({ ...initialFilters, ...nextFilters });
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('applications-requests-table')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
  };

  const isApplicationFilterActive = (nextFilters = {}) => {
    const targetFilters = { ...initialFilters, ...nextFilters };
    return Object.keys(initialFilters).every((key) => String(filters[key] || '') === String(targetFilters[key] || ''));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f8fc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
          <span className="text-sm font-semibold text-slate-600">Loading admin reports...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <PageShell title="Reports" description="Admin-only reports could not be loaded.">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
      </PageShell>
    );
  }

  if (routeKey === 'applications') {
    const newRegistration = tickets.filter((ticket) => ticket.requestType === 'new_national_id').length;
    const lostReplacement = tickets.filter((ticket) => ticket.requestType === 'lost_replacement').length;
    const updateInformation = tickets.filter((ticket) => ticket.requestType === 'update_information').length;

    return (
      <PageShell
        title="Applications & Requests Report"
        description="Review all National ID applications with filters by service, center, status, and date range."
        actions={<ExportActions onExport={exportTickets} />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Applications"
            value={tickets.length}
            icon={FaClipboardList}
            onClick={() => applyApplicationFilter()}
            active={isApplicationFilterActive()}
          />
          <StatCard
            label="New ID Registration"
            value={newRegistration}
            icon={FaClipboardList}
            accent="green"
            onClick={() => applyApplicationFilter({ requestType: 'new_national_id' })}
            active={isApplicationFilterActive({ requestType: 'new_national_id' })}
          />
          <StatCard
            label="Lost ID Replacement"
            value={lostReplacement}
            icon={FaClipboardList}
            accent="amber"
            onClick={() => applyApplicationFilter({ requestType: 'lost_replacement' })}
            active={isApplicationFilterActive({ requestType: 'lost_replacement' })}
          />
          <StatCard
            label="Update Information"
            value={updateInformation}
            icon={FaClipboardList}
            accent="navy"
            onClick={() => applyApplicationFilter({ requestType: 'update_information' })}
            active={isApplicationFilterActive({ requestType: 'update_information' })}
          />
          <StatCard
            label="Pending"
            value={reportData.pending}
            icon={FaClock}
            accent="amber"
            onClick={() => applyApplicationFilter({ requestStatus: 'Pending' })}
            active={isApplicationFilterActive({ requestStatus: 'Pending' })}
          />
          <StatCard
            label="Completed"
            value={reportData.completed}
            icon={FaChartLine}
            accent="green"
            onClick={() => applyApplicationFilter({ requestStatus: 'Completed' })}
            active={isApplicationFilterActive({ requestStatus: 'Completed' })}
          />
          <StatCard
            label="Cancelled"
            value={reportData.cancelled}
            icon={FaShieldAlt}
            accent="red"
            onClick={() => applyApplicationFilter({ status: 'Cancelled' })}
            active={isApplicationFilterActive({ status: 'Cancelled' })}
          />
          <StatCard
            label="Resubmitted"
            value={reportData.resubmitted}
            icon={FaClipboardList}
            accent="blue"
            onClick={() => applyApplicationFilter({ resubmissionOnly: 'true' })}
            active={isApplicationFilterActive({ resubmissionOnly: 'true' })}
          />
          <StatCard
            label="Avg Processing Time"
            value={`${reportData.avgProcessing} min`}
            icon={FaChartLine}
            accent="navy"
            onClick={() => applyApplicationFilter({ status: 'Completed' })}
            active={isApplicationFilterActive({ status: 'Completed' })}
          />
          <StatCard
            label="Avg Waiting Time"
            value={`${reportData.avgWait} min`}
            icon={FaChartLine}
            accent="navy"
            onClick={() => applyApplicationFilter({ status: 'Waiting' })}
            active={isApplicationFilterActive({ status: 'Waiting' })}
          />
        </div>
        <div id="applications-requests-table" className="space-y-4">
          <Filters filters={filters} setFilters={setFilters} options={reportData.options} />
          <RequestsTable rows={reportData.filteredTickets} />
        </div>
      </PageShell>
    );
  }

  if (routeKey === 'operators') {
    const onlineOperators = operators.filter((operator) => operator.status === 'active').length;
    const inactiveOperators = operators.filter((operator) => operator.status === 'inactive').length;
    const leaderboard = [...reportData.operatorActivityRows].sort((a, b) => b.completed - a.completed).slice(0, 6);

    return (
      <PageShell
        title="Operator Performance Report"
        description="Review operator status, completed tickets, cancellations, and login or activity records."
        actions={<ExportActions onExport={exportOperators} />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Operators" value={operators.length} icon={FaUserCog} />
          <StatCard label="Online Operators" value={onlineOperators} icon={FaUserCog} accent="green" />
          <StatCard label="Offline Operators" value={Math.max(operators.length - onlineOperators, 0)} icon={FaUserCog} accent="amber" />
          <StatCard label="Inactive Operators" value={inactiveOperators} icon={FaUserCog} accent="red" />
          <StatCard label="Avg Service Time" value={`${reportData.avgProcessing} min`} icon={FaChartLine} accent="navy" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Completed Tickets by Operator">
            <Bar data={barData(reportData.operatorActivityRows.map((row) => ({ label: row.name, count: row.completed })), 'Completed')} options={chartOptions} />
          </ChartCard>
          <ChartCard title="Cancelled Tickets by Operator">
            <Bar data={barData(reportData.operatorActivityRows.map((row) => ({ label: row.name, count: row.cancelled })), 'Cancelled')} options={chartOptions} />
          </ChartCard>
        </div>
        <motion.div variants={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-black text-[#0B3A75]">Operator Leaderboard</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {leaderboard.map((operator, index) => (
              <div key={operator._id || operator.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-bold text-blue-700">#{index + 1}</p>
                <p className="font-black text-slate-950">{operator.name}</p>
                <p className="text-xs text-slate-500">{operator.center?.name || 'No assigned center'}</p>
                <p className="mt-2 text-sm font-bold text-emerald-700">{operator.completed} completed tickets</p>
              </div>
            ))}
          </div>
        </motion.div>
        <AuditTable logs={audits.filter((log) => ['operator', 'super_operator'].includes(log.role)).slice(0, 50)} />
      </PageShell>
    );
  }

  if (routeKey === 'citizens') {
    const citizenReportsBase = '/dashboard/admin/reports/citizens';
    const maleCitizens = tickets.filter((ticket) => citizenGenderKey(ticket) === 'male').length;
    const femaleCitizens = tickets.filter((ticket) => citizenGenderKey(ticket) === 'female').length;
    const demographicRows = citizenReportMode === 'male'
      ? tickets.filter((ticket) => citizenGenderKey(ticket) === 'male')
      : citizenReportMode === 'female'
        ? tickets.filter((ticket) => citizenGenderKey(ticket) === 'female')
        : tickets;
    const demographicTitle = citizenReportMode === 'male'
      ? 'Male Citizen Records'
      : citizenReportMode === 'female'
        ? 'Female Citizen Records'
        : 'All Citizen Records';
    const isDetailPage = citizenReportMode !== 'overview';

    return (
      <PageShell
        title={isDetailPage ? demographicTitle.replace('Records', 'Report') : 'Citizen Demographics Report'}
        description={isDetailPage ? 'Review this citizen report page using real National ID request data.' : 'Citizen request distribution by gender, age group, district, center, and service usage.'}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Citizens"
            value={stats?.totalCitizens || 0}
            icon={FaUsers}
            to={`${citizenReportsBase}/all`}
            active={citizenReportMode === 'all'}
          />
          <StatCard
            label="Male Citizens"
            value={maleCitizens}
            icon={FaUsers}
            accent="blue"
            to={`${citizenReportsBase}/male`}
            active={citizenReportMode === 'male'}
          />
          <StatCard
            label="Female Citizens"
            value={femaleCitizens}
            icon={FaUsers}
            accent="green"
            to={`${citizenReportsBase}/female`}
            active={citizenReportMode === 'female'}
          />
          <StatCard
            label="Districts Recorded"
            value={reportData.districtRows.length}
            icon={FaUsers}
            accent="navy"
            to={`${citizenReportsBase}/districts`}
            active={citizenReportMode === 'districts'}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Gender Distribution">
            <Doughnut data={doughnutData(reportData.genderRows)} options={doughnutOptions} />
          </ChartCard>
          <ChartCard title="Age Groups">
            <Bar data={barData(reportData.ageRows, 'Citizens')} options={chartOptions} />
          </ChartCard>
          <ChartCard title="Citizens by District">
            <Bar data={barData(reportData.districtRows, 'Requests')} options={chartOptions} />
          </ChartCard>
          <ChartCard title="Citizens by Selected Center">
            <Bar data={barData(reportData.centerRows, 'Requests')} options={chartOptions} />
          </ChartCard>
          <ChartCard title="Service Usage by Citizens">
            <Doughnut data={doughnutData(reportData.serviceRows)} options={doughnutOptions} />
          </ChartCard>
        </div>
        {isDetailPage && (
          <div className="space-y-3">
            <Link
              to={citizenReportsBase}
              className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
            >
              Back to Citizen Demographics
            </Link>
            {citizenReportMode === 'districts' ? (
              <DistrictBreakdownTable rows={reportData.districtRows} />
            ) : (
              <RequestsTable rows={demographicRows} title={demographicTitle} />
            )}
          </div>
        )}
      </PageShell>
    );
  }

  if (routeKey === 'security') {
    return (
      <PageShell
        title="Security & Audit Report"
        description="Read-only audit and security activity. Delete actions are intentionally not available here."
        actions={<ExportActions onExport={exportAudits} />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Failed Login Attempts" value={reportData.security.failedLogins} icon={FaLock} accent="red" />
          <StatCard label="Successful Logins" value={reportData.security.successfulLogins} icon={FaLock} accent="green" />
          <StatCard label="Password Changes" value={reportData.security.passwordChanges} icon={FaLock} accent="amber" />
          <StatCard label="Unauthorized Attempts" value={reportData.security.unauthorizedAttempts} icon={FaShieldAlt} accent="red" />
          <StatCard label="Admin Actions" value={reportData.security.adminActions} icon={FaShieldAlt} accent="navy" />
          <StatCard label="Operator Actions" value={reportData.security.operatorActions} icon={FaShieldAlt} accent="blue" />
          <StatCard label="Critical Actions" value={reportData.security.criticalActions} icon={FaShieldAlt} accent="red" />
        </div>
        <ChartCard title="Audit Actions Breakdown">
          <Bar data={barData(reportData.actionRows.slice(0, 10), 'Actions')} options={chartOptions} />
        </ChartCard>
        <AuditTable logs={audits} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Reports Home"
      description="Professional admin report overview for National ID applications, operators, citizens, and security."
      actions={<ExportActions onExport={exportTickets} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Citizens" value={stats?.totalCitizens || 0} icon={FaUsers} to="/dashboard/admin/reports/citizens" />
        <StatCard label="Total Appointments" value={stats?.totalAppointments || tickets.length} icon={FaClipboardList} to="/dashboard/admin/reports/applications" />
        <StatCard label="Today's Bookings" value={stats?.dailyBookings || tickets.filter((ticket) => ticket.date === todayKey).length} icon={FaClipboardList} accent="green" to="/admin-appointments?date=today" />
        <StatCard label="Pending Requests" value={reportData.pending} icon={FaClipboardList} accent="amber" to="/dashboard/admin/reports/applications" />
        <StatCard label="Completed Requests" value={reportData.completed} icon={FaChartLine} accent="green" to="/dashboard/admin/reports/applications" />
        <StatCard label="Cancelled Requests" value={reportData.cancelled} icon={FaShieldAlt} accent="red" to="/dashboard/admin/reports/applications" />
        <StatCard label="Active Operators" value={operators.filter((operator) => operator.status === 'active').length} icon={FaUserCog} accent="navy" to="/dashboard/admin/reports/operators" />
        <StatCard label="Active Centers" value={stats?.serviceCenters || 0} icon={FaChartLine} accent="blue" to="/center-management" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartCard title="Weekly Appointment Chart">
            <Line data={weeklyLineData} options={chartOptions} />
          </ChartCard>
        </div>
        <div className="xl:col-span-2">
          <ChartCard title="Service Breakdown Chart">
            <Doughnut data={doughnutData(reportData.serviceRows)} options={doughnutOptions} />
          </ChartCard>
        </div>
      </div>

      <motion.div variants={item} className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {reportCards.map((card) => (
          <Link key={card.path} to={card.path} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <card.icon className="mb-3 text-2xl text-blue-700" />
            <h2 className="text-sm font-black text-[#0B3A75]">{card.title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
          </Link>
        ))}
      </motion.div>

      <motion.div variants={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black text-[#0B3A75]">Recent Activity</h2>
        <div className="space-y-2">
          {(stats?.recentActivities || []).map((activity) => (
            <div key={activity.id || activity.ref} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
              <p className="text-xs text-slate-500">{formatDate(activity.time)} - {activity.status}</p>
            </div>
          ))}
          {!(stats?.recentActivities || []).length && <p className="text-sm text-slate-500">No recent activity recorded.</p>}
        </div>
      </motion.div>
    </PageShell>
  );
};

export default Reports;
