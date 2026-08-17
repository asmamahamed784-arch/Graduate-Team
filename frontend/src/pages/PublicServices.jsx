import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowRight,
  FiBell,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiEdit3,
  FiRefreshCw,
  FiShield
} from 'react-icons/fi';

const serviceSections = [
  {
    id: 'new-registration',
    eyebrow: 'NEW REGISTRATION',
    title: 'Register for a New National ID',
    icon: FiClipboard,
    image: '/images/home/service-laptop-new-registration.png',
    imageAlt: 'New National ID registration on a laptop',
    summary:
      'Apply for your first National ID online. Choose a center, pick a date and time, and complete your details before visiting a trusted Banaadir registration center.',
    features: [
      { icon: FiShield, title: 'Secure & Verified', text: 'Your application is protected at every step.' },
      { icon: FiCheckCircle, title: 'Guided Booking', text: 'Clear steps from service choice to confirmation.' },
      { icon: FiClock, title: 'Save Time', text: 'Book online and avoid long waiting lines.' },
      { icon: FiBell, title: 'Track Status', text: 'Follow your request and queue updates in real time.' }
    ],
    ctaLabel: 'Get Started',
    ctaTo: '/dashboard/user/new-id-registration'
  },
  {
    id: 'update-information',
    eyebrow: 'UPDATE INFORMATION',
    title: 'Update Your Information',
    icon: FiEdit3,
    image: '/images/home/service-laptop-update-information.png',
    imageAlt: 'Update National ID information on a laptop',
    summary:
      'Keep your National ID information accurate and up to date. You can easily update any changed or incorrect details online without visiting the registration center.',
    features: [
      { icon: FiShield, title: 'Secure & Verified', text: 'Your updates are verified for security.' },
      { icon: FiCheckCircle, title: 'Accurate Records', text: 'Helps maintain accurate national records.' },
      { icon: FiClock, title: 'Save Time', text: 'No need to wait in long queues.' },
      { icon: FiBell, title: 'Track Status', text: 'Track your application status in real time.' }
    ],
    ctaLabel: 'Get Started',
    ctaTo: '/dashboard/user/update-information'
  },
  {
    id: 'replace-lost-id',
    eyebrow: 'REPLACE LOST ID',
    title: 'Replace Lost National ID',
    icon: FiRefreshCw,
    image: '/images/home/service-laptop-replace-lost-id.png',
    imageAlt: 'Replace lost National ID service on a laptop',
    summary:
      'Report a lost National ID and request a replacement using your existing record. Follow a simple online process with clear guidance until your new card is ready.',
    features: [
      { icon: FiShield, title: 'Secure & Private', text: 'Your data is protected at every step.' },
      { icon: FiCheckCircle, title: 'Official Replacement', text: 'Use your existing National ID record safely.' },
      { icon: FiClock, title: 'Fast & Easy', text: 'Simple steps to start your replacement request.' },
      { icon: FiBell, title: 'Need Help?', text: 'Support is available if you get stuck.' }
    ],
    ctaLabel: 'Get Started',
    ctaTo: '/dashboard/user/replace-lost-id'
  }
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 }
};

function scrollToHash(hash) {
  if (!hash) return;
  const id = hash.replace(/^#/, '');
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const PublicServices = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return undefined;
    }

    const timer = window.setTimeout(() => scrollToHash(location.hash), 80);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <div className="nqs-public-services">
      <section className="nqs-public-services-hero">
        <div className="nqs-home-container nqs-public-services-hero-inner">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.55 }}
          >
            <span className="nqs-portal-eyebrow nqs-portal-eyebrow-light">National ID Services</span>
            <h1>Choose the service that matches your need</h1>
            <p>
              Learn what each National ID service covers, then continue through the secure request flow
              when you are ready.
            </p>
          </motion.div>
        </div>
      </section>

      {serviceSections.map((service) => {
        const Icon = service.icon;

        return (
          <section
            key={service.id}
            id={service.id}
            className="nqs-public-service-section nqs-public-service-showcase"
          >
            <div className="nqs-home-container nqs-public-service-showcase-grid">
              <motion.div
                className="nqs-public-service-copy"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeUp}
                transition={{ duration: 0.55 }}
              >
                <div className="nqs-public-service-kicker">
                  <span className="nqs-public-service-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="nqs-public-service-eyebrow">{service.eyebrow}</span>
                </div>

                <h2>{service.title}</h2>
                <p className="nqs-public-service-summary">{service.summary}</p>

                <div className="nqs-public-service-features">
                  {service.features.map((feature) => {
                    const FeatureIcon = feature.icon;
                    return (
                      <div key={feature.title} className="nqs-public-service-feature">
                        <span className="nqs-public-service-feature-icon" aria-hidden="true">
                          <FeatureIcon />
                        </span>
                        <div>
                          <h3>{feature.title}</h3>
                          <p>{feature.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Link to={service.ctaTo} className="nqs-portal-cta-primary nqs-public-service-cta">
                  {service.ctaLabel}
                  <FiArrowRight />
                </Link>
              </motion.div>

              <motion.div
                className="nqs-public-service-media nqs-public-service-laptop"
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.65 }}
              >
                <img src={service.image} alt={service.imageAlt} loading="lazy" />
              </motion.div>
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default PublicServices;
