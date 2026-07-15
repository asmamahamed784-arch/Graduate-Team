import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiEdit3, FiRefreshCw } from 'react-icons/fi';
import { FaIdCard } from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import chooseNationalImage from '../assets/images/choose national.png';
import newNationalImage from '../assets/images/new national.png';
import updateNationalImage from '../assets/images/apdate.png';
import lostIdImage from '../assets/images/lost ID.png';
import {
  LOST_ID_SERVICE_NAME,
  NEW_ID_SERVICE_NAME,
  UPDATE_INFO_SERVICE_NAME
} from './appointments/appointmentShared';

const serviceCards = [
  {
    name: NEW_ID_SERVICE_NAME,
    title: 'New National ID Registration',
    fallbackDescription: 'Apply for a new National ID card and book your appointment at a Banaadir center.',
    path: '/dashboard/user/new-id-registration',
    icon: FaIdCard,
    image: newNationalImage
  },
  {
    name: UPDATE_INFO_SERVICE_NAME,
    title: 'Update National ID Information',
    fallbackDescription: 'Request a correction or update to your existing National ID information.',
    path: '/dashboard/user/update-information',
    icon: FiEdit3,
    image: updateNationalImage
  },
  {
    name: LOST_ID_SERVICE_NAME,
    title: 'Replace Lost National ID',
    fallbackDescription: 'Book a replacement appointment if your National ID card is lost.',
    path: '/dashboard/user/replace-lost-id',
    icon: FiRefreshCw,
    image: lostIdImage
  }
];

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

const Services = () => {
  const { isCitizen, isAuthenticated, user } = useAuth();
  const [services, setServices] = useState([]);
  const [ownBookings, setOwnBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    () => Boolean(user?.nationalId || ['ACTIVE', 'COMPLETED'].includes(user?.nationalIdStatus)) || ownBookings.some(hasNewRegistration),
    [ownBookings, user?.nationalId, user?.nationalIdStatus]
  );
  const hasIssuedNationalId = Boolean(user?.nationalId || ['ACTIVE', 'COMPLETED'].includes(user?.nationalIdStatus));

  const cards = useMemo(() => {
    return serviceCards.map((card) => ({
      ...card,
      service: services.find((service) => service.name === card.name)
    }));
  }, [services]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-3 py-6 text-slate-900 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-900/5">
          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_360px] lg:p-8">
            <div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
            National ID Services
              </span>
              <h1 className="mt-4 text-3xl font-black text-[#082A55] sm:text-4xl">Choose Your National ID Service</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Select the service you need. Each service has its own form and workflow.
              </p>
              {loading && <p className="mt-3 text-sm text-slate-500">Loading live services...</p>}
              {!loading && error && <p className="mt-3 text-sm text-amber-700">{error}</p>}
              {alreadyRegistered && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  You already have a National ID. You cannot register for a new National ID. You may only update your information or request a replacement for a lost ID.
                </div>
              )}
            </div>
            <div className="min-h-48 overflow-hidden rounded-2xl bg-blue-50/60">
              <img
                src={chooseNationalImage}
                alt="National ID digital service"
                className="h-56 w-full object-cover"
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card) => {
            const isNewRegistrationCard = card.name === NEW_ID_SERVICE_NAME;
            const needsIssuedId = card.name === UPDATE_INFO_SERVICE_NAME || card.name === LOST_ID_SERVICE_NAME;
            const disabled = alreadyRegistered && isNewRegistrationCard;
            const ineligible = needsIssuedId && isAuthenticated && isCitizen && !hasIssuedNationalId && !ownBookings.some((ticket) => ticket.requestType === 'new_national_id' && ticket.requestStatus === 'Completed');
            return (
            <article
              key={card.name}
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition ${disabled ? 'opacity-65' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
            >
              <div className="mb-4 h-40 overflow-hidden rounded-xl bg-slate-50">
                <img
                  src={card.image}
                  alt={card.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#0B3A75]">
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-black text-[#082A55]">{card.title}</h2>
              <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">
                {card.service?.description || card.fallbackDescription}
              </p>
              {disabled || ineligible ? (
                <button
                  type="button"
                  disabled
                  className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-slate-200 px-4 py-3 text-sm font-black text-slate-500"
                >
                  {disabled ? 'Already registered' : 'Requires issued National ID'}
                </button>
              ) : (
                <Link
                  to={card.path}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B3A75] px-4 py-3 text-sm font-black text-white transition hover:bg-[#092B5A]"
                >
                  Apply
                  <FiArrowRight />
                </Link>
              )}
            </article>
          );
          })}
        </section>
      </div>
    </div>
  );
};

export default Services;
