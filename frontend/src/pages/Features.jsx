import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiCalendar, FiClock, FiBell, FiBarChart2, FiShield, FiUsers,
  FiMonitor, FiSmartphone, FiGlobe, FiLock, FiMail, FiCheckCircle,
  FiMapPin, FiActivity, FiLayers,
} from 'react-icons/fi';
import { FaQrcode } from 'react-icons/fa';

const citizenFeatures = [
  {
    icon: FiCalendar,
    title: 'Online Appointment Booking',
    text: 'Book National ID registration, replacement, or information-update appointments from home. Choose your preferred center, date, and time slot with live availability.',
  },
  {
    icon: FaQrcode,
    title: 'Digital QR Tickets',
    text: 'Every booking generates a secure QR ticket. Present it at the center for instant verification — no paper forms, no manual lookups, no disputes about your place in line.',
  },
  {
    icon: FiClock,
    title: 'Real-Time Queue Tracking',
    text: 'Track your ticket position live from your phone. See who is currently being served, how many people are ahead of you, and the estimated waiting time.',
  },
  {
    icon: FiBell,
    title: 'Smart Notifications',
    text: 'Receive confirmations, reminders, and queue alerts by email and in-app notifications, so you arrive at the center exactly when you are needed.',
  },
  {
    icon: FiMonitor,
    title: 'Live Queue Display',
    text: 'Each center has a public live-queue screen showing currently-served tickets per counter — the same view is available online for remote checking.',
  },
  {
    icon: FiSmartphone,
    title: 'Works on Any Device',
    text: 'The portal is fully responsive: book, track, and manage your appointments from a phone, tablet, or computer with the same experience.',
  },
];

const staffFeatures = [
  {
    icon: FiUsers,
    title: 'Operator Counter Console',
    text: 'Operators call the next ticket, put tickets on hold, and complete service with one click. The console shows the live waiting list for their assigned center only.',
  },
  {
    icon: FaQrcode,
    title: 'QR Verification & Check-In',
    text: 'Scan citizen QR tickets at the entrance or counter to verify authenticity, confirm appointment details, and check citizens in instantly.',
  },
  {
    icon: FiBarChart2,
    title: 'Reports & Analytics',
    text: 'Administrators see daily and weekly volumes, completion rates, average wait and service times, per-center and per-service performance charts.',
  },
  {
    icon: FiLayers,
    title: 'Center & Service Management',
    text: 'Manage 19 Banaadir district centers: working days, opening hours, slot durations, booking capacity per slot and per day, and the services each center offers.',
  },
  {
    icon: FiShield,
    title: 'Audit & Anti-Corruption Logs',
    text: 'Every sensitive action — logins, bookings, cancellations, queue calls — is recorded with the acting user, role, and IP address for full accountability.',
  },
  {
    icon: FiActivity,
    title: 'Session Monitoring',
    text: 'Administrators can see active sessions across the system and revoke access instantly if an account is compromised.',
  },
];

const platformPillars = [
  {
    icon: FiLock,
    title: 'Secure by Design',
    text: 'JWT-based authentication, role-based access control, and encrypted password storage protect every account and every action.',
  },
  {
    icon: FiGlobe,
    title: 'Bilingual Interface',
    text: 'The portal supports Somali and English so every citizen can use the service in the language they are most comfortable with.',
  },
  {
    icon: FiMail,
    title: 'Email Delivery Logs',
    text: 'Every confirmation and status email is logged with a Sent/Failed status, so support staff can trace exactly what each citizen received.',
  },
  {
    icon: FiMapPin,
    title: 'District Coverage',
    text: 'All Banaadir districts are covered with dedicated National ID centers, each with its own schedule, counters, and capacity settings.',
  },
];

const roleMatrix = [
  ['Book appointments & receive QR tickets', true, false, false],
  ['Track queue status in real time', true, true, true],
  ['Call next ticket / serve counters', false, true, true],
  ['Scan & verify QR tickets', false, true, true],
  ['Manage services, centers & schedules', false, false, true],
  ['View reports, analytics & audit logs', false, false, true],
  ['Manage operators & active sessions', false, false, true],
];

const Features = () => {
  return (
    <div className="bg-white text-slate-900 dark:bg-[#061225] dark:text-slate-100">
      {/* Hero */}
      <section className="bg-[#F8FBFF] pt-28 dark:bg-[#071a33]">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">Platform Features</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#082A55] dark:text-white sm:text-5xl">
              Everything Needed to Run a Modern National ID Service
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700 dark:text-slate-300">
              NQS combines online booking, digital ticketing, live queue management, and
              full administrative oversight in one platform — for citizens, operators, and administrators.
            </p>
            <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-blue-600" />
          </div>
        </div>
      </section>

      {/* Citizen features */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-[#082A55] dark:text-white">For Citizens</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-slate-600 dark:text-slate-400">
            Skip the physical line. Handle your entire National ID appointment from your phone.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {citizenFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1d355f] dark:bg-[#071a33]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-black text-[#082A55] dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Staff & admin features */}
      <section className="bg-[#F1F7FF] py-14 dark:bg-[#071a33]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-[#082A55] dark:text-white">For Operators & Administrators</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-slate-600 dark:text-slate-400">
            A professional management system with dashboards, live queue control, and complete oversight.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staffFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1d355f] dark:bg-[#0b2444]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-black text-[#082A55] dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Role access matrix */}
      <section className="py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-[#082A55] dark:text-white">Who Can Do What</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-slate-600 dark:text-slate-400">
            Role-based access control means every user only sees the tools they are authorized to use.
          </p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm dark:border-[#1d355f]">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1d355f]">
              <thead className="bg-slate-50 dark:bg-[#0b2444]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Capability</th>
                  <th className="px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Citizen</th>
                  <th className="px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Operator</th>
                  <th className="px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-[#1d355f] dark:bg-[#071a33]">
                {roleMatrix.map(([capability, citizen, operator, admin]) => (
                  <tr key={capability}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{capability}</td>
                    {[citizen, operator, admin].map((allowed, i) => (
                      <td key={i} className="px-5 py-3 text-center">
                        {allowed
                          ? <FiCheckCircle className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Platform pillars */}
      <section className="bg-[#F8FBFF] py-14 dark:bg-[#071a33]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-[#082A55] dark:text-white">Built on a Solid Foundation</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {platformPillars.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-[#1d355f] dark:bg-[#0b2444]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-black text-[#082A55] dark:text-white">{title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-[#082A55] dark:text-white">Ready to Skip the Line?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Create a free citizen account and book your National ID appointment in minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-extrabold uppercase text-white shadow-sm transition hover:bg-blue-700">
              Create Account
            </Link>
            <Link to="/services" className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-extrabold uppercase text-slate-700 transition hover:bg-slate-50 dark:border-[#1d355f] dark:text-slate-200 dark:hover:bg-white/5">
              Browse Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;
