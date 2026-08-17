import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiCalendar, FiChevronRight, FiHelpCircle, FiSearch, FiUsers } from 'react-icons/fi';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import {
  getServiceIcon,
  getServiceId,
  getServicePath,
  isLostIdService,
  isNewIdService,
  isUpdateInfoService
} from '../utils/serviceRouting';

const registeredStatuses = new Set(['Waiting', 'Pending', 'Scheduled', 'Resubmitted', 'Now Serving', 'Being Served', 'In Progress', 'Completed', 'On Hold']);
const registeredRequestStatuses = new Set(['Pending', 'Approved', 'Completed', 'Resubmission Required']);

const hasNewRegistration = (ticket) => (
  ticket?.requestType === 'new_national_id' &&
  (
    registeredStatuses.has(ticket.status) ||
    registeredRequestStatuses.has(ticket.requestStatus) ||
    ticket.needsResubmission === true
  )
);

const toneStyles = {
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
};

const shortcutTiles = [
  { key: 'track-queue', title: 'Track Queue', description: 'Check your queue status and estimated waiting time.', path: '/dashboard/user/track', icon: FiUsers, tone: 'green' },
  { key: 'my-appointments', title: 'My Appointments', description: 'View, manage or reschedule your appointments.', path: '/dashboard/user/my-appointments', icon: FiCalendar, tone: 'blue' },
  { key: 'help-support', title: 'Help & Support', description: 'Get help with FAQs or contact our support team.', path: '/faq', icon: FiHelpCircle, tone: 'purple' },
];

const Services = () => {
  const { isCitizen, isAuthenticated, user } = useAuth();
  const [services, setServices] = useState([]);
  const [ownBookings, setOwnBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await apiClient.get('/api/services');
        setServices(res.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Service information is temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isCitizen) {
      setOwnBookings([]);
      return;
    }

    const loadOwnBookings = async () => {
      try {
        const res = await apiClient.get('/api/bookings/my');
        setOwnBookings(Array.isArray(res.data) ? res.data : []);
      } catch {
        setOwnBookings([]);
      }
    };
    loadOwnBookings();
  }, [isAuthenticated, isCitizen]);

  const alreadyRegistered = useMemo(
    () => ['ACTIVE', 'COMPLETED', 'ISSUED', 'WAITING', 'UNDER_REVIEW'].includes(String(user?.nationalIdStatus || '').toUpperCase()) || ownBookings.some(hasNewRegistration),
    [ownBookings, user?.nationalIdStatus]
  );
  const hasIssuedNationalId = ['ACTIVE', 'COMPLETED', 'ISSUED'].includes(String(user?.nationalIdStatus || '').toUpperCase());

  const serviceTiles = useMemo(() => {
    const toneFor = (service) => {
      if (isNewIdService(service)) return 'blue';
      if (isUpdateInfoService(service)) return 'purple';
      if (isLostIdService(service)) return 'amber';
      return 'blue';
    };

    return [...services]
      .filter((service) => String(service.category || '').toLowerCase().includes('national id'))
      .sort((a, b) => {
        const rank = (service) => {
          if (isNewIdService(service)) return 0;
          if (isUpdateInfoService(service)) return 1;
          if (isLostIdService(service)) return 2;
          return 10;
        };
        return rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || ''));
      })
      .map((service) => {
        const isNewRegistrationTile = isNewIdService(service);
        const needsIssuedId = isUpdateInfoService(service) || isLostIdService(service);
        const disabled = alreadyRegistered && isNewRegistrationTile;
        const ineligible = needsIssuedId && isAuthenticated && isCitizen && !hasIssuedNationalId &&
          !ownBookings.some((ticket) => ticket.requestType === 'new_national_id' && ticket.requestStatus === 'Completed');
        return {
          key: getServiceId(service) || service.name,
          title: isNewRegistrationTile ? 'New Registration' : service.name,
          description: service.description || 'Book this National ID service at your selected Banaadir center.',
          path: getServicePath(service),
          icon: getServiceIcon(service),
          tone: toneFor(service),
          disabledLabel: disabled ? 'Already registered' : ineligible ? 'Requires issued National ID' : '',
        };
      });
  }, [alreadyRegistered, hasIssuedNationalId, isAuthenticated, isCitizen, ownBookings, services]);

  const allTiles = useMemo(() => [...serviceTiles, ...shortcutTiles], [serviceTiles]);
  const visibleTiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allTiles;
    return allTiles.filter((tile) => tile.title.toLowerCase().includes(term) || tile.description.toLowerCase().includes(term));
  }, [allTiles, search]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-24 pt-4 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <section>
          <h1 className="flex items-center gap-2 text-2xl font-black text-[#0B3A75] sm:text-3xl">
            <FiBriefcase className="text-blue-700" /> Services
          </h1>
          <p className="mt-1 text-sm text-slate-600">Choose a service</p>
        </section>

        <section className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <FiSearch className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </section>

        {loading && <p className="text-sm text-slate-500">Loading live services...</p>}
        {!loading && error && <p className="text-sm text-amber-700">{error}</p>}
        {alreadyRegistered && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            You already have a National ID. You may only update your information or request a replacement for a lost ID.
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!loading && visibleTiles.length === 0 && (
            <div className="rounded-2xl border border-blue-100 bg-white p-6 text-sm font-semibold text-slate-600 sm:col-span-2">
              No services match your search.
            </div>
          )}
          {visibleTiles.map((tile) => {
            const Icon = tile.icon;
            const isDisabled = Boolean(tile.disabledLabel);
            const content = (
              <>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneStyles[tile.tone]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-black text-[#082A55]">{tile.title}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{tile.disabledLabel || tile.description}</span>
                </span>
                <FiChevronRight className="shrink-0 text-slate-300" />
              </>
            );

            return isDisabled ? (
              <div key={tile.key} className="flex cursor-not-allowed items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 opacity-60 shadow-sm">
                {content}
              </div>
            ) : (
              <Link
                key={tile.key}
                to={tile.path}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                {content}
              </Link>
            );
          })}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-blue-100 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <FiBriefcase />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#06194A]">Need to visit a center?</p>
            <p className="truncate text-xs text-slate-500">Some services require an in-person visit. Find your nearest center.</p>
          </div>
          <Link to="/centers" className="shrink-0 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800">
            Find Centers
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Services;
