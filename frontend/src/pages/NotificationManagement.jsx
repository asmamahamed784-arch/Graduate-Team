import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertTriangle, FiBell, FiCalendar, FiChevronRight, FiCheckCircle,
  FiX, FiInbox, FiMapPin, FiSend, FiUserCheck
} from 'react-icons/fi';
import { useAuth, useNotification } from '../hooks';
import { getNotificationDisplayMessage } from '../utils/cancellationDisplay';

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'Appointments', label: 'Appointment' },
  { key: 'Queue', label: 'Queue' },
  { key: 'System', label: 'System' },
];

const typeColors = {
  Appointments: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  Queue: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  'Operator Approval': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  System: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  Alert: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

const getCategoryIcon = (category, notification) => {
  const text = `${notification?.title || ''} ${notification?.desc || ''}`.toLowerCase();
  if (/action required|additional information|correction/.test(text)) return FiAlertTriangle;
  if (category === 'Appointments') return FiCalendar;
  if (category === 'Queue') return FiCheckCircle;
  if (category === 'Operator Approval') return FiUserCheck;
  if (category === 'System' && /center/.test(text)) return FiMapPin;
  return FiBell;
};

const getNotificationMessage = (notification = {}) => getNotificationDisplayMessage(notification);

const formatRelativeTime = (value) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NotificationManagement = () => {
  const { isAdmin } = useAuth();
  const {
    notifications,
    unreadCount,
    markAllRead,
    deleteNotification,
    sendNotification,
    openNotification,
    toast
  } = useNotification();
  const [activeFilter, setActiveFilter] = useState('all');
  const [compose, setCompose] = useState({
    title: '',
    desc: '',
    category: 'System',
    sendEmail: true,
    sendSms: true,
  });
  const [sending, setSending] = useState(false);
  const [openingId, setOpeningId] = useState('');

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.read;
    return n.category === activeFilter;
  });

  const canSend = isAdmin;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!compose.title.trim() || !compose.desc.trim()) {
      toast.warning('Enter a notification title and message.');
      return;
    }
    setSending(true);
    try {
      await sendNotification(compose);
      setCompose((prev) => ({ ...prev, title: '', desc: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to send notification.');
    } finally {
      setSending(false);
    }
  };

  const handleOpenNotification = async (notification) => {
    const id = notification._id || notification.id;
    setOpeningId(String(id || ''));
    try {
      await openNotification(notification);
    } finally {
      setOpeningId('');
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden px-3 pb-12 sm:px-5 lg:px-6">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative rounded-xl bg-[var(--color-primary-soft)] p-2.5">
              <FiBell className="text-xl text-[var(--color-primary)]" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black text-[var(--text-main)]">Notifications</h1>
              <p className="text-sm font-medium text-[var(--text-muted)]">
                {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'You\'re all caught up!'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800"
            >
              <FiCheckCircle size={15} />
              Mark all as read
            </button>
          )}
        </div>
      </motion.div>

      {canSend && (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSend}
          className="mb-6 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <FiSend className="text-[var(--color-primary)]" />
            <h2 className="text-sm font-black text-[var(--text-main)]">Send System Notification</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={compose.title}
              onChange={(e) => setCompose((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
              className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2.5 text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
            />
            <select
              value={compose.category}
              onChange={(e) => setCompose((prev) => ({ ...prev, category: e.target.value }))}
              className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2.5 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
            >
              <option value="System">System</option>
              <option value="Appointments">Appointments</option>
              <option value="Queue">Queue</option>
            </select>
          </div>
          <textarea
            value={compose.desc}
            onChange={(e) => setCompose((prev) => ({ ...prev, desc: e.target.value }))}
            rows={3}
            placeholder="Message"
            className="mt-3 w-full resize-y rounded-xl border border-[var(--border-light)] bg-[var(--bg-input)] px-3 py-2.5 text-sm font-semibold text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-4 focus:ring-[var(--border-focus)]/15"
          />
          <button
            type="submit"
            disabled={sending}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <FiSend size={14} />
            {sending ? 'Sending...' : 'Send notification'}
          </button>
        </motion.form>
      )}

      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-2 shadow-sm">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeFilter === tab.key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-[var(--border-light)] bg-[var(--bg-card)] p-10 text-center"
            >
              <FiInbox className="mx-auto mb-3 text-3xl text-[var(--text-muted)]" />
              <p className="font-bold text-[var(--text-muted)]">No notifications</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">New updates will appear here.</p>
            </motion.div>
          ) : (
            filtered.map((n) => {
              const Icon = getCategoryIcon(n.category, n);
              const message = getNotificationMessage(n);
              const id = n._id || n.id;
              const isOpening = openingId && String(id) === openingId;
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => handleOpenNotification(n)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleOpenNotification(n);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all cursor-pointer ${
                    n.read
                      ? 'border-[var(--border-light)] bg-[var(--bg-card)]'
                      : 'border-[var(--border-focus)] bg-[var(--bg-card)]'
                  } hover:shadow-md`}
                >
                  <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-500'}`} />

                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${typeColors[n.category] || typeColors.System}`}>
                    <Icon size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-sm font-black text-[var(--text-main)]">
                        {n.title}
                      </h3>
                      <span className="shrink-0 text-[11px] font-bold text-[var(--color-primary)]">
                        {formatRelativeTime(n.timestamp || n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                      {message}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(id);
                      }}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      aria-label="Delete notification"
                    >
                      <FiX size={16} />
                    </button>
                    {isOpening ? (
                      <span className="text-[11px] font-semibold text-[var(--text-muted)]">Opening...</span>
                    ) : (
                      <FiChevronRight className="text-[var(--text-muted)]" />
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NotificationManagement;
