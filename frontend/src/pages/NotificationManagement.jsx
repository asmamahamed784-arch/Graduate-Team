import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiCalendar, FiCheckCircle,
  FiX, FiInbox, FiSend
} from 'react-icons/fi';
import { useAuth, useNotification } from '../hooks';

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'Appointments', label: 'Appointments' },
  { key: 'System', label: 'System' },
];

const typeColors = {
  Appointments: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  Queue: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  System: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
};

const getCategoryIcon = (category) => {
  if (category === 'Appointments') return FiCalendar;
  if (category === 'Queue') return FiCheckCircle;
  return FiBell;
};

const NotificationManagement = () => {
  const { isAdmin } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllRead, deleteNotification, sendNotification, toast } = useNotification();
  const [activeFilter, setActiveFilter] = useState('all');
  const [compose, setCompose] = useState({
    title: '',
    desc: '',
    category: 'System',
    sendEmail: true,
    sendSms: true,
  });
  const [sending, setSending] = useState(false);

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

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
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
          onSubmit={handleSend}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <FiSend className="text-blue-700 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Send Message</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={compose.title}
              onChange={(e) => setCompose({ ...compose, title: e.target.value })}
              placeholder="Title"
              className="px-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={compose.category}
              onChange={(e) => setCompose({ ...compose, category: e.target.value })}
              className="px-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>System</option>
              <option>Appointments</option>
              <option>Queue</option>
            </select>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <FiSend size={15} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
          <textarea
            value={compose.desc}
            onChange={(e) => setCompose({ ...compose, desc: e.target.value })}
            placeholder="Message"
            rows={3}
            className="mt-3 w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={compose.sendEmail} onChange={(e) => setCompose({ ...compose, sendEmail: e.target.checked })} />
              Email record
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={compose.sendSms} onChange={(e) => setCompose({ ...compose, sendSms: e.target.checked })} />
              SMS record
            </label>
          </div>
        </motion.form>
      )}

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex gap-2 mb-6 overflow-x-auto pb-1"
      >
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
              activeFilter === tab.key
                ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            {tab.label}
            {tab.key === 'unread' && unreadCount > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeFilter === 'unread' ? 'bg-white/20' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Notification List */}
      <div className="space-y-3 max-w-4xl">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
            >
              <FiInbox className="mx-auto text-4xl text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">New updates will appear here.</p>
            </motion.div>
          ) : (
            filtered.map((n) => {
              const Icon = getCategoryIcon(n.category);
              return (
                <motion.div
                  key={n._id || n.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => markAsRead(n._id || n.id)}
                  className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all group ${
                    n.read
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50 shadow-sm'
                  } hover:shadow-md`}
                >
                  {/* Icon */}
                  <div className={`p-2.5 rounded-xl shrink-0 ${typeColors[n.category] || typeColors.System}`}>
                    <Icon size={18} />
                  </div>

                  {/* Content */}
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
                      {n.desc}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                      {n.timestamp ? new Date(n.timestamp).toLocaleString() : 'Just now'}
                    </p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n._id || n.id);
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
