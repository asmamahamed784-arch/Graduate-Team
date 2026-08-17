import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FiMenu, FiMoon, FiSun, FiX, FiChevronDown, FiUser } from 'react-icons/fi';
import { useAuth, useTheme } from '../hooks';
import BrandLogo from './BrandLogo';

const navItems = [
  { name: 'Home', to: '/' },
  { name: 'About', to: '/about' },
  {
    name: 'Services',
    to: '/services',
    hasDropdown: true,
    children: [
      { name: 'New National ID Registration', to: '/services#new-registration' },
      { name: 'Update Information', to: '/services#update-information' },
      { name: 'Replace Lost ID', to: '/services#replace-lost-id' }
    ]
  },
  { name: 'Track Queue', to: '/track' },
  { name: 'FAQ', to: '/faq' },
  { name: 'Contact', to: '/contact' }
];

function NavBar() {
  const { isAuthenticated, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef(null);

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

  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!servicesRef.current?.contains(event.target)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <>
      <nav className={`nqs-simple-navbar ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nqs-nav-inner">
          <Link to="/" className="nqs-nav-brand" onClick={() => setMobileOpen(false)}>
            <BrandLogo full size={72} className="nqs-nav-brand-logo" />
          </Link>

          <div className="nqs-nav-links">
            {navItems.map((item) => {
              if (item.hasDropdown) {
                return (
                  <div
                    key={item.name}
                    className={`nqs-nav-dropdown ${servicesOpen ? 'is-open' : ''}`}
                    ref={servicesRef}
                    onMouseEnter={() => setServicesOpen(true)}
                    onMouseLeave={() => setServicesOpen(false)}
                  >
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `nqs-nav-link ${isActive ? 'is-active' : ''}`
                      }
                      onClick={() => setServicesOpen((open) => !open)}
                      aria-haspopup="menu"
                      aria-expanded={servicesOpen}
                    >
                      {item.name}
                      <FiChevronDown className="nqs-nav-chevron" />
                    </NavLink>
                    <div className="nqs-nav-dropdown-menu" role="menu">
                      {item.children.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className="nqs-nav-dropdown-item"
                          role="menuitem"
                          onClick={() => setServicesOpen(false)}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.name}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nqs-nav-link ${isActive ? 'is-active' : ''}`
                  }
                >
                  {item.name}
                </NavLink>
              );
            })}
          </div>

          <div className="nqs-nav-actions">
            <button
              type="button"
              className="nqs-theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light' : 'Dark'}
            >
              <FiSun className={`nqs-theme-toggle-icon ${!isDark ? 'is-on' : ''}`} />
              <span className={`nqs-theme-toggle-knob ${isDark ? 'is-dark' : 'is-light'}`} />
              <FiMoon className={`nqs-theme-toggle-icon ${isDark ? 'is-on' : ''}`} />
            </button>

            <Link to={dashboardPath} className="nqs-login-chip">
              <FiUser />
              <span>{isAuthenticated ? 'Dashboard' : 'Login'}</span>
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

        {mobileOpen ? (
          <div className="nqs-mobile-menu">
            {navItems.map((item) => (
              <React.Fragment key={item.name}>
                <Link
                  to={item.to}
                  className="nqs-mobile-link"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.name}
                </Link>
                {item.children?.map((child) => (
                  <Link
                    key={child.to}
                    to={child.to}
                    className="nqs-mobile-link nqs-mobile-link-child"
                    onClick={() => setMobileOpen(false)}
                  >
                    {child.name}
                  </Link>
                ))}
              </React.Fragment>
            ))}
            <button type="button" className="nqs-mobile-link nqs-mobile-theme" onClick={toggleTheme}>
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <Link
              to={dashboardPath}
              className="nqs-mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              {isAuthenticated ? 'Dashboard' : 'Login'}
            </Link>
          </div>
        ) : null}
      </nav>
    </>
  );
}

export default NavBar;
