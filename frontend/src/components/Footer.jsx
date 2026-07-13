import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiGlobe, FiMail, FiMapPin, FiPhone, FiShield } from 'react-icons/fi';
import crestLogo from '../assets/logo/government_crest.svg';

const quickLinks = [
  ['About', '/about'],
  ['Features', '/features'],
  ['Services', '/services'],
  ['Pricing', '/pricing'],
  ['Centers', '/centers'],
  ['FAQ', '/faq'],
];

const serviceLinks = [
  ['New ID Registration', '/services/new-id-registration'],
  ['Update Information', '/services/update-information'],
  ['Replace Lost ID', '/services/replace-lost-id'],
  ['Track Queue', '/track'],
];

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="nqs-footer border-t border-blue-900/30 bg-[#061E3D] text-blue-50">
      <div className="bg-[#082A55]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Ready to start?</p>
            <h2 className="mt-2 text-2xl font-black text-white">Create an account and enter the National ID system.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
              Public pages explain the services. Applications, QR tickets, appointments, and dashboards require login.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black uppercase text-white hover:bg-emerald-400">
              Create account <FiArrowRight />
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-5 py-3 text-sm font-black uppercase text-white hover:bg-white/20">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.9fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white p-2 shadow-sm">
                <img src={crestLogo} alt="NQS logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide text-white">NQS National ID</h2>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Banaadir Portal</p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-7 text-blue-100/75">
              A public website and authenticated management system for National ID appointment booking, QR ticketing, live queues, and service-center operations.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-300">
              <FiShield className="h-4 w-4" />
              Official National ID Service
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">Website</h3>
            <ul className="space-y-2 text-sm">
              {quickLinks.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-blue-100/75 transition hover:text-emerald-300">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">Services</h3>
            <ul className="space-y-2 text-sm">
              {serviceLinks.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-blue-100/75 transition hover:text-emerald-300">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">Contact</h3>
            <div className="space-y-3 text-sm text-blue-100/75">
              <div className="flex items-start gap-3">
                <FiMapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                <span>NQS Government Plaza, Hodan District, Mogadishu</span>
              </div>
              <div className="flex items-center gap-3">
                <FiPhone className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>+252 61 000 1000</span>
              </div>
              <div className="flex items-center gap-3">
                <FiMail className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>contact@nqs.gov.so</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-blue-100/65 sm:px-6 md:flex-row lg:px-8">
          <div>Copyright {currentYear} National ID Service (NQS). All rights reserved.</div>
          <div className="flex items-center gap-2">
            <FiGlobe className="h-4 w-4" />
            <span>Soomaaliya</span>
            <span>|</span>
            <span>English</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
