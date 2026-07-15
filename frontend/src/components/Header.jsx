import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useTheme } from '../hooks';
import { FiBell, FiChevronDown, FiUser, FiSettings, FiLogOut, FiHome, FiMoon, FiSun } from 'react-icons/fi';
import { useNotifications } from '../context/NotificationContext';

const Header = () => {
  const { user, role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const displayRole = role || 'citizen';
  const isCitizen = role === 'citizen';
  const canOpenProfile = Boolean(role);
  const name = user?.name || user?.fullName || user?.username || 'Citizen User';
  const username = user?.username || user?.email || 'nqs-user';
  const pageLabel = role === 'admin'
    ? 'Admin Dashboard'
    : role === 'operator' || role === 'super_operator'
      ? 'Operator Dashboard'
      : 'Dashboard';

  const getInitials = (fullName) => fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className={`nqs-dashboard-header sticky top-0 z-30 flex h-16 items-center justify-between px-4 shadow-sm transition-colors duration-200 sm:px-5 ${
        isCitizen
          ? 'border-b border-blue-900/40 bg-[#0B3A75] text-white'
          : 'border-b border-slate-200 bg-white dark:border-[#1d355f] dark:bg-[#071a33]'
      }`}
    >
      <div className="flex items-center space-x-2">
        <span className={`text-sm sm:text-base font-extrabold font-sans tracking-tight ${isCitizen ? 'text-white' : 'text-[#4189DD]'}`}>
          NQS National ID
        </span>
        <span className={isCitizen ? 'text-blue-200/70' : 'text-slate-300 dark:text-slate-600'}>/</span>
        <span className={`text-sm font-medium ${isCitizen ? 'text-blue-50' : 'text-slate-700 dark:text-slate-200'}`}>
          {pageLabel}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <Link
          to="/"
          className={
            isCitizen
              ? 'nqs-header-action hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white transition hover:bg-white/10 sm:flex'
              : 'nqs-header-action hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-white/10 sm:flex'
          }
        >
          <FiHome className="w-3.5 h-3.5" />
          Home
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className={
            isCitizen
              ? 'nqs-header-action inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-xs font-extrabold uppercase text-white transition hover:bg-white/20'
              : 'nqs-header-action inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-extrabold uppercase text-slate-700 transition hover:bg-blue-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
          }
          aria-label="Toggle dark and light theme"
        >
          {isDark ? <FiSun className="h-3.5 w-3.5" /> : <FiMoon className="h-3.5 w-3.5" />}
          {isDark ? 'Light' : 'Dark'}
        </button>

        {role === 'citizen' && (
          <Link
            to="/notifications"
            className={
              isCitizen
                ? 'nqs-header-icon relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-white transition hover:bg-white/20'
                : 'nqs-header-icon relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-blue-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
            }
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          >
            <FiBell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className={
              isCitizen
                ? 'nqs-header-profile flex items-center space-x-2 rounded-xl p-1 transition hover:bg-white/10 focus:outline-none'
                : 'nqs-header-profile flex items-center space-x-2 rounded-xl p-1 transition hover:bg-blue-50 focus:outline-none dark:hover:bg-white/10'
            }
          >
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs shadow-lg shadow-blue-600/20">
              {getInitials(name)}
            </div>
            <div className="hidden md:block text-left">
              <p className={`text-xs font-extrabold leading-none ${isCitizen ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{name}</p>
              <p className={`text-[10px] mt-0.5 capitalize leading-none ${isCitizen ? 'text-blue-100' : 'text-slate-500 dark:text-slate-300'}`}>{displayRole}</p>
            </div>
            <FiChevronDown className={`w-3.5 h-3.5 ${isCitizen ? 'text-blue-100' : 'text-slate-500 dark:text-slate-300'}`} />
          </button>

          {profileDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-45"
                onClick={() => setProfileDropdownOpen(false)}
              />
              <div className="nqs-profile-dropdown absolute right-0 z-50 mt-2 w-56 animate-fade-in rounded-2xl border border-slate-200 bg-white py-2 shadow-xl dark:border-[#1d355f] dark:bg-[#071a33]">
                <div className="border-b border-slate-100 px-4 py-2 dark:border-[#1d355f]">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-300">@{username}</p>
                </div>
                {canOpenProfile && (
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-white/10"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <FiUser className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    <span>My Profile</span>
                  </Link>
                )}
                <Link
                  to="/profile#password"
                  className="flex items-center space-x-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-white/10"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <FiSettings className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                  <span>Profile Settings</span>
                </Link>
                {canOpenProfile && <div className="my-1 h-px bg-slate-100 dark:bg-[#1d355f]" />}
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center space-x-2.5 px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
