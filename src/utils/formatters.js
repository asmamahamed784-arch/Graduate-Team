// src/utils/formatters.js
// NQS Telemetry and String formatting helper utilities

/**
 * Formats a Date object or ISO string into a nice, localized date
 * Example: '2026-05-24' -> 'Sunday, May 24, 2026'
 */
export const formatDate = (dateStr, locale = 'en-US') => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (_e) {
    return dateStr;
  }
};

/**
 * Formats a time string or hour-minute parameters
 */
export const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr;
};

/**
 * Formats duration integers into clean minute strings
 * Example: 25 -> '25 mins'
 */
export const formatDuration = (mins) => {
  const duration = parseInt(mins);
  if (isNaN(duration)) return '0 mins';
  return `${duration} mins`;
};

/**
 * Masks IP addresses in activity logs.
 * Example: '192.168.1.45' -> '192.168.1.***'
 */
export const maskIPAddress = (ip) => {
  if (typeof ip !== 'string') return '***.***.***.***';
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
};

/**
 * Masks user names to safeguard citizen confidentiality on public monitor boards
 * Example: 'Cabdi Xasan' -> 'Cabdi X.***'
 */
export const maskCitizenName = (name) => {
  if (typeof name !== 'string' || !name) return 'Citizen';
  const parts = name.trim().split(' ');
  if (parts.length < 2) return name;
  const first = parts[0];
  const lastInitial = parts[1][0];
  return `${first} ${lastInitial}.***`;
};
