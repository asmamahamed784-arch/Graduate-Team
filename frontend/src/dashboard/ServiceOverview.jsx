import React from 'react';
import { motion } from 'framer-motion';
import {
  FiCheckCircle,
  FiPauseCircle,
  FiXCircle,
  FiClipboard,
} from 'react-icons/fi';

const DEFAULT_SERVICES = [];

const statusConfig = {
  active: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    icon: FiCheckCircle,
  },
  paused: {
    label: 'Paused',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    icon: FiPauseCircle,
  },
  closed: {
    label: 'Closed',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    icon: FiXCircle,
  },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.active;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function ServiceOverview({
  services = DEFAULT_SERVICES,
  title = 'Service Overview',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <FiClipboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {services.length} service tracked
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Service Name
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                Tickets Today
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                Avg Wait
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                Status
              </th>
            </tr>
          </thead>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            {services.map((svc, idx) => (
              <motion.tr
                key={svc.name + idx}
                variants={rowVariants}
                className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors cursor-default"
              >
                <td className="px-6 py-3.5">
                  <span className="font-medium text-gray-800 dark:text-white text-sm">
                    {svc.name}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-center">
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {svc.ticketsToday}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-center text-sm text-gray-600 dark:text-gray-300">
                  {svc.avgWait}
                </td>
                <td className="px-6 py-3.5 text-center">
                  <StatusBadge status={svc.status} />
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.div>
  );
}
