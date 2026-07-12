import React from 'react';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiClock,
  FiMonitor,
  FiHash,
} from 'react-icons/fi';

const statCards = [
  {
    key: 'totalWaiting',
    label: 'Total Waiting',
    icon: FiUsers,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
  },
  {
    key: 'currentServing',
    label: 'Currently Serving',
    icon: FiHash,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  {
    key: 'avgWaitTime',
    label: 'Avg Wait',
    icon: FiClock,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
  },
  {
    key: 'countersActive',
    label: 'Active Counters',
    icon: FiMonitor,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/30',
  },
];

export default function QueueStatusCard({
  centerName = 'Banaadir National ID Center',
  totalWaiting = 24,
  currentServing = 'NQS-1018',
  avgWaitTime = '14 min',
  countersActive = 8,
  countersTotal = 12,
}) {
  const values = {
    totalWaiting,
    currentServing,
    avgWaitTime,
    countersActive: `${countersActive} / ${countersTotal}`,
  };

  const utilization = Math.round((countersActive / countersTotal) * 100);

  const barColor =
    utilization >= 80
      ? 'bg-emerald-500'
      : utilization >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {centerName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Queue Status</p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Live
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </span>
                </div>
                <span className="text-xl font-bold text-gray-800 dark:text-white">
                  {values[stat.key]}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Utilization Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Counter Utilization
            </span>
            <span className="text-sm font-bold text-gray-800 dark:text-white">
              {utilization}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${utilization}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            {countersActive} of {countersTotal} counters currently active
          </p>
        </div>
      </div>
    </motion.div>
  );
}
