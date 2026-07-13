import React from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineArrowRight,
  HiOutlineCalendarDays,
  HiOutlineCheckBadge,
  HiOutlineIdentification,
  HiOutlinePencilSquare,
  HiOutlineMapPin,
  HiOutlineComputerDesktop,
  HiOutlineArrowPath,
  HiOutlineShieldCheck,
  HiOutlineDevicePhoneMobile,
  HiOutlineUserPlus,
  HiOutlineQrCode,
  HiOutlineSparkles,
  HiOutlineClock,
} from 'react-icons/hi2';
import { useAuth } from '../hooks';
import heroImage from '../assets/images/hero.png';
import serviceCenterImage from '../assets/images/service center.png';
import queueImage from '../assets/images/Queue.jpg';

const services = [
  {
    title: 'New National ID Registration',
    description: 'Create a citizen account, choose a center, and book your first National ID registration appointment.',
    path: '/services/new-id-registration',
    icon: HiOutlineIdentification,
    image: serviceCenterImage,
    accent: 'blue',
  },
  {
    title: 'Update ID Information',
    description: 'Submit corrected details and supporting information for review before visiting the center.',
    path: '/services/update-information',
    icon: HiOutlinePencilSquare,
    image: heroImage,
    accent: 'emerald',
  },
  {
    title: 'Replace Lost ID',
    description: 'Book a replacement appointment and receive a secure QR ticket for identity verification.',
    path: '/services/replace-lost-id',
    icon: HiOutlineArrowPath,
    image: queueImage,
    accent: 'amber',
  },
];

const highlights = [
  { label: 'District centers', value: '19+', icon: HiOutlineMapPin },
  { label: 'Digital QR tickets', value: '100%', icon: HiOutlineQrCode },
  { label: 'Live queue tracking', value: '24/7', icon: HiOutlineComputerDesktop },
  { label: 'Role protected system', value: 'RBAC', icon: HiOutlineShieldCheck },
];

const workflow = [
  {
    title: 'Create an account',
    text: 'Register as a citizen or sign in with an existing account before submitting any service request.',
    icon: HiOutlineUserPlus,
  },
  {
    title: 'Book your service',
    text: 'Select the National ID service, center, appointment date, and time slot that works for you.',
    icon: HiOutlineCalendarDays,
  },
  {
    title: 'Use your QR ticket',
    text: 'Bring the generated QR ticket to the center for fast check-in and queue verification.',
    icon: HiOutlineQrCode,
  },
  {
    title: 'Track your queue',
    text: 'Follow your appointment status and queue position from your phone before arriving.',
    icon: HiOutlineDevicePhoneMobile,
  },
];

const accentClasses = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

const Home = () => {
  const { isAuthenticated, role } = useAuth();
  const isCitizen = isAuthenticated && role === 'citizen';
  const servicesEntry = isCitizen ? '/dashboard/user/services' : null;

  return (
    <div className="bg-[var(--nqs-bg)] text-[var(--nqs-text)]">
      {/* ─── Hero: light, centered, airy ──────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50/70 to-white pt-28 dark:from-[#0b2444] dark:via-[#071a33] dark:to-[#061225]">
        {/* soft decorative glows */}
        <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl dark:bg-blue-500/10" />
        <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl dark:bg-emerald-500/10" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 backdrop-blur dark:border-blue-500/30 dark:bg-white/5 dark:text-blue-300">
              <HiOutlineShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Official Banaadir National ID Portal
            </p>
            <h1 className="mt-8 text-5xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-7xl">
              Your National ID,
              <span className="block text-blue-700 dark:text-blue-300">One Click Away</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-slate-300">
              Book appointments, receive secure QR tickets, and track your queue in real
              time — before you even leave home.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isCitizen ? (
                <Link
                  to="/dashboard/user/services"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  <HiOutlineSparkles className="h-4 w-4" /> Open My Services
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700"
                  >
                    Get Started <HiOutlineArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/services"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/70 px-8 py-3.5 text-sm font-bold text-slate-700 backdrop-blur transition hover:bg-white dark:border-[#27476f] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Explore Services
                  </Link>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><HiOutlineCheckBadge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Free online booking</span>
              <span className="inline-flex items-center gap-1.5"><HiOutlineCheckBadge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Official government fees only</span>
              <span className="inline-flex items-center gap-1.5"><HiOutlineCheckBadge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Somali & English</span>
            </div>
          </div>

          {/* Framed real photo showcase */}
          <div className="relative mx-auto mt-14 max-w-5xl">
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-[#1d355f] dark:bg-white/5">
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={heroImage}
                  alt="Banaadir National ID service center"
                  className="h-72 w-full object-cover sm:h-96"
                />
              </div>
            </div>
            {/* floating stat chips */}
            <div className="absolute -left-4 top-8 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-[#1d355f] dark:bg-[#0b2444] md:block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <HiOutlineQrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">QR Ticket Issued</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">NQS-1024 • Hodan Center</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 bottom-8 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-[#1d355f] dark:bg-[#0b2444] md:block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <HiOutlineClock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">Now Serving #17</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Your position: #21 • ~15 min</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stat strip ───────────────────────────────── */}
      <section className="border-b border-[var(--nqs-border)] bg-[var(--nqs-card)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 sm:px-6 md:grid-cols-4 lg:px-8">
          {highlights.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-[var(--nqs-border)] bg-[var(--nqs-card-soft)] p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md shadow-blue-900/20">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-black text-[var(--nqs-text)]">{value}</p>
                <p className="text-xs font-bold text-[var(--nqs-muted)]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Services ─────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Citizen Services</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Choose what you need today</h2>
            </div>
            <Link
              to={servicesEntry || '/services'}
              className="inline-flex items-center gap-2 text-sm font-black text-blue-700 dark:text-blue-300"
            >
              {servicesEntry ? 'Open services in my dashboard' : 'View all services'} <HiOutlineArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="group overflow-hidden rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                  <div className="relative h-48 overflow-hidden">
                    <img src={service.image} alt={service.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 to-transparent" />
                  </div>
                  <div className="p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClasses[service.accent]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-lg font-black text-slate-900 dark:text-white">{service.title}</h3>
                    <p className="mt-3 min-h-[72px] text-sm leading-6 text-[var(--nqs-muted)]">{service.description}</p>
                    <Link
                      to={service.path}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      Start Service <HiOutlineArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────── */}
      <section className="bg-[var(--nqs-card-soft)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="overflow-hidden rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] shadow-sm">
              <img src={serviceCenterImage} alt="National ID service counter" className="h-80 w-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">How it works</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Browse publicly, sign in when action is needed</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--nqs-muted)]">
                Visitors can read every public page without an account. When you want to book, update, replace, or manage a ticket, the system signs you in and takes you straight to the service — no lost steps.
              </p>
              <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {workflow.map(({ title, text, icon: Icon }) => (
                  <div key={title} className="rounded-xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] p-4 transition hover:shadow-md">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-md shadow-blue-900/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-[var(--nqs-muted)]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Live queue + CTA ─────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] p-6 shadow-sm lg:col-span-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <img src={queueImage} alt="Queue tracking display" className="h-48 w-full rounded-xl object-cover md:w-64" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Live queue</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Know when to arrive</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--nqs-muted)]">
                    Track your queue ticket from home and avoid waiting at the center longer than necessary.
                  </p>
                  <Link to="/track" className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--nqs-border)] px-5 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-white/5">
                    Check queue status <HiOutlineArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="nqs-portal-hero relative overflow-hidden rounded-2xl border border-[var(--nqs-border)] bg-[#082A55] bg-gradient-to-br from-[#082A55] to-[#0B3A75] p-6 text-white shadow-sm">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-400/20 blur-2xl" />
              <HiOutlineCheckBadge className="h-10 w-10 text-emerald-300" />
              <h2 className="mt-5 text-2xl font-black text-white">
                {isCitizen ? 'Continue where you left off' : 'Ready to enter the system?'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-blue-50">
                {isCitizen
                  ? 'Open your dashboard to apply for services, follow your requests, and track your queue.'
                  : 'Sign in if you already have an account, or register as a citizen to start your first service request.'}
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3">
                {isCitizen ? (
                  <Link to="/dashboard/user/services" className="nqs-hero-card rounded-full bg-white px-4 py-3 text-center text-sm font-bold text-[#082A55] transition hover:bg-blue-50">
                    Open My Services
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="nqs-hero-card rounded-full bg-white px-4 py-3 text-center text-sm font-bold text-[#082A55] transition hover:bg-blue-50">
                      Sign in
                    </Link>
                    <Link to="/register" className="rounded-full border border-white/30 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10">
                      Create account
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
