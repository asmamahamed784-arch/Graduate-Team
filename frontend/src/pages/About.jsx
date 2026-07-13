import React from 'react';
import {
  FiBarChart2,
  FiBell,
  FiCalendar,
  FiClock,
  FiList,
  FiLock,
  FiMapPin,
  FiShield,
  FiTarget,
  FiUsers,
} from 'react-icons/fi';
import { FaBuilding, FaQrcode } from 'react-icons/fa';

const overviewCards = [
  {
    title: 'Who We Are',
    text: 'NQS National ID is a digital service platform designed to simplify National ID registration, replacement, and information update services for Banaadir citizens.',
    icon: FiUsers,
    color: 'blue',
  },
  {
    title: 'Our Mission',
    text: 'To provide citizens with fast, transparent, and secure access to National ID services through online booking, QR ticketing, and queue tracking.',
    icon: FiTarget,
    color: 'green',
  },
  {
    title: 'Our Vision',
    text: 'To build a smart and efficient National ID service system that sets a new standard for public service delivery in Somalia.',
    icon: FiShield,
    color: 'blue',
  },
];

const services = [
  {
    title: 'Online Appointment Booking',
    text: 'Book your National ID appointment online in a few simple steps.',
    icon: FiCalendar,
    color: 'blue',
  },
  {
    title: 'QR Ticket Verification',
    text: 'Get your QR ticket and verify it easily at the service center.',
    icon: FaQrcode,
    color: 'green',
  },
  {
    title: 'Queue Tracking',
    text: 'Check your queue status in real time and plan your visit better.',
    icon: FiClock,
    color: 'orange',
  },
  {
    title: 'Banaadir Service Centers',
    text: 'Find all National ID service centers across Banaadir region.',
    icon: FaBuilding,
    color: 'purple',
  },
  {
    title: 'Citizen Notifications',
    text: 'Receive important updates and notifications about your services.',
    icon: FiBell,
    color: 'amber',
  },
  {
    title: 'Admin & Operator Management',
    text: 'Secure dashboard for admins and operators to manage services.',
    icon: FiUsers,
    color: 'blue',
  },
];

const steps = [
  ['Choose a Service', 'Select the National ID service you need.', FiList],
  ['Select a Center', 'Choose your preferred service center.', FiMapPin],
  ['Book Appointment', 'Pick a date and time that suits you.', FiCalendar],
  ['Receive QR Ticket', 'Get your QR ticket for the appointment.', FaQrcode],
  ['Visit Center', 'Visit the center at your scheduled time.', FaBuilding],
];

const benefits = [
  ['Reduces Long Queues', 'Book online and avoid standing in long lines.', FiClock, 'blue'],
  ['Select Time', 'Quick and easy booking from anywhere.', FiClock, 'green'],
  ['Improves Transparency', 'Real-time queue tracking and clear service process.', FiShield, 'blue'],
  ['Better Management', 'Helps service centers manage appointments efficiently.', FiBarChart2, 'green'],
  ['Secure & Reliable', 'Your data and services are safe and protected.', FiLock, 'blue'],
];

const colorStyles = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-600',
};

const About = () => {
  return (
    <div className="nqs-about-page bg-white text-slate-900">
      <section className="nqs-about-hero bg-[#F8FBFF] pt-28">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="nqs-about-eyebrow text-sm font-black uppercase tracking-wide text-blue-700">About Us</p>
            <h1 className="nqs-about-title mt-4 text-4xl font-black leading-tight tracking-tight text-[#082A55] sm:text-6xl">
              About NQS
              <br />
              National ID
            </h1>
            <p className="nqs-about-subtitle mx-auto mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700">
              Digital National ID appointment and queue services for Banaadir citizens.
            </p>
            <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-blue-600" />
            <p className="nqs-about-body mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600">
              Our platform helps citizens book appointments, check queues, and access National ID services easily and efficiently from anywhere.
            </p>
          </div>
        </div>
      </section>

      <section className="nqs-about-section border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          {overviewCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className={`flex gap-5 py-6 md:px-8 ${index !== overviewCards.length - 1 ? 'md:border-r md:border-slate-200' : ''}`}
              >
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${colorStyles[card.color]}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="nqs-about-heading text-xl font-black text-[#082A55]">{card.title}</h2>
                  <p className="nqs-about-body mt-4 max-w-sm text-sm leading-7 text-slate-600">{card.text}</p>
                  <div className={`mt-5 h-0.5 w-10 rounded-full ${card.color === 'green' ? 'bg-emerald-600' : 'bg-blue-600'}`} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="nqs-about-section bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="nqs-about-heading text-center text-2xl font-black text-[#082A55]">What We Provide</h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {services.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${colorStyles[item.color]}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="nqs-about-heading mt-5 text-sm font-black leading-6 text-[#082A55]">{item.title}</h3>
                  <p className="nqs-about-body mt-4 text-xs leading-6 text-slate-600">{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nqs-about-process bg-[#F1F7FF] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="nqs-about-heading text-center text-2xl font-black text-[#082A55]">How It Works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-5">
            {steps.map(([title, text, Icon], index) => (
              <article key={title} className="relative text-center">
                {index !== steps.length - 1 && (
                  <div className="absolute left-[58%] top-10 hidden h-px w-[84%] border-t border-dashed border-blue-300 md:block" />
                )}
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                  <span className="absolute -top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <Icon className="h-9 w-9 text-blue-700" />
                </div>
                <h3 className="nqs-about-heading mt-4 text-sm font-black text-[#082A55]">{title}</h3>
                <p className="nqs-about-body mx-auto mt-2 max-w-[150px] text-xs leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nqs-about-section bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="nqs-about-heading text-center text-2xl font-black text-[#082A55]">Why Use NQS?</h2>
          <div className="mt-8 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {benefits.map(([title, text, Icon, color], index) => (
              <article
                key={title}
                className={`px-5 py-4 text-center ${index !== benefits.length - 1 ? 'lg:border-r lg:border-slate-200' : ''}`}
              >
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 ${color === 'green' ? 'border-emerald-600 text-emerald-600' : 'border-blue-600 text-blue-600'}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="nqs-about-heading mt-4 text-sm font-black text-[#082A55]">{title}</h3>
                <p className="nqs-about-body mx-auto mt-2 max-w-[180px] text-xs leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
