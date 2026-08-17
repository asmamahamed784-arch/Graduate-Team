import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** Animates a numeric value smoothly from 0 on mount, and toward `value` on every later change. */
export function useCountUp(value, duration = 900) {
  const numericTarget = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(numericTarget);
      fromRef.current = numericTarget;
      return undefined;
    }

    const from = fromRef.current;
    const delta = numericTarget - from;
    if (!delta) return undefined;

    const lo = Math.min(from, numericTarget);
    const hi = Math.max(from, numericTarget);
    const start = performance.now();
    let lastValue = from;
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const next = progress >= 1 ? numericTarget : Math.min(hi, Math.max(lo, from + delta * eased));
      lastValue = next;
      setDisplay(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = numericTarget;
      }
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      // Hand off the in-progress value so an interrupted animation (e.g. React
      // StrictMode's dev-only double-effect) resumes smoothly instead of
      // restarting from the original starting point.
      fromRef.current = lastValue;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericTarget, duration]);

  return Math.round(display);
}

export default useCountUp;
