import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth, useTheme } from '../hooks';
import { FiMenu, FiMoon, FiSun, FiX, FiUser } from 'react-icons/fi';
import crestLogo from '../assets/logo/government_crest.svg';

const navItems = [
  { name: 'Home', to: '/' },
  { name: 'About', to: '/about' },
  { name: 'Check Queue', to: '/track' },
  { name: 'Centers', to: '/centers' },
  { name: 'FAQ', to: '/faq' },
  { name: 'Contact', to: '/contact' },
];

function NavBar() {
  const { isAuthenticated, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dashboardPath = !isAuthenticated
    ? '/login'
    : role === 'admin'
      ? '/dashboard/admin'
      : role === 'operator'
        ? '/dashboard/operator'
        : '/dashboard/user';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`nqs-public-navbar fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#092B5A]/95 backdrop-blur-xl py-2 shadow-lg border-b border-blue-900/30'
          : 'bg-[#082A55] py-2.5 border-b border-blue-900/30'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-10">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white p-1.5 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <img src={crestLogo} alt="NQS logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-white font-black text-base tracking-wide font-sans leading-none uppercase">
                NQS National ID
              </span>
              <span className="text-emerald-300 font-bold text-[9px] tracking-widest uppercase leading-none mt-0.5">
                Banaadir Portal
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-colors duration-150 ${
                    isActive
                      ? 'text-white bg-white/15'
                      : 'text-blue-50/90 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </div>

          <div className="hidden lg:flex items-center space-x-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-extrabold uppercase text-white transition hover:bg-white/20"
              aria-label="Toggle dark and white theme"
            >
              {isDark ? <FiSun className="h-3.5 w-3.5" /> : <FiMoon className="h-3.5 w-3.5" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
            <Link
              to={dashboardPath}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-extrabold uppercase rounded-md shadow-sm transition-all duration-200 flex items-center space-x-1.5"
            >
              <FiUser className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="flex lg:hidden items-center space-x-3">
            <button
              className="p-2 text-blue-50 hover:text-white rounded-lg transition focus:outline-none"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-[#092B5A] border-t border-blue-900/30 px-4 pt-2 pb-6 space-y-2 shadow-xl animate-slide-in">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.to}
              className="block px-3 py-2.5 rounded-lg text-sm font-bold uppercase text-blue-50 hover:text-white hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <div className="h-px bg-white/15 my-4" />
          <div className="pt-2 px-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 py-3 text-sm font-extrabold uppercase text-white"
            >
              {isDark ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>
            <Link
              to={dashboardPath}
              className="w-full py-3 bg-blue-600 text-white font-extrabold text-sm uppercase rounded-lg text-center shadow-sm block"
              onClick={() => setMobileOpen(false)}
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default NavBar;
