import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiSearch,
  FiChevronDown,
  FiHelpCircle,
  FiPhone,
  FiMail,
  FiMapPin,
  FiMessageCircle,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

const SUPPORT_PHONE = '+252 61 000 1000';
const SUPPORT_PHONE_DIAL = '+252610001000';
const SUPPORT_WHATSAPP = '252610001000';
const SUPPORT_EMAIL = 'contact@nqs.gov.so';
const HEAD_OFFICE = 'NQS Government Plaza, Hodan District, Mogadishu';

const faqCategories = [
  {
    title: 'General Questions',
    items: [
      {
        q: 'What is the National Queue System (NQS)?',
        a: 'The National Queue System (NQS) is a digital platform for National ID appointments in Banaadir Region. It allows citizens to book a National ID appointment, receive a queue ticket, and track their position in real time.',
      },
      {
        q: 'Who can use NQS?',
        a: 'NQS is available to citizens who need National ID service support at approved Banaadir National ID centers. You can create a citizen account with your name, email, and phone number.',
      },
      {
        q: 'What services are available through NQS?',
        a: 'NQS supports National ID Registration, lost National ID replacement, and National ID information update appointments.',
      },
    ],
  },
  {
    title: 'Appointments & Booking',
    items: [
      {
        q: 'How can I reschedule or cancel my appointment?',
        a: 'Log in to your NQS account, open My Appointments, find your active National ID queue ticket, and cancel or manage it from there. Cancellation is only available within 1 hour of booking.',
      },
      {
        q: 'What documents do I need for my appointment?',
        a: 'Bring your existing identification or birth record, a recent ID photo, and the completed National ID application form. Also bring your digital or printed NQS queue ticket.',
      },
      {
        q: 'How long does it take to receive my ID?',
        a: 'Once your appointment is completed and approved, your permanent National ID is issued immediately and reflected in your NQS account.',
      },
      {
        q: 'What should I do if I lost my appointment confirmation?',
        a: 'Your ticket reference is always available under My Appointments. You can also track your queue status at any time using your ticket reference.',
      },
    ],
  },
  {
    title: 'Queue & Tracking',
    items: [
      {
        q: 'How can I track my queue?',
        a: 'Open the Track Queue page and enter your ticket reference number, such as REQ-1023. The page shows your current position, estimated wait time, status, and counter information.',
      },
      {
        q: 'What happens if I miss my turn?',
        a: 'If you miss your turn, contact the operator at your National ID center. The operator can place the ticket on hold or advise you to book another appointment if needed.',
      },
    ],
  },
];

const quickActions = [
  { key: 'call', label: 'Call Support', description: 'Speak with our support team', icon: FiPhone, tone: 'bg-blue-50 text-blue-600', href: `tel:${SUPPORT_PHONE_DIAL}` },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Chat with us on WhatsApp', icon: FaWhatsapp, tone: 'bg-emerald-50 text-emerald-600', href: `https://wa.me/${SUPPORT_WHATSAPP}`, external: true },
  { key: 'email', label: 'Email', description: 'Send us an email', icon: FiMail, tone: 'bg-sky-50 text-sky-600', href: `mailto:${SUPPORT_EMAIL}` },
  { key: 'faq', label: 'FAQ', description: 'Browse common questions', icon: FiHelpCircle, tone: 'bg-amber-50 text-amber-600', href: '#faq-list' },
];

function AccordionItem({ item, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-bold text-slate-900 dark:text-white">{item.q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-slate-400"
        >
          <FiChevronDown />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-slate-600 dark:border-gray-700 dark:text-gray-300">
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQ() {
  const [openKey, setOpenKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return faqCategories;
    return faqCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] px-4 pb-10 pt-4 text-slate-900 dark:bg-gray-900 dark:text-white">
      <div className="mx-auto max-w-2xl space-y-4">
        <section>
          <h1 className="flex items-center gap-2 text-2xl font-black text-[#0B3A75] dark:text-white sm:text-3xl">
            <FiHelpCircle className="text-blue-700" /> Help &amp; Support
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">We&apos;re here to help. Find answers or get in touch.</p>
        </section>

        <section className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <FiSearch className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help topics, e.g. appointments, documents..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.key}
                href={action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noreferrer' : undefined}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${action.tone}`}>
                  <Icon size={18} />
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">{action.label}</span>
                <span className="text-[10px] leading-tight text-slate-500 dark:text-gray-400">{action.description}</span>
              </a>
            );
          })}
        </section>

        <section id="faq-list" className="space-y-4 scroll-mt-4">
          <h2 className="text-base font-black text-[#0B3A75] dark:text-white">Frequently Asked Questions</h2>

          {filteredCategories.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              No questions match your search. Try a different keyword.
            </p>
          )}

          {filteredCategories.map((category, catIdx) => (
            <div key={category.title} className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400 dark:text-gray-500">{category.title}</p>
              <div className="space-y-2">
                {category.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  return (
                    <AccordionItem key={key} item={item} isOpen={openKey === key} onToggle={() => toggle(key)} />
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-black text-[#0B3A75] dark:text-white">Contact Information</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a href={`tel:${SUPPORT_PHONE_DIAL}`} className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300">
              <FiPhone className="mt-0.5 shrink-0 text-blue-600" />
              <span>
                <span className="block font-bold text-slate-900 dark:text-white">Phone</span>
                {SUPPORT_PHONE}
              </span>
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300">
              <FiMail className="mt-0.5 shrink-0 text-blue-600" />
              <span>
                <span className="block font-bold text-slate-900 dark:text-white">Email</span>
                {SUPPORT_EMAIL}
              </span>
            </a>
            <span className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300">
              <FiMapPin className="mt-0.5 shrink-0 text-blue-600" />
              <span>
                <span className="block font-bold text-slate-900 dark:text-white">Head Office</span>
                {HEAD_OFFICE}
              </span>
            </span>
          </div>
        </section>

        <section className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/20">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm dark:bg-gray-800">
            <FiMessageCircle />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#0B2E59] dark:text-white">Need more help?</p>
            <p className="text-xs text-slate-600 dark:text-gray-400">Our support team is ready to assist you with any questions or issues.</p>
          </div>
          <Link
            to="/contact"
            className="shrink-0 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800"
          >
            Contact Us
          </Link>
        </section>
      </div>
    </div>
  );
}

export default FAQ;
