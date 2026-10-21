'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Barely-there ambient light: warm parchment and gold radial gradients drifting on long
 * (26–40s) loops behind a section. The gradients are soft by construction (no CSS blur
 * filter) and only `transform` animates, so the compositor does the work. The loops pause
 * while the section is off-screen or the tab is hidden; reduced motion leaves them static
 * (globals.css). Purely decorative: aria-hidden, pointer-events none.
 */
export function AmbientBackdrop({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = true;
    const apply = () => {
      if (onScreen && document.visibilityState === 'visible') el.removeAttribute('data-paused');
      else el.setAttribute('data-paused', '');
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      apply();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={cn('ambient', className)}>
      <span className="ambient-blob ambient-a" />
      <span className="ambient-blob ambient-b" />
      <span className="ambient-blob ambient-c" />
    </div>
  );
}
