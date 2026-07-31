import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useTheme } from '../hooks';
import { FiBell, FiCalendar, FiChevronDown, FiUser, FiSettings, FiLogOut, FiHome, FiMoon, FiSun } from 'react-icons/fi';
import { useNotifications } from '../context/NotificationContext';

const Header = () => {
  const { user, role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount, notifications, openNotification } = useNotifications();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  const isCenterManager = role === 'super_operator' || role === 'center_manager';
  const isUserManager = role === 'user_manager';
  const isAdminRole = role === 'admin' || role === 'super_admin';
  const displayRole = isCenterManager ? 'Center Manager' : isUserManager ? 'User Manager' : role === 'super_admin' ? 'Super Admin' : role || 'citizen';
  const canOpenProfile = Boolean(role);
  const name = user?.name || user?.fullName || user?.username || 'Citizen User';
  const username = user?.username || user?.email || 'nqs-user';
  const pageLabel = isAdminRole
    ? 'Admin Dashboard'
    : isUserManager
      ? 'User Management'
    : isCenterManager
      ? 'Center Dashboard'
      : role === 'operator'
      ? 'Operator Dashboard'
      : 'Dashboard';
  const todayLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const recentNotifications = (notifications || []).slice(0, 6);
  const notificationsPath = role === 'operator' || role === 'super_operator' || role === 'center_manager'
    ? '/dashboard/operator/notifications'
    : '/notifications';

  const getInitials = (fullName) => fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleOpenNotification = async (notification) => {
    setNotificationDropdownOpen(false);
    await openNotification(notification);
  };

  return (
    <header
      className="nqs-dashboard-header nqs-app-header sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 shadow-sm sm:px-5"
    >
      <div className="flex items-center space-x-2">
        <span className="text-sm font-extrabold tracking-tight text-[var(--nqs-brand)] sm:text-base">
          NQS National ID
        </span>
        <span className="text-[var(--nqs-muted)]">/</span>
        <span className="text-sm font-medium text-[var(--nqs-text)]">
          {pageLabel}
        </span>
      </div>

      <div className="flex items-center space-x-3">
        <Link
          to="/"
          className="nqs-header-action nqs-force-header-button hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold sm:flex"
        >
          <FiHome className="w-3.5 h-3.5" />
          Home
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="nqs-header-action nqs-force-header-button inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold"
          aria-label="Toggle dark and light theme"
        >
          {isDark ? <FiSun className="h-3.5 w-3.5" /> : <FiMoon className="h-3.5 w-3.5" />}
          {isDark ? 'Light' : 'Dark'}
        </button>

        <span className="nqs-header-date nqs-force-header-button hidden items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold lg:inline-flex">
          <FiCalendar className="h-3.5 w-3.5" />
          {todayLabel}
        </span>

        {role && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileDropdownOpen(false);
                setNotificationDropdownOpen((open) => !open);
              }}
              className="nqs-header-action nqs-force-header-button nqs-notification-btn relative inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold leading-none"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              title="Notifications"
            >
              <FiBell className="nqs-notification-bell h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="nqs-notification-label hidden sm:inline leading-none">Notifications</span>
              {unreadCount > 0 && (
                <span className="nqs-notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-45"
                  onClick={() => setNotificationDropdownOpen(false)}
                />
                <div className="nqs-notification-dropdown absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--nqs-border)] bg-[var(--nqs-card)] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--nqs-border)] px-4 py-3">
                    <p className="nqs-notification-dropdown-title text-sm font-black">Notifications</p>
                    <span className="nqs-notification-dropdown-badge rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {unreadCount} unread
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <p className="nqs-notification-dropdown-empty px-4 py-6 text-center text-xs font-semibold">
                        No notifications yet.
                      </p>
                    ) : (
                      recentNotifications.map((notification) => {
                        const id = notification._id || notification.id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleOpenNotification(notification)}
                            className={`nqs-notification-dropdown-item block w-full border-b border-[var(--nqs-border)] px-4 py-3 text-left transition ${
                              notification.read ? 'is-read' : 'is-unread'
                            }`}
                          >
                            <p className="nqs-notification-dropdown-item-title truncate text-xs font-black">
                              {notification.title || 'Notification'}
                            </p>
                            <p className="nqs-notification-dropdown-item-desc mt-1 line-clamp-2 text-[11px]">
                              {notification.desc || notification.message || 'Open related page'}
                            </p>
                            <p className="nqs-notification-dropdown-item-link mt-1 text-[10px] font-semibold">
                              Click to open
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <Link
                    to={notificationsPath}
                    onClick={() => setNotificationDropdownOpen(false)}
                    className="nqs-notification-dropdown-footer block border-t border-[var(--nqs-border)] px-4 py-3 text-center text-xs font-black"
                  >
                    View all notifications
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => {
              setNotificationDropdownOpen(false);
              setProfileDropdownOpen(!profileDropdownOpen);
            }}
            className="nqs-header-profile nqs-force-header-button inline-flex items-center gap-2.5 rounded-md border px-2 py-1.5 focus:outline-none"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--nqs-primary)] text-xs font-bold text-white">
              {getInitials(name)}
            </div>
            <div className="nqs-profile-meta hidden text-left md:flex md:flex-col md:justify-center">
              <p className="text-xs font-extrabold leading-none text-[var(--nqs-text)]">{name}</p>
              <p className="mt-1 text-[10px] capitalize leading-none text-[var(--nqs-muted)]">{displayRole}</p>
            </div>
            <FiChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--nqs-muted)]" />
          </button>

          {profileDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-45"
                onClick={() => setProfileDropdownOpen(false)}
              />
              <div className="nqs-profile-dropdown absolute right-0 z-50 mt-2 w-56 rounded-lg border border-[var(--nqs-border)] bg-[var(--nqs-card)] py-2 shadow-lg">
                <div className="border-b border-[var(--nqs-border)] px-4 py-2">
                  <p className="text-sm font-semibold text-[var(--nqs-text)]">{name}</p>
                  <p className="truncate text-xs text-[var(--nqs-muted)]">@{username}</p>
                </div>
                {canOpenProfile && (
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2.5 px-4 py-2.5 text-xs font-semibold text-[var(--nqs-text)] hover:bg-[var(--nqs-card-soft)]"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <FiUser className="h-4 w-4 text-[var(--nqs-muted)]" />
                    <span>My Profile</span>
                  </Link>
                )}
                <Link
                  to="/profile#password"
                  className="flex items-center space-x-2.5 px-4 py-2.5 text-xs font-semibold text-[var(--nqs-text)] hover:bg-[var(--nqs-card-soft)]"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <FiSettings className="h-4 w-4 text-[var(--nqs-muted)]" />
                  <span>Profile Settings</span>
                </Link>
                {canOpenProfile && <div className="my-1 h-px bg-[var(--nqs-border)]" />}
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center space-x-2.5 px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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
