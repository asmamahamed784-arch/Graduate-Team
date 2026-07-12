import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiEdit3, FiRefreshCw } from 'react-icons/fi';
import { FaIdCard } from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
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
    path: '/services/new-id-registration',
    icon: FaIdCard,
    image: newNationalImage
  },
  {
    name: UPDATE_INFO_SERVICE_NAME,
    title: 'Update National ID Information',
    fallbackDescription: 'Request a correction or update to your existing National ID information.',
    path: '/services/update-information',
    icon: FiEdit3,
    image: updateNationalImage
  },
  {
    name: LOST_ID_SERVICE_NAME,
    title: 'Replace Lost National ID',
    fallbackDescription: 'Book a replacement appointment if your National ID card is lost.',
    path: '/services/replace-lost-id',
    icon: FiRefreshCw,
    image: lostIdImage
  }
];

const Services = () => {
  const [services, setServices] = useState([]);
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

  const cards = useMemo(() => {
    return serviceCards.map((card) => ({
      ...card,
      service: services.find((service) => service.name === card.name)
    }));
  }, [services]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-3 py-10 pt-28 text-slate-900 sm:px-5 lg:px-6">
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
          {cards.map((card) => (
            <article
              key={card.name}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
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
              <Link
                to={card.path}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B3A75] px-4 py-3 text-sm font-black text-white transition hover:bg-[#092B5A]"
              >
                Apply
                <FiArrowRight />
              </Link>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default Services;
