'use client';
import { useEffect, type RefObject } from 'react';

/**
 * Pins a scroll container's height so its bottom lands exactly at the viewport
 * bottom, instead of relying on a hardcoded `calc(100vh - Npx)` guess. This keeps
 * the container's horizontal scrollbar always in view (no scrolling through 100
 * rows to reach it) and works no matter how tall the header / filter row gets.
 *
 * Recalculates on window resize and whenever `deps` change (e.g. after data loads
 * or filters toggle, which can change the row above the table).
 */
export function useFillViewportHeight(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
  bottomGap = 12,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const top = el.getBoundingClientRect().top;
      const h = Math.max(160, window.innerHeight - top - bottomGap);
      el.style.maxHeight = `${h}px`;
    };

    // Run after layout settles so getBoundingClientRect().top is accurate.
    const raf = requestAnimationFrame(apply);
    window.addEventListener('resize', apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
