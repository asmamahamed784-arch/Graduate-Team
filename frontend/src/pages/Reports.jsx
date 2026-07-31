import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaChartLine,
  FaBuilding,
  FaCalendarDay,
  FaClock,
  FaClipboardList,
  FaConciergeBell,
  FaDownload,
  FaFilePdf,
  FaFilter,
  FaLock,
  FaServer,
  FaShieldAlt,
  FaTable,
  FaUserCog,
  FaUsers,
} from 'react-icons/fa';
import api from '../api/axiosInstance';

const reportCards = [
  {
    title: 'Overview',
    description: 'Executive summary of citizens, appointments, queue status, and completions.',
    path: '/dashboard/admin/reports',
    icon: FaChartLine,
  },
  {
    title: 'Citizen Analytics',
    description: 'Understand citizen requests by gender, age group, district, and center.',
    path: '/dashboard/admin/reports/citizens',
    icon: FaUsers,
  },
  {
    title: 'Service Centers',
    description: 'Center-by-center workload, waiting, completed, and cancellation reporting.',
    path: '/dashboard/admin/reports/service-centers',
    icon: FaBuilding,
  },
  {
    title: 'Operators',
    description: 'Review operator activity, completed tickets, and service performance.',
    path: '/dashboard/admin/reports/operators',
    icon: FaUserCog,
  },
  {
    title: 'Queue Analytics',
    description: 'Waiting queue, active service, completed, cancelled, and no-show analysis.',
    path: '/dashboard/admin/reports/queue',
    icon: FaClock,
  },
];

const requestTypeLabels = {
  new_national_id: 'New ID Registration',
  lost_replacement: 'Lost ID Replacement',
  update_information: 'Update Information',
};

const requestTypeSlugs = {
  new_national_id: 'new-registration',
  update_information: 'update-information',
  lost_replacement: 'lost-id',
};

const slugRequestTypes = Object.fromEntries(Object.entries(requestTypeSlugs).map(([key, value]) => [value, key]));

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

const centerIdFromTicket = (ticket) => (
  ticket.center?._id ||
  ticket.center?.id ||
  ticket.centerId ||
  ticket.center
);

const citizenName = (ticket) => (
  ticket.registrationDetails?.fullName ||
  ticket.replacementDetails?.fullName ||
  ticket.updateDetails?.fullName ||
  ticket.citizen?.name ||
  ticket.citizenName ||
  'No data'
);

const citizenNqsId = (ticket) => (
  ticket.citizen?.nationalId ||
  ticket.nationalIdNumber ||
  ticket.registrationDetails?.nationalIdNumber ||
  ticket.replacementDetails?.nationalIdNumber ||
  ticket.updateDetails?.nationalIdNumber ||
  ''
);

const citizenUniqueKey = (ticket) => (
  ticket.citizen?._id ||
  ticket.citizen?.id ||
  ticket.citizenId ||
  ticket.citizen ||
  citizenNqsId(ticket) ||
  `${citizenName(ticket)}-${ticket.registrationDetails?.phone || ticket.replacementDetails?.phone || ticket.updateDetails?.phone || ''}`
);

const uniqueCitizenCount = (rows) => new Set(rows.map(citizenUniqueKey).filter(Boolean).map(String)).size;

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

const statusLabel = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  return {
    active: 'Active',
    inactive: 'Inactive',
    pending_approval: 'Pending',
  }[key] || 'All';
};

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

const ReportTabs = () => (
  <motion.div variants={item} className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
    <div className="flex min-w-max gap-2">
      {reportCards.map((card) => (
        <Link
          key={card.path}
          to={card.path}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
        >
          <card.icon className="text-blue-700" />
          {card.title}
        </Link>
      ))}
    </div>
  </motion.div>
);

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
      <ReportTabs />
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
            {['Request Ref', 'NQS ID', 'Citizen', 'Gender', 'Request Type', 'Service', 'Center', 'Date', 'Status', 'Request Status'].map((heading) => (
              <th key={heading} className="px-4 py-3 font-black">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((ticket) => (
            <tr key={ticket._id || ticket.id || ticket.ref} className="hover:bg-blue-50/50">
              <td className="px-4 py-3 font-black text-blue-700">{ticket.ref}</td>
              <td className="px-4 py-3 font-mono font-semibold text-slate-700">{citizenNqsId(ticket) || '--'}</td>
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
              <td colSpan="10" className="px-4 py-8 text-center text-sm text-slate-500">No requests found for the selected filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const OperatorsTable = ({ rows }) => (
  <motion.div id="operators-report-table" variants={item} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-black text-[#0B3A75]"><FaUserCog /> Operator Records</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {['Name', 'Username', 'Phone', 'Role', 'Center', 'District', 'Status', 'Completed', 'Cancelled'].map((heading) => (
              <th key={heading} className="px-4 py-3 font-black">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? rows.map((operator) => (
            <tr key={operator._id || operator.id || operator.username} className="hover:bg-blue-50/50">
              <td className="px-4 py-3 font-black text-slate-950">{operator.name || 'No name'}</td>
              <td className="px-4 py-3 text-slate-700">{operator.username || '--'}</td>
              <td className="px-4 py-3 text-slate-700">{operator.phone || '--'}</td>
              <td className="px-4 py-3 text-slate-700 capitalize">{roleName(operator.role || operator.type)}</td>
              <td className="px-4 py-3 text-slate-700">{operator.center?.name || operator.centerName || 'Not assigned'}</td>
              <td className="px-4 py-3 text-slate-700">{operator.center?.district || operator.district || '--'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-1 text-xs font-black ${
                  operator.status === 'active' || operator.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : operator.status === 'inactive' || operator.status === 'Inactive'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {operator.status || 'Pending'}
                </span>
              </td>
              <td className="px-4 py-3 font-black text-emerald-700">{operator.completed || 0}</td>
              <td className="px-4 py-3 font-black text-red-700">{operator.cancelled || 0}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan="9" className="px-4 py-8 text-center text-sm text-slate-500">No operators found.</td>
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

const ServiceCenterTable = ({ rows, clickable = false }) => (
  <motion.div variants={item} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><FaBuilding className="text-blue-700" /> District Service Centers Operations</h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
          <tr>
            {['Service Center', 'Total Bookings', 'Completed', 'Waiting', 'Cancelled', 'No Show', 'Update', 'Lost ID', 'Efficiency %'].map((heading) => (
              <th key={heading} className="px-4 py-3 font-black">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.length ? rows.map((row) => {
            const efficiency = row.total ? Math.round((row.completed / row.total) * 100) : 0;
            return (
            <tr key={row.label} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50/70">
              <td className="px-4 py-3 font-semibold text-slate-900">
                {clickable ? (
                  <Link to={`/dashboard/admin/reports/service-centers/${row.id}`} className="text-blue-700 hover:underline">
                    {row.label}
                  </Link>
                ) : row.label}
              </td>
              <td className="px-4 py-3 font-black text-slate-950">{row.total}</td>
              <td className="bg-emerald-500 px-4 py-3 font-black text-white">{row.completed}</td>
              <td className="bg-amber-400 px-4 py-3 font-black text-slate-950">{row.waiting}</td>
              <td className="bg-red-500 px-4 py-3 font-black text-white">{row.cancelled}</td>
              <td className="bg-rose-400 px-4 py-3 font-black text-white">{row.noShow}</td>
              <td className="px-4 py-3 font-black text-blue-700">{row.update}</td>
              <td className="px-4 py-3 font-black text-blue-700">{row.lost}</td>
              <td className={`px-4 py-3 font-black text-white ${efficiency >= 70 ? 'bg-emerald-600' : efficiency >= 30 ? 'bg-amber-500' : 'bg-red-600'}`}>
                {efficiency}%
              </td>
            </tr>
          );}) : (
            <tr>
              <td colSpan="9" className="px-4 py-8 text-center text-sm text-slate-500">No center performance data found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </motion.div>
);

const CenterDirectory = ({ rows }) => (
  <motion.div variants={item} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
    {rows.map((row) => (
      <Link
        key={row.id}
        to={`/dashboard/admin/reports/service-centers/${row.id}`}
        className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{row.district} District</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{row.label}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{row.phone || 'No phone recorded'}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{row.total} total</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-amber-50 px-2 py-3">
            <p className="text-lg font-black text-amber-700">{row.waiting}</p>
            <p className="text-[11px] font-bold text-slate-600">Waiting</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2 py-3">
            <p className="text-lg font-black text-emerald-700">{row.completed}</p>
            <p className="text-[11px] font-bold text-slate-600">Completed</p>
          </div>
          <div className="rounded-lg bg-red-50 px-2 py-3">
            <p className="text-lg font-black text-red-700">{row.cancelled + row.noShow}</p>
            <p className="text-[11px] font-bold text-slate-600">Stopped</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-black text-blue-700">
          <span>Open full center report</span>
          <span className="transition group-hover:translate-x-1">View</span>
        </div>
      </Link>
    ))}
  </motion.div>
);

const Reports = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [centers, setCenters] = useState([]);
  const [operators, setOperators] = useState([]);
  const [audits, setAudits] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [operatorStatusFilter, setOperatorStatusFilter] = useState('');

  useEffect(() => {
    const dashboardScroller = document.querySelector('main');
    dashboardScroller?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [statsRes, analyticsRes, bookingsRes, centersRes, operatorsRes, auditsRes] = await Promise.all([
          api.get('/api/reports/stats'),
          api.get('/api/reports/analytics'),
          api.get('/api/bookings/admin/all'),
          api.get('/api/centers'),
          api.get('/api/operators'),
          api.get('/api/audits', { params: { limit: 500 } }),
        ]);

        if (!active) return;
        setStats(getPayload(statsRes));
        setAnalytics(getPayload(analyticsRes));
        setTickets(safeArray(getPayload(bookingsRes)));
        setCenters(safeArray(getPayload(centersRes)));
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
    if (location.pathname.includes('/dashboard/admin/reports/services/')) return 'service-detail';
    if (location.pathname.includes('/dashboard/admin/reports/service-centers/')) return 'center-detail';
    if (location.pathname.endsWith('/service-centers')) return 'service-centers';
    if (location.pathname.endsWith('/operators')) return 'operators';
    if (location.pathname.endsWith('/queue')) return 'queue';
    if (location.pathname.includes('/dashboard/admin/reports/citizens')) return 'citizens';
    if (location.pathname.endsWith('/security')) return 'security';
    return 'home';
  }, [location.pathname]);

  const citizenReportMode = useMemo(() => {
    const lastSegment = location.pathname.split('/').filter(Boolean).pop();
    return ['all', 'male', 'female', 'districts'].includes(lastSegment) ? lastSegment : 'overview';
  }, [location.pathname]);

  useEffect(() => {
    if (routeKey !== 'operators') return;
    const status = new URLSearchParams(location.search).get('status') || '';
    const normalizedStatus = String(status).trim().toLowerCase().replace(/\s+/g, '_');
    setOperatorStatusFilter(['active', 'pending_approval', 'inactive'].includes(normalizedStatus) ? normalizedStatus : '');
  }, [routeKey, location.search]);

  const reportData = useMemo(() => {
    const filteredTickets = filterTickets(tickets, filters);
    const statuses = [...new Set(tickets.map((ticket) => ticket.status).filter(Boolean))].sort();
    const centerOptions = [...new Set([...centers.map((center) => center.name), ...tickets.map(centerName)].filter(Boolean))].sort();
    const districts = [...new Set([...BANAADIR_DISTRICTS, ...centers.map((center) => center.district), ...tickets.map(citizenDistrict)].filter(Boolean))].sort();
    const services = [...new Set(tickets.map(serviceName).filter(Boolean))].sort();
    const requestStatuses = [...new Set(tickets.map((ticket) => ticket.requestStatus).filter(Boolean))].sort();
    const pending = tickets.filter((ticket) => ticket.requestStatus === 'Pending').length;
    const waiting = tickets.filter((ticket) => ['Waiting', 'Pending', 'On Hold', 'Being Served', 'In Progress'].includes(ticket.status) || ['Pending', 'Approved', 'Resubmission Required'].includes(ticket.requestStatus)).length;
    const activeAppointments = tickets.filter((ticket) => !['Completed', 'Cancelled', 'Rejected', 'Expired', 'No Show'].includes(ticket.status) && !['Completed', 'Rejected', 'Cancelled'].includes(ticket.requestStatus)).length;
    const completed = tickets.filter((ticket) => ticket.status === 'Completed' || ticket.requestStatus === 'Completed').length;
    const cancelled = tickets.filter((ticket) => ticket.status === 'Cancelled').length;
    const noShow = tickets.filter((ticket) => ['No Show', 'NoShow', 'no_show'].includes(ticket.status)).length;
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

    const centerSeedRows = centers.length
      ? centers
      : BANAADIR_DISTRICTS.map((district) => ({
        id: district.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        _id: district.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: `${district} National ID Center`,
        district,
        phone: '',
        address: '',
      }));

    const centerPerformanceMap = centerSeedRows.reduce((map, center) => {
      const id = center._id || center.id || center.name;
      map[id] = {
        id,
        label: center.name,
        district: center.district || 'Banaadir',
        phone: center.phone || '',
        address: center.address || '',
        total: 0,
        waiting: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        update: 0,
        lost: 0,
        newRegistration: 0,
        male: 0,
        female: 0,
        unknownGender: 0,
        tickets: [],
      };
      return map;
    }, {});

    tickets.forEach((ticket) => {
      const ticketCenterId = centerIdFromTicket(ticket);
      const knownCenter = centerSeedRows.find((center) => (
        String(center._id || center.id) === String(ticketCenterId) ||
        center.name === centerName(ticket)
      ));
      const key = knownCenter?._id || knownCenter?.id || ticketCenterId || centerName(ticket);
      if (!centerPerformanceMap[key]) {
        centerPerformanceMap[key] = {
          id: key,
          label: centerName(ticket),
          district: citizenDistrict(ticket),
          phone: '',
          address: '',
          total: 0,
          waiting: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          update: 0,
          lost: 0,
          newRegistration: 0,
          male: 0,
          female: 0,
          unknownGender: 0,
          tickets: [],
        };
      }
      const row = centerPerformanceMap[key];
      row.total += 1;
      row.tickets.push(ticket);
      if (ticket.status === 'Completed' || ticket.requestStatus === 'Completed') row.completed += 1;
      if (['Waiting', 'Pending', 'On Hold', 'Being Served', 'In Progress'].includes(ticket.status) || ['Pending', 'Approved', 'Resubmission Required'].includes(ticket.requestStatus)) row.waiting += 1;
      if (ticket.status === 'Cancelled') row.cancelled += 1;
      if (['No Show', 'NoShow', 'no_show'].includes(ticket.status)) row.noShow += 1;
      if (ticket.requestType === 'new_national_id' || !ticket.requestType) row.newRegistration += 1;
      if (ticket.requestType === 'update_information') row.update += 1;
      if (ticket.requestType === 'lost_replacement') row.lost += 1;
      const gender = citizenGenderKey(ticket);
      if (gender === 'male') row.male += 1;
      else if (gender === 'female') row.female += 1;
      else row.unknownGender += 1;
    });

    const centerPerformanceRows = Object.values(centerPerformanceMap)
      .filter((row) => BANAADIR_DISTRICTS.includes(row.district) || row.label !== 'Not assigned')
      .sort((a, b) => BANAADIR_DISTRICTS.indexOf(a.district) - BANAADIR_DISTRICTS.indexOf(b.district) || a.label.localeCompare(b.label));

    const actionRows = mapToChartRows(makeCountMap(audits, (log) => log.action || 'Unknown action'));
    const adminActions = audits.filter((log) => ['admin', 'super_admin'].includes(log.role)).length;
    const operatorActions = audits.filter((log) => ['operator', 'super_operator', 'center_manager'].includes(log.role)).length;
    const failedLogins = audits.filter((log) => /failed|invalid/i.test(`${log.action} ${log.details}`)).length;
    const successfulLogins = audits.filter((log) => /login$/i.test(log.action || '') || /signed in/i.test(log.details || '')).length;
    const passwordChanges = audits.filter((log) => /password/i.test(`${log.action} ${log.details}`)).length;
    const unauthorizedAttempts = audits.filter((log) => /unauthorized|forbidden|403/i.test(`${log.action} ${log.details}`)).length;

    return {
      filteredTickets,
      options: { statuses, centers: centerOptions, districts, services, requestStatuses },
      pending,
      waiting,
      activeAppointments,
      completed,
      cancelled,
      noShow,
      resubmitted,
      avgWait: average(waitingTimes),
      avgProcessing: average(serviceTimes),
      genderRows,
      districtRows,
      centerRows,
      serviceRows,
      ageRows,
      operatorActivityRows,
      centerPerformanceRows,
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
  }, [analytics, audits, centers, filters, operators, tickets]);

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

  const showOperatorRows = (status = '') => {
    setOperatorStatusFilter(status);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const table = document.getElementById('operators-report-table');
        const scroller = document.querySelector('main');
        if (table && scroller) {
          const scrollerRect = scroller.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          scroller.scrollTo({
            top: scroller.scrollTop + tableRect.top - scrollerRect.top - 90,
            left: 0,
            behavior: 'smooth',
          });
          return;
        }
        table?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

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

  const serviceSlug = params.serviceSlug;
  const selectedRequestType = slugRequestTypes[serviceSlug];
  const selectedCenter = reportData.centerPerformanceRows.find((row) => String(row.id) === String(params.centerId));
  const centerView = params.centerView || 'all';
  const todayTickets = tickets.filter((ticket) => ticket.date === todayKey).length;
  const totalBookings = stats?.totalBookings ?? stats?.totalAppointments ?? tickets.length;
  const activeServices = stats?.activeServices ?? 0;
  const totalCenters = stats?.serviceCenters ?? stats?.totalServiceCenters ?? centers.length;
  const operatorOnlyRows = reportData.operatorActivityRows.filter((operator) => String(operator.role || '').toLowerCase() === 'operator');
  const adminOverviewCards = [
    { label: 'Citizen Accounts', value: stats?.totalUsers ?? stats?.totalCitizens ?? 0, icon: FaUsers, accent: 'blue', to: '/dashboard/admin/reports/citizens/all' },
    { label: 'Total Bookings', value: totalBookings, icon: FaClipboardList, accent: 'blue', to: '/dashboard/admin/reports/applications' },
    { label: 'Total Operators', value: operatorOnlyRows.length, icon: FaUserCog, accent: 'navy', to: '/dashboard/admin/reports/operators' },
    { label: 'Active Service', value: activeServices, icon: FaConciergeBell, accent: 'green', to: '/service-management' },
    { label: 'Banaadir Centers', value: totalCenters, icon: FaBuilding, accent: 'navy', to: '/dashboard/admin/reports/service-centers' },
    { label: "Today's Tickets", value: stats?.dailyBookings ?? stats?.dailyVisitors ?? todayTickets, icon: FaCalendarDay, accent: 'amber', to: { pathname: '/admin-appointments', search: '?date=today' } },
    { label: 'API Status', value: stats?.systemUptime || 'Online', icon: FaServer, accent: 'green', to: '/settings' },
  ];

  const buildSummaryRows = (rows) => ({
    total: rows.length,
    waiting: rows.filter((ticket) => ['Waiting', 'Pending', 'On Hold', 'Being Served', 'In Progress'].includes(ticket.status) || ['Pending', 'Approved', 'Resubmission Required'].includes(ticket.requestStatus)).length,
    completed: rows.filter((ticket) => ticket.status === 'Completed' || ticket.requestStatus === 'Completed').length,
    cancelled: rows.filter((ticket) => ticket.status === 'Cancelled').length,
    noShow: rows.filter((ticket) => ['No Show', 'NoShow', 'no_show'].includes(ticket.status)).length,
    male: rows.filter((ticket) => citizenGenderKey(ticket) === 'male').length,
    female: rows.filter((ticket) => citizenGenderKey(ticket) === 'female').length,
    newRegistration: rows.filter((ticket) => ticket.requestType === 'new_national_id' || !ticket.requestType).length,
    update: rows.filter((ticket) => ticket.requestType === 'update_information').length,
    lost: rows.filter((ticket) => ticket.requestType === 'lost_replacement').length,
  });

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

  if (routeKey === 'center-detail') {
    const centerTickets = selectedCenter?.tickets || [];
    const summary = buildSummaryRows(centerTickets);
    const centerViewConfig = {
      all: {
        title: 'All Center Records',
        rows: centerTickets,
      },
      'new-registration': {
        title: 'New Registration Work',
        rows: centerTickets.filter((ticket) => ticket.requestType === 'new_national_id' || !ticket.requestType),
      },
      'update-information': {
        title: 'Update Information Work',
        rows: centerTickets.filter((ticket) => ticket.requestType === 'update_information'),
      },
      'lost-id': {
        title: 'Lost ID Replacement Work',
        rows: centerTickets.filter((ticket) => ticket.requestType === 'lost_replacement'),
      },
      waiting: {
        title: 'Waiting Work',
        rows: centerTickets.filter((ticket) => ['Waiting', 'Pending', 'On Hold', 'Being Served', 'In Progress'].includes(ticket.status) || ['Pending', 'Approved', 'Resubmission Required'].includes(ticket.requestStatus)),
      },
      completed: {
        title: 'Completed Work',
        rows: centerTickets.filter((ticket) => ticket.status === 'Completed' || ticket.requestStatus === 'Completed'),
      },
      cancelled: {
        title: 'Cancelled / No Show Work',
        rows: centerTickets.filter((ticket) => ticket.status === 'Cancelled' || ['No Show', 'NoShow', 'no_show'].includes(ticket.status)),
      },
      male: {
        title: 'Male Citizen Records',
        rows: centerTickets.filter((ticket) => citizenGenderKey(ticket) === 'male'),
      },
      female: {
        title: 'Female Citizen Records',
        rows: centerTickets.filter((ticket) => citizenGenderKey(ticket) === 'female'),
      },
    };
    const activeCenterView = centerViewConfig[centerView] || centerViewConfig.all;
    const centerBasePath = `/dashboard/admin/reports/service-centers/${selectedCenter?.id || params.centerId}`;

    return (
      <PageShell
        title={selectedCenter ? selectedCenter.label : 'Center Report'}
        description={selectedCenter ? `${selectedCenter.district} District center performance, citizens, requests, and queue status.` : 'The selected center could not be found.'}
        actions={<ExportActions onExport={() => csvDownload('nqs-center-report.csv', [
          ['Ticket', 'Citizen', 'Gender', 'Request Type', 'Service', 'Center', 'Date', 'Status', 'Request Status'],
          ...centerTickets.map((ticket) => [
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
        ])} />}
      >
        <Link to="/dashboard/admin/reports/service-centers" className="inline-flex w-max rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">
          Back to all centers
        </Link>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Work" value={summary.total} icon={FaClipboardList} to={`${centerBasePath}/all`} active={centerView === 'all'} />
          <StatCard label="Waiting" value={summary.waiting} icon={FaClock} accent="amber" to={`${centerBasePath}/waiting`} active={centerView === 'waiting'} />
          <StatCard label="Completed" value={summary.completed} icon={FaChartLine} accent="green" to={`${centerBasePath}/completed`} active={centerView === 'completed'} />
          <StatCard label="Cancelled / No Show" value={summary.cancelled + summary.noShow} icon={FaShieldAlt} accent="red" to={`${centerBasePath}/cancelled`} active={centerView === 'cancelled'} />
          <StatCard label="New Registration" value={summary.newRegistration} icon={FaClipboardList} accent="blue" to={`${centerBasePath}/new-registration`} active={centerView === 'new-registration'} />
          <StatCard label="Update Information" value={summary.update} icon={FaClipboardList} accent="navy" to={`${centerBasePath}/update-information`} active={centerView === 'update-information'} />
          <StatCard label="Lost ID Replacement" value={summary.lost} icon={FaClipboardList} accent="amber" to={`${centerBasePath}/lost-id`} active={centerView === 'lost-id'} />
          <StatCard label="Male Citizens" value={summary.male} icon={FaUsers} accent="blue" to={`${centerBasePath}/male`} active={centerView === 'male'} />
          <StatCard label="Female Citizens" value={summary.female} icon={FaUsers} accent="green" to={`${centerBasePath}/female`} active={centerView === 'female'} />
        </div>
        <RequestsTable rows={activeCenterView.rows} title={activeCenterView.title} />
      </PageShell>
    );
  }

  if (routeKey === 'service-detail') {
    const serviceRows = selectedRequestType
      ? tickets.filter((ticket) => (selectedRequestType === 'new_national_id' ? ticket.requestType === 'new_national_id' || !ticket.requestType : ticket.requestType === selectedRequestType))
      : tickets;
    const summary = buildSummaryRows(serviceRows);

    return (
      <PageShell
        title={`${requestTypeLabels[selectedRequestType] || 'Service'} Report`}
        description="This page shows only this service, with its own citizens, queue status, center distribution, and gender counts."
        actions={<ExportActions onExport={() => csvDownload('nqs-service-report.csv', [
          ['Ticket', 'Citizen', 'Gender', 'Center', 'Date', 'Status', 'Request Status'],
          ...serviceRows.map((ticket) => [
            ticket.ref,
            citizenName(ticket),
            citizenGender(ticket),
            centerName(ticket),
            ticket.date,
            ticket.status,
            ticket.requestStatus,
          ]),
        ])} />}
      >
        <Link to="/dashboard/admin/reports/applications" className="inline-flex w-max rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">
          Back to services
        </Link>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Requests" value={summary.total} icon={FaClipboardList} to={`/dashboard/admin/reports/services/${serviceSlug}`} />
          <StatCard label="Waiting" value={summary.waiting} icon={FaClock} accent="amber" to="/dashboard/admin/reports/queue?status=waiting" />
          <StatCard label="Completed" value={summary.completed} icon={FaChartLine} accent="green" to="/dashboard/admin/reports/queue?status=completed" />
          <StatCard label="Cancelled / No Show" value={summary.cancelled + summary.noShow} icon={FaShieldAlt} accent="red" to="/dashboard/admin/reports/queue?status=cancelled" />
          <StatCard label="Male" value={summary.male} icon={FaUsers} accent="blue" to="/dashboard/admin/reports/citizens/male" />
          <StatCard label="Female" value={summary.female} icon={FaUsers} accent="green" to="/dashboard/admin/reports/citizens/female" />
        </div>
        <RequestsTable rows={serviceRows} title={`${requestTypeLabels[selectedRequestType] || 'Service'} Records`} />
        <ServiceCenterTable rows={reportData.centerPerformanceRows.map((center) => {
          const centerServiceTickets = center.tickets.filter((ticket) => (selectedRequestType === 'new_national_id' ? ticket.requestType === 'new_national_id' || !ticket.requestType : ticket.requestType === selectedRequestType));
          const centerSummary = buildSummaryRows(centerServiceTickets);
          return { ...center, ...centerSummary, label: center.label, id: center.id, district: center.district };
        })} clickable />
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
        <Filters filters={filters} setFilters={setFilters} options={reportData.options} />
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
            to="/dashboard/admin/reports/services/new-registration"
          />
          <StatCard
            label="Lost ID Replacement"
            value={lostReplacement}
            icon={FaClipboardList}
            accent="amber"
            to="/dashboard/admin/reports/services/lost-id"
          />
          <StatCard
            label="Update Information"
            value={updateInformation}
            icon={FaClipboardList}
            accent="navy"
            to="/dashboard/admin/reports/services/update-information"
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
          <RequestsTable rows={reportData.filteredTickets} />
        </div>
      </PageShell>
    );
  }

  if (routeKey === 'operators') {
    const operatorRows = reportData.operatorActivityRows.filter((operator) => String(operator.role || '').toLowerCase() === 'operator');
    const statusKey = (status = '') => String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
    const activeOperators = operatorRows.filter((operator) => statusKey(operator.status) === 'active').length;
    const inactiveOperators = operatorRows.filter((operator) => statusKey(operator.status) === 'inactive').length;
    const pendingOperators = operatorRows.filter((operator) => statusKey(operator.status) === 'pending_approval').length;
    const filteredOperatorRows = operatorStatusFilter
      ? operatorRows.filter((operator) => statusKey(operator.status) === operatorStatusFilter)
      : operatorRows;
    const operatorFilterTitle = operatorStatusFilter ? `${statusLabel(operatorStatusFilter)} Operators` : 'All Operators';

    return (
      <PageShell
        title="Operator Performance Report"
        description="Review operator status, completed tickets, cancellations, and login or activity records."
        actions={<ExportActions onExport={exportOperators} />}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Operators" value={operatorRows.length} icon={FaUserCog} onClick={() => showOperatorRows('')} active={!operatorStatusFilter} />
          <StatCard label="Active Operators" value={activeOperators} icon={FaUserCog} accent="green" onClick={() => showOperatorRows('active')} active={operatorStatusFilter === 'active'} />
          <StatCard label="Pending Operators" value={pendingOperators} icon={FaUserCog} accent="amber" onClick={() => showOperatorRows('pending_approval')} active={operatorStatusFilter === 'pending_approval'} />
          <StatCard label="Inactive Operators" value={inactiveOperators} icon={FaUserCog} accent="red" onClick={() => showOperatorRows('inactive')} active={operatorStatusFilter === 'inactive'} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">{operatorFilterTitle}</h2>
          {operatorStatusFilter && (
            <button
              type="button"
              onClick={() => showOperatorRows('')}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50"
            >
              ← Back to all operators
            </button>
          )}
        </div>
        <OperatorsTable rows={filteredOperatorRows} />
      </PageShell>
    );
  }

  if (routeKey === 'service-centers') {
    return (
      <PageShell
        title="Service Centers Report"
        description="All 18 Banaadir district centers. Open any center to view only that center's full work report."
        actions={<ExportActions onExport={exportTickets} />}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Service Centers" value={reportData.centerPerformanceRows.length} icon={FaBuilding} to="/dashboard/admin/reports/service-centers" />
          <StatCard label="Active Appts" value={reportData.activeAppointments} icon={FaClipboardList} accent="amber" to="/dashboard/admin/reports/queue?status=active" />
          <StatCard label="Completed" value={reportData.completed} icon={FaChartLine} accent="green" to="/dashboard/admin/reports/queue?status=completed" />
          <StatCard label="Waiting" value={reportData.waiting} icon={FaClock} accent="amber" to="/dashboard/admin/reports/queue?status=waiting" />
          <StatCard label="Cancelled / No Show" value={reportData.cancelled + reportData.noShow} icon={FaShieldAlt} accent="red" to="/dashboard/admin/reports/queue?status=cancelled" />
        </div>
        <CenterDirectory rows={reportData.centerPerformanceRows} />
        <ServiceCenterTable rows={reportData.centerPerformanceRows} clickable />
      </PageShell>
    );
  }

  if (routeKey === 'queue') {
    const queueStatusFilter = new URLSearchParams(location.search).get('status');
    const queueRows = tickets.filter((ticket) => {
      if (queueStatusFilter === 'active') return !['Completed', 'Cancelled', 'Rejected', 'Expired', 'No Show'].includes(ticket.status) && !['Completed', 'Rejected', 'Cancelled'].includes(ticket.requestStatus);
      if (queueStatusFilter === 'waiting') return ['Waiting', 'Pending', 'On Hold', 'Being Served', 'In Progress'].includes(ticket.status) || ['Pending', 'Approved', 'Resubmission Required'].includes(ticket.requestStatus);
      if (queueStatusFilter === 'completed') return ticket.status === 'Completed' || ticket.requestStatus === 'Completed';
      if (queueStatusFilter === 'cancelled') return ticket.status === 'Cancelled' || ['No Show', 'NoShow', 'no_show'].includes(ticket.status);
      if (queueStatusFilter === 'no-show') return ['No Show', 'NoShow', 'no_show'].includes(ticket.status);
      return ['Waiting', 'Pending', 'On Hold', 'Being Served', 'In Progress', 'Completed', 'Cancelled', 'No Show'].includes(ticket.status);
    });
    const queueTitle = {
      active: 'Active Appointment Records',
      waiting: 'Waiting Queue Records',
      completed: 'Completed Queue Records',
      cancelled: 'Cancelled / No Show Queue Records',
      'no-show': 'No Show Queue Records',
    }[queueStatusFilter] || 'Queue Records';
    return (
      <PageShell
        title="Queue Analytics Report"
        description="Queue status, active appointments, completed services, waiting work, cancellations, and no-shows."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Active Appts" value={reportData.activeAppointments} icon={FaClipboardList} accent="amber" to="/dashboard/admin/reports/queue?status=active" active={queueStatusFilter === 'active'} />
          <StatCard label="Completed" value={reportData.completed} icon={FaChartLine} accent="green" to="/dashboard/admin/reports/queue?status=completed" active={queueStatusFilter === 'completed'} />
          <StatCard label="Waiting" value={reportData.waiting} icon={FaClock} accent="amber" to="/dashboard/admin/reports/queue?status=waiting" active={queueStatusFilter === 'waiting'} />
          <StatCard label="Cancelled" value={reportData.cancelled} icon={FaShieldAlt} accent="red" to="/dashboard/admin/reports/queue?status=cancelled" active={queueStatusFilter === 'cancelled'} />
          <StatCard label="No Show" value={reportData.noShow} icon={FaShieldAlt} accent="navy" to="/dashboard/admin/reports/queue?status=no-show" active={queueStatusFilter === 'no-show'} />
        </div>
        <RequestsTable rows={queueRows} title={queueTitle} />
      </PageShell>
    );
  }

  if (routeKey === 'citizens') {
    const citizenReportsBase = '/dashboard/admin/reports/citizens';
    const maleRows = tickets.filter((ticket) => citizenGenderKey(ticket) === 'male');
    const femaleRows = tickets.filter((ticket) => citizenGenderKey(ticket) === 'female');
    const maleCitizens = uniqueCitizenCount(maleRows);
    const femaleCitizens = uniqueCitizenCount(femaleRows);
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
            value={stats?.totalCitizens || uniqueCitizenCount(tickets)}
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
        {!isDetailPage && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DistrictBreakdownTable rows={reportData.districtRows} />
            <RequestsTable rows={tickets} title="All Citizen Records" />
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
      </PageShell>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-[#eaf1f8] p-3 text-slate-950 sm:p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-2xl border border-slate-300 bg-[#f7fafc] shadow-2xl shadow-slate-300/40">
        <div className="bg-[#3f94cf] text-white">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl font-black">NQS</div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-black uppercase tracking-wide sm:text-lg">
                  Somali National ID & Queue Management System | National Citizen & Operational Analytics
                </h1>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-sm font-bold md:flex">
              <span className="rounded-full bg-white/20 px-3 py-1">Asma (Admin)</span>
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="flex overflow-x-auto border-t border-white/20 bg-[#2f82bd] px-3">
            {reportCards.map((card) => (
              <Link
                key={card.path}
                to={card.path}
                className={`inline-flex min-w-max items-center gap-2 border-b-4 px-4 py-3 text-sm font-bold transition ${
                  card.path === '/dashboard/admin/reports'
                    ? 'border-white bg-white/10 text-white'
                    : 'border-transparent text-blue-50 hover:bg-white/10'
                }`}
              >
                <card.icon />
                {card.title}
              </Link>
            ))}
            <button
              type="button"
              onClick={exportTickets}
              className="inline-flex min-w-max items-center gap-2 border-b-4 border-transparent px-4 py-3 text-sm font-bold text-blue-50 hover:bg-white/10"
            >
              <FaDownload /> Export Reports
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <motion.div variants={item} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-3 xl:grid-cols-7">
            <input
              type="text"
              value={`${filters.startDate || '01/01/2026'} - ${filters.endDate || todayKey}`}
              readOnly
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
            />
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) navigate(`/dashboard/admin/reports/service-centers/${event.target.value}`);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="">Center: All Centers</option>
              {reportData.centerPerformanceRows.map((center) => (
                <option key={center.id} value={center.id}>{center.label}</option>
              ))}
            </select>
            <select value={filters.district} onChange={(event) => setFilters((current) => ({ ...current, district: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
              <option value="">District: All</option>
              {reportData.options.districts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) navigate(`/dashboard/admin/reports/services/${requestTypeSlugs[event.target.value]}`);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="">Service: All</option>
              {Object.entries(requestTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) navigate(`/dashboard/admin/reports/citizens/${event.target.value}`);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="">Gender: All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
              <option value="">Status: All</option>
              {reportData.options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="button" onClick={exportTickets} className="rounded-lg bg-[#3f94cf] px-3 py-2 text-xs font-black text-white hover:bg-[#2f82bd]">
              Export (PDF/Excel)
            </button>
          </motion.div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adminOverviewCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                icon={card.icon}
                accent={card.accent}
                to={card.to}
              />
            ))}
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default Reports;
