import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';
import { FiHeadphones, FiMail, FiMapPin, FiMessageCircle, FiPhone, FiSend } from 'react-icons/fi';

const initialForm = {
  fullName: '',
  email: '',
  subject: '',
  message: '',
};

const subjectOptions = [
  'General Inquiry',
  'Technical Support',
  'Appointment Question',
  'Feedback',
  'Report an Issue',
];

const contactItems = [
  {
    icon: FiPhone,
    label: 'Phone',
    value: '+252 61 000 1000',
    detail: 'Sun - Thu, 8:00 AM - 5:00 PM'
  },
  {
    icon: FiMail,
    label: 'Email',
    value: 'contact@nqs.gov.so',
    detail: 'We usually reply within 24 hours'
  },
  {
    icon: FiMapPin,
    label: 'Location',
    value: 'NQS Headquarters',
    detail: 'Hodan District, Mogadishu, Somalia'
  },
  {
    icon: FiHeadphones,
    label: 'Support',
    value: 'support@nqs.gov.so',
    detail: 'For technical support and assistance'
  },
];

const MESSAGE_MAX = 1000;

function ContactSection() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/api/contact', form);
      if (res.data.success) {
        toast.success('Your message has been sent successfully.');
        setForm(initialForm);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to send your message.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0B3A75] focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1.5 block text-left text-xs font-semibold text-slate-700';

  return (
    <>
      <section className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-32">
        <div className="nqs-contact-hero-bg absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Contact Us
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
              We are here to help you. Reach out to us for any questions, support, or feedback.
            </p>
            <span className="mt-5 block h-1 w-14 rounded-full bg-[#1F6FC2]" />
          </div>
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl shadow-xl lg:max-w-none">
            <img
              src="/images/home/hero-slide-office.png"
              alt="NQS support team member assisting a citizen"
              className="h-56 w-full object-cover sm:h-72"
              loading="lazy"
            />
          </div>
        </div>

        <svg
          className="nqs-contact-hero-wave absolute inset-x-0 bottom-0 -z-10 h-14 w-full sm:h-20"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,40 C360,100 1080,0 1440,50 L1440,100 L0,100 Z" />
        </svg>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-[#0B3A75]">Get in Touch</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose the best way to reach us. Our team will respond as soon as possible.
            </p>

            <div className="mt-5 space-y-3">
              {contactItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0B3A75]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-950">{item.label}</p>
                      <p className="text-sm text-slate-700">{item.value}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm"
          >
            <h2 className="text-lg font-black text-[#0B3A75]">Send us a Message</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fill out the form below and we&apos;ll get back to you.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fullName" className={labelClass}>Full Name *</label>
                <input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onChange={(event) => updateField('fullName', event.target.value.replace(/[^A-Za-z\s'-]/g, ''))}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>Email Address *</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="subject" className={labelClass}>Subject *</label>
                <select
                  id="subject"
                  value={form.subject}
                  onChange={(event) => updateField('subject', event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>Select a subject</option>
                  {subjectOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="message" className={labelClass}>Message *</label>
                <textarea
                  id="message"
                  rows={4}
                  placeholder="Write your message here..."
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value.slice(0, MESSAGE_MAX))}
                  className={`${inputClass} min-h-28 resize-none`}
                  maxLength={MESSAGE_MAX}
                  required
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {form.message.length}/{MESSAGE_MAX}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B3A75] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#092B5A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiSend className="h-4 w-4" />
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#E7F1FF] p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0B3A75]">
              <FiMessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B3A75]">Frequently Asked Questions</p>
              <p className="text-xs text-slate-600">Find quick answers to common questions.</p>
            </div>
          </div>
          <Link
            to="/faq"
            className="inline-flex items-center gap-2 rounded-lg border border-[#0B3A75]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0B3A75] transition hover:bg-[#0B3A75] hover:text-white"
          >
            View FAQs
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </>
  );
}

export default ContactSection;
