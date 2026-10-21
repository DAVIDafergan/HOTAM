'use client';

import React, { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

// One shared observer for every revealed block on the page.
let sharedObserver: IntersectionObserver | null = null;
function observer() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-reveal', 'shown');
          sharedObserver?.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
  }
  return sharedObserver;
}

/**
 * Fade-and-rise reveal (plus the eyebrow's gold hairline drawing in) the first time a block
 * scrolls into view. Server HTML is fully visible; after hydration only blocks that start
 * below the fold are set to "pending", so above-the-fold content never waits for JS and
 * nothing shifts layout (transform/opacity only — see [data-reveal] in globals.css).
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
  'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const Element = Tag as 'div';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on screen
    el.setAttribute('data-reveal', 'pending');
    const io = observer();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <Element
      ref={ref as React.RefObject<HTMLDivElement>}
      data-reveal="shown"
      className={className}
      style={delay ? { ...style, ['--reveal-delay' as string]: `${delay}ms` } : style}
      {...rest}
    >
      {children}
    </Element>
  );
}
