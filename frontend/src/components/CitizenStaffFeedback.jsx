import React from 'react';
import {
  getCancellationFeedbackText,
  getCancellationReasonList,
} from '../utils/cancellationDisplay';

/**
 * Shared citizen-facing panel for staff cancel/correction feedback.
 * Shows incorrect fields + admin/operator notes.
 */
export default function CitizenStaffFeedback({
  ticket,
  className = '',
  title = 'Staff feedback',
  emptyMessage = 'Please correct your information and resubmit.',
  forceShow = false,
}) {
  if (!ticket) return null;

  const status = String(ticket.currentStatus || ticket.status || ticket.requestStatus || '').toLowerCase();
  const isCancelled = status.includes('cancel') || status.includes('resubmission');
  const reasons = getCancellationReasonList(ticket);
  const embedded =
    ticket.cancellationDetails ||
    ticket.registrationDetails?.cancellationDetails ||
    ticket.replacementDetails?.cancellationDetails ||
    ticket.updateDetails?.cancellationDetails ||
    {};
  const notes = String(
    ticket.cancellationNotes ||
      ticket.additionalNotes ||
      ticket.note ||
      embedded.cancellationNotes ||
      embedded.additionalNotes ||
      ''
  ).trim();
  const summary = getCancellationFeedbackText(ticket, '');

  if (!reasons.length && !notes && !summary && !(forceShow || isCancelled)) return null;

  return (
    <section
      className={`rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-red-950 ${className}`.trim()}
    >
      <p className="text-xs font-black uppercase tracking-wide text-red-600">{title}</p>
      <p className="mt-1 text-sm font-semibold text-red-900">
        These are the fields staff marked as incorrect, and any notes they left for you.
      </p>

      {reasons.length ? (
        <div className="mt-3">
          <p className="text-xs font-black uppercase tracking-wide text-red-600">
            Incorrect fields
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black text-red-700"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-red-900">{emptyMessage}</p>
      )}

      <div className="mt-4 rounded-xl border border-red-200 bg-white p-3">
        <p className="text-xs font-black uppercase tracking-wide text-red-600">
          Notes from admin / operator
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">
          {notes || summary || 'No additional notes were provided.'}
        </p>
      </div>
    </section>
  );
}
