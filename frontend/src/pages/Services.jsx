import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
} from 'react-icons/fi';
import { FaIdCard, FaQrcode } from 'react-icons/fa';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../hooks';
import heroImage from '../assets/images/hero.png';
import serviceCenterImage from '../assets/images/service center.png';
import queueImage from '../assets/images/Queue.jpg';
import {
  LOST_ID_SERVICE_NAME,
  NEW_ID_SERVICE_NAME,
  UPDATE_INFO_SERVICE_NAME
} from './appointments/appointmentShared';

const serviceTabs = [
  {
    key: 'new-id',
    name: NEW_ID_SERVICE_NAME,
    title: 'New National ID Registration',
    shortTitle: 'New ID',
    fallbackDescription: 'Apply for a new National ID card and book your appointment at a Banaadir center.',
    path: '/services/new-id-registration',
    icon: FaIdCard,
    image: serviceCenterImage,
    price: 'Free',
    duration: '15-20 minutes at the center',
    badge: 'First issue',
    overview: [
      'Create a citizen account before starting the request.',
      'Choose your preferred National ID center and appointment slot.',
      'Receive a digital QR ticket after submitting the form.',
      'Visit the center for document review, biometric capture, and final approval.',
    ],
    requirements: [
      'Citizen full name and personal details',
      'Phone number and district information',
      'Birth details and basic identity information',
      'In-person biometric verification at the selected center',
    ],
    process: [
      'Register or sign in to your citizen account.',
      'Complete the New National ID form in the system.',
      'Select a center, date, and time slot.',
      'Present your QR ticket at the center counter.',
    ],
  },
  {
    key: 'update-info',
    name: UPDATE_INFO_SERVICE_NAME,
    title: 'Update National ID Information',
    shortTitle: 'Update Info',
    fallbackDescription: 'Request a correction or update to your existing National ID information.',
    path: '/services/update-information',
    icon: FiEdit3,
    image: heroImage,
    price: '$5',
    duration: '10-15 minutes at the center',
    badge: 'Correction',
    overview: [
      'Submit the information that needs to be corrected.',
      'Provide supporting details for admin review.',
      'Book a visit for document verification if required.',
      'Track the request status from your dashboard.',
    ],
    requirements: [
      'Existing National ID details',
      'Corrected personal information',
      'Reason for the update request',
      'Supporting document information when available',
    ],
    process: [
      'Sign in to enter the service workflow.',
      'Fill the update request form.',
      'Submit corrected details for review.',
      'Follow queue and appointment updates from the system.',
    ],
  },
  {
    key: 'lost-id',
    name: LOST_ID_SERVICE_NAME,
    title: 'Replace Lost National ID',
    shortTitle: 'Lost ID',
    fallbackDescription: 'Book a replacement appointment if your National ID card is lost, stolen, or damaged.',
    path: '/services/replace-lost-id',
    icon: FiRefreshCw,
    image: queueImage,
    price: '$10',
    duration: '10-15 minutes at the center',
    badge: 'Replacement',
    overview: [
      'Request a replacement for a lost, stolen, or damaged National ID.',
      'Confirm your identity details before booking.',
      'Receive a QR appointment ticket for center verification.',
      'Track replacement status from your citizen dashboard.',
    ],
    requirements: [
      'Existing National ID number if known',
      'Full name and phone number',
      'Loss or damage reason',
      'Identity verification at the selected center',
    ],
    process: [
      'Create an account or sign in.',
      'Complete the lost ID replacement request.',
      'Choose your appointment slot.',
      'Bring the QR ticket to the center for verification.',
    ],
  },
];

const detailTabs = [
  { key: 'overview', label: 'Overview', icon: FiFileText },
  { key: 'process', label: 'Process', icon: FiCalendar },
  { key: 'requirements', label: 'Requirements', icon: FiCheckCircle },
  { key: 'fees', label: 'Fees & time', icon: FiClock },
];

const Services = () => {
  const { isAuthenticated, role } = useAuth();
  const isCitizen = isAuthenticated && role === 'citizen';
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeServiceKey, setActiveServiceKey] = useState(serviceTabs[0].key);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');

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
    return serviceTabs.map((card) => ({
      ...card,
      service: services.find((service) => service.name === card.name)
    }));
  }, [services]);

  const activeService = cards.find((card) => card.key === activeServiceKey) || cards[0];
  const ActiveIcon = activeService.icon;

  const selectedItems = activeDetailTab === 'process'
    ? activeService.process
    : activeDetailTab === 'requirements'
      ? activeService.requirements
      : activeService.overview;

  return (
    <div className="min-h-screen bg-[var(--nqs-bg)] text-[var(--nqs-text)]">
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50/70 to-white pt-28 dark:from-[#0b2444] dark:via-[#071a33] dark:to-[#061225]">
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl dark:bg-blue-500/10" />
        <div className="pointer-events-none absolute -right-24 top-32 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl dark:bg-emerald-500/10" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 backdrop-blur dark:border-blue-500/30 dark:bg-white/5 dark:text-blue-300">
              <FiShield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Official National ID Services
            </span>
            <h1 className="mt-7 text-4xl font-black leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Every Service,
              <span className="block text-blue-700 dark:text-blue-300">Explained Step by Step</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-slate-300">
              Compare the three official services — new registration, information update, and
              lost-card replacement. Review requirements, process, fees, and time, then apply
              when you are ready.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isCitizen ? (
                <Link to="/dashboard/user/services" className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700">
                  Open My Services <FiArrowRight />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700">
                    Create account <FiArrowRight />
                  </Link>
                  <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-8 py-3.5 text-sm font-bold text-slate-700 backdrop-blur transition hover:bg-white dark:border-[#27476f] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><FaQrcode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Digital QR ticket with every booking</span>
              <span className="inline-flex items-center gap-1.5"><FiUserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Free account, needed only to apply</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Our Services</p>
              <h2 className="mt-3 text-3xl font-black text-[#082A55] dark:text-white">Choose the service you need</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--nqs-muted)]">
                Switch between the tabs to see each service's overview, process, requirements, and official fees.
              </p>
            </div>
            {loading && <p className="text-sm font-semibold text-[var(--nqs-muted)]">Loading live service data...</p>}
            {!loading && error && <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{error}</p>}
          </div>

          {/* Service tabs */}
          <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] p-2">
            {cards.map((card) => {
              const Icon = card.icon;
              const isActive = card.key === activeServiceKey;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => {
                    setActiveServiceKey(card.key);
                    setActiveDetailTab('overview');
                  }}
                  className={`flex flex-1 items-center justify-center gap-3 rounded-xl px-4 py-3 text-left transition sm:flex-initial sm:justify-start ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-600 hover:bg-[var(--nqs-card-soft)] dark:text-slate-300'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-black ${isActive ? 'text-white' : 'text-[#082A55] dark:text-white'}`}>{card.shortTitle}</p>
                    <p className={`truncate text-xs font-semibold ${isActive ? 'text-blue-100' : 'text-[var(--nqs-muted)]'}`}>{card.badge}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <div className="overflow-hidden rounded-3xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="relative min-h-[320px] overflow-hidden">
                  <img
                    src={activeService.image}
                    alt={activeService.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
                  <span className="absolute left-5 top-5 rounded-full border border-white/40 bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#082A55] shadow-sm backdrop-blur">
                    {activeService.badge}
                  </span>
                </div>
                <div className="p-6 lg:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <ActiveIcon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-[#082A55] dark:text-white">{activeService.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--nqs-muted)]">
                        {activeService.service?.description || activeService.fallbackDescription}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2 border-b border-[var(--nqs-border)]">
                    {detailTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeDetailTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveDetailTab(tab.key)}
                          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-black transition ${
                            isActive
                              ? 'border-blue-600 text-blue-700 dark:border-blue-300 dark:text-blue-300'
                              : 'border-transparent text-[var(--nqs-muted)] hover:text-blue-700 dark:hover:text-blue-300'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6">
                    {activeDetailTab === 'fees' ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card-soft)] p-5">
                          <p className="text-xs font-black uppercase tracking-wide text-[var(--nqs-muted)]">Official fee</p>
                          <p className="mt-2 text-3xl font-black text-[#082A55] dark:text-white">{activeService.price}</p>
                          <p className="mt-2 text-sm text-[var(--nqs-muted)]">Paid at the center when required.</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card-soft)] p-5">
                          <p className="text-xs font-black uppercase tracking-wide text-[var(--nqs-muted)]">Estimated time</p>
                          <p className="mt-2 text-xl font-black text-[#082A55] dark:text-white">{activeService.duration}</p>
                          <p className="mt-2 text-sm text-[var(--nqs-muted)]">Queue time depends on center capacity.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {selectedItems.map((item, index) => (
                          <div key={item} className="flex gap-3 rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card-soft)] p-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-black text-white">
                              {index + 1}
                            </div>
                            <p className="text-sm font-semibold leading-6 text-[var(--nqs-text)]">{item}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to={activeService.path}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black uppercase text-white shadow-sm transition hover:bg-blue-800"
                    >
                      Start Application <FiArrowRight />
                    </Link>
                    {!isAuthenticated && (
                      <Link
                        to="/register"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--nqs-border)] px-5 py-3 text-sm font-black uppercase text-blue-700 transition hover:bg-[var(--nqs-card-soft)] dark:text-blue-300"
                      >
                        Register first
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Services;
