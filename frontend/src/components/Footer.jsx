import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import BrandLogo from './BrandLogo';

function Footer() {
  return (
    <footer className="nqs-simple-footer">
      <div className="nqs-footer-main">
        <div className="nqs-footer-brand">
          <div className="nqs-footer-title">
            <BrandLogo className="nqs-footer-logo" />
            <strong>NQS</strong>
          </div>
          <p>
            National ID Service (NQS) is the official provider of digital identity
            appointments and queue support in Banaadir.
          </p>
          <div className="nqs-footer-status">
            <FiCheckCircle />
            <span>Official National ID Service</span>
          </div>
        </div>

        <div className="nqs-footer-links">
          <div>
            <h3>Quick Links</h3>
            <Link to="/dashboard/user/services">Services</Link>
            <Link to="/about">Office Locations</Link>
            <Link to="/contact">Support Portal</Link>
            <Link to="/faq">Verification Tool</Link>
          </div>
          <div>
            <h3>Legal</h3>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Accessibility</span>
            <span>Data Protection</span>
          </div>
          <div>
            <h3>Contact</h3>
            <span className="nqs-footer-contact">
              <FiMapPin />
              NQS Government Plaza, Hodan District, Mogadishu
            </span>
            <span className="nqs-footer-contact">
              <FiPhone />
              +252 61 000 1000
            </span>
            <span className="nqs-footer-contact">
              <FiMail />
              contact@nqs.gov.so
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
