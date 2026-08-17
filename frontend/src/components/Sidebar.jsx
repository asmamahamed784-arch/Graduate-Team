import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth, useNotification } from '../hooks';
import api from '../api/axiosInstance';
import {
  FiMenu, FiX, FiHome, FiBarChart2,
  FiSettings, FiClipboard, FiShield, FiCamera, FiBell,
  FiGrid, FiUsers, FiCalendar, FiHelpCircle, FiLogOut,
  FiChevronLeft, FiChevronRight, FiChevronDown, FiUser, FiSearch, FiEdit3, FiRefreshCw
} from 'react-icons/fi';
import {
  getServiceIcon,
  getServiceId,
  getServiceLabel,
  getServicePath,
  isCompletedNewIdBooking,
  isLostIdService,
  isNewIdService,
  isUpdateInfoService
} from '../utils/serviceRouting';
import BrandLogo from './BrandLogo';

const adminNavStructure = [
  { to: '/', label: 'Home', icon: <FiHome /> },
  { to: '/dashboard/admin', label: 'Admin Dashboard', icon: <FiGrid />, end: true },
  {
    type: 'group',
    id: 'operations',
    label: 'Operations',
    icon: <FiClipboard />,
    children: [
      { to: '/admin-appointments', label: 'Appointments', icon: <FiClipboard /> },
      { to: '/dashboard/admin/qr-scan', label: 'QR Scan', icon: <FiCamera /> }
    ]
  },
  {
    type: 'group',
    id: 'people',
    label: 'People & Access',
    icon: <FiUsers />,
    children: [
      { to: '/operator-management', label: 'Operators', icon: <FiUsers /> },
      { to: '/user-management', label: 'User Management', icon: <FiUser /> },
      { to: '/active-sessions', label: 'Active Sessions', icon: <FiShield /> }
    ]
  },
  {
    type: 'group',
    id: 'system',
    label: 'System Management',
    icon: <FiSettings />,
    children: [
      { to: '/service-management', label: 'Manage Services', icon: <FiSettings /> },
      { to: '/center-management', label: 'Manage Centers', icon: <FiSettings /> }
    ]
  },
  {
    type: 'group',
    id: 'monitoring',
    label: 'Monitoring',
    icon: <FiBarChart2 />,
    children: [
      { to: '/dashboard/admin/reports', label: 'Reports', icon: <FiBarChart2 /> },
      { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
      { to: '/logs', label: 'Activity Logs', icon: <FiShield /> }
    ]
  },
  { to: '/settings', label: 'Settings', icon: <FiSettings />, footer: true }
];

const navItems = {
  citizen: [
    { to: '/', label: 'Home', icon: <FiHome />, end: true },
    { to: '/dashboard/user', label: 'Dashboard', icon: <FiGrid />, end: true },
    {
      to: '/dashboard/user/appointments',
      label: 'My Requests',
      icon: <FiClipboard />,
      children: [
        { to: '/dashboard/user/new-id-registration', label: 'Book Appointment', icon: <FiClipboard /> },
        { to: '/dashboard/user/update-information', label: 'Update Information', icon: <FiEdit3 /> },
        { to: '/dashboard/user/replace-lost-id', label: 'Replace Lost ID', icon: <FiRefreshCw /> },
      ],
    },
    { to: '/dashboard/user/track', label: 'Check Queue Status', icon: <FiSearch /> },
    { to: '/notifications', label: 'Notifications', icon: <FiBell />, badgeKey: 'notifications' },
    {
      type: 'group',
      id: 'citizenSettings',
      label: 'Settings',
      icon: <FiSettings />,
      children: [
        { to: '/profile', label: 'Profile Settings', icon: <FiSettings /> },
        { to: '/faq', label: 'Help & Support', icon: <FiHelpCircle /> }
      ]
    },
    { type: 'action', id: 'logout', label: 'Logout', icon: <FiLogOut />, danger: true, footer: true },
  ],
  operator: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Operator Dashboard', icon: <FiHome />, end: true },
    {
      type: 'group',
      id: 'operations',
      label: 'Operations',
      icon: <FiClipboard />,
      children: [
        { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
        { to: '/dashboard/operator/center-schedule', label: 'Daily Schedule', icon: <FiCalendar /> },
        { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> }
      ]
    },
    { to: '/dashboard/operator/notifications', label: 'Notifications', icon: <FiBell /> },
  ],
  super_operator: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Center Dashboard', icon: <FiHome />, end: true },
    {
      type: 'group',
      id: 'operations',
      label: 'Operations',
      icon: <FiClipboard />,
      children: [
        { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
        { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
        { to: '/dashboard/operator/staff', label: 'Center Staff', icon: <FiUsers /> }
      ]
    },
    {
      type: 'group',
      id: 'monitoring',
      label: 'Monitoring',
      icon: <FiBarChart2 />,
      children: [
        { to: '/dashboard/operator/center-schedule', label: 'Center Schedule', icon: <FiCalendar /> },
        { to: '/dashboard/operator/report', label: 'Reports', icon: <FiBarChart2 /> },
        { to: '/dashboard/operator/notifications', label: 'Notifications', icon: <FiBell /> }
      ]
    },
  ],
  center_manager: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Center Dashboard', icon: <FiHome />, end: true },
    {
      type: 'group',
      id: 'operations',
      label: 'Operations',
      icon: <FiClipboard />,
      children: [
        { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
        { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
        { to: '/dashboard/operator/staff', label: 'Center Staff', icon: <FiUsers /> }
      ]
    },
    {
      type: 'group',
      id: 'monitoring',
      label: 'Monitoring',
      icon: <FiBarChart2 />,
      children: [
        { to: '/dashboard/operator/center-schedule', label: 'Center Schedule', icon: <FiCalendar /> },
        { to: '/dashboard/operator/report', label: 'Reports', icon: <FiBarChart2 /> },
        { to: '/dashboard/operator/notifications', label: 'Notifications', icon: <FiBell /> }
      ]
    },
  ],
  admin: adminNavStructure,
  super_admin: adminNavStructure,
  user_manager: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/user-management', label: 'User Management', icon: <FiUsers />, end: true },
    { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
    { to: '/profile', label: 'Profile Settings', icon: <FiSettings /> },
  ],
};

const groupContainsPath = (group, pathname) => (
  Array.isArray(group.children) && group.children.some((child) => {
    if (!child.to) return false;
    if (child.end) return pathname === child.to;
    return pathname === child.to || pathname.startsWith(`${child.to}/`);
  })
);

const Sidebar = ({ collapsed = false, onToggleCollapse }) => {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    operations: true,
    people: true,
    system: true,
    monitoring: true,
    citizenSettings: true
  });
  const [hasCompletedNationalId, setHasCompletedNationalId] = useState(false);
  const [bookingGateLoaded, setBookingGateLoaded] = useState(false);
  const [services, setServices] = useState([]);
  const { role, logout } = useAuth();
  const { unreadCount } = useNotification();
  const location = useLocation();
  const isCitizen = role === 'citizen';
  const isAdminShell = role === 'admin' || role === 'super_admin';
  const badgeCounts = { notifications: unreadCount };

  const items = useMemo(() => {
    const baseItems = navItems[role || 'citizen'] || navItems.admin || [];
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
      if (item.to !== '/dashboard/user/appointments') return item;
      const children = citizenServices.length
        ? citizenServices.map((service) => {
            const Icon = getServiceIcon(service);
            const disabled = (isUpdateInfoService(service) || isLostIdService(service)) && !hasCompletedNationalId;
            return {
              to: getServicePath(service),
              label: getServiceLabel(service),
              icon: <Icon />,
              disabled,
              disabledTitle: disabled
                ? (bookingGateLoaded ? 'Complete your New National ID appointment first.' : 'Checking your appointment record...')
                : ''
            };
          })
        : item.children.map((child) => (
            ['/dashboard/user/update-information', '/dashboard/user/replace-lost-id'].includes(child.to)
              ? {
                  ...child,
                  disabled: !hasCompletedNationalId,
                  disabledTitle: bookingGateLoaded
                    ? 'Complete your New National ID appointment first.'
                    : 'Checking your appointment record...'
                }
              : child
          ));
      return { ...item, children };
    });
  }, [bookingGateLoaded, hasCompletedNationalId, isCitizen, role, services]);

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
    return () => { mounted = false; };
  }, [isCitizen]);

  useEffect(() => {
    if (!isCitizen) {
      setHasCompletedNationalId(false);
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
        if (mounted) setHasCompletedNationalId(records.some(isCompletedNewIdBooking));
      } catch {
        if (mounted) setHasCompletedNationalId(false);
      } finally {
        if (mounted) setBookingGateLoaded(true);
      }
    };
    loadBookingGate();
    return () => { mounted = false; };
  }, [isCitizen]);

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      items.forEach((item) => {
        if (item.type === 'group' && groupContainsPath(item, location.pathname)) {
          next[item.id] = true;
        }
      });
      return next;
    });
  }, [items, location.pathname]);

  const toggleGroup = (id) => {
    setOpenGroups((current) => ({ ...current, [id]: !current[id] }));
  };

  const mainItems = items.filter((item) => !item.footer);
  const footerItems = items.filter((item) => item.footer);

  const renderLink = (item, { child = false } = {}) => {
    const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0;

    if (item.disabled) {
      return (
        <button
          key={item.to || getServiceId(item)}
          type="button"
          disabled
          aria-disabled="true"
          title={item.disabledTitle || item.label}
          className={`${child ? 'nqs-sidebar-child-link' : 'nqs-sidebar-link'} nqs-sidebar-link-disabled flex w-full cursor-not-allowed items-center space-x-3 rounded-md px-3 py-2 text-left text-sm font-medium`}
        >
          <span className={child ? 'text-sm' : 'text-lg'}>{item.icon}</span>
          <span className="nqs-sidebar-label flex-1">{item.label}</span>
        </button>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={() => setOpen(false)}
        title={item.label}
        className={({ isActive }) =>
          `${child ? 'nqs-sidebar-child-link' : 'nqs-sidebar-link'} flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${isActive ? 'nqs-sidebar-link-active' : ''} ${item.footer ? 'nqs-sidebar-settings' : ''}`
        }
      >
        <span className={child ? 'text-sm' : 'text-lg'}>{item.icon}</span>
        <span className="nqs-sidebar-label flex-1">{item.label}</span>
        {badge > 0 ? <span className="nqs-sidebar-badge">{badge > 9 ? '9+' : badge}</span> : null}
      </NavLink>
    );
  };

  const renderAction = (item) => (
    <button
      key={item.id}
      type="button"
      onClick={() => {
        setOpen(false);
        logout();
      }}
      title={item.label}
      className={`nqs-sidebar-link nqs-sidebar-action flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${item.danger ? 'is-danger' : ''}`}
    >
      <span className="text-lg">{item.icon}</span>
      <span className="nqs-sidebar-label">{item.label}</span>
    </button>
  );

  const renderGroup = (group) => {
    const isOpen = Boolean(openGroups[group.id]) || (collapsed && isAdminShell);
    const activeGroup = groupContainsPath(group, location.pathname);

    if (collapsed && isAdminShell) {
      return (
        <div key={group.id} className="nqs-sidebar-group is-collapsed-group">
          {group.children.map((child) => renderLink(child))}
        </div>
      );
    }

    return (
      <div key={group.id} className={`nqs-sidebar-group ${activeGroup ? 'is-active-group' : ''}`}>
        <button
          type="button"
          className="nqs-sidebar-group-btn"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={isOpen}
        >
          <span className="nqs-sidebar-group-left">
            <span className="text-lg">{group.icon}</span>
            <span className="nqs-sidebar-label">{group.label}</span>
          </span>
          <FiChevronDown className={`nqs-sidebar-chevron ${isOpen ? 'is-open' : ''}`} />
        </button>
        {isOpen ? (
          <div className="nqs-sidebar-group-children">
            {group.children.map((child) => renderLink(child, { child: true }))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <button
        className="nqs-mobile-menu-button fixed left-3 top-3 z-50 rounded-md p-2 shadow-sm focus:outline-none md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      <nav
        className={`
          nqs-dashboard-sidebar
          ${isCitizen ? 'is-citizen-nav' : ''}
          fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden p-4
          ${collapsed && isAdminShell ? 'is-collapsed' : ''}
          transform ${open ? 'translate-x-0' : '-translate-x-full'} 
          shadow-sm transition-all duration-200 ease-in-out md:translate-x-0 md:shadow-none
        `}
        style={{ width: (collapsed && isAdminShell) ? '76px' : '284px' }}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center space-x-3 min-w-0">
            <BrandLogo className="nqs-sidebar-logo" size={isCitizen ? 56 : 42} />
            <div className="nqs-sidebar-brand-text min-w-0">
              <h2 className="truncate text-base font-semibold leading-none tracking-tight text-[var(--nqs-text)]">NQS National ID</h2>
              <small className="nqs-sidebar-brand-subtitle truncate">National Queueing System</small>
            </div>
          </div>
          {isAdminShell && onToggleCollapse ? (
            <button
              type="button"
              className="nqs-sidebar-collapse-btn hidden md:inline-flex items-center justify-center rounded-md border border-[var(--nqs-border)] p-1.5 text-[var(--nqs-text)]"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
            </button>
          ) : null}
        </div>

        <div className="nqs-sidebar-scroll flex flex-1 flex-col space-y-1 overflow-y-auto pr-1">
          {mainItems.map((item) => (
            item.type === 'group'
              ? renderGroup(item)
              : (
                <div key={item.to}>
                  {renderLink(item)}
                  {item.children?.length > 0 && !(collapsed && isAdminShell) && item.type !== 'group' ? (
                    <div className="ml-7 mt-1 space-y-1 border-l border-[var(--nqs-border)] pl-3">
                      {item.children.map((child) => renderLink(child, { child: true }))}
                    </div>
                  ) : null}
                </div>
              )
          ))}
        </div>

        {footerItems.length ? (
          <div className="nqs-sidebar-footer mt-3 border-t border-[var(--nqs-border)] pt-3">
            {footerItems.map((item) => (item.type === 'action' ? renderAction(item) : renderLink(item)))}
          </div>
        ) : null}
      </nav>
    </>
  );
};

export default Sidebar;
