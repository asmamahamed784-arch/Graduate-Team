import { motion } from 'framer-motion';
import { FaCalendarAlt, FaEye, FaTimesCircle } from 'react-icons/fa';

const STATUS_STYLES = {
  Confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
  Pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
};

/**
 * AppointmentTable — A sortable, responsive appointments table.
 *
 * @param {Object}   props
 * @param {Array}    props.appointments   — Array of { id, service, center, date, time, status }
 * @param {string}   [props.title='Upcoming Appointments']
 * @param {Function} [props.onView]       — Called with appointment id
 * @param {Function} [props.onCancel]     — Called with appointment id
 * @param {boolean}  [props.showActions=true]
 */
export default function AppointmentTable({
  appointments = [],
  title = 'Upcoming Appointments',
  onView,
  onCancel,
  showActions = true,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <FaCalendarAlt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
          {title}
        </h3>
        <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[11px] font-bold">
          {appointments.length}
        </span>
      </div>

      {/* Table */}
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
          <FaCalendarAlt className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No appointments scheduled</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40">
                <th className="px-5 py-3 font-semibold">Service</th>
                <th className="px-5 py-3 font-semibold">Center</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                {showActions && <th className="px-5 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {appointments.map((appt, i) => (
                <motion.tr
                  key={appt.id}
                  custom={i}
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-5 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {appt.service}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {appt.center}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {appt.date}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {appt.time}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span
                      className={`
                        inline-block text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full
                        ${STATUS_STYLES[appt.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}
                      `}
                    >
                      {appt.status}
                    </span>
                  </td>
                  {showActions && (
                    <td className="px-5 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {onView && (
                          <button
                            type="button"
                            onClick={() => onView(appt.id)}
                            title="View details"
                            className="p-1.5 rounded-md text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <FaEye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onCancel && appt.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => onCancel(appt.id)}
                            title="Cancel appointment"
                            className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                          >
                            <FaTimesCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
