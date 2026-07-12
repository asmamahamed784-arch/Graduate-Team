import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks';
import {
  FiMenu, FiX, FiHome, FiBarChart2,
  FiSettings, FiClipboard, FiShield, FiCamera, FiBell,
  FiGrid, FiSearch, FiUsers
} from 'react-icons/fi';

const navItems = {
  citizen: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/user', label: 'Dashboard', icon: <FiGrid />, end: true },
    { to: '/dashboard/user/appointments', label: 'My Appointments', icon: <FiClipboard /> },
    { to: '/track', label: 'Check Queue Status', icon: <FiSearch /> },
    { to: '/profile', label: 'Profile Settings', icon: <FiSettings /> },
  ],
  operator: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Operator Dashboard', icon: <FiHome />, end: true },
    { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
    { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
  ],
  super_operator: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/operator', label: 'Operator Dashboard', icon: <FiHome />, end: true },
    { to: '/queue-management', label: 'Queue Management', icon: <FiClipboard /> },
    { to: '/dashboard/operator/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
    { to: '/operator-management', label: 'Center Operators', icon: <FiUsers /> },
  ],
  admin: [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard/admin', label: 'Admin Dashboard', icon: <FiHome />, end: true },
    { to: '/admin-appointments', label: 'Appointments', icon: <FiClipboard /> },
    { to: '/operator-management', label: 'Operators', icon: <FiUsers /> },
    { to: '/active-sessions', label: 'Active Sessions', icon: <FiShield /> },
    { to: '/dashboard/admin/reports', label: 'Reports', icon: <FiBarChart2 /> },
    { to: '/service-management', label: 'Manage Services', icon: <FiSettings /> },
    { to: '/center-management', label: 'Manage Centers', icon: <FiSettings /> },
    { to: '/dashboard/admin/qr-scan', label: 'QR Scan', icon: <FiCamera /> },
    { to: '/notifications', label: 'Notifications', icon: <FiBell /> },
    { to: '/logs', label: 'Activity Logs', icon: <FiShield /> },
    { to: '/settings', label: 'Settings', icon: <FiSettings /> },
  ],
};

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const { role } = useAuth();
  const items = navItems[role || 'citizen'] || [];

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
          fixed left-0 top-0 z-40 flex h-screen w-64 flex-col overflow-hidden bg-white p-4 text-slate-800 dark:bg-[#071a33] dark:text-slate-100
          transform ${open ? 'translate-x-0' : '-translate-x-full'} 
          shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 md:shadow-none
          border-r border-slate-200 dark:border-[#1d355f]
        `}
      >
        <div className="mb-6 flex items-center space-x-3 px-1">
          <div className="h-10 w-10 bg-[#0B3A75] rounded-md flex items-center justify-center font-black text-lg text-white shadow-lg shadow-blue-600/15">
            N
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-950 leading-none dark:text-white">NQS National ID</h2>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Banaadir Portal</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col space-y-1 overflow-hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-blue-50 hover:text-[#0B3A75] dark:hover:bg-white/10 dark:hover:text-white
                 ${isActive ? 'bg-blue-50 text-[#0B3A75] shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
