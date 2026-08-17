import React from 'react';
import { FiChevronLeft } from 'react-icons/fi';
import BrandLogo from '../BrandLogo';

/** Shared mobile-wizard chrome: back button + brand, title, progress bar,
 *  scrollable step body, and a sticky Back/Next footer. Used by every
 *  step of the booking flow so each service's wizard looks identical. */
const WizardShell = ({
  title,
  subtitle,
  stepIndex,
  stepCount,
  subStep,
  onBack,
  children,
  footer,
}) => (
  <div className="nqs-booking-wizard min-h-screen bg-[#F5F8FC] pb-28">
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <FiChevronLeft />
        </button>
        <BrandLogo size={26} />
        <span className="text-sm font-black text-[#0B2E59]">NQS</span>
      </div>

      <h1 className="text-xl font-black text-[#0B3A75] sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}

      {stepCount > 0 && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, Math.round((stepIndex / stepCount) * 100))}%` }}
            />
          </div>
          {subStep && <p className="mt-2 text-xs font-black text-slate-500">{subStep}</p>}
        </div>
      )}

      <div className="mt-5">{children}</div>
    </div>

    {footer && (
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-3">{footer}</div>
      </div>
    )}
  </div>
);

export default WizardShell;
