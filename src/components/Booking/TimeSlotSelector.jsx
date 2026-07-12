import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const TimeSlotSelector = ({ date, selected, onSelect, onNext, onBack }) => {
  // Generate time slots from 9:00 AM to 5:00 PM in 30-minute intervals
  const slots = useMemo(() => {
    const timeSlots = [];
    let hour = 9;
    let minutes = 0;

    while (hour < 17 || (hour === 17 && minutes === 0)) {
      const displayHour = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedMinutes = minutes === 0 ? '00' : minutes;
      const timeStr = `${displayHour}:${formattedMinutes} ${ampm}`;
      
      timeSlots.push({
        time: timeStr,
        isUnavailable: false,
      });

      minutes += 30;
      if (minutes >= 60) {
        minutes = 0;
        hour += 1;
      }
    }
    return timeSlots;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-xl rounded-xl border border-blue-500/20 bg-slate-950/45 p-4 shadow-lg shadow-black/15 backdrop-blur"
    >
      <div className="mb-4 flex items-center space-x-2.5">
        <div className="rounded-lg bg-[#4189DD]/10 p-2 text-[#7CB8FF]">
          <FiClock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Select Time Slot</h2>
          <p className="text-xs text-slate-400">
            Available appointments for {date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'selected date'}
          </p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {slots.map((slot) => {
          const isSelected = selected === slot.time;
          return (
            <button
              key={slot.time}
              type="button"
              disabled={slot.isUnavailable}
              onClick={() => onSelect(slot.time)}
              className={`flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                slot.isUnavailable
                  ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed line-through'
                  : isSelected
                  ? 'bg-[#4189DD] border-[#4189DD] text-white shadow-lg shadow-blue-950/30'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-[#4189DD]/60 hover:bg-[#4189DD]/10'
              }`}
            >
              <span>{slot.time}</span>
              <span className={`mt-0.5 text-[9px] ${slot.isUnavailable ? 'text-slate-600' : isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                {slot.isUnavailable ? 'Unavailable' : 'Available'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center space-x-2 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-300 transition duration-200 hover:bg-slate-800"
        >
          <FiChevronLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!selected}
          className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-lg transition duration-200 ${
            selected
              ? 'bg-[#4189DD] hover:bg-blue-500 shadow-blue-950/30'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
          }`}
        >
          <span>Next</span>
          <FiChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export default TimeSlotSelector;
