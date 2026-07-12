// src/utils/helpers.js
// Reusable NQS utility helpers

/**
 * Creates a simple delay promise
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Capitalizes the first letter of a string
 */
export const capitalize = (str) => {
  if (typeof str !== 'string' || !str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Merges CSS classes conditionally
 */
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Safe JSON parser with fallback values
 */
export const safeParse = (data, fallback = null) => {
  try {
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.warn('[helpers] JSON parsing failed, using fallback:', e);
    return fallback;
  }
};

/**
 * Retrieves color classes for activity log review levels.
 */
export const getRiskBadgeColor = (risk) => {
  const base = 'px-2 py-0.5 rounded-full text-xs font-semibold';
  switch (String(risk).toLowerCase()) {
    case 'high':
      return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800`;
    case 'medium':
      return `${base} bg-yellow-100 text-yellow-750 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800`;
    case 'low':
    default:
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800`;
  }
};

/**
 * Generates initial letters from full names
 */
export const getInitials = (name) => {
  if (typeof name !== 'string' || !name) return 'AH';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};
