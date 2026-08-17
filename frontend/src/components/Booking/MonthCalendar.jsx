import React, { useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Real month-grid date picker — availability/disabled state comes from the
 *  same `availability` map the rest of the booking flow already fetches
 *  (closed/full/available per date), nothing here is decorative. */
const MonthCalendar = ({ value, onChange, minDateKey, maxDateKey, availability = {}, disabled = false }) => {
  const initialMonth = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewDate, setViewDate] = useState(new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  const canGoPrev = !minDateKey || toKey(new Date(year, month, 0)) >= minDateKey.slice(0, 7) + '-01' || new Date(year, month, 0) >= new Date(`${minDateKey}T00:00:00`);
  const canGoNext = !maxDateKey || new Date(year, month + 1, 1) <= new Date(`${maxDateKey}T00:00:00`);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          disabled={!canGoPrev}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous month"
        >
          <FiChevronLeft />
        </button>
        <p className="text-sm font-black text-[#0B3A75]">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          disabled={!canGoNext}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next month"
        >
          <FiChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-slate-400">
        {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} />;
          const date = new Date(year, month, day);
          const key = toKey(date);
          const isSelected = key === value;
          const beforeMin = minDateKey && key < minDateKey;
          const afterMax = maxDateKey && key > maxDateKey;
          const status = availability[key]?.status;
          const isUnavailable = beforeMin || afterMax || status === 'closed' || status === 'full';
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || isUnavailable}
              onClick={() => onChange(key)}
              className={`aspect-square rounded-lg text-xs font-bold transition ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isUnavailable
                    ? 'cursor-not-allowed text-slate-300'
                    : status === 'available'
                      ? 'text-slate-800 hover:bg-blue-50'
                      : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <span className="h-2 w-2 rounded-full bg-blue-600" /> Selected
        <span className="ml-3 h-2 w-2 rounded-full bg-slate-200" /> Unavailable
      </p>
    </div>
  );
};

export default MonthCalendar;
