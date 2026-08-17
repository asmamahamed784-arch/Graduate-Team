import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube } from 'react-icons/fa';
import { FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import BrandLogo from './BrandLogo';

function Footer() {
  return (
    <footer className="nqs-simple-footer">
      <div className="nqs-footer-main">
        <div className="nqs-footer-brand">
          <div className="nqs-footer-title">
            <BrandLogo className="nqs-footer-logo" size={48} />
            <div className="nqs-footer-brand-text">
              <strong>NQS</strong>
              <span>NATIONAL ID</span>
            </div>
          </div>
          <p>Making National ID services easier, faster and more efficient for everyone.</p>
          <div className="nqs-footer-social">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <FaTwitter />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <FaYoutube />
            </a>
          </div>
        </div>

        <div className="nqs-footer-col">
          <h3>Quick Links</h3>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/services">Services</Link>
          <Link to="/track">Track Queue</Link>
          <Link to="/faq">FAQ</Link>
        </div>

        <div className="nqs-footer-col">
          <h3>Services</h3>
          <Link to="/services/new-id-registration">New Registration</Link>
          <Link to="/services/update-information">Update Information</Link>
          <Link to="/services/replace-lost-id">Lost ID Replacement</Link>
          <Link to="/track">Check Status</Link>
          <Link to="/services">All Services</Link>
        </div>

        <div className="nqs-footer-col">
          <h3>Support</h3>
          <Link to="/faq">Help Center</Link>
          <Link to="/contact">Contact Us</Link>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Accessibility</span>
        </div>

        <div className="nqs-footer-col nqs-footer-col-contact">
          <h3>Contact Us</h3>
          <span className="nqs-footer-contact">
            <FiMapPin aria-hidden="true" />
            NQS Government Plaza, Hodan District, Mogadishu
          </span>
          <span className="nqs-footer-contact">
            <FiPhone aria-hidden="true" />
            +252 61 000 1000
          </span>
          <span className="nqs-footer-contact">
            <FiMail aria-hidden="true" />
            contact@nqs.gov.so
          </span>
        </div>
      </div>

      <div className="nqs-footer-bottom">
        <span>© 2024 NQS National ID System. All rights reserved.</span>
      </div>
    </footer>
  );
}

export default Footer;
