import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import {
  FiSearch,
  FiChevronDown,
  FiHelpCircle,
  FiCalendar,
  FiActivity,
  FiMessageCircle,
} from 'react-icons/fi';
import { FaQuestionCircle } from 'react-icons/fa';

/* ─── FAQ Data ─────────────────────────────────────── */
const faqCategories = [
  {
    title: 'General Questions',
    icon: <FiHelpCircle className="text-xl" />,
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
    icon: <FiCalendar className="text-xl" />,
    items: [
      {
        q: 'How do I book an appointment?',
        a: 'Log in to your NQS account, open the booking page, select National ID Registration, choose a Banaadir National ID center, pick a date and time, and confirm your booking. You will receive a digital queue ticket with a reference number.',
      },
      {
        q: 'Can I cancel my appointment?',
        a: 'Yes. Go to your dashboard, find your active National ID queue ticket, and cancel it from the ticket actions.',
      },
      {
        q: 'What documents do I need to bring?',
        a: 'Bring your existing identification or birth record, a recent ID photo, and the completed National ID application form. Also bring your digital or printed NQS queue ticket.',
      },
    ],
  },
  {
    title: 'Queue & Tracking',
    icon: <FiActivity className="text-xl" />,
    items: [
      {
        q: 'How do I track my queue position?',
        a: 'Open the Check Queue page and enter your NQS reference number, such as NQS-1023. The page shows your current position, estimated wait time, status, and counter information.',
      },
      {
        q: 'What happens if I miss my turn?',
        a: 'If you miss your turn, contact the operator at the Banaadir National ID center. The operator can place the ticket on hold or advise you to book another appointment if needed.',
      },
    ],
  },
];

/* ─── Accordion Item ───────────────────────────────── */
function AccordionItem({ item, isOpen, onToggle, colors }) {
  return (
    <div
      className="nqs-faq-item overflow-hidden rounded-xl border transition-colors"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <button
        onClick={onToggle}
        className="nqs-faq-trigger flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors"
        style={{ backgroundColor: colors.card }}
      >
        <span
          className="nqs-faq-question text-[15px] font-semibold leading-snug"
          style={{ color: colors.text }}
        >
          {item.q}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0"
          style={{ color: colors.blue }}
        >
          <FiChevronDown className="text-lg" />
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
            <div
              className="nqs-faq-answer border-t px-6 pb-5 pt-4 text-sm leading-relaxed"
              style={{ backgroundColor: colors.answer, borderColor: colors.border, color: colors.muted }}
            >
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   FAQ Page
   ═══════════════════════════════════════════════════════ */
function FAQ() {
  const { isDark } = useTheme();
  const [openKey, setOpenKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const colors = useMemo(() => (
    isDark
      ? {
          page: '#061225',
          card: '#071a33',
          answer: '#061225',
          text: '#ffffff',
          muted: '#cbd5e1',
          border: '#1d355f',
          blue: '#93c5fd',
          iconBg: '#0b2444',
        }
      : {
          page: '#f5f8fc',
          card: '#ffffff',
          answer: '#f8fafc',
          text: '#000000',
          muted: '#111827',
          border: '#dbe7f3',
          blue: '#2563eb',
          iconBg: '#dbeafe',
        }
  ), [isDark]);

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  /* filtered categories / items */
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return faqCategories;
    return faqCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) ||
            item.a.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  return (
    <section
      className="nqs-faq-page min-h-screen"
      style={{ backgroundColor: colors.page, color: colors.text }}
    >
      {/* ── Hero ─────────────────────────────────────── */}
      <div
        className="nqs-faq-hero border-b"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <motion.div
          className="container mx-auto px-4 py-20 text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <FaQuestionCircle className="mx-auto mb-4 text-5xl" style={{ color: colors.blue }} />
          <h1
            className="nqs-faq-title mb-4 text-4xl font-bold tracking-tight md:text-5xl"
            style={{ color: colors.text }}
          >
            Frequently Asked Questions
          </h1>
          <p
            className="nqs-faq-muted mx-auto max-w-2xl text-lg leading-relaxed md:text-xl"
            style={{ color: colors.muted }}
          >
            Answers to common questions about National ID appointments and queue tickets.
          </p>

          {/* Search bar */}
          <div
            className="nqs-faq-search mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-xl border px-5 py-3 shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <FiSearch className="flex-shrink-0 text-xl" style={{ color: colors.muted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="nqs-faq-input w-full bg-transparent text-base outline-none placeholder:text-slate-400"
              style={{ color: colors.text }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="whitespace-nowrap text-sm transition"
                style={{ color: colors.blue }}
              >
                Clear
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── FAQ Content ──────────────────────────────── */}
      <div className="container mx-auto px-4 py-14 max-w-3xl">
        {filteredCategories.length === 0 && (
          <motion.p
            className="nqs-faq-muted py-16 text-center text-lg"
            style={{ color: colors.muted }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            No questions match your search. Try a different keyword.
          </motion.p>
        )}

        {filteredCategories.map((category, catIdx) => (
          <motion.div
            key={category.title}
            className="mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: catIdx * 0.1, duration: 0.5 }}
          >
            {/* Category heading */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="nqs-faq-icon flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: colors.iconBg, color: colors.blue }}
              >
                {category.icon}
              </div>
              <h2 className="nqs-faq-heading text-xl font-bold" style={{ color: colors.text }}>
                {category.title}
              </h2>
            </div>

            {/* Accordion list */}
            <div className="flex flex-col gap-3">
              {category.items.map((item, itemIdx) => {
                const key = `${catIdx}-${itemIdx}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    isOpen={openKey === key}
                    onToggle={() => toggle(key)}
                    colors={colors}
                  />
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* ── Still need help ────────────────────────── */}
        <motion.div
          className="nqs-faq-help mt-16 rounded-2xl border p-10 text-center shadow-sm"
          style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.text }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <FiMessageCircle className="mx-auto mb-4 text-4xl" style={{ color: colors.blue }} />
          <h3 className="nqs-faq-heading mb-2 text-2xl font-bold" style={{ color: colors.text }}>Need Help?</h3>
          <p className="nqs-faq-muted mx-auto mb-6 max-w-md" style={{ color: colors.muted }}>
            Contact the National ID office if you need help with booking or queue status.
          </p>
          <Link
            to="/contact"
            className="inline-block bg-[#4189DD] text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/15"
          >
            Contact Us
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export default FAQ;
