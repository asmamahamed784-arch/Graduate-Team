import React from 'react';
import { motion } from 'framer-motion';
import { FiCreditCard, FiArrowRight, FiCheckCircle } from 'react-icons/fi';

const ServiceSelector = ({ services = [], selected, onSelect, onNext }) => {
  const selectedId = selected?._id || selected?.id;

  return (
    <div>
      <h2 className="mb-1 text-base font-bold text-white">Select Service</h2>
      <p className="mb-3 text-xs text-slate-400">
        National ID Registration is the available service for this appointment.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3">
        {services.map((svc) => {
          const serviceId = svc._id || svc.id;
          const isSelected = selectedId === serviceId;
          return (
            <motion.button
              key={serviceId}
              whileHover={{ y: -1 }}
              onClick={() => onSelect(svc)}
              className={`rounded-xl border p-3 text-left transition-all ${
                isSelected
                  ? 'border-[#4189DD] bg-[#4189DD]/15 shadow-lg shadow-blue-950/30'
                  : 'border-slate-800 bg-slate-950/60 hover:border-[#4189DD]/60'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-[#4189DD] text-white' : 'bg-[#4189DD]/10 text-[#7CB8FF]'
                  }`}>
                    <FiCreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      {svc.name || 'National ID Registration'}
                    </h3>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
                      {svc.description || 'Book an appointment for National ID Registration.'}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-500/10 px-2.5 py-1 text-[11px] font-bold text-teal-300">
                    <FiCheckCircle size={12} />
                    Selected
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {services.length === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-center">
          <p className="text-xs font-semibold text-slate-300">No active National ID service is available right now.</p>
          <p className="mt-1 text-xs text-slate-500">Please try again later.</p>
        </div>
      )}

      <div className="flex border-t border-slate-800 pt-3">
        <button
          onClick={onNext}
          disabled={!selected}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4189DD] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <FiArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default ServiceSelector;
