import React from 'react';
import { getLostIdSubmittedDetails } from '../utils/cancellationFields';

/** Shows the Lost ID form the citizen submitted inside the cancel modal. */
export default function LostIdCancelDetails({ ticket }) {
  const rows = getLostIdSubmittedDetails(ticket);

  return (
    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Replace Lost National ID — submitted details
      </p>
      <p className="mt-1 text-sm font-semibold text-amber-950 dark:text-amber-100">
        Review what the citizen entered for this lost ID request before you cancel.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-amber-200/80 bg-white px-3 py-2 dark:border-amber-500/20 dark:bg-slate-950/50"
          >
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
