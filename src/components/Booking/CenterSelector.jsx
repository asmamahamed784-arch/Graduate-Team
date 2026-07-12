import React from 'react';
import { motion } from 'framer-motion';
import { FiMapPin, FiArrowRight, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';

const CenterSelector = ({ centers = [], selected, onSelect, onNext, onBack }) => {
  const selectedId = selected?._id || selected?.id;

  const statusColors = {
    Open: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    Busy: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    Closed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };

  return (
    <div>
      <h2 className="mb-1 text-base font-bold text-white">Select Center</h2>
      <p className="mb-3 text-xs text-slate-400">
        Choose a Banaadir National ID center for your appointment.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {centers.map((center) => {
          const centerId = center._id || center.id;
          const isSelected = selectedId === centerId;
          const isClosed = center.status === 'Closed';
          return (
            <motion.button
              key={centerId}
              whileHover={!isClosed ? { y: -1 } : {}}
              whileTap={!isClosed ? { scale: 0.98 } : {}}
              onClick={() => !isClosed && onSelect(center)}
              disabled={isClosed}
              className={`rounded-xl border p-3 text-left transition-all ${
                isClosed
                  ? 'opacity-50 cursor-not-allowed border-slate-800 bg-slate-950/40'
                  : isSelected
                    ? 'border-[#4189DD] bg-[#4189DD]/15 shadow-lg shadow-blue-950/30'
                    : 'border-slate-800 bg-slate-950/60 hover:border-[#4189DD]/60'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#4189DD]/10 text-[#7CB8FF]'
                }`}>
                  <FiMapPin size={15} />
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[center.status] || statusColors.Open}`}>
                  {center.status}
                </span>
              </div>
              <h3 className={`font-semibold mb-1 text-sm ${
                isSelected ? 'text-blue-200' : 'text-white'
              }`}>
                {center.name}
              </h3>
              <p className="mb-1.5 text-[11px] leading-4 text-slate-400">{center.address}</p>
              {!isClosed && (
                <p className="text-[11px] text-slate-500">
                  Wait time: <span className="font-medium text-slate-300">{center.waitTime || '15 min'}</span>
                </p>
              )}
              {isSelected && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#7CB8FF]">
                  <FiCheckCircle size={11} />
                  Selected
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {centers.length === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-center">
          <p className="text-xs font-semibold text-slate-300">No service centers are available right now.</p>
          <p className="mt-1 text-xs text-slate-500">Please try again later.</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:justify-between">
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

export default CenterSelector;
