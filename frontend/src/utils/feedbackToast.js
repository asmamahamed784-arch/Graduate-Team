import { toast } from 'react-toastify';

/** One shared toast id so the whole app never stacks duplicate feedback. */
export const NQS_FEEDBACK_TOAST_ID = 'nqs-single-feedback';

/**
 * Submission acknowledgments already get a page-level success toast.
 * Socket/inbox copies of the same event should not fire a second toast.
 */
export const isAcknowledgmentNotification = (notification = {}) => {
  const title = String(notification.title || '').toLowerCase();
  const desc = String(
    notification.desc || notification.message || notification.body || ''
  ).toLowerCase();
  const haystack = `${title} ${desc}`;

  return (
    /\b(submitted|created successfully|booking successful|resubmitted|verified successfully)\b/.test(
      haystack
    ) ||
    /\byour .+ (request|appointment|booking).+submitted\b/.test(haystack)
  );
};

export const showAppFeedback = (message, type = 'success', options = {}) => {
  const fn =
    type === 'error'
      ? toast.error
      : type === 'info'
        ? toast.info
        : type === 'warning'
          ? toast.warning
          : toast.success;

  return fn(message, {
    toastId: NQS_FEEDBACK_TOAST_ID,
    ...options,
  });
};
