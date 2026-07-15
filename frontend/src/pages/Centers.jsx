import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiClock,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiUsers,
  FiList,
  FiMap,
  FiArrowRight,
  FiInfo,
} from 'react-icons/fi';
import { apiClient } from '../api/apiClient';
import serviceCenterImage from '../assets/images/service center.png';

const normalizeWaitTime = (center, index) => {
  if (center.waitTime) return center.waitTime;
  const counters = Number(center.counters) || 0;
  if (counters >= 10) return '~15 min';
  if (counters >= 6) return '~20 min';
  return index % 2 === 0 ? '~15 min' : '~20 min';
};

const normalizeStatus = (status) => {
  if (!status || status === 'Open') return 'Active';
  return status;
};

function Centers() {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCenters = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await apiClient.get('/api/centers/list');
        setCenters((res.data || []).map((center, index) => ({
          ...center,
          id: center._id || center.id,
          district: center.district || center.city || 'Banaadir',
          hours: center.hours || '08:00 AM - 05:00 PM',
          counters: Number(center.counters || center.counterCount || 0),
          waitTime: normalizeWaitTime(center, index),
          status: normalizeStatus(center.status),
          address: center.address || center.location || 'Address pending',
          phone: center.phone || center.contactNumber || 'Contact pending',
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
      list = centers.filter((center) =>
        center.name?.toLowerCase().includes(search) ||
        center.district?.toLowerCase().includes(search) ||
        center.address?.toLowerCase().includes(search)
      );
    }

    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [centers, query]);

  const selectedCenter = useMemo(
    () => filtered.find((center) => center.id === selectedCenterId) || filtered[0] || null,
    [filtered, selectedCenterId]
  );

  const counterPanelCenter = useMemo(
    () => filtered.find((center) => center.id === selectedCenterId) || null,
    [filtered, selectedCenterId]
  );

  const totalCounters = useMemo(
    () => filtered.reduce((sum, center) => sum + (Number(center.counters) || 0), 0),
    [filtered]
  );

  const openCounters = (center) => {
    setSelectedCenterId(center.id);
    window.requestAnimationFrame(() => {
      document.getElementById('center-counters-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  return (
    <section className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="nqs-portal-hero bg-[#0B3A75] py-8 text-white sm:py-9">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
              Banaadir National ID Service
            </p>
            <h1 className="max-w-3xl text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
              Find a National ID Center near you
            </h1>
            <p className="mt-3 text-sm leading-6 text-blue-50 sm:text-base">
              Search Banaadir National ID service centers and book your appointment.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200/40 bg-white p-3 shadow-2xl shadow-blue-950/20 dark:border-slate-700/60 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by center name, district, or address"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-950 dark:focus:ring-blue-900/30"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-[#0B3A75] text-white shadow-lg shadow-blue-950/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <FiList /> List View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${viewMode === 'map' ? 'bg-[#0B3A75] text-white shadow-lg shadow-blue-950/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <FiMap /> Map View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">Banaadir National ID Centers</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose a center and continue your appointment booking.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {filtered.length} centers available
            </div>
            <button
              type="button"
              onClick={() => selectedCenter && openCounters(selectedCenter)}
              disabled={!selectedCenter}
              className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-200"
            >
              {totalCounters} counters
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Loading service centers...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            No National ID centers match your search.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          viewMode === 'list' ? (
            <div className="space-y-3">
              {filtered.map((center) => {
                const isActive = ['Active', 'Open'].includes(center.status);

                return (
                  <article key={center.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-[130px_1fr_auto] lg:items-center">
                    <div className="h-24 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-950">
                      <img
                        src={serviceCenterImage}
                        alt={center.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-black text-slate-950 dark:text-slate-100">{center.name}</h3>
                          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{center.district}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCounters(center)}
                          className={`w-fit rounded-full px-3 py-1 text-xs font-black transition ${isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'}`}
                        >
                          {isActive ? 'Active' : center.status}
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
                        <div className="flex items-start gap-2">
                          <FiMapPin className="mt-0.5 shrink-0 text-[#0B3A75]" />
                          <span className="line-clamp-2">{center.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiPhone className="shrink-0 text-[#0B3A75]" />
                          <span>{center.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiClock className="shrink-0 text-[#0B3A75]" />
                          <span>{center.hours}</span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
                        <button
                          type="button"
                          onClick={() => openCounters(center)}
                          className="rounded-xl bg-blue-50 p-3 text-left transition hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/45"
                        >
                          <div className="flex items-center gap-2 text-[#0B3A75]">
                            <FiUsers />
                            <span className="text-base font-black">{center.counters}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Counters</p>
                        </button>
                        <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <FiClock />
                            <span className="text-base font-black">{center.waitTime}</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Estimated Wait</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:w-44">
                      <Link
                        to="/dashboard/user/new-id-registration"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3A75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#092B5A]"
                      >
                        Book Appointment
                        <FiArrowRight />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('map');
                          setSelectedCenterId(center.id);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <FiMap />
                        View Map
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-200 bg-[#eaf4ff] shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="absolute inset-0 opacity-70">
                  <div className="absolute left-[8%] top-[14%] h-28 w-28 rounded-full bg-blue-200/70 blur-2xl" />
                  <div className="absolute bottom-[12%] right-[18%] h-36 w-36 rounded-full bg-emerald-200/70 blur-2xl" />
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,58,117,0.08)_1px,transparent_1px),linear-gradient(rgba(11,58,117,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
                </div>
                <div className="relative h-full p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950 dark:text-white">Banaadir Centers Map</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Click a pin to view center details and counters.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#0B3A75] shadow-sm dark:bg-slate-800 dark:text-blue-200"
                    >
                      Back to List
                    </button>
                  </div>

                  <div className="relative h-[280px] rounded-2xl border border-white/80 bg-white/45 dark:border-slate-700 dark:bg-slate-950/35">
                    {filtered.map((center, index) => {
                      const x = 10 + ((index * 19) % 78);
                      const y = 16 + ((index * 27) % 68);
                      const active = selectedCenter?.id === center.id;
                      return (
                        <button
                          key={center.id}
                          type="button"
                          onClick={() => setSelectedCenterId(center.id)}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 text-white shadow-lg transition hover:scale-110 ${active ? 'bg-emerald-600 ring-4 ring-emerald-200' : 'bg-[#0B3A75]'}`}
                          style={{ left: `${x}%`, top: `${y}%` }}
                          title={center.name}
                        >
                          <FiMapPin className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                {selectedCenter ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Selected Center</p>
                    <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">{selectedCenter.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{selectedCenter.district}</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <p className="flex gap-2"><FiMapPin className="mt-0.5 text-[#0B3A75]" /> {selectedCenter.address}</p>
                      <p className="flex gap-2"><FiPhone className="mt-0.5 text-[#0B3A75]" /> {selectedCenter.phone}</p>
                      <p className="flex gap-2"><FiClock className="mt-0.5 text-[#0B3A75]" /> {selectedCenter.hours}</p>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => openCounters(selectedCenter)}
                        className="rounded-2xl bg-blue-50 p-4 text-left transition hover:bg-blue-100 dark:bg-blue-900/30"
                      >
                        <FiUsers className="text-[#0B3A75]" />
                        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{selectedCenter.counters}</p>
                        <p className="text-xs font-bold text-slate-500">Counters</p>
                      </button>
                      <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                        <FiClock className="text-[#0B3A75]" />
                        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{selectedCenter.waitTime}</p>
                        <p className="text-xs font-bold text-slate-500">Est. wait</p>
                      </div>
                    </div>
                    <Link
                      to="/dashboard/user/new-id-registration"
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B3A75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#092B5A]"
                    >
                      Book Appointment
                      <FiArrowRight />
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select a center pin on the map.</p>
                )}
              </aside>
            </div>
          )
        )}

        {!loading && !error && counterPanelCenter && (
          <section id="center-counters-panel" className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-950 dark:text-white">
                  <FiUsers className="text-[#0B3A75]" />
                  Counters at {counterPanelCenter.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {counterPanelCenter.counters || 0} active counters. Estimated waiting time: {counterPanelCenter.waitTime}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCenterId('')}
                className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: Math.max(Number(counterPanelCenter.counters) || 0, 1) }).map((_, index) => (
                <div key={`${counterPanelCenter.id}-counter-${index + 1}`} className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-center dark:border-blue-900/40 dark:bg-blue-900/20">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-200">Counter</p>
                  <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{index + 1}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Active</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <FiInfo className="mt-0.5 shrink-0 text-[#0B3A75]" />
              <p>Counter information is loaded from the center record and helps citizens choose a center with better capacity.</p>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export default Centers;
