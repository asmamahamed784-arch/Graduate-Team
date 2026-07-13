import { motion } from 'framer-motion';
import { FaClock } from 'react-icons/fa';

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/**
 * RecentActivity — A vertical-timeline activity feed.
 *
 * @param {Object}   props
 * @param {Array}    props.activities   — Array of { id, action, time, icon (React component), color (Tailwind text color) }
 * @param {string}   [props.title='Recent Activity']
 * @param {number}   [props.maxItems=5]
 */
export default function RecentActivity({
  activities = [],
  title = 'Recent Activity',
  maxItems = 5,
}) {
  const visible = activities.slice(0, maxItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <FaClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
          {title}
        </h3>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
            <FaClock className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <motion.ul
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="relative"
          >
            {/* Connecting vertical line */}
            <span
              aria-hidden="true"
              className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gray-200 dark:bg-gray-700 rounded-full"
            />

            {visible.map((activity, index) => {
              const Icon = activity.icon;
              const isLast = index === visible.length - 1;

              return (
                <motion.li
                  key={activity.id}
                  variants={itemVariants}
                  className={`relative flex items-start gap-4 ${isLast ? '' : 'pb-5'}`}
                >
                  {/* Icon node */}
                  <div
                    className={`
                      relative z-10 flex items-center justify-center flex-shrink-0
                      w-[30px] h-[30px] rounded-full
                      bg-white dark:bg-gray-800
                      border-2 border-gray-200 dark:border-gray-600
                    `}
                  >
                    {Icon && (
                      <Icon
                        className={`w-3.5 h-3.5 ${activity.color || 'text-gray-500 dark:text-gray-400'}`}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                      {activity.action}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {activity.time}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </div>
    </motion.div>
  );
}
