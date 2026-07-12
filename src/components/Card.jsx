import React from 'react';
import { motion } from 'framer-motion';

/**
 * Reusable Card component.
 *
 * @param {Object} props
 * @param {string} [props.title] - Optional card title displayed at the top.
 * @param {React.ReactNode} props.children - Card body content.
 * @param {string} [props.className] - Additional Tailwind classes.
 * @param {string} [props.variant] - "primary" | "secondary" for background tint.
 * @returns {JSX.Element}
 */
const Card = ({ title, children, className = '', variant = 'primary' }) => {
  const bgClass = variant === 'secondary' ? 'bg-slate-50' : 'bg-white';
  const borderClass = 'border border-slate-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl shadow-sm ${bgClass} ${borderClass} ${className}`}
    >
      {title && (
        <div className="px-6 py-4 border-b border-slate-200 text-lg font-semibold text-slate-900">
          {title}
        </div>
      )}
      <div className="p-6 text-slate-700">{children}</div>
    </motion.div>
  );
};

export default Card;
