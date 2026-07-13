import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  HiOutlineIdentification,
  HiOutlinePencilSquare,
  HiOutlineArrowPath,
  HiOutlineArrowRight,
  HiOutlineUserPlus,
  HiOutlineCalendarDays,
  HiOutlineQrCode,
  HiOutlineDevicePhoneMobile,
  HiOutlineCheckBadge,
  HiOutlineClock,
} from 'react-icons/hi2';
import api from '../api/axiosInstance';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';

/** Maps backend service names to their booking flows inside the system. */
const serviceFlows = {
  'National ID Registration': {
    path: '/services/new-id-registration',
    icon: HiOutlineIdentification,
    accent: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    action: 'Apply Now',
  },
  'Update National ID Information': {
    path: '/services/update-information',
    icon: HiOutlinePencilSquare,
    accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    action: 'Request Update',
  },
  'Replace Lost National ID': {
    path: '/services/replace-lost-id',
    icon: HiOutlineArrowPath,
    accent: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    action: 'Request Replacement',
  },
};

const processSteps = [
  {
    icon: HiOutlineUserPlus,
    title: '1. Submit Your Request',
    text: 'Choose a service from the Available Services tab and complete the application form with your details.',
  },
  {
    icon: HiOutlineCalendarDays,
    title: '2. Appointment Booked',
    text: 'Pick a center, date, and time slot. Your appointment is reserved instantly and confirmed by email.',
  },
  {
    icon: HiOutlineQrCode,
    title: '3. Receive QR Ticket',
    text: 'A secure QR ticket is generated for your appointment. Save it on your phone or print it.',
  },
  {
    icon: HiOutlineDevicePhoneMobile,
    title: '4. Track Your Queue',
    text: 'On the appointment day, follow your live queue position from the My Requests tab or Check Queue Status.',
  },
  {
    icon: HiOutlineCheckBadge,
    title: '5. Visit & Complete',
    text: 'Arrive when your number is near, present your QR ticket at the counter, and complete your service.',
  },
];

const statusBadge = (status) => {
  const base = 'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold';
  if (status === 'Completed') return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  if (status === 'Cancelled' || status === 'Rejected') return `${base} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`;
  if (status === 'Being Served') return `${base} bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300`;
  return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
};

const requestStage = (booking) => {
  const status = booking.requestType === 'new_national_id'
    ? booking.status
    : (booking.requestStatus || booking.status);
  if (status === 'Completed') return 'Service completed';
  if (status === 'Cancelled' || status === 'Rejected') return 'Closed — see reason';
  if (status === 'Being Served') return 'At the counter now';
  if (status === 'Approved') return 'Approved — visit the center';
  return 'Waiting for appointment day';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const CitizenServices = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [servicesRes, bookingsRes] = await Promise.all([
          api.get('/api/services'),
          api.get('/api/bookings/my'),
        ]);
        setServices(servicesRes.data.data || []);
        setBookings(bookingsRes.data.data || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load your services.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const tabs = useMemo(() => ([
    { key: 'available', label: 'Available Services', count: services.length },
    { key: 'requests', label: 'My Requests', count: bookings.length },
    { key: 'process', label: 'Process Guide' },
  ]), [services.length, bookings.length]);

  const requestColumns = [
    {
      header: 'Ticket',
      accessor: 'ref',
      render: (row) => <span className="whitespace-nowrap font-mono font-bold text-blue-700 dark:text-blue-300">{row.ref}</span>,
    },
    {
      header: 'Service',
      accessor: 'service',
      sortValue: (row) => row.service?.name || '',
      render: (row) => row.service?.name || '—',
    },
    {
      header: 'Center',
      accessor: 'center',
      sortValue: (row) => row.center?.name || '',
      render: (row) => row.center?.name || '—',
    },
    {
      header: 'Appointment',
      accessor: 'date',
      sortValue: (row) => row.date || '',
      render: (row) => (
        <span className="whitespace-nowrap">
          {formatDate(row.date)}
          {row.timeSlot ? <span className="block text-xs text-slate-500 dark:text-slate-400">{row.timeSlot}</span> : null}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortValue: (row) => row.requestStatus || row.status || '',
      render: (row) => (
        <span className={statusBadge(row.requestType === 'new_national_id' ? row.status : (row.requestStatus || row.status))}>
          {row.requestType === 'new_national_id' ? row.status : (row.requestStatus || row.status)}
        </span>
      ),
    },
    {
      header: 'Current Stage',
      accessor: '_stage',
      sortable: false,
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <HiOutlineClock className="h-4 w-4 text-blue-500" />
          {requestStage(row)}
        </span>
      ),
    },
    {
      header: 'Track',
      accessor: '_track',
      sortable: false,
      render: (row) => (
        <Link
          to={`/track?ref=${row.ref}`}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-950/40"
        >
          Live Queue <HiOutlineArrowRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-2 sm:p-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">My Services</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Apply for National ID services, follow your requests, and understand each step of the process — all in one place.
        </p>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1 — Available services */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {loading && [...Array(3)].map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-[#1d355f] dark:bg-[#0b2444]" />
          ))}
          {!loading && services.map((service) => {
            const flow = serviceFlows[service.name] || {
              path: '/services/new-id-registration',
              icon: HiOutlineIdentification,
              accent: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
              action: 'Apply Now',
            };
            const Icon = flow.icon;
            return (
              <article
                key={service._id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#1d355f] dark:bg-[#071a33]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${flow.accent}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-base font-black text-slate-900 dark:text-white">{service.name}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{service.description}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <HiOutlineClock className="h-4 w-4" /> ~{service.duration || 15} min at the counter
                  </span>
                </div>
                <Link
                  to={flow.path}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold uppercase text-white transition hover:bg-blue-700"
                >
                  {flow.action} <HiOutlineArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
          {!loading && services.length === 0 && (
            <p className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-[#1d355f] dark:bg-[#071a33] dark:text-slate-400">
              No services are available right now. Please check back later.
            </p>
          )}
        </div>
      )}

      {/* Tab 2 — My requests */}
      {activeTab === 'requests' && (
        <DataTable
          columns={requestColumns}
          data={bookings}
          loading={loading}
          searchPlaceholder="Search by ticket, service, or center..."
          emptyTitle="No requests yet"
          emptyText="Apply for a service from the Available Services tab — your requests and their progress will appear here."
        />
      )}

      {/* Tab 3 — Process guide */}
      {activeTab === 'process' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1d355f] dark:bg-[#071a33]">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">How Your Request Moves Through the System</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Every National ID service follows the same five steps, from application to completion.
          </p>
          <ol className="relative mt-8 space-y-8 border-l-2 border-blue-200 pl-8 dark:border-blue-500/30">
            {processSteps.map(({ icon: Icon, title, text }) => (
              <li key={title} className="relative">
                <span className="absolute -left-[3.05rem] flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-200 bg-white text-blue-700 dark:border-blue-500/30 dark:bg-[#0b2444] dark:text-blue-300">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            Cancelled or rejected requests always include a reason, and you can resubmit directly from the My Requests tab.
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenServices;
