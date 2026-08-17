import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import {
  FiArrowRight,
  FiAward,
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClipboard,
  FiEdit3,
  FiHome,
  FiRefreshCw,
  FiUsers
} from 'react-icons/fi';
import api from '../api/axiosInstance';

const HOW_ICON_BLUE = '#2F6FB7';
const HOW_ICON_GOLD = '#E8B923';

function HowIconSubmit() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="16" y="10" width="34" height="46" rx="3" stroke={HOW_ICON_BLUE} strokeWidth="2.2" />
      <circle cx="33" cy="26" r="7" stroke={HOW_ICON_BLUE} strokeWidth="2.2" />
      <path d="M23 44c3.2-5 16.8-5 20 0" stroke={HOW_ICON_BLUE} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="48" cy="48" r="11" fill="#FFFFFF" stroke={HOW_ICON_GOLD} strokeWidth="2.2" />
      <path d="M43.5 48.2l3 3 6.2-6.5" stroke={HOW_ICON_GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 14l2.5 8.5L63 25l-8.5 2.5L52 36l-2.5-8.5L41 25l8.5-2.5L52 14z" fill={HOW_ICON_GOLD} />
    </svg>
  );
}

function HowIconCapture() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="12" y="16" width="28" height="36" rx="2.5" stroke={HOW_ICON_BLUE} strokeWidth="2.2" />
      <rect x="24" y="22" width="28" height="36" rx="2.5" fill="#FFFFFF" stroke={HOW_ICON_BLUE} strokeWidth="2.2" />
      <path d="M30 34h16M30 40h16M30 46h10" stroke={HOW_ICON_BLUE} strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="24" r="10" fill="#FFFFFF" stroke={HOW_ICON_GOLD} strokeWidth="2.2" />
      <path d="M46 24.2l2.8 2.8 5.5-5.8" stroke={HOW_ICON_GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HowIconReview() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="14" y="14" width="30" height="40" rx="2.5" stroke={HOW_ICON_BLUE} strokeWidth="2.2" />
      <path d="M20 24h18M20 30h18M20 36h12" stroke={HOW_ICON_BLUE} strokeWidth="2" strokeLinecap="round" />
      <circle cx="46" cy="40" r="12" stroke={HOW_ICON_BLUE} strokeWidth="2.4" />
      <path d="M55 49l8 8" stroke={HOW_ICON_GOLD} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function HowIconIssue() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" aria-hidden="true">
      <rect x="12" y="28" width="42" height="28" rx="3" stroke={HOW_ICON_BLUE} strokeWidth="2.2" />
      <circle cx="26" cy="42" r="6" stroke={HOW_ICON_BLUE} strokeWidth="2" />
      <path d="M36 38h12M36 44h10" stroke={HOW_ICON_BLUE} strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="22" r="11" fill="#FFFFFF" stroke={HOW_ICON_GOLD} strokeWidth="2.2" />
      <path d="M45.5 22.2l3 3 6-6.4" stroke={HOW_ICON_GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* User-provided hero images — NIRA-style stacked crossfade slider */
const heroSlides = [
  {
    title: 'Your ID, Your Right, Your Future',
    description:
      'Apply for your National ID, update your information, or replace a lost card — all in one place.',
    image: '/images/home/hero-service-center.png',
    alt: 'Citizen receiving National ID at an NQS service center'
  },
  {
    title: 'Professional Service, Closer to You',
    description:
      'Visit modern registration centers with trusted staff and clear guidance every step of the way.',
    image: '/images/home/hero-slide-office.png',
    alt: 'NQS staff member working at a National ID service center'
  },
  {
    title: 'National ID Services in Your Pocket',
    description:
      'Book appointments, follow updates, and manage your requests from anywhere on your phone.',
    image: '/images/home/hero-slide-mobile.png',
    alt: 'NQS National ID mobile application on a smartphone'
  },
  {
    title: 'Identity. Dignity. Future.',
    description:
      'Secure digital identity services that connect citizens with trusted centers across Somalia.',
    image: '/images/home/hero-slide-digital.png',
    alt: 'Digital National ID services with Somali flag branding'
  },
  {
    title: 'One Platform for Every Citizen',
    description:
      'Track your queue in real time and complete National ID services with confidence.',
    image: '/images/home/hero-slide-devices.png',
    alt: 'NQS digital identity apps on phone and tablet'
  },
  {
    title: 'Book Online, Skip the Wait',
    description:
      'Choose your service, pick a date, and manage your National ID appointment online.',
    image: '/images/home/hero-slide-booking.png',
    alt: 'Citizen booking a National ID appointment on a laptop'
  }
];

const easierServices = [
  {
    title: 'New National ID Registration',
    description:
      'Citizens applying for a National ID for the first time can book an appointment online before visiting the selected service center.',
    points: [
      'First-time National ID application',
      'Choose service center',
      'Select date and time',
      'Receive appointment reference'
    ],
    button: 'View Registration Details',
    to: '/services#new-registration',
    icon: FiClipboard,
    image: '/images/home/service-laptop-new-registration.png',
    imageAlt: 'New National ID registration on laptop'
  },
  {
    title: 'Update Information',
    description:
      'Citizens with an existing National ID can request corrections or changes to their personal information.',
    points: [
      'Compare old and new information',
      'Update changed personal details',
      'Upload supporting documents',
      'Track approval status'
    ],
    button: 'View Update Details',
    to: '/services#update-information',
    icon: FiEdit3,
    image: '/images/home/service-laptop-update-information.png',
    imageAlt: 'Update National ID information on laptop'
  },
  {
    title: 'Replace Lost ID',
    description:
      'Citizens whose National ID is lost, damaged, or unavailable can submit a replacement request online.',
    points: [
      'Report lost or damaged ID',
      'Keep the existing National ID record',
      'Submit replacement details',
      'Track replacement status'
    ],
    button: 'View Replacement Details',
    to: '/services#replace-lost-id',
    icon: FiRefreshCw,
    image: '/images/home/service-laptop-replace-lost-id.png',
    imageAlt: 'Replace lost National ID on laptop'
  }
];

const howToApply = [
  {
    step: 'STEP 01',
    title: 'Application Submission',
    description:
      'Citizens choose a National ID service and submit their appointment request online through NQS.',
    Icon: HowIconSubmit
  },
  {
    step: 'STEP 02',
    title: 'Data Capture',
    description:
      'Required personal details, service center, date, and time are collected to complete the booking.',
    Icon: HowIconCapture
  },
  {
    step: 'STEP 03',
    title: 'Review',
    description:
      'The request is reviewed for accuracy and confirmation, then a booking reference is issued.',
    Icon: HowIconReview
  },
  {
    step: 'STEP 04',
    title: 'Issuance of Credential',
    description:
      'After confirmation, citizens visit the selected center and complete their National ID service.',
    Icon: HowIconIssue
  }
];

const homeStatsMeta = [
  {
    key: 'appointmentsBooked',
    labelTop: 'Appointments',
    labelBottom: 'Booked',
    icon: FiCalendar,
    tone: 'blue',
    kind: 'count'
  },
  {
    key: 'happyCitizens',
    labelTop: 'Happy',
    labelBottom: 'Citizens',
    icon: FiUsers,
    tone: 'green',
    kind: 'count'
  },
  {
    key: 'serviceCenters',
    labelTop: 'Service',
    labelBottom: 'Centers',
    icon: FiHome,
    tone: 'purple',
    kind: 'plus'
  },
  {
    key: 'satisfactionRate',
    labelTop: 'Satisfaction',
    labelBottom: 'Rate',
    icon: FiAward,
    tone: 'orange',
    kind: 'percent'
  }
];

const homeAboutHighlights = [
  'Book National ID appointments from home',
  'Update National ID information online',
  'Track your queue in real time',
  'Access services across Banaadir centers'
];

function formatLiveStat(value, kind) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (kind === 'percent') return `${n}%`;
  if (kind === 'plus') return `${n}+`;
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M+`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K+`;
  return String(n);
}

function StatValue({ target, kind, active }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return undefined;
    }

    let frame = 0;
    const duration = 1600;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(target * eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, target]);

  return <strong>{formatLiveStat(display, kind)}</strong>;
}

function HomeStatsStrip() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const [stats, setStats] = useState({
    appointmentsBooked: 0,
    happyCitizens: 0,
    serviceCenters: 0,
    satisfactionRate: 0
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const res = await api.get('/api/reports/public-home-stats');
        const data = res.data?.data || res.data || {};
        if (!mounted) return;
        setStats({
          appointmentsBooked: Number(data.appointmentsBooked) || 0,
          happyCitizens: Number(data.happyCitizens) || 0,
          serviceCenters: Number(data.serviceCenters) || 0,
          satisfactionRate: Number(data.satisfactionRate) || 0
        });
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setLoaded(true);
      }
    };

    loadStats();
    const timer = window.setInterval(loadStats, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="nqs-portal-stats" aria-label="NQS impact statistics" ref={ref}>
      <div className="nqs-home-container">
        <div className="nqs-portal-stats-card">
          {homeStatsMeta.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.key} className={`nqs-portal-stats-item tone-${stat.tone}`}>
                <span className="nqs-portal-stats-icon" aria-hidden="true">
                  <Icon />
                </span>
                <StatValue
                  target={stats[stat.key]}
                  kind={stat.kind}
                  active={inView && loaded}
                />
                <p>
                  <span>{stat.labelTop}</span>
                  <span>{stat.labelBottom}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0 }
};

function HomeAboutPreview() {
  return (
    <section className="nqs-home-about-preview" aria-label="About NQS preview">
      <div className="nqs-home-container nqs-home-about-preview-grid">
        <motion.div
          className="nqs-home-about-preview-media"
          initial={{ opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55 }}
        >
          <motion.img
            src="/images/about/devices-mockup.png"
            alt="NQS dashboard and mobile app"
            loading="lazy"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.div
          className="nqs-home-about-preview-copy"
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55, delay: 0.06 }}
        >
          <span className="nqs-home-about-preview-eyebrow">About Our Project</span>
          <h2>A Smarter Way to Access National ID Services</h2>
          <p>
            NQS brings National ID booking, updates, and queue tracking into one secure
            digital experience for citizens across Banaadir.
          </p>

          <ul className="nqs-home-about-preview-list">
            {homeAboutHighlights.map((highlight) => (
              <li key={highlight}>
                <span aria-hidden="true">
                  <FiCheck />
                </span>
                {highlight}
              </li>
            ))}
          </ul>

          <Link to="/about" className="nqs-home-about-preview-link">
            Learn more about NQS
            <FiArrowRight />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function EasierServicesShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="nqs-portal-easier" aria-label="National ID Services Made Easier">
      <div className="nqs-home-container">
        <motion.div
          className="nqs-section-heading"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.35 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2>National ID Services Made Easier</h2>
          <p>A secure and reliable path for citizens across Banaadir service centers.</p>
        </motion.div>

        <div className="nqs-portal-easier-cards" role="tablist" aria-label="National ID services">
          {easierServices.map((service, index) => {
            const Icon = service.icon;
            const isActive = index === activeIndex;
            return (
              <article
                key={service.title}
                className={`nqs-portal-easier-card ${isActive ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="nqs-portal-easier-card-hit"
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="sr-only">Show {service.title}</span>
                </button>
                <div
                  className="nqs-portal-easier-card-media"
                  style={{ backgroundImage: `url(${service.image})` }}
                >
                  <span
                    className="nqs-portal-easier-card-photo"
                    style={{ backgroundImage: `url(${service.image})` }}
                    aria-hidden="true"
                  />
                  <motion.img
                    src={service.image}
                    alt={service.imageAlt}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: index * 0.3 }}
                  />
                </div>
                <div className="nqs-portal-easier-card-copy">
                  <span className="nqs-portal-easier-card-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <ul>
                    {service.points.slice(0, 2).map((point) => (
                      <li key={point}>
                        <FiCheck aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={service.to} className="nqs-portal-easier-card-link">
                    {service.button}
                    <FiArrowRight />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MobileAppPreviewStrip() {
  return (
    <section className="relative overflow-hidden py-24 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900" aria-label="NQS mobile app features">
      {/* Animated background blobs */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-yellow-200 dark:bg-yellow-900 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <div className="nqs-home-container relative z-10">
        <div className="flex flex-col lg:flex-row gap-12 items-center lg:justify-start">
          
          {/* Left: Enlarged Animated Phone Mockup */}
          <div className="flex-shrink-0 lg:-ml-4">
            <motion.div
              className="relative w-80 h-[680px] rounded-[3.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden ring-4 ring-gray-100 dark:ring-gray-700 lg:-mr-4"
              initial={{ opacity: 0, scale: 0.8, rotate: -3 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              animate={{ y: [0, -15, 0] }}
              style={{
                animation: 'float 6s ease-in-out infinite'
              }}
            >
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-7 bg-gray-900 rounded-b-3xl w-40 mx-auto z-20"></div>
              {/* Screen Content */}
              <img
                src="/images/home/uploaded_3.png"
                alt="NQS National ID mobile application"
                className="w-full h-full object-cover rounded-[2.5rem] bg-white"
                loading="lazy"
              />
              
              {/* Glass glare effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-10 transform -rotate-45 scale-150 pointer-events-none"></div>
            </motion.div>
          </div>

          {/* Right: Descriptive Text */}
          <div className="text-left space-y-8 max-w-xl lg:ml-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-sm font-bold tracking-wide uppercase mb-4">
                Available Now
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
                National ID Services <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">
                  in Your Pocket
                </span>
              </h2>
            </motion.div>

            <motion.p
              className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Experience the ultimate convenience with the NQS Mobile App. Designed for speed and ease, our application allows you to manage all your National ID requirements on the go. Say goodbye to long lines and paperwork.
            </motion.p>

            <motion.ul
              className="space-y-4"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {[
                'Book and manage appointments instantly',
                'Track your queue status in real-time',
                'Receive secure digital QR tickets',
                'Get instant notifications and updates'
              ].map((feature, idx) => (
                <li key={idx} className="flex items-center space-x-3 text-gray-700 dark:text-gray-200">
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                    <FiCheck className="w-4 h-4" />
                  </span>
                  <span className="font-medium">{feature}</span>
                </li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="pt-4"
            >
              <button className="px-8 py-4 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-lg shadow-xl hover:scale-105 hover:shadow-2xl transition-all duration-300">
                Download the App
              </button>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}

const SLIDE_MS = 7000;

const Home = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const goToSlide = (index) => {
    setActiveSlide((index + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="nqs-home-redesign nqs-home-portal">
      <section
        className="nqs-portal-hero nqs-portal-hero-soft nqs-portal-hero-nira"
        aria-label="NQS National ID hero"
      >
        <div className="nqs-portal-hero-inner">
          <div className="nqs-portal-hero-panel">
            <div className="nqs-portal-hero-copy">
              <div className="nqs-portal-hero-copy-stack">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.title}
                    className={`nqs-portal-hero-copy-slide ${index === activeSlide ? 'is-active' : ''}`}
                    aria-hidden={index !== activeSlide}
                  >
                    <span className="nqs-portal-hero-kicker">Your ID, Your Right</span>
                    <h1>{slide.title}</h1>
                    <p>{slide.description}</p>
                  </div>
                ))}
              </div>

              <div className="nqs-hero-actions">
                <Link to="/dashboard/user/services" className="nqs-portal-cta-primary nqs-hero-btn-start">
                  Get Started
                </Link>
              </div>
            </div>
          </div>

          <div className="nqs-portal-hero-media">
            {heroSlides.map((slide, index) => (
              <div
                key={slide.image}
                className={`nqs-portal-hero-media-slide ${index === activeSlide ? 'is-active' : ''}`}
                aria-hidden={index !== activeSlide}
              >
                <motion.img 
                  src={slide.image} 
                  alt={slide.alt}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
              </div>
            ))}

            <div className="nqs-portal-hero-blend" aria-hidden="true" />

            <div className="nqs-portal-slider-dots-bottom" role="tablist" aria-label="Hero slides">
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.image}
                  type="button"
                  role="tab"
                  aria-selected={index === activeSlide}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`nqs-portal-slider-dot ${index === activeSlide ? 'is-active' : ''}`}
                  onClick={() => goToSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="nqs-portal-slider-arrow nqs-portal-slider-arrow-prev"
          onClick={() => goToSlide(activeSlide - 1)}
          aria-label="Previous slide"
        >
          <FiChevronLeft />
        </button>
        <button
          type="button"
          className="nqs-portal-slider-arrow nqs-portal-slider-arrow-next"
          onClick={() => goToSlide(activeSlide + 1)}
          aria-label="Next slide"
        >
          <FiChevronRight />
        </button>
      </section>

      <HomeStatsStrip />

      <HomeAboutPreview />

      <EasierServicesShowcase />

      <MobileAppPreviewStrip />

      <section className="nqs-portal-how nqs-portal-how-apply" aria-label="How to Apply">
        <div className="nqs-home-container">
          <motion.div
            className="nqs-section-heading"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
            variants={fadeUp}
            transition={{ duration: 0.55 }}
          >
            <h2>How to Apply</h2>
          </motion.div>

          <div className="nqs-portal-how-grid">
            {howToApply.map((step, index) => {
              const Icon = step.Icon;
              return (
                <motion.article
                  key={step.step}
                  className="nqs-portal-how-step"
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <span className="nqs-portal-how-badge">{step.step}</span>
                  <span className="nqs-portal-how-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
