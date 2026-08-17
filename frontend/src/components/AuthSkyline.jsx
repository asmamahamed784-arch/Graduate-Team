import React from 'react';

/** Decorative city skyline anchored to the bottom of an auth page card. */
const AuthSkyline = ({ className = 'text-blue-100' }) => (
  <svg
    className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full ${className}`}
    viewBox="0 0 400 64"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <rect x="0" y="30" width="40" height="34" fill="currentColor" />
    <rect x="44" y="18" width="34" height="46" fill="currentColor" />
    <rect x="82" y="36" width="28" height="28" fill="currentColor" />
    <path d="M118 64V38a20 20 0 0 1 40 0v26z" fill="currentColor" />
    <rect x="135" y="12" width="6" height="18" fill="currentColor" />
    <rect x="166" y="24" width="32" height="40" fill="currentColor" />
    <rect x="202" y="38" width="26" height="26" fill="currentColor" />
    <rect x="232" y="20" width="36" height="44" fill="currentColor" />
    <rect x="272" y="34" width="30" height="30" fill="currentColor" />
    <rect x="306" y="16" width="38" height="48" fill="currentColor" />
    <rect x="348" y="32" width="32" height="32" fill="currentColor" />
  </svg>
);

export default AuthSkyline;
