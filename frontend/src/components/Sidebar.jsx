import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks';
import {
  FiMenu, FiX, FiHome, FiBarChart2,
  FiSettings, FiClipboard, FiShield, FiCamera, FiBell,
  FiGrid, FiSearch, FiUsers, FiLogOut, FiMapPin, FiLayers,
  FiMonitor, FiUser, FiMail,
} from 'react-icons/fi';

/**
 * ERP navigation model. Each role only receives the sections and links it is
 * authorized to use (RBAC) — the API enforces the same roles server-side.
 */
const navSections = {
  citizen: [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard/user', label: 'Dashboard', icon: <FiGrid />, end: true },
      ],
    },
    {
      title: 'My Services',
      items: [
        { to: '/dashboard/user/services', label: 'Services & Process', icon: <FiLayers /> },
        { to: '/dashboard/user/appointments', label: 'My Appointments', icon: <FiClipboard /> },
        { to: '/track', label: 'Check Queue Status', icon: <FiSearch /> },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/profile', label: 'Profile Settings', icon: <FiUser /> },
        { to: '/', label: 'Public Website', icon: <FiHome /> },
      ],
    },
  ],
  operator: [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard/operator', label: 'Dashboard', icon: <FiGrid />, end: true },
      ],
    },
    {
      title: 'Queue Operations',
      items: [
        { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
        { to: '/dashboard/operator/qr-scan', label: 'QR Scan & Verify', icon: <FiCamera /> },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/profile', label: 'Profile Settings', icon: <FiUser /> },
        { to: '/', label: 'Public Website', icon: <FiHome /> },
      ],
    },
  ],
  super_operator: [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard/operator', label: 'Dashboard', icon: <FiGrid />, end: true },
      ],
    },
    {
      title: 'Queue Operations',
      items: [
        { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
        { to: '/dashboard/operator/qr-scan', label: 'QR Scan & Verify', icon: <FiCamera /> },
      ],
    },
    {
      title: 'Center Management',
      items: [
        { to: '/operator-management', label: 'Center Operators', icon: <FiUsers /> },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/profile', label: 'Profile Settings', icon: <FiUser /> },
        { to: '/', label: 'Public Website', icon: <FiHome /> },
      ],
    },
  ],
  admin: [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard/admin', label: 'Dashboard', icon: <FiGrid />, end: true },
        { to: '/dashboard/admin/reports', label: 'Reports & Analytics', icon: <FiBarChart2 /> },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/admin-appointments', label: 'Appointments', icon: <FiClipboard /> },
        { to: '/dashboard/admin/qr-scan', label: 'QR Scan & Verify', icon: <FiCamera /> },
        { to: '/live', label: 'Live Queue Screen', icon: <FiMonitor /> },
      ],
    },
    {
      title: 'Management',
      items: [
        { to: '/service-management', label: 'Services', icon: <FiLayers /> },
        { to: '/center-management', label: 'Centers', icon: <FiMapPin /> },
        { to: '/operator-management', label: 'Operators', icon: <FiUsers /> },
        { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
        { to: '/contact-messages', label: 'Contact Messages', icon: <FiMail /> },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/active-sessions', label: 'Active Sessions', icon: <FiShield /> },
        { to: '/logs', label: 'Audit Logs', icon: <FiShield /> },
        { to: '/settings', label: 'Settings', icon: <FiSettings /> },
        { to: '/', label: 'Public Website', icon: <FiHome /> },
      ],
    },
  ],
};

const roleLabels = {
  citizen: 'Citizen Portal',
  operator: 'Operator Console',
  super_operator: 'Senior Operator Console',
  admin: 'Administration',
};

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const { user, role, logout } = useAuth();
  const sections = navSections[role || 'citizen'] || [];
  const name = user?.name || user?.username || 'User';

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-3 top-3 z-50 rounded-lg bg-white p-2 text-slate-700 shadow-md focus:outline-none dark:bg-[#071a33] dark:text-slate-100 md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        {open ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      {/* Sidebar */}
      <nav
        className={`
          fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-white text-slate-800 dark:bg-[#071a33] dark:text-slate-100
          transform ${open ? 'translate-x-0' : '-translate-x-full'}
          shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 md:shadow-none
          border-r border-slate-200 dark:border-[#1d355f]
        `}
      >
        {/* Brand */}
        <div className="flex items-center space-x-3 border-b border-slate-200 p-4 dark:border-[#1d355f]">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0B3A75] text-lg font-black text-white shadow-lg shadow-blue-600/15">
            N
          </div>
          <div>
            <h2 className="text-base font-extrabold leading-none tracking-tight text-slate-950 dark:text-white">NQS National ID</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {roleLabels[role] || 'Portal'}
            </span>
          </div>
        </div>

        {/* Sections */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150
                       ${isActive
                         ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                         : 'text-slate-700 hover:bg-blue-50 hover:text-[#0B3A75] dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white'}`
                    }
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div className="border-t border-slate-200 p-3 dark:border-[#1d355f]">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
              {name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{name}</p>
              <p className="truncate text-[10px] capitalize text-slate-500 dark:text-slate-400">{(role || 'citizen').replace('_', ' ')}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              aria-label="Log out"
              title="Log out"
            >
              <FiLogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
