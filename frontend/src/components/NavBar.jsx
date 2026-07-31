import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiMenu, FiMoon, FiSun, FiUser, FiX } from 'react-icons/fi';
import { useAuth, useTheme } from '../hooks';
import BrandLogo from './BrandLogo';

const navItems = [
  { name: 'Home', to: '/' },
  { name: 'About', to: '/about' },
  { name: 'FAQ', to: '/faq' },
  { name: 'Contact', to: '/contact' }
];

function NavBar() {
  const { isAuthenticated, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const centerRoles = ['operator', 'super_operator', 'center_manager'];
  const adminRoles = ['admin', 'super_admin'];
  const dashboardPath = !isAuthenticated
    ? '/login'
    : adminRoles.includes(role)
      ? '/dashboard/admin'
      : centerRoles.includes(role)
        ? '/dashboard/operator'
        : '/dashboard/user';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`nqs-simple-navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="nqs-nav-inner">
        <Link to="/" className="nqs-nav-brand" onClick={() => setMobileOpen(false)}>
          <BrandLogo className="nqs-nav-mark" />
          <span className="nqs-brand-copy">
            <strong>NQS National ID</strong>
          </span>
        </Link>

        <div className="nqs-nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) => `nqs-nav-link ${isActive ? 'is-active' : ''}`}
            >
              {item.name}
            </NavLink>
          ))}
        </div>

        <div className="nqs-nav-actions">
          <button
            type="button"
            onClick={toggleTheme}
            className="nqs-theme-link"
            aria-label="Toggle dark and light theme"
          >
            {isDark ? <FiSun /> : <FiMoon />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
          <Link to={dashboardPath} className="nqs-dashboard-link">
            <FiUser />
            <span>Dashboard</span>
          </Link>
          <button
            type="button"
            className="nqs-menu-button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="nqs-mobile-menu">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.to}
              onClick={() => setMobileOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <button type="button" onClick={toggleTheme}>
            {isDark ? 'Light' : 'Dark'}
          </button>
          <Link to={dashboardPath} onClick={() => setMobileOpen(false)}>
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}

export default NavBar;
