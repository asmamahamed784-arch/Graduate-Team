import React, { useEffect, useMemo, useState } from 'react';
import {
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit3,
  FiFilter,
  FiMapPin,
  FiMoreVertical,
  FiSearch,
  FiUserCheck,
  FiUsers,
  FiXCircle
} from 'react-icons/fi';
import { useDashboard } from '../hooks';
import api from '../api/axiosInstance';
import { apiClient } from '../api/apiClient';

const formatNumber = (value) => Number(value || 0).toLocaleString();

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
  appointment.requestStatus ||
  appointment.status ||
  'Waiting'
);

const statusStyles = {
  Waiting: 'bg-amber-100 text-amber-800',
  Pending: 'bg-amber-100 text-amber-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-800',
  Rejected: 'bg-rose-100 text-rose-800',
  'Correction Required': 'bg-orange-100 text-orange-700',
  'Resubmission Required': 'bg-orange-100 text-orange-700',
  'Being Served': 'bg-blue-100 text-blue-800',
  'On Hold': 'bg-slate-100 text-slate-700'
};

const periodOptions = ['Today', 'This Week', 'This Month', 'All Time'];

function AdminDashboard() {
  const { loading, adminStats } = useDashboard();
  const [appointments, setAppointments] = useState([]);
  const [centers, setCenters] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    district: '',
    center: '',
    serviceType: '',
    date: '',
    period: 'This Week'
  });

  useEffect(() => {
    let mounted = true;
    const loadRecords = async () => {
      setRecordsLoading(true);
      try {
        const [bookingsRes, centersRes] = await Promise.all([
          api.get('/api/bookings/admin/all'),
          apiClient.get('/api/centers/list')
        ]);
        if (!mounted) return;
        setAppointments(Array.isArray(bookingsRes.data?.data) ? bookingsRes.data.data : []);
        const centerRows = Array.isArray(centersRes.data?.data)
          ? centersRes.data.data
          : Array.isArray(centersRes.data)
            ? centersRes.data
            : [];
        setCenters(centerRows);
      } catch {
        if (!mounted) return;
        setAppointments([]);
        setCenters([]);
      } finally {
        if (mounted) setRecordsLoading(false);
      }
    };

    loadRecords();
    return () => {
      mounted = false;
    };
  }, []);

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
      date: dateKey(appointment.date || appointment.appointmentDate || appointment.createdAt),
      time: appointment.timeSlot || appointment.time || appointment.registrationDetails?.timeSlot || ''
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

  const filteredAppointments = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return normalizedAppointments.filter((appointment) => {
      const searchable = [
        appointment.ticketId,
        appointment.citizenName,
        appointment.district,
        appointment.centerName,
        appointment.serviceType,
        appointment.status
      ].join(' ').toLowerCase();

      if (term && !searchable.includes(term)) return false;
      if (filters.status && appointment.status !== filters.status) return false;
      if (filters.district && appointment.district !== filters.district) return false;
      if (filters.center && appointment.centerId !== filters.center && appointment.centerName !== filters.center) return false;
      if (filters.serviceType && appointment.requestType !== filters.serviceType) return false;
      if (filters.date && appointment.date !== filters.date) return false;
      if (filters.period === 'Today' && appointment.date !== todayKey) return false;
      if (filters.period === 'This Week' && appointment.date < thisWeekStart) return false;
      if (filters.period === 'This Month' && appointment.date < thisMonthStart) return false;
      return true;
    });
  }, [filters, normalizedAppointments, thisMonthStart, thisWeekStart, todayKey]);

  useEffect(() => {
    setPage(1);
  }, [filters, rowsPerPage]);

  const stats = useMemo(() => {
    const statusMatches = (values) => normalizedAppointments.filter((item) => values.includes(item.status)).length;
    const todayAppointments = normalizedAppointments.filter((item) => item.date === todayKey);
    return {
      totalCitizens: adminStats?.totalUsers ?? 0,
      activeOperators: adminStats?.activeOperators ?? 0,
      pendingRequests: statusMatches(['Waiting', 'Pending', 'Resubmission Required']),
      approvedToday: todayAppointments.filter((item) => ['Approved', 'Completed'].includes(item.status)).length,
      serviceCenters: adminStats?.serviceCenters ?? centers.length,
      waitingQueue: adminStats?.waitingQueue ?? statusMatches(['Waiting']),
      lostRequests: normalizedAppointments.filter((item) => item.requestType === 'lost_replacement').length,
      updateRequests: normalizedAppointments.filter((item) => item.requestType === 'update_information').length
    };
  }, [adminStats, centers.length, normalizedAppointments, todayKey]);

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
      .map((center) => ({
        id: center.id || center._id || center.name,
        name: center.name
      }))
      .filter((item) => item.id && item.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [centers, filters.district]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / rowsPerPage));
  const visibleRows = filteredAppointments.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const exportCsv = () => {
    const headings = ['Ticket ID', 'Citizen Name', 'District', 'Center', 'Service Type', 'Status', 'Appointment Date'];
    const rows = filteredAppointments.map((item) => [
      item.ticketId,
      item.citizenName,
      item.district,
      item.centerName,
      item.serviceType,
      item.status,
      `${displayDate(item.date)} ${item.time}`.trim()
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

  const dashboardCards = [
    { label: 'Total Citizens', value: stats.totalCitizens, icon: FiUsers, tone: 'blue', note: 'from database', action: () => {} },
    { label: 'Active Operators', value: stats.activeOperators, icon: FiUserCheck, tone: 'green', note: 'currently active', action: () => {} },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: FiCalendar, tone: 'yellow', note: 'needs review', action: () => updateFilter('status', 'Pending') },
    { label: 'Approved Today', value: stats.approvedToday, icon: FiCheckCircle, tone: 'purple', note: displayDate(todayKey), action: () => updateFilter('period', 'Today') },
    { label: 'Service Centers', value: stats.serviceCenters, icon: FiBriefcase, tone: 'indigo', note: 'Banaadir centers', action: () => {} },
    { label: 'Waiting Queue', value: stats.waitingQueue, icon: FiUsers, tone: 'orange', note: 'waiting now', action: () => updateFilter('status', 'Waiting') },
    { label: 'Lost ID Requests', value: stats.lostRequests, icon: FiXCircle, tone: 'rose', note: 'replacement cases', action: () => updateFilter('serviceType', 'lost_replacement') },
    { label: 'Update Requests', value: stats.updateRequests, icon: FiEdit3, tone: 'cyan', note: 'information updates', action: () => updateFilter('serviceType', 'update_information') }
  ];

  if (loading || recordsLoading) {
    return (
      <main className="nqs-admin-modern flex min-h-screen items-center justify-center bg-[#f8fbff]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563eb] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="nqs-admin-modern min-h-screen bg-[#f8fbff] text-[#071a33]">
      <div className="space-y-6 p-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-[#071a33]">Admin Dashboard</h2>
            <p className="mt-2 text-base font-medium text-[#62708a]">
              Overview of National ID operations and citizen service requests
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block min-w-[320px]">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#62708a]" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Search citizens, tickets, ID numbers..."
                className="nqs-admin-input h-12 w-full rounded-lg border border-[#d7e1ee] bg-white pl-12 pr-4 text-sm font-semibold text-[#071a33] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
            <select
              value={filters.period}
              onChange={(event) => updateFilter('period', event.target.value)}
              className="nqs-admin-input h-12 w-full rounded-lg border border-[#d7e1ee] bg-white px-4 text-sm font-black text-[#071a33] outline-none lg:w-44"
            >
              {periodOptions.map((period) => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {dashboardCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={card.action}
              className="nqs-admin-metric-card rounded-xl border border-[#d7e1ee] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2563eb]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className={`nqs-admin-card-icon nqs-tone-${card.tone} flex h-14 w-14 items-center justify-center rounded-full`}>
                  <card.icon className="h-7 w-7" />
                </span>
                <Sparkline tone={card.tone} />
              </div>
              <p className="mt-4 text-sm font-black text-[#071a33]">{card.label}</p>
              <strong className="mt-1 block text-2xl font-black text-[#071a33]">{formatNumber(card.value)}</strong>
              <p className="mt-4 text-sm font-semibold text-[#62708a]">{card.note}</p>
            </button>
          ))}
        </section>

        <section className="nqs-admin-table-card overflow-hidden rounded-xl border border-[#d7e1ee] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#d7e1ee] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <FiCalendar className="h-6 w-6 text-[#2563eb]" />
              <h2 className="text-xl font-black text-[#071a33]">Recent Appointments</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:flex">
              <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="nqs-admin-input h-10 rounded-lg border border-[#d7e1ee] bg-white px-3 text-sm font-bold text-[#071a33]">
                <option value="">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select value={filters.district} onChange={(event) => updateFilter('district', event.target.value)} className="nqs-admin-input h-10 rounded-lg border border-[#d7e1ee] bg-white px-3 text-sm font-bold text-[#071a33]">
                <option value="">All districts</option>
                {districts.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
              <select value={filters.center} onChange={(event) => updateFilter('center', event.target.value)} className="nqs-admin-input h-10 rounded-lg border border-[#d7e1ee] bg-white px-3 text-sm font-bold text-[#071a33]">
                <option value="">All centers</option>
                {centerOptions.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
              <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} className="nqs-admin-input h-10 rounded-lg border border-[#d7e1ee] bg-white px-3 text-sm font-bold text-[#071a33]" />
              <select value={filters.serviceType} onChange={(event) => updateFilter('serviceType', event.target.value)} className="nqs-admin-input h-10 rounded-lg border border-[#d7e1ee] bg-white px-3 text-sm font-bold text-[#071a33]">
                <option value="">All services</option>
                <option value="new_national_id">New Registration</option>
                <option value="update_information">Update Information</option>
                <option value="lost_replacement">Lost ID Replacement</option>
              </select>
              <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d7e1ee] bg-white px-4 text-sm font-black text-[#071a33]">
                <FiFilter /> Filter
              </button>
              <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-black text-white">
                <FiDownload /> Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto px-4 pt-4">
            <table className="min-w-full overflow-hidden rounded-lg border border-[#d7e1ee] text-left text-sm">
              <thead className="bg-[#f4f8ff] text-xs uppercase text-[#071a33]">
                <tr>
                  {['Ticket ID', 'Citizen Name', 'District', 'Center', 'Service Type', 'Status', 'Appointment Date', 'Actions'].map((heading) => (
                    <th key={heading} className="px-4 py-4 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d7e1ee]">
                {visibleRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center font-semibold text-[#62708a]" colSpan={8}>
                      No appointments match the selected filters.
                    </td>
                  </tr>
                )}
                {visibleRows.map((appointment) => (
                  <tr key={appointment.id || appointment.ticketId} className="bg-white hover:bg-[#f8fbff]">
                    <td className="px-4 py-4 font-black text-[#2563eb]">{appointment.ticketId}</td>
                    <td className="px-4 py-4 font-semibold text-[#071a33]">{appointment.citizenName}</td>
                    <td className="px-4 py-4 font-semibold text-[#071a33]">
                      <span className="inline-flex items-center gap-1.5"><FiMapPin className="text-[#071a33]" /> {appointment.district}</span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#071a33]">{appointment.centerName}</td>
                    <td className="px-4 py-4 font-semibold text-[#071a33]">{appointment.serviceType}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-md px-3 py-1 text-xs font-black uppercase ${statusStyles[appointment.status] || 'bg-blue-100 text-blue-800'}`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#071a33]">
                      <span className="inline-flex items-start gap-2">
                        <FiCalendar className="mt-0.5 text-[#62708a]" />
                        <span>{displayDate(appointment.date)}<br /><span className="text-xs text-[#62708a]">{appointment.time || '--'}</span></span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button type="button" className="rounded-md p-2 text-[#071a33] hover:bg-[#eef4ff]" aria-label="Appointment actions">
                        <FiMoreVertical />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 px-4 py-4 text-sm font-semibold text-[#62708a] md:flex-row md:items-center md:justify-between">
            <span>
              Showing {filteredAppointments.length ? ((page - 1) * rowsPerPage) + 1 : 0} to {Math.min(page * rowsPerPage, filteredAppointments.length)} of {filteredAppointments.length} entries
            </span>
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-[#d7e1ee] p-2 text-[#071a33]" aria-label="Previous page">
                <FiChevronLeft />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-9 w-9 rounded-md text-sm font-black ${page === pageNumber ? 'bg-[#2563eb] text-white' : 'border border-[#d7e1ee] text-[#071a33]'}`}
                >
                  {pageNumber}
                </button>
              ))}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-md border border-[#d7e1ee] p-2 text-[#071a33]" aria-label="Next page">
                <FiChevronRight />
              </button>
            </div>
            <label className="flex items-center gap-3">
              Rows per page
              <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))} className="nqs-admin-input h-10 rounded-lg border border-[#d7e1ee] bg-white px-3 text-sm font-bold text-[#071a33]">
                {[5, 10, 25].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>
    </main>
  );
}

const Sparkline = ({ tone }) => {
  const stroke = {
    blue: '#2563eb',
    green: '#22c55e',
    yellow: '#f59e0b',
    purple: '#8b5cf6',
    indigo: '#2563eb',
    orange: '#f97316',
    rose: '#e11d48',
    cyan: '#0891b2'
  }[tone] || '#2563eb';

  return (
    <svg className="h-12 w-28" viewBox="0 0 112 48" fill="none" aria-hidden="true">
      <path d="M2 38 C12 34 16 36 24 30 C32 24 35 36 43 25 C51 14 56 29 64 16 C74 0 81 22 90 14 C99 7 104 18 110 14" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

export default AdminDashboard;
