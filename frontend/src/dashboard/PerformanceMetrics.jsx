import React from 'react';
import { motion } from 'framer-motion';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiZap,
  FiActivity,
} from 'react-icons/fi';

const DEFAULT_METRICS = {};

const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
    barBg: 'bg-blue-100 dark:bg-blue-900/50',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    barBg: 'bg-emerald-100 dark:bg-emerald-900/50',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
    barBg: 'bg-amber-100 dark:bg-amber-900/50',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
    barBg: 'bg-red-100 dark:bg-red-900/50',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400',
    bar: 'bg-violet-500',
    barBg: 'bg-violet-100 dark:bg-violet-900/50',
  },
};

function TrendIndicator({ trend, direction }) {
  if (direction === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
        <FiMinus className="w-3 h-3" />
        {trend}
      </span>
    );
  }

  const isPositive =
    (direction === 'up' && !trend.toLowerCase().includes('show')) ||
    (direction === 'down' && (trend.includes('-') && !trend.toLowerCase().includes('show')));

  const trendColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400';

  const TrendIcon = direction === 'up' ? FiTrendingUp : FiTrendingDown;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
      <TrendIcon className="w-3 h-3" />
      {trend}
    </span>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

export default function PerformanceMetrics({
  metrics = null,
  title = 'Performance Metrics',
}) {
  const data = metrics || DEFAULT_METRICS;
  const entries = Object.entries(data);

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <FiActivity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time performance indicators
          </p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {entries.map(([key, metric]) => {
          const Icon = metric.icon || FiZap;
          const colors = colorMap[metric.color] || colorMap.blue;

          return (
            <motion.div
              key={key}
              variants={cardVariants}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 hover:shadow-md transition-shadow"
            >
              {/* Top Row: Icon + Trend */}
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <TrendIndicator trend={metric.trend} direction={metric.direction} />
              </div>

              {/* Value */}
              <p className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                {metric.value}
              </p>

              {/* Label */}
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {metric.label}
              </p>

              {/* Progress Bar */}
              <div className={`w-full h-1.5 rounded-full ${colors.barBg}`}>
                <motion.div
                  className={`h-full rounded-full ${colors.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(metric.progress, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
