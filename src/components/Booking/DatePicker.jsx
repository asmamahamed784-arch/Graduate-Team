import React from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FiCalendar, FiArrowLeft, FiArrowRight, FiInfo } from 'react-icons/fi';

const DatePickerComponent = ({ selected, onSelect, onNext, onBack }) => {
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 30);

  return (
    <div>
      <h2 className="mb-1 text-base font-bold text-white">Select Date</h2>
      <p className="mb-3 text-xs text-slate-400">
        Choose your preferred appointment date within the next 30 days.
      </p>

      <div className="max-w-sm">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-lg shadow-black/10">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-[#4189DD]/10 p-2">
              <FiCalendar className="text-[#7CB8FF]" size={15} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Appointment Date</h3>
              <p className="text-[11px] text-slate-400">
                {selected ? selected.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No date selected'}
              </p>
            </div>
          </div>

          <div className="mb-3 flex justify-center text-xs [&_.react-datepicker]:scale-[0.92] [&_.react-datepicker]:border-gray-200 [&_.react-datepicker]:shadow-md [&_.react-datepicker]:dark:border-gray-700 [&_.react-datepicker]:dark:bg-gray-800 [&_.react-datepicker]:rounded-xl [&_.react-datepicker__header]:rounded-t-xl [&_.react-datepicker__header]:border-blue-600 [&_.react-datepicker__header]:bg-blue-700 [&_.react-datepicker__header]:dark:bg-blue-800 [&_.react-datepicker__current-month]:text-white [&_.react-datepicker__day--disabled]:opacity-30 [&_.react-datepicker__day--keyboard-selected]:bg-blue-200 [&_.react-datepicker__day--keyboard-selected]:dark:bg-blue-800 [&_.react-datepicker__day--selected]:bg-blue-600 [&_.react-datepicker__day--selected]:text-white [&_.react-datepicker__day-name]:text-blue-100 [&_.react-datepicker__day:hover]:bg-blue-100 [&_.react-datepicker__day:hover]:dark:bg-blue-900/40 [&_.react-datepicker__day]:dark:text-gray-300 [&_.react-datepicker__navigation-icon::before]:border-white">
            <ReactDatePicker
              selected={selected}
              onChange={(date) => onSelect(date)}
              minDate={today}
              maxDate={maxDate}
              inline
              calendarClassName="!font-sans"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-[#4189DD]/20 bg-[#4189DD]/10 p-2.5">
            <FiInfo className="mt-0.5 shrink-0 text-[#7CB8FF]" size={13} />
            <p className="text-[11px] leading-4 text-blue-200">
              Appointments are available from today until {maxDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              Weekends may have limited availability.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800"
        >
          <FiArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!selected}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4189DD] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <FiArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default DatePickerComponent;
