/** Somalia calendar helpers (Africa/Mogadishu, UTC+3, no DST). */

export const SOMALIA_TZ = 'Africa/Mogadishu';
export const SOMALIA_UTC_OFFSET = '+03:00';

/** YYYY-MM-DD for `date` in Africa/Mogadishu. */
export const mogadishuDateKey = (date = new Date()) => (
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SOMALIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date instanceof Date ? date : new Date(date))
);

/**
 * Inclusive start / exclusive end Instant for the Mogadishu calendar day
 * that contains `date` (defaults to now).
 */
export const getMogadishuDayBounds = (date = new Date()) => {
  const dayKey = mogadishuDateKey(date);
  const start = new Date(`${dayKey}T00:00:00.000${SOMALIA_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dayKey, start, end };
};
