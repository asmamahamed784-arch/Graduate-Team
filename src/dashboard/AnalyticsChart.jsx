import React from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { motion } from 'framer-motion';
import { FiBarChart2 } from 'react-icons/fi';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 20,
        usePointStyle: true,
        pointStyleWidth: 10,
        font: { size: 12, family: "'Inter', sans-serif" },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: { size: 13, family: "'Inter', sans-serif" },
      bodyFont: { size: 12, family: "'Inter', sans-serif" },
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 11, family: "'Inter', sans-serif" },
        color: '#94a3b8',
      },
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.1)' },
      ticks: {
        font: { size: 11, family: "'Inter', sans-serif" },
        color: '#94a3b8',
      },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        padding: 20,
        usePointStyle: true,
        pointStyleWidth: 10,
        font: { size: 12, family: "'Inter', sans-serif" },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: { size: 13, family: "'Inter', sans-serif" },
      bodyFont: { size: 12, family: "'Inter', sans-serif" },
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
      boxPadding: 4,
    },
  },
  cutout: '65%',
};

const chartComponents = {
  line: Line,
  bar: Bar,
  doughnut: Doughnut,
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
    <FiBarChart2 className="w-16 h-16 mb-4 opacity-30" />
    <p className="text-lg font-medium">No chart data available</p>
    <p className="text-sm mt-1 opacity-70">Data will appear here once available</p>
  </div>
);

export default function AnalyticsChart({
  type = 'line',
  title = 'Chart',
  data = null,
  options = null,
  height = 'h-72',
  subtitle = '',
}) {
  const ChartComponent = chartComponents[type] || Line;

  const mergedOptions =
    options ||
    (type === 'doughnut' ? { ...doughnutOptions } : { ...defaultOptions });

  const hasData =
    data &&
    data.datasets &&
    data.datasets.length > 0 &&
    data.datasets.some((ds) => ds.data && ds.data.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Chart Body */}
      <div className="p-6">
        {hasData ? (
          <div className={`${height} w-full`}>
            <ChartComponent data={data} options={mergedOptions} />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </motion.div>
  );
}
