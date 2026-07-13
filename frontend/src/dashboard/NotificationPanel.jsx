import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBell,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaTimes,
} from 'react-icons/fa';

const TYPE_CONFIG = {
  info: {
    icon: FaInfoCircle,
    border: 'border-blue-500',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  success: {
    icon: FaCheckCircle,
    border: 'border-green-500',
    iconColor: 'text-green-500 dark:text-green-400',
  },
  warning: {
    icon: FaExclamationTriangle,
    border: 'border-yellow-500',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
  },
  error: {
    icon: FaTimesCircle,
    border: 'border-red-500',
    iconColor: 'text-red-500 dark:text-red-400',
  },
};

const itemVariants = {
  initial: { opacity: 0, x: 20, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

/**
 * NotificationPanel — A notifications sidebar panel.
 *
 * @param {Object}   props
 * @param {Array}    props.notifications  — Array of { id, title, message, time, type, read }
 *                                          type: 'info' | 'success' | 'warning' | 'error'
 * @param {string}   [props.title='Notifications']
 * @param {Function} [props.onMarkRead]       — Called with notification id
 * @param {Function} [props.onMarkAllRead]    — Called when "Mark all read" clicked
 * @param {Function} [props.onDismiss]        — Called with notification id
 */
export default function NotificationPanel({
  notifications = [],
  title = 'Notifications',
  onMarkRead,
  onMarkAllRead,
  onDismiss,
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FaBell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
            {title}
          </h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
              {unreadCount}
            </span>
          )}
        </div>

        {onMarkAllRead && unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors focus:outline-none"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto max-h-[28rem] px-4 py-3 space-y-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <FaBell className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notifications.map((notif) => {
              const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
              const TypeIcon = config.icon;

              return (
                <motion.div
                  key={notif.id}
                  variants={itemVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  layout
                  onClick={() => {
                    if (!notif.read && onMarkRead) onMarkRead(notif.id);
                  }}
                  className={`
                    relative flex gap-3 p-3 rounded-lg border-l-[3px] ${config.border}
                    ${
                      notif.read
                        ? 'bg-gray-50 dark:bg-gray-700/30'
                        : 'bg-blue-50/40 dark:bg-blue-900/10'
                    }
                    cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
                    group
                  `}
                >
                  {/* Type icon */}
                  <div className="flex-shrink-0 pt-0.5">
                    <TypeIcon className={`w-4 h-4 ${config.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1">
                      <p
                        className={`text-sm leading-snug ${
                          notif.read
                            ? 'font-medium text-gray-700 dark:text-gray-300'
                            : 'font-bold text-gray-900 dark:text-white'
                        }`}
                      >
                        {notif.title}
                      </p>

                      {/* Unread dot */}
                      {!notif.read && (
                        <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {notif.time}
                    </p>
                  </div>

                  {/* Dismiss button */}
                  {onDismiss && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(notif.id);
                      }}
                      title="Dismiss"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-all focus:outline-none focus:opacity-100"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
