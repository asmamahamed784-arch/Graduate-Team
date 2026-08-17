import React from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useTheme } from '../hooks';
import { NQS_FEEDBACK_TOAST_ID } from '../utils/feedbackToast';

let feedbackToastPatched = false;

/** Force every toast to share one slot so the app never stacks 2 feedbacks. */
const patchSingleFeedbackToasts = () => {
  if (feedbackToastPatched) return;
  feedbackToastPatched = true;

  ['success', 'info', 'error', 'warning', 'warn'].forEach((type) => {
    if (typeof toast[type] !== 'function') return;
    const original = toast[type].bind(toast);
    toast[type] = (content, options = {}) => {
      const toastId = options.toastId ?? NQS_FEEDBACK_TOAST_ID;
      // Replace any existing feedback toast so two never appear together.
      if (toast.isActive(toastId)) {
        toast.update(toastId, {
          render: content,
          type: type === 'warn' ? 'warning' : type,
          ...options,
          toastId,
        });
        return toastId;
      }
      return original(content, {
        ...options,
        toastId,
      });
    };
  });
};

patchSingleFeedbackToasts();

const ToastProvider = ({ children }) => {
  const { theme } = useTheme();

  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={1}
        theme={theme}
        toastClassName="nqs-toast"
      />
    </>
  );
};

export default ToastProvider;
