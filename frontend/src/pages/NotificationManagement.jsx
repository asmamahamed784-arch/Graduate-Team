import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiCalendar, FiCheckCircle,
  FiX, FiInbox, FiSend, FiUserCheck
} from 'react-icons/fi';
import { useAuth, useNotification } from '../hooks';
import { buildNotificationRoute } from '../utils/notificationRouting';

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'Appointments', label: 'Appointments' },
  { key: 'Operator Approval', label: 'Operator Approval' },
  { key: 'System', label: 'System' },
];

const typeColors = {
  Appointments: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  Queue: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  'Operator Approval': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  System: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
};

const getCategoryIcon = (category) => {
  if (category === 'Appointments') return FiCalendar;
  if (category === 'Queue') return FiCheckCircle;
  if (category === 'Operator Approval') return FiUserCheck;
  return FiBell;
};

const getNotificationMessage = (notification = {}) => notification.desc || notification.message || '';

const NotificationManagement = () => {
  const { user, isAdmin } = useAuth();
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
    <div className="min-h-screen pb-12">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl relative">
              <FiBell className="text-blue-700 dark:text-blue-400 text-xl" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'You\'re all caught up!'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
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
          className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-4 flex items-center gap-2">
            <FiSend className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Send System Notification</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={compose.title}
              onChange={(e) => setCompose((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <select
              value={compose.category}
              onChange={(e) => setCompose((prev) => ({ ...prev, category: e.target.value }))}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
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
            className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={sending}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <FiSend size={14} />
            {sending ? 'Sending...' : 'Send notification'}
          </button>
        </motion.form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeFilter === tab.key
                ? 'bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
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
              className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800"
            >
              <FiInbox className="mx-auto mb-3 text-3xl text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">New updates will appear here.</p>
            </motion.div>
          ) : (
            filtered.map((n) => {
              const Icon = getCategoryIcon(n.category);
              const route = buildNotificationRoute(n, user);
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
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all group ${
                    n.read
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50 shadow-sm'
                  } hover:shadow-md`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${typeColors[n.category] || typeColors.System}`}>
                    <Icon size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!n.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                      <h3 className={`text-sm font-semibold truncate ${
                        n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {n.title}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                      {message}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                      {n.timestamp || n.createdAt ? new Date(n.timestamp || n.createdAt).toLocaleString() : 'Just now'}
                    </p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenNotification(n);
                      }}
                      className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
                    >
                      {isOpening ? 'Opening...' : route ? 'Open related page' : 'Open'}
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(id);
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    aria-label="Delete notification"
                  >
                    <FiX size={16} />
                  </button>
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
