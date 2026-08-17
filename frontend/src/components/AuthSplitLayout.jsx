import React, { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import BrandLogo from './BrandLogo';
import AuthSkyline from './AuthSkyline';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'so', label: 'Soomaali' },
];

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        {language === 'so' ? 'SO' : 'EN'}
        <FiChevronDown className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-36 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
            {LANGUAGES.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  changeLanguage(option.code);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                  language === option.code
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** Split-panel shell shared by Login and Register: brand/features on the
 * left, the page's own form content passed in as children on the right. */
const AuthSplitLayout = ({ children }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F8FD] px-4 py-10">
    <div className="relative flex w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-300/50">
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B2E59] via-[#0F3768] to-[#123A6B] p-10 !text-[#ffffff] lg:flex">
        <div className="relative z-10 -mt-6 text-center">
          <div className="mx-auto mb-5 flex h-32 w-32 items-center justify-center rounded-full bg-white p-4 shadow-xl shadow-slate-950/20 ring-1 ring-white/70">
            <BrandLogo size={104} className="mx-auto" />
          </div>
          <p className="text-2xl font-black tracking-wide !text-[#ffffff]">NQS NATIONAL ID</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] !text-blue-200">
            Appointment &amp; Queue System
          </p>
          <div className="mx-auto my-4 h-0.5 w-12 bg-amber-400" />
          <p className="mx-auto max-w-xs text-sm leading-relaxed !text-blue-100">
            Book appointments, track your queue in real-time, and manage your
            National ID services easily and efficiently.
          </p>
        </div>
        <AuthSkyline className="!text-[#ffffff]/10" />
      </div>

      <div className="relative w-full p-8 sm:p-10 lg:w-1/2">
        <div className="absolute right-6 top-6 sm:right-8 sm:top-8">
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    </div>
  </div>
);

export default AuthSplitLayout;
