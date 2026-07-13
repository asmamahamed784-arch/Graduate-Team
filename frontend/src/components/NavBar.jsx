import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth, useTheme } from '../hooks';
import {
  HiOutlineMoon, HiOutlineSun, HiOutlineBars3, HiOutlineXMark,
  HiOutlineArrowRightOnRectangle, HiOutlineUserPlus, HiOutlineSquares2X2,
} from 'react-icons/hi2';
import crestLogo from '../assets/logo/government_crest.svg';

const navItems = [
  { name: 'Home', to: '/' },
  { name: 'About', to: '/about' },
  { name: 'Features', to: '/features' },
  { name: 'Services', to: '/services' },
  { name: 'Pricing', to: '/pricing' },
  { name: 'Queue', to: '/track' },
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
      : role === 'operator' || role === 'super_operator'
        ? '/dashboard/operator'
        : '/dashboard/user';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 z-50 w-full border-b transition-all duration-300 ${
        scrolled
          ? 'border-slate-200/80 bg-white/85 py-2 shadow-sm backdrop-blur-xl dark:border-[#1d355f]/80 dark:bg-[#061225]/85'
          : 'border-transparent bg-white/60 py-3 backdrop-blur-md dark:bg-[#061225]/60'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-12 items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition-transform duration-200 group-hover:scale-105 dark:border-[#1d355f]">
              <img src={crestLogo} alt="NQS logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col text-left">
              <span className="whitespace-nowrap text-sm font-black leading-none tracking-tight text-slate-900 dark:text-white">
                NQS National ID
              </span>
              <span className="mt-0.5 whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-widest text-emerald-600 dark:text-emerald-400">
                Banaadir Portal
              </span>
            </div>
          </Link>

          {/* Center links */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </div>

          {/* Right actions */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-[#1d355f] dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Toggle dark and light theme"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <HiOutlineSun className="h-5 w-5" /> : <HiOutlineMoon className="h-5 w-5" />}
            </button>
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                <HiOutlineSquares2X2 className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <HiOutlineArrowRightOnRectangle className="h-4 w-4" />
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  <HiOutlineUserPlus className="h-4 w-4" />
                  Create account
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 dark:border-[#1d355f] dark:bg-white/5 dark:text-slate-300"
              aria-label="Toggle theme"
            >
              {isDark ? <HiOutlineSun className="h-5 w-5" /> : <HiOutlineMoon className="h-5 w-5" />}
            </button>
            <button
              className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-white/10"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <HiOutlineXMark className="h-6 w-6" /> : <HiOutlineBars3 className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="space-y-1 border-t border-slate-200 bg-white px-4 pb-6 pt-3 shadow-xl dark:border-[#1d355f] dark:bg-[#061225] lg:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                }`
              }
              onClick={() => setMobileOpen(false)}
            >
              {item.name}
            </NavLink>
          ))}
          <div className="my-4 h-px bg-slate-200 dark:bg-[#1d355f]" />
          {isAuthenticated ? (
            <Link
              to={dashboardPath}
              className="block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white shadow-sm"
              onClick={() => setMobileOpen(false)}
            >
              Open Dashboard
            </Link>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <Link
                to="/login"
                className="block w-full rounded-xl border border-slate-200 py-3 text-center text-sm font-bold text-slate-700 dark:border-[#1d355f] dark:text-slate-200"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="block w-full rounded-xl bg-emerald-500 py-3 text-center text-sm font-bold text-white"
                onClick={() => setMobileOpen(false)}
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export default NavBar;
