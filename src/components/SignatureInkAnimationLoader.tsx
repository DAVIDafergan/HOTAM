"use client";

import { useEffect, useState, type ComponentType } from 'react';

const PLACEHOLDER = <div aria-hidden="true" className="w-full max-w-2xl mx-auto h-32 md:h-40" />;

// Manual client-only lazy load instead of next/dynamic(..., { ssr: false }):
// that pattern left the page permanently stuck on its Suspense fallback in
// production (silent hydration stall, no console error, reproduced on every
// fresh render). A plain useEffect + dynamic import() sidesteps React.lazy /
// Suspense entirely while still code-splitting the heavy three.js bundle
// away from the initial page load, so it can't compete with the LCP element.
export default function SignatureInkAnimationLoader() {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@/components/SignatureInkAnimation').then((mod) => {
      if (!cancelled) setComponent(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Component) return PLACEHOLDER;
  return <Component />;
}
