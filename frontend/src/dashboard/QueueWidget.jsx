import { motion, AnimatePresence } from 'framer-motion';
import { FaUserClock, FaPhoneAlt, FaPause, FaCheckCircle } from 'react-icons/fa';

const STATUS_STYLES = {
  'Being Served': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
  Waiting:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  'On Hold':      'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400',
};

function StatusBadge({ status }) {
  return (
    <span
      className={`
        inline-block text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap
        ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}
      `}
    >
      {status}
    </span>
  );
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

/**
 * QueueWidget — A mini live queue status widget.
 *
 * @param {Object}   props
 * @param {string}   [props.title='Live Queue']   — Widget title
 * @param {Array}    props.tickets                 — Array of { ref, name, service, status, waitTime }
 * @param {Function} [props.onCallNext]            — Callback for Call Next action
 * @param {Function} [props.onHold]                — Callback for Hold action
 * @param {Function} [props.onComplete]            — Callback for Complete action
 */
export default function QueueWidget({
  title = 'Live Queue',
  tickets = [],
  onCallNext,
  onHold,
  onComplete,
}) {
  const serving = tickets.find((t) => t.status === 'Being Served');
  const waiting = tickets
    .filter((t) => t.status === 'Waiting')
    .slice(0, 5);

  const hasActions = onCallNext || onHold || onComplete;

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
          <FaUserClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
            {title}
          </h3>
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {tickets.length} ticket{tickets.length !== 1 && 's'}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto max-h-96 px-5 py-4 space-y-4">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
            <FaUserClock className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No tickets in queue</p>
          </div>
        ) : (
          <>
            {/* Currently serving */}
            {serving && (
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
                <p className="text-[10px] uppercase tracking-widest font-bold text-green-600 dark:text-green-400 mb-1">
                  Now Serving
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400 truncate">
                      {serving.ref}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      {serving.service}
                    </p>
                  </div>
                  <StatusBadge status={serving.status} />
                </div>
              </div>
            )}

            {/* Waiting list */}
            {waiting.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-2">
                  Up Next
                </p>
                <motion.ul
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  <AnimatePresence>
                    {waiting.map((ticket) => (
                      <motion.li
                        key={ticket.ref}
                        variants={itemVariants}
                        exit={{ opacity: 0, x: 12 }}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                            {ticket.ref}
                          </span>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {ticket.service}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {ticket.waitTime}
                          </span>
                          <StatusBadge status={ticket.status} />
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action bar */}
      {hasActions && tickets.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          {onCallNext && (
            <button
              type="button"
              onClick={onCallNext}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <FaPhoneAlt className="w-3 h-3" />
              Call Next
            </button>
          )}
          {onHold && (
            <button
              type="button"
              onClick={onHold}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <FaPause className="w-3 h-3" />
              Hold
            </button>
          )}
          {onComplete && (
            <button
              type="button"
              onClick={onComplete}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <FaCheckCircle className="w-3 h-3" />
              Complete
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
