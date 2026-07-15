import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCreditCard,
  FiEdit3,
  FiMapPin,
  FiRefreshCw
} from 'react-icons/fi';
import heroImage from '../assets/images/hero.png';
import serviceCenterImage from '../assets/images/service center.png';
import queueImage from '../assets/images/Queue.jpg';
import nationalIdCardImage from '../assets/images/cords.png';

const services = [
  {
    title: 'New National ID Registration',
    description: 'Apply for a new National ID card and book your appointment at a Banaadir center.',
    path: '/dashboard/user/new-id-registration',
    icon: FiCreditCard,
    color: 'blue'
  },
  {
    title: 'Update National ID Information',
    description: 'Request corrections to your existing National ID information for admin review.',
    path: '/dashboard/user/update-information',
    icon: FiEdit3,
    color: 'green'
  },
  {
    title: 'Replace Lost National ID',
    description: 'Book a replacement appointment if your National ID card has been lost.',
    path: '/dashboard/user/replace-lost-id',
    icon: FiRefreshCw,
    color: 'orange'
  }
];

const updates = [
  {
    tag: 'Announcement',
    date: 'March 14, 2024',
    title: 'New Service Center Opening in Banaadir',
    text: 'More citizens can now access National ID appointment services through additional district support.',
    image: serviceCenterImage,
    color: 'blue'
  },
  {
    tag: 'Technology',
    date: 'February 28, 2024',
    title: 'Mobile Queue Ticket Support Now Available',
    text: 'Citizens can view their queue ticket and QR reference from their phone before visiting the center.',
    image: queueImage,
    color: 'green'
  },
  {
    tag: 'Security',
    date: 'February 15, 2024',
    title: 'Updated QR Ticket Security Standards',
    text: 'Ticket verification has been improved to protect citizen records and reduce invalid ticket use.',
    image: nationalIdCardImage,
    color: 'orange'
  }
];

const colorMap = {
  blue: {
    icon: 'bg-blue-600',
    soft: 'bg-blue-50 text-blue-700',
    link: 'text-blue-700'
  },
  green: {
    icon: 'bg-emerald-600',
    soft: 'bg-emerald-50 text-emerald-700',
    link: 'text-emerald-700'
  },
  orange: {
    icon: 'bg-orange-500',
    soft: 'bg-orange-50 text-orange-700',
    link: 'text-orange-600'
  },
  purple: {
    icon: 'bg-violet-600',
    soft: 'bg-violet-50 text-violet-700',
    link: 'text-violet-700'
  }
};

const Home = () => {
  return (
    <div className="bg-white text-slate-900">
      <section className="nqs-portal-hero relative min-h-[520px] overflow-hidden bg-[#082A55] pt-16 text-white">
        <img
          src={heroImage}
          alt="Banaadir National ID service building"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#06284F]/35" />
        <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(3,24,47,0.78)_0%,rgba(3,24,47,0.52)_38%,rgba(3,24,47,0.14)_72%,rgba(3,24,47,0.02)_100%)]" />

        <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-center px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
              National Queue System
            </h1>
            <p className="mt-4 max-w-lg text-2xl font-semibold leading-snug text-white">
              Digital National ID Services for Every Citizen
            </p>
            <p className="mt-5 max-w-md text-base font-medium leading-7 text-blue-50">
              Book appointments, check your queue, and access national ID services easily and efficiently.
            </p>

            <div className="mt-14 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/dashboard/user/new-id-registration"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
              >
                Book Appointment
              </Link>
              <Link
                to="/dashboard/user/track"
                className="inline-flex items-center justify-center rounded-md border border-white/80 bg-white/5 px-6 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                Check Queue
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Our Services</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[#082A55]">How can we help you?</h2>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-7 md:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const theme = colorMap[service.color];
            return (
              <article key={service.title} className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${theme.soft}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-lg font-black text-[#082A55]">{service.title}</h3>
                <p className="mx-auto mt-3 min-h-[72px] max-w-xs text-sm leading-6 text-slate-600">{service.description}</p>
                <Link to={service.path} className={`mt-5 inline-flex items-center justify-center gap-2 text-sm font-black ${theme.link}`}>
                  More detail <FiArrowRight />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-[#F5F8FC] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-[#082A55]">Recent Updates</h2>
              <p className="mt-1 text-sm text-slate-600">Stay informed about National ID service updates.</p>
            </div>
            <Link to="/faq" className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
              View all news <FiArrowRight />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {updates.map((item) => {
              const theme = colorMap[item.color];
              return (
                <article key={item.title} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="relative h-56 overflow-hidden bg-slate-100">
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${theme.soft}`}>
                      {item.tag}
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-slate-500">{item.date}</p>
                    <h3 className="mt-2 text-lg font-black leading-snug text-[#082A55]">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
                    <Link to="/about" className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${theme.link}`}>
                      Read More <FiArrowRight />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Need help?</p>
            <h2 className="mt-2 text-2xl font-black text-[#082A55]">Find your nearest Banaadir National ID Center</h2>
          </div>
          <Link
            to="/centers"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0B3A75] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#092B5A]"
          >
            View Centers <FiMapPin />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
