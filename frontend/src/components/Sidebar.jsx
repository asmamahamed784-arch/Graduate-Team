import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks';
import {
  FiMenu, FiX, FiHome, FiBarChart2,
  FiSettings, FiClipboard, FiShield, FiCamera, FiBell,
  FiGrid, FiSearch, FiUsers, FiEdit3, FiRefreshCw
} from 'react-icons/fi';

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
  const isCitizen = role === 'citizen';

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
          nqs-dashboard-sidebar
          fixed left-0 top-0 z-40 flex h-screen w-64 flex-col overflow-hidden p-4
          transform ${open ? 'translate-x-0' : '-translate-x-full'} 
          shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 md:shadow-none
          ${isCitizen
            ? 'border-r border-blue-950/40 bg-[#06284f] text-white'
            : 'border-r border-sky-200 bg-[#e8f5ff] text-slate-800 dark:border-[#1d355f] dark:bg-[#071a33] dark:text-slate-100'}
        `}
      >
        <div className="mb-6 flex items-center space-x-3 px-1">
          <div className="h-10 w-10 bg-[#0B3A75] rounded-md flex items-center justify-center font-black text-lg text-white shadow-lg shadow-blue-600/15">
            N
          </div>
          <div>
            <h2 className={`text-base font-extrabold tracking-tight leading-none ${isCitizen ? 'text-white' : 'text-slate-950 dark:text-white'}`}>NQS National ID</h2>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Banaadir Portal</span>
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
                  isCitizen
                    ? `flex items-center space-x-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-blue-600/80 hover:text-white ${
                      isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-50'
                    }`
                    : `flex items-center space-x-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150 hover:bg-blue-50 hover:text-[#0B3A75] dark:hover:bg-white/10 dark:hover:text-white
                   ${isActive ? 'bg-blue-50 text-[#0B3A75] shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>

              {item.children?.length > 0 && (
                <div className={`ml-7 mt-1 space-y-1 border-l pl-3 ${isCitizen ? 'border-blue-300/30' : 'border-slate-200 dark:border-white/10'}`}>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        isCitizen
                          ? `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition hover:bg-blue-600/70 hover:text-white ${
                            isActive ? 'bg-blue-600/80 text-white' : 'text-blue-100'
                          }`
                          : `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition hover:bg-blue-50 hover:text-[#0B3A75] dark:hover:bg-white/10 ${
                            isActive ? 'bg-blue-50 text-[#0B3A75] dark:bg-white/10 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                          }`
                      }
                    >
                      <span className="text-sm">{child.icon}</span>
                      <span>{child.label}</span>
                    </NavLink>
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
