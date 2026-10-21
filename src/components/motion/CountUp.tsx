'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts a number up once, the first time it scrolls into view (1.4s, expo-out).
 * The final value is server-rendered and also reserves the width (an invisible copy), so
 * there is no layout shift and no-JS / reduced-motion visitors simply see the number.
 * Non-numeric values (e.g. "—") are rendered as-is.
 */
export function CountUp({
  value,
  decimals,
  duration = 1400,
  className,
}: {
  value: number | string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const target = typeof value === 'number' ? value : Number(value);
  const numeric = value !== '' && value !== null && Number.isFinite(target);
  const places = decimals ?? (numeric ? (String(value).split('.')[1]?.length ?? 0) : 0);
  const format = (n: number) => n.toLocaleString('he-IL', { minimumFractionDigits: places, maximumFractionDigits: places });
  const finalText = numeric ? format(target) : String(value);

  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !numeric || target === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(2, -10 * t); // expo out
          setShown(t >= 1 ? null : format(target * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setShown(format(0));
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, numeric, duration, places]);

  return (
    <span ref={ref} className={`relative inline-grid tabular-nums ${className ?? ''}`}>
      <span className="invisible col-start-1 row-start-1" aria-hidden="true">{finalText}</span>
      <span className="col-start-1 row-start-1 text-center" aria-hidden={shown !== null ? true : undefined}>
        {shown ?? finalText}
      </span>
      {shown !== null && <span className="sr-only">{finalText}</span>}
    </span>
  );
}
