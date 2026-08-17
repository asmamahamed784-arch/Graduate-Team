import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowRight,
  FiChevronRight,
  FiClock,
  FiInfo,
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiSearch,
  FiSliders,
  FiUsers,
} from 'react-icons/fi';
import { apiClient } from '../api/apiClient';
import Modal from '../components/Modal';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = { Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };
const ICON_TONES = ['bg-blue-50 text-blue-600', 'bg-purple-50 text-purple-600', 'bg-amber-50 text-amber-600', 'bg-rose-50 text-rose-600'];

const parseTimeToMinutes = (value) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const formatTime12h = (value) => {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return value || '';
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
};

const formatWorkingDays = (workingDays) => {
  if (!workingDays?.length) return 'Hours vary';
  if (workingDays.length === 7) return 'Every day';
  if (workingDays.length === 1) return DAY_ABBR[workingDays[0]] || workingDays[0];
  return `${DAY_ABBR[workingDays[0]] || workingDays[0]} - ${DAY_ABBR[workingDays[workingDays.length - 1]] || workingDays[workingDays.length - 1]}`;
};

/** Real open/closed status from the center's own schedule (startTime/endTime/
 *  workingDays/closedDays/isActive) — not a display-only "hours" string. */
const getCenterOpenStatus = (center) => {
  if (center.isActive === false || center.status === 'Inactive') return 'closed';

  const workingDays = Array.isArray(center.workingDays) && center.workingDays.length ? center.workingDays : WEEK_DAYS;
  const closedDays = Array.isArray(center.closedDays) ? center.closedDays : [];
  const now = new Date();
  const todayName = WEEK_DAYS[now.getDay()];
  if (!workingDays.includes(todayName) || closedDays.includes(todayName)) return 'closed';

  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  const startMinutes = parseTimeToMinutes(center.startTime) ?? 0;
  const endMinutes = parseTimeToMinutes(center.endTime) ?? (24 * 60);
  if (nowMinutes < startMinutes || nowMinutes >= endMinutes) return 'closed';
  if (endMinutes - nowMinutes <= 30) return 'closing-soon';
  return 'open';
};

const statusMeta = {
  open: { label: 'Open', badge: 'bg-emerald-100 text-emerald-700' },
  'closing-soon': { label: 'Closing Soon', badge: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Closed', badge: 'bg-red-100 text-red-700' },
};

const filterChips = [
  { key: 'all', label: 'All' },
  { key: 'near-me', label: 'Near Me' },
  { key: 'open-now', label: 'Open Now' },
];

function Centers() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCenter, setSelectedCenter] = useState(null);

  useEffect(() => {
    const loadCenters = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await apiClient.get('/api/centers/list');
        setCenters((res.data || []).map((center) => ({
          ...center,
          id: center._id || center.id,
          district: center.district || center.city || 'Banaadir',
          address: center.address || center.location || 'Address pending',
          phone: center.phone || center.contactNumber || 'Contact pending',
          counters: Number(center.counters || center.counterCount || 0),
        })));
      } catch (err) {
        setCenters([]);
        setError(err.response?.data?.message || 'Unable to load centers right now.');
      } finally {
        setLoading(false);
      }
    };

    loadCenters();
  }, []);

  const filtered = useMemo(() => {
    const search = query.toLowerCase().trim();
    let list = centers;

    if (search) {
      list = list.filter((center) =>
        center.name?.toLowerCase().includes(search) ||
        center.district?.toLowerCase().includes(search) ||
        center.address?.toLowerCase().includes(search)
      );
    }

    if (activeFilter === 'open-now') {
      list = list.filter((center) => getCenterOpenStatus(center) !== 'closed');
    }

    return [...list].sort((a, b) => (
      String(a.district || '').localeCompare(String(b.district || '')) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    ));
  }, [activeFilter, centers, query]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.info('Location access is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => toast.info('Distance-based sorting is coming soon — showing all centers for now.'),
      () => toast.error('Could not access your location.')
    );
    setActiveFilter('near-me');
  };

  const directionsUrl = (center) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${center.name} ${center.address}`)}`;

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-10 pt-4 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <section>
          <h1 className="flex items-center gap-2 text-2xl font-black text-[#0B3A75] sm:text-3xl">
            <FiMapPin className="text-blue-700" /> Centers
          </h1>
          <p className="mt-1 text-sm text-slate-600">Find service centers</p>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
              <FiMapPin />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-[#0B2E59]">Find a center near you</h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-600">
                Search or allow location access to find the nearest NQS service centers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUseLocation}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm hover:bg-blue-100"
          >
            <FiNavigation /> Use my location
          </button>
        </section>

        <section className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <FiSearch className="shrink-0 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by center name or location..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
            <FiSliders />
          </span>
        </section>

        <section className="flex gap-2 overflow-x-auto pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveFilter(chip.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                activeFilter === chip.key
                  ? 'bg-[#0B2E59] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </section>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
            Loading service centers...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
            No centers match your search.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <section className="space-y-3">
            {filtered.map((center, index) => {
              const status = getCenterOpenStatus(center);
              const meta = statusMeta[status];
              return (
                <button
                  key={center.id}
                  type="button"
                  onClick={() => setSelectedCenter(center)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${ICON_TONES[index % ICON_TONES.length]}`}>
                    <FiMapPin />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-black text-[#06194A]">{center.name}</h3>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${meta.badge}`}>{meta.label}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                      <FiMapPin className="shrink-0" /> {center.district}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 truncate">
                        <FiClock className="shrink-0" /> {formatWorkingDays(center.workingDays)} &middot; {formatTime12h(center.startTime)} - {formatTime12h(center.endTime)}
                      </span>
                      <span className="shrink-0 font-bold text-blue-600">{status === 'closing-soon' ? 'Get Directions' : 'View Details'}</span>
                    </div>
                  </div>
                  <FiChevronRight className="shrink-0 text-slate-300" />
                </button>
              );
            })}
          </section>
        )}
      </div>

      <Modal isOpen={Boolean(selectedCenter)} onClose={() => setSelectedCenter(null)} title={selectedCenter?.name || 'Center Details'} className="max-w-md border border-slate-200 bg-white">
        {selectedCenter && (
          <div className="space-y-4 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-500">{selectedCenter.district}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${statusMeta[getCenterOpenStatus(selectedCenter)].badge}`}>
                {statusMeta[getCenterOpenStatus(selectedCenter)].label}
              </span>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p className="flex items-start gap-2"><FiMapPin className="mt-0.5 shrink-0 text-[#0B3A75]" /> {selectedCenter.address}</p>
              <p className="flex items-center gap-2"><FiPhone className="shrink-0 text-[#0B3A75]" /> {selectedCenter.phone}</p>
              <p className="flex items-center gap-2">
                <FiClock className="shrink-0 text-[#0B3A75]" />
                {formatWorkingDays(selectedCenter.workingDays)} &middot; {formatTime12h(selectedCenter.startTime)} - {formatTime12h(selectedCenter.endTime)}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-[#0B3A75]">
                <FiUsers />
                <span className="text-lg font-black">{selectedCenter.counters}</span>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Active Counters</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/dashboard/user/new-id-registration"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3A75] px-4 py-3 text-sm font-black text-white hover:bg-[#092B5A]"
              >
                Book Appointment <FiArrowRight />
              </Link>
              <a
                href={directionsUrl(selectedCenter)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                <FiNavigation /> Directions
              </a>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <FiInfo className="mt-0.5 shrink-0 text-[#0B3A75]" />
              Counter and hours information is loaded directly from the center's schedule.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Centers;
