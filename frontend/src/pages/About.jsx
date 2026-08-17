import React from 'react';
import {
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiEye,
  FiHome,
  FiInfo,
  FiMapPin,
  FiShield,
  FiStar,
  FiTarget,
  FiUsers,
} from 'react-icons/fi';

const values = ['Integrity', 'Efficiency', 'Transparency', 'Respect', 'Innovation'];

const features = [
  {
    icon: <FiCalendar />,
    title: 'Online Appointment Booking',
    text: 'Book appointments for National ID services easily.',
    tone: 'blue',
  },
  {
    icon: <FiUsers />,
    title: 'Live Queue Tracking',
    text: 'Track your queue status in real-time.',
    tone: 'green',
  },
  {
    icon: <FiMapPin />,
    title: 'Multiple Service Centers',
    text: 'Access services at multiple National ID centers.',
    tone: 'purple',
  },
  {
    icon: <FiBell />,
    title: 'Instant Notifications',
    text: 'Get real-time updates about your appointments.',
    tone: 'orange',
  },
  {
    icon: <FiShield />,
    title: 'Secure & Reliable',
    text: 'Your data and information are safe with us.',
    tone: 'red',
  },
];

const About = () => {
  return (
    <div className="nqs-about-page">
      <section className="nqs-about-hero-v3">
        <div className="nqs-about-shell">
          <div className="nqs-about-crumb">
            <span aria-hidden="true">
              <FiHome />
            </span>
            <b>/</b>
            <span>About NQS</span>
          </div>

          <div className="nqs-about-hero-grid">
            <div className="nqs-about-hero-copy">
              <h1>About NQS</h1>
              <span className="nqs-about-title-line" aria-hidden="true" />
              <h2>Digital. Efficient. For Citizens.</h2>
              <p>
                The National Queueing System (NQS) is a modern digital platform
                that makes it easy for citizens to book appointments, track queues,
                and access National ID services anytime, anywhere.
              </p>
            </div>
            <div className="nqs-about-hero-media" aria-hidden="true">
              <img
                src="/images/about/national-id-center.png"
                alt=""
                loading="eager"
              />
            </div>
          </div>

          <article className="nqs-about-system-card">
            <span className="nqs-about-card-icon" aria-hidden="true">
              <FiInfo />
            </span>
            <div>
              <h3>About the System</h3>
              <p>
                NQS is designed to improve the way citizens access National
                Identification services by reducing waiting times, improving
                organization, and ensuring a transparent and efficient service
                delivery process.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="nqs-about-content">
        <div className="nqs-about-shell">
          <div className="nqs-about-info-grid">
            <article className="nqs-about-info-card">
              <span className="nqs-about-circle-icon" aria-hidden="true">
                <FiTarget />
              </span>
              <div>
                <h3>Our Mission</h3>
                <p>
                  To provide a seamless and efficient queue management and
                  appointment system for all National ID services.
                </p>
              </div>
            </article>

            <article className="nqs-about-info-card">
              <span className="nqs-about-circle-icon" aria-hidden="true">
                <FiEye />
              </span>
              <div>
                <h3>Our Vision</h3>
                <p>
                  To become the leading digital queueing platform that delivers
                  reliable, secure and citizen-centered services.
                </p>
              </div>
            </article>

            <article className="nqs-about-info-card">
              <span className="nqs-about-circle-icon" aria-hidden="true">
                <FiCheckCircle />
              </span>
              <div>
                <h3>Our Values</h3>
                <ul>
                  {values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </div>
            </article>
          </div>

          <div className="nqs-about-feature-heading">
            <span aria-hidden="true">
              <FiStar />
            </span>
            <h3>Key Features</h3>
          </div>

          <div className="nqs-about-features">
            {features.map((feature) => (
              <article className="nqs-about-feature" key={feature.title}>
                <span
                  className={`nqs-about-feature-icon is-${feature.tone}`}
                  aria-hidden="true"
                >
                  {feature.icon}
                </span>
                <div>
                  <h4>{feature.title}</h4>
                  <p>{feature.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
