import React from 'react';

/**
 * Reusable Card component.
 *
 * @param {Object} props
 * @param {string} [props.title] - Optional card title displayed at the top.
 * @param {React.ReactNode} props.children - Card body content.
 * @param {string} [props.className] - Additional Tailwind classes.
 * @param {string} [props.variant] - "primary" | "secondary" for background tint.
 * @returns {JSX.Element}
 */
const Card = ({ title, children, className = '', variant = 'primary' }) => {
  const bgClass = variant === 'secondary' ? 'bg-[var(--nqs-card-soft)]' : 'bg-[var(--nqs-card)]';
  const borderClass = 'border border-[var(--nqs-border)]';

  return (
    <div className={`rounded-lg shadow-sm ${bgClass} ${borderClass} ${className}`}>
      {title && (
        <div className="border-b border-[var(--nqs-border)] px-5 py-3 text-base font-semibold text-[var(--nqs-text)]">
          {title}
        </div>
      )}
      <div className="p-5 text-sm text-[var(--nqs-muted)]">{children}</div>
    </div>
  );
};

export default Card;
