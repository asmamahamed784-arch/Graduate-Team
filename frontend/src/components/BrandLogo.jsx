import React from 'react';

const BRAND_MARK_SRC = '/images/brand/nqs-official-mark.png';

function BrandLogo({ className = '', full = false, size = 56 }) {
  if (full) {
    return (
      <span
        className={`nqs-brand-logo nqs-brand-logo-full ${className}`.trim()}
        role="img"
        aria-label="NQS National Queueing System"
      >
        <img
          className="nqs-brand-logo-img nqs-brand-emblem"
          src={BRAND_MARK_SRC}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size }}
          loading="eager"
          decoding="async"
        />
        <span className="nqs-brand-logo-text">
          <strong>NQS</strong>
          <small>National Queueing System</small>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`nqs-brand-logo nqs-brand-logo-mark ${className}`.trim()}
      aria-hidden="true"
    >
      <img
        className="nqs-brand-logo-img"
        src={BRAND_MARK_SRC}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        loading="eager"
        decoding="async"
      />
    </span>
  );
}

export default BrandLogo;
