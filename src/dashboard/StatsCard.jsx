import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';

/**
 * StatsCard — A reusable statistics card widget for dashboards.
 *
 * @param {Object}  props
 * @param {React.ComponentType} props.icon        — React icon component to render
 * @param {string}  props.label                   — Stat label text
 * @param {string|number} props.value             — Stat value
 * @param {string}  [props.trend]                 — Trend text e.g. '+12%'
 * @param {boolean} [props.trendUp]               — Whether the trend is positive
 * @param {string}  props.borderColor             — Tailwind border color class (e.g. 'border-blue-500')
 * @param {string}  props.iconBg                  — Tailwind bg class for icon container
 * @param {string}  props.iconColor               — Tailwind text color class for icon
 * @param {number}  [props.delay=0]               — Animation delay in seconds
 */
export default function StatsCard({
  icon: Icon,
  label = 'Statistic',
  value = 0,
  trend,
  trendUp,
  borderColor = 'border-blue-500',
  iconBg = 'bg-blue-100',
  iconColor = 'text-blue-600',
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className={`
        relative overflow-hidden rounded-xl border-l-4 ${borderColor}
        bg-white dark:bg-gray-800
        shadow-sm hover:shadow-lg
        transition-shadow duration-300
        p-5 sm:p-6
        flex items-center gap-4
      `}
    >
      {/* Icon container */}
      <div
        className={`
          flex-shrink-0 flex items-center justify-center
          w-12 h-12 sm:w-14 sm:h-14 rounded-full
          ${iconBg} dark:opacity-90
        `}
      >
        {Icon && <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
          {label}
        </p>

        <div className="flex items-baseline gap-2 mt-1">
          <AnimatePresence mode="wait">
            <motion.span
              key={String(value)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-none"
            >
              {value}
            </motion.span>
          </AnimatePresence>

          {/* Trend badge */}
          {trend && (
            <span
              className={`
                inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full
                ${
                  trendUp
                    ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/40'
                    : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/40'
                }
              `}
            >
              {trendUp ? (
                <FaArrowUp className="w-2.5 h-2.5" />
              ) : (
                <FaArrowDown className="w-2.5 h-2.5" />
              )}
              {trend}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
