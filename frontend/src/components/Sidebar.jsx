import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks';
import api from '../api/axiosInstance';
import {
  FiMenu, FiX, FiHome, FiBarChart2,
  FiSettings, FiClipboard, FiShield, FiCamera, FiBell,
  FiGrid, FiSearch, FiUsers, FiEdit3, FiRefreshCw, FiCalendar
} from 'react-icons/fi';
import {
  getServiceIcon,
  getServiceId,
  getServiceLabel,
  getServicePath,
  isLostIdService,
  isNewIdService,
  isUpdateInfoService
} from '../utils/serviceRouting';
import BrandLogo from './BrandLogo';

const navItems = {
  citizen: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/user', label: 'Dashboard', icon: <FiGrid />, end: true },
    {
      to: '/dashboard/user/appointments',
      label: 'My Requests',
      icon: <FiClipboard />,
      end: true,
      children: [
        { to: '/dashboard/user/new-id-registration', label: 'Book Appointment', icon: <FiClipboard /> },
        { to: '/dashboard/user/update-information', label: 'Update Information', icon: <FiEdit3 /> },
        { to: '/dashboard/user/replace-lost-id', label: 'Replace Lost ID', icon: <FiRefreshCw /> },
      ],
    },
    { to: '/dashboard/user/track', label: 'Check Queue Status', icon: <FiSearch /> },
    { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
    { to: '/profile', label: 'Profile Settings', icon: <FiSettings /> },
  ],
  operator: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Operator Dashboard', icon: <FiHome />, end: true },
    { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
    { to: '/dashboard/operator/center-schedule', label: 'Daily Schedule', icon: <FiCalendar /> },
    { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
    { to: '/dashboard/operator/notifications', label: 'Notifications', icon: <FiBell /> },
  ],
  super_operator: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Center Dashboard', icon: <FiHome />, end: true },
    { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
    { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
    { to: '/dashboard/operator/staff', label: 'Center Staff', icon: <FiUsers /> },
    { to: '/dashboard/operator/center-schedule', label: 'Center Schedule', icon: <FiCalendar /> },
    { to: '/dashboard/operator/notifications', label: 'Notifications', icon: <FiBell /> },
  ],
  center_manager: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Center Dashboard', icon: <FiHome />, end: true },
    { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
    { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
    { to: '/dashboard/operator/staff', label: 'Center Staff', icon: <FiUsers /> },
    { to: '/dashboard/operator/center-schedule', label: 'Center Schedule', icon: <FiCalendar /> },
    { to: '/dashboard/operator/notifications', label: 'Notifications', icon: <FiBell /> },
  ],
  admin: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/admin', label: 'Admin Dashboard', icon: <FiHome />, end: true },
    { to: '/admin-appointments', label: 'Appointments', icon: <FiClipboard /> },
    { to: '/operator-management', label: 'Operators', icon: <FiUsers /> },
    { to: '/user-management', label: 'User Management', icon: <FiUsers /> },
    { to: '/active-sessions', label: 'Active Sessions', icon: <FiShield /> },
    { to: '/dashboard/admin/reports', label: 'Reports', icon: <FiBarChart2 /> },
    { to: '/service-management', label: 'Manage Services', icon: <FiSettings /> },
    { to: '/center-management', label: 'Manage Centers', icon: <FiSettings /> },
    { to: '/dashboard/admin/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
    { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
    { to: '/logs', label: 'Activity Logs', icon: <FiShield /> },
    { to: '/settings', label: 'Settings', icon: <FiSettings /> },
  ],
  user_manager: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/user-management', label: 'User Management', icon: <FiUsers />, end: true },
    { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
    { to: '/profile', label: 'Profile Settings', icon: <FiSettings /> },
  ],
};

const hasNationalIdBooking = (ticket = {}) => {
  const requestType = String(ticket.requestType || ticket.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const serviceName = String(ticket.service?.name || ticket.serviceName || ticket.service || '').trim().toLowerCase();
  return requestType === 'new_national_id' ||
    requestType === 'new_id_registration' ||
    serviceName.includes('national id registration') ||
    serviceName.includes('new national id');
};

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const [hasBooking, setHasBooking] = useState(false);
  const [bookingGateLoaded, setBookingGateLoaded] = useState(false);
  const [services, setServices] = useState([]);
  const { role } = useAuth();
  const isCitizen = role === 'citizen';
  const items = useMemo(() => {
    const baseItems = navItems[role || 'citizen'] || [];
    if (!isCitizen) return baseItems;
    const citizenServices = services
      .filter((service) => String(service.category || '').toLowerCase().includes('national id'))
      .sort((a, b) => {
        const rank = (service) => {
          if (isNewIdService(service)) return 0;
          if (isUpdateInfoService(service)) return 1;
          if (isLostIdService(service)) return 2;
          return 10;
        };
        return rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || ''));
      });

    return baseItems.map((item) => {
      if (!item.children?.length) return item;
      const children = citizenServices.length
        ? citizenServices.map((service) => {
            const Icon = getServiceIcon(service);
            const disabled = (isUpdateInfoService(service) || isLostIdService(service)) && !hasBooking;
            return {
              to: getServicePath(service),
              label: getServiceLabel(service),
              icon: <Icon />,
              disabled,
              disabledTitle: disabled
                ? (bookingGateLoaded ? 'Please book a New National ID appointment first.' : 'Checking your appointment record...')
                : ''
            };
          })
        : item.children.map((child) => (
            ['/dashboard/user/update-information', '/dashboard/user/replace-lost-id'].includes(child.to)
              ? {
                  ...child,
                  disabled: !hasBooking,
                  disabledTitle: bookingGateLoaded
                    ? 'Please book a New National ID appointment first.'
                    : 'Checking your appointment record...'
                }
              : child
          ));
      return {
        ...item,
        children
      };
    });
  }, [bookingGateLoaded, hasBooking, isCitizen, role, services]);

  useEffect(() => {
    if (!isCitizen) {
      setServices([]);
      return undefined;
    }

    let mounted = true;
    const loadServices = async () => {
      try {
        const response = await api.get('/api/services');
        const records = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        if (mounted) setServices(records);
      } catch {
        if (mounted) setServices([]);
      }
    };

    loadServices();
    return () => {
      mounted = false;
    };
  }, [isCitizen]);

  useEffect(() => {
    if (!isCitizen) {
      setHasBooking(false);
      setBookingGateLoaded(true);
      return undefined;
    }

    let mounted = true;
    const loadBookingGate = async () => {
      try {
        const response = await api.get('/api/bookings/my');
        const records = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        if (mounted) setHasBooking(records.some(hasNationalIdBooking));
      } catch {
        if (mounted) setHasBooking(false);
      } finally {
        if (mounted) setBookingGateLoaded(true);
      }
    };

    loadBookingGate();
    return () => {
      mounted = false;
    };
  }, [isCitizen]);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="nqs-mobile-menu-button fixed left-3 top-3 z-50 rounded-md p-2 shadow-sm focus:outline-none md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>
      {/* Sidebar */}
      <nav
        className={`
          nqs-dashboard-sidebar
          fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col overflow-hidden p-4
          transform ${open ? 'translate-x-0' : '-translate-x-full'} 
          shadow-sm transition-transform duration-200 ease-in-out md:translate-x-0 md:shadow-none
        `}
      >
        <div className="mb-6 flex items-center space-x-3 px-1">
          <BrandLogo className="nqs-sidebar-logo" />
          <div>
            <h2 className="text-base font-semibold leading-none tracking-tight text-[var(--nqs-text)]">NQS National ID</h2>
          </div>
        </div>

        <div className="flex flex-1 flex-col space-y-1 overflow-hidden">
          {items.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `nqs-sidebar-link flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${isActive ? 'nqs-sidebar-link-active' : ''}`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>

              {item.children?.length > 0 && (
                <div className="ml-7 mt-1 space-y-1 border-l border-[var(--nqs-border)] pl-3">
                  {item.children.map((child) => (
                    child.disabled ? (
                      <button
                        key={child.to || getServiceId(child)}
                        type="button"
                        disabled
                        title={child.disabledTitle}
                        className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-[var(--nqs-muted)] opacity-50"
                      >
                        <span className="text-sm">{child.icon}</span>
                        <span>{child.label}</span>
                      </button>
                    ) : (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `nqs-sidebar-child-link flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${isActive ? 'nqs-sidebar-link-active' : ''}`
                        }
                      >
                        <span className="text-sm">{child.icon}</span>
                        <span>{child.label}</span>
                      </NavLink>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
