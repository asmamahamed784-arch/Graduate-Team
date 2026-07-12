import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axiosInstance';
import { FiClock, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  message: '',
};

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
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0B3A75] focus:ring-2 focus:ring-blue-100';
  const labelClass = 'mb-1.5 block text-left text-xs font-semibold text-slate-700';

  const contactItems = [
    {
      icon: FiMapPin,
      label: 'Office',
      value: 'Banaadir National ID Center',
      detail: 'Mogadishu, Somalia'
    },
    {
      icon: FiPhone,
      label: 'Phone',
      value: '+252 61 000 1000',
      detail: 'Sunday - Thursday'
    },
    {
      icon: FiMail,
      label: 'Email',
      value: 'support@nqs.gov.so',
      detail: 'Support inbox'
    },
    {
      icon: FiClock,
      label: 'Working Hours',
      value: '8:00 AM - 5:00 PM',
      detail: 'Sunday - Thursday'
    },
  ];

  return (
    <section className="pt-2">
      <div className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          Contact Support
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Send a message to the National ID support team.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1fr] lg:items-start">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-950">Contact Information</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            For National ID assistance, contact the Banaadir National ID support office.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {contactItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0B3A75]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-950">{item.value}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm lg:ml-auto"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className={labelClass}>Full Name</label>
              <input
                id="fullName"
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="message" className={labelClass}>Message</label>
              <textarea
                id="message"
                rows={3}
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
                className={`${inputClass} min-h-24 resize-none`}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-[#0B3A75] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#092B5A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default ContactSection;
