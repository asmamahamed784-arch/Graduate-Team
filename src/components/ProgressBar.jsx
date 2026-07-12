import React from 'react';
import { motion } from 'framer-motion';

/**
 * ProgressBar component
 * @param {number} percent - progress percentage (0-100)
 * @param {string} className - additional Tailwind classes
 * @param {string} color - Tailwind color name (e.g., 'blue', 'green')
 */
const ProgressBar = ({ percent = 0, className = '', color = 'blue' }) => {
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden ${className}`}>
      <motion.div
        className={`h-3 bg-${color}-500`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
};

export default ProgressBar;
