import React from 'react';

function BrandLogo({ className = '' }) {
  return (
    <span className={`nqs-brand-logo ${className}`.trim()} aria-hidden="true">
      NQ
    </span>
  );
}

export default BrandLogo;
