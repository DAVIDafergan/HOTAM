"use client";

import { useEffect, useRef, useState, type ComponentType } from 'react';

// Matches SignatureInkAnimation's own container size exactly, so swapping the placeholder
// for the real component never shifts layout (no CLS either way).
const PLACEHOLDER_CLASS = 'w-full max-w-2xl mx-auto h-32 md:h-40';

// Manual client-only lazy load instead of next/dynamic(..., { ssr: false }):
// that pattern left the page permanently stuck on its Suspense fallback in
// production (silent hydration stall, no console error, reproduced on every
// fresh render). A plain useEffect + dynamic import() sidesteps React.lazy /
// Suspense entirely while still code-splitting the heavy three.js bundle
// away from the initial page load, so it can't compete with the LCP element.
//
// That import() used to fire unconditionally on mount — since this section sits below the
// fold, every homepage load paid three.js's full parse/init cost (~180KB gzip, WebGL context
// + shader compilation) within seconds, whether or not the visitor ever scrolled there. Now
// gated behind an IntersectionObserver on the placeholder itself, with a generous rootMargin
// so the fetch starts a little before the section is actually visible (no visible loading
// gap when it scrolls into view) instead of only once it's fully on-screen.
export default function SignatureInkAnimationLoader() {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        import('@/components/SignatureInkAnimation').then((mod) => {
          if (!cancelled) setComponent(() => mod.default);
        });
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  if (!Component) return <div ref={placeholderRef} aria-hidden="true" className={PLACEHOLDER_CLASS} />;
  return <Component />;
}
