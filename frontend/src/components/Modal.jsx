import React from 'react';
import { FiX } from 'react-icons/fi';

/**
 * Modal component
 * @param {boolean} isOpen - controls visibility
 * @param {function} onClose - callback to close the modal
 * @param {string|ReactNode} title - optional header title
 * @param {ReactNode} children - modal body content
 * @param {string} className - additional Tailwind classes for content container
 */
const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] px-4">
      <div className={`w-full max-w-lg rounded-lg border border-[var(--nqs-border)] bg-[var(--nqs-card)] shadow-lg ${className}`}>
        <div className="flex items-center justify-between border-b border-[var(--nqs-border)] px-5 py-3">
          {title && <h3 className="text-base font-semibold text-[var(--nqs-text)]">{title}</h3>}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--nqs-muted)] hover:bg-[var(--nqs-card-soft)] hover:text-[var(--nqs-text)]"
            aria-label="Close modal"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 text-sm text-[var(--nqs-muted)]">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
