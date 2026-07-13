import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiCreditCard, FiHelpCircle, FiShield, FiClock } from 'react-icons/fi';

const plans = [
  {
    name: 'New National ID Registration',
    price: 'Free',
    period: 'first issuance',
    highlight: false,
    description: 'First-time registration for citizens who have never held a National ID card.',
    features: [
      'Online appointment booking',
      'Digital QR ticket',
      'Real-time queue tracking',
      'Email confirmations & reminders',
      'Biometric enrollment at the center',
      'Card ready for collection in 21 days',
    ],
    cta: 'Book Registration',
    to: '/services/new-id-registration',
  },
  {
    name: 'Replace Lost National ID',
    price: '$10',
    period: 'per replacement card',
    highlight: true,
    description: 'Replacement card for citizens whose National ID has been lost, stolen, or damaged.',
    features: [
      'Online appointment booking',
      'Digital QR ticket',
      'Real-time queue tracking',
      'Police report reference support',
      'Identity re-verification at the center',
      'Replacement card in 14 days',
    ],
    cta: 'Book Replacement',
    to: '/services/replace-lost-id',
  },
  {
    name: 'Update ID Information',
    price: '$5',
    period: 'per information update',
    highlight: false,
    description: 'Correct or update the personal information printed on your existing National ID.',
    features: [
      'Online appointment booking',
      'Digital QR ticket',
      'Real-time queue tracking',
      'Supporting-document review',
      'Updated card printed after approval',
      'Updated card in 14 days',
    ],
    cta: 'Book Update',
    to: '/services/update-information',
  },
];

const notes = [
  {
    icon: FiCreditCard,
    title: 'Payment at the Center',
    text: 'Service fees are paid at the service center counter on the day of your appointment. Online booking itself is always free.',
  },
  {
    icon: FiShield,
    title: 'No Hidden Charges',
    text: 'The fees listed here are the only official charges. Report anyone requesting additional payment through the Contact page — every report is investigated.',
  },
  {
    icon: FiClock,
    title: 'Free Cancellation',
    text: 'You can cancel or rebook your appointment at no cost any time before your scheduled slot.',
  },
  {
    icon: FiHelpCircle,
    title: 'Fee Exemptions',
    text: 'Elderly citizens and persons with disabilities may qualify for fee exemptions. Ask at your service center or contact support for eligibility.',
  },
];

const Pricing = () => {
  return (
    <div className="bg-white text-slate-900 dark:bg-[#061225] dark:text-slate-100">
      {/* Hero */}
      <section className="bg-[#F8FBFF] pt-28 dark:bg-[#071a33]">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">Service Fees</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-[#082A55] dark:text-white sm:text-5xl">
              Transparent, Official Pricing
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700 dark:text-slate-300">
              Booking through NQS is always free. These are the official government fees
              for each National ID service — no agents, no middlemen, no extra charges.
            </p>
            <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-blue-600" />
          </div>
        </div>
      </section>

      {/* Fee cards */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-7 shadow-sm ${
                  plan.highlight
                    ? 'border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400'
                    : 'border-slate-200 dark:border-[#1d355f]'
                } bg-white dark:bg-[#071a33]`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                    Most Requested
                  </span>
                )}
                <h2 className="text-base font-black text-[#082A55] dark:text-white">{plan.name}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{plan.description}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-black tracking-tight text-[#082A55] dark:text-white">{plan.price}</span>
                  <span className="pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{plan.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                      <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.to}
                  className={`mt-7 rounded-xl px-5 py-3 text-center text-sm font-extrabold uppercase transition ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-[#1d355f] dark:text-slate-200 dark:hover:bg-white/5'
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="bg-[#F1F7FF] py-14 dark:bg-[#071a33]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black text-[#082A55] dark:text-white">Good to Know</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {notes.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1d355f] dark:bg-[#0b2444]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <Icon className="h-5 w-5" />
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
          <h2 className="text-2xl font-black text-[#082A55] dark:text-white">Questions About Fees?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Check the FAQ for common questions, or contact our support team directly.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/faq" className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-extrabold uppercase text-white shadow-sm transition hover:bg-blue-700">
              Read the FAQ
            </Link>
            <Link to="/contact" className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-extrabold uppercase text-slate-700 transition hover:bg-slate-50 dark:border-[#1d355f] dark:text-slate-200 dark:hover:bg-white/5">
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
