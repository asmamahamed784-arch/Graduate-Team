import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiShield,
  FiTrendingDown,
  FiZap
} from 'react-icons/fi';
import api from '../api/axiosInstance';
import { apiClient } from '../api/apiClient';
import serviceCenterImage from '../assets/images/service center.png';
import queueImage from '../assets/images/Queue.jpg';

const citizenPhoneImage = '/images/home/img.jpeg';
const processImage = '/images/home/ChatGPT Image Jul 30, 2026, 12_04_35 AM.png';

const serviceHighlights = [
  {
    title: 'Digital Appointment Booking',
    description: 'Book your appointment online from home and choose the time that works best for you.',
    icon: FiCalendar,
    image: queueImage,
    featured: true,
    to: '/dashboard/user/new-id-registration'
  },
  {
    title: 'Live Notifications',
    description: 'Receive timely reminders and updates when your appointment is getting closer.',
    icon: FiBell,
    to: '/notifications'
  },
  {
    title: 'Queue Status',
    description: 'Track your place in the queue in real time from wherever you are.',
    icon: FiTrendingDown,
    tone: 'plain',
    to: '/dashboard/user/track'
  },
  {
    title: 'Security and Privacy',
    description: 'Your data is protected with secure systems and modern verification standards.',
    icon: FiShield,
    secure: true,
    to: '/about'
  }
];

const steps = [
  {
    title: 'Choose a Service',
    description: 'Select the government service you need from the available service list.'
  },
  {
    title: 'Pick a Time',
    description: 'Choose the date and time that works best for your visit.'
  },
  {
    title: 'Get Your Appointment',
    description: 'Receive your appointment number and secure QR code confirmation.'
  },
  {
    title: 'Visit the Center',
    description: 'Arrive at the selected center on time without waiting in long lines.'
  }
];

const Home = () => {
  const [portalStats, setPortalStats] = useState({
    citizens: 0,
    services: 0,
    centers: 0,
    loading: true
  });

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const [servicesResult, centersResult, reportsResult] = await Promise.allSettled([
          apiClient.get('/api/services'),
          apiClient.get('/api/centers/list'),
          api.get('/api/reports/stats')
        ]);

        if (!mounted) return;

        const services = servicesResult.status === 'fulfilled' && Array.isArray(servicesResult.value.data)
          ? servicesResult.value.data
          : [];
        const centers = centersResult.status === 'fulfilled' && Array.isArray(centersResult.value.data)
          ? centersResult.value.data
          : [];
        const report = reportsResult.status === 'fulfilled'
          ? reportsResult.value.data?.data || reportsResult.value.data || {}
          : {};

        setPortalStats({
          citizens: Number(report.totalCitizens ?? report.totalUsers ?? 0),
          services: Number(report.activeServices ?? services.length ?? 0),
          centers: Number(report.totalServiceCenters ?? report.serviceCenters ?? centers.length ?? 0),
          loading: false
        });
      } catch {
        if (!mounted) return;
        setPortalStats({
          citizens: 0,
          services: 0,
          centers: 0,
          loading: false
        });
      }
    };

    loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  const displayNumber = (value) => {
    if (portalStats.loading) return '...';
    return Number(value || 0).toLocaleString();
  };

  const stats = [
    {
      value: displayNumber(portalStats.citizens),
      label: 'Registered Citizens'
    },
    {
      value: displayNumber(portalStats.services),
      label: 'Active Services'
    },
    {
      value: displayNumber(portalStats.centers),
      label: 'Service Centers'
    }
  ];

  return (
    <div className="nqs-home-redesign">
      <section className="nqs-home-hero">
        <div className="nqs-home-container nqs-hero-grid">
          <div className="nqs-hero-copy">
            <span className="nqs-pill">
              <FiZap />
              Secure Government Service
            </span>
            <h1>NQS Queue and Appointment System</h1>
            <p>
              Access government services through a simple digital portal. Skip long lines,
              book appointments from home, and stay updated before you visit.
            </p>
            <div className="nqs-hero-actions">
              <Link to="/dashboard/user/services" className="nqs-primary-action">
                Book Appointment
                <FiArrowRight />
              </Link>
              <Link to="/about" className="nqs-secondary-action">
                How it works
              </Link>
            </div>
          </div>

          <div className="nqs-hero-visual" aria-label="NQS service center appointment preview">
            <div className="nqs-hero-photo nqs-hero-photo-back">
              <img src={serviceCenterImage} alt="NQS service center" />
            </div>
            <div className="nqs-hero-photo nqs-hero-photo-front">
              <img src={citizenPhoneImage} alt="Citizen using NQS appointment service" />
            </div>
            <div className="nqs-phone-card">
              <div className="nqs-phone-shell">
                <span />
                <span />
                <span />
              </div>
              <div className="nqs-wait-card">
                <FiClock />
                <div>
                  <span>Waiting Time</span>
                  <strong>-85%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nqs-stat-band">
        <div className="nqs-home-container nqs-stat-grid">
          {stats.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="nqs-services-section">
        <div className="nqs-home-container">
          <div className="nqs-section-heading">
            <h2>Services we improved for you</h2>
            <p>The fastest way to access government services through NQS.</p>
          </div>

          <div className="nqs-service-grid">
            {serviceHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className={[
                    'nqs-service-card',
                    item.featured ? 'nqs-service-card-wide' : '',
                    item.secure ? 'nqs-service-card-secure' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="nqs-card-copy">
                    <span className="nqs-card-icon">
                      <Icon />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.secure && (
                      <div className="nqs-security-tags">
                        <span>ISO 27001</span>
                        <span>256-bit Encrypted</span>
                      </div>
                    )}
                  </div>
                  {item.image && (
                    <img src={item.image} alt="" className="nqs-card-image" />
                  )}
                  {item.secure && <span className="nqs-secure-ring" />}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nqs-process-section">
        <div className="nqs-home-container nqs-process-grid">
          <div>
            <h2>How does NQS work?</h2>
            <p className="nqs-process-intro">
              Four simple steps to help you get the service you need faster and with less waiting.
            </p>
            <div className="nqs-step-list">
              {steps.map((step, index) => (
                <div className="nqs-step" key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="nqs-process-image">
            <img src={processImage} alt="NQS appointment portal shown in a service office" />
            <div className="nqs-process-badge">
              <FiCheckCircle />
              Appointment confirmed
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
