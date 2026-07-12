import React from 'react';
import { Link } from 'react-router-dom';
import { FiGlobe, FiMail, FiPhone, FiMapPin, FiShield, FiInfo, FiLock } from 'react-icons/fi';
import crestLogo from '../assets/logo/government_crest.svg';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#082A55] text-blue-50 border-t border-blue-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white p-1.5">
                <img src={crestLogo} alt="NQS logo" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-white font-extrabold text-lg tracking-wide uppercase">NQS</h2>
            </div>
            <p className="text-xs leading-relaxed text-blue-100/80">
              National ID Service (NQS) is the official provider of digital identity appointments and queue support in Banaadir.
            </p>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-300 font-bold">
              <FiShield className="w-3.5 h-3.5" />
              <span>Official National ID Service</span>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 border-l-2 border-[#4189DD] pl-3">
              Quick Links
            </h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/services" className="hover:text-emerald-300 transition-colors">Services</Link></li>
              <li><Link to="/centers" className="hover:text-emerald-300 transition-colors">Office Locations</Link></li>
              <li><Link to="/contact" className="hover:text-emerald-300 transition-colors">Support Portal</Link></li>
              <li><Link to="/track" className="hover:text-emerald-300 transition-colors">Verification Tool</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 border-l-2 border-[#4189DD] pl-3">
              Legal
            </h3>
            <ul className="space-y-2 text-xs">
              <li><span className="text-blue-100/80">Privacy Policy</span></li>
              <li><span className="text-blue-100/80">Terms of Service</span></li>
              <li><span className="text-blue-100/80">Accessibility</span></li>
              <li><span className="text-blue-100/80">Data Protection</span></li>
              <li>
                <span className="hidden text-blue-100/60 items-center space-x-1">
                  <FiLock className="w-3 h-3" />
                  <span>QR ticket checking</span>
                </span>
              </li>
              <li>
                <span className="hidden text-blue-100/60 items-center space-x-1">
                  <FiInfo className="w-3 h-3" />
                  <span>Queue status updates</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-white font-bold text-xs uppercase tracking-widest mb-4 border-l-2 border-[#4189DD] pl-3">
              Contact
            </h3>
            <div className="flex items-start space-x-2 text-xs">
              <FiMapPin className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
              <span>NQS Government Plaza, Hodan District, Mogadishu</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <FiPhone className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>+252 61 000 1000</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <FiMail className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>contact@nqs.gov.so</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#061E3D] py-6 border-t border-blue-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs space-y-4 md:space-y-0 text-blue-100/70">
          <div>
            Copyright {currentYear} National ID Service (NQS). All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <FiGlobe className="h-4 w-4" />
            <span>Soomaaliya</span>
            <span>|</span>
            <span>English</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
