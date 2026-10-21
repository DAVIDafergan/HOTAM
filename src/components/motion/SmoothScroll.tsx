'use client';

import { useEffect } from 'react';

/**
 * Inertial smooth scrolling (Lenis) for desktop mouse/trackpad users only.
 *
 * - Never loaded on touch devices or with prefers-reduced-motion: the module is imported
 *   lazily, after those checks, so phones never download it.
 * - Scroll position stays native (window.scrollY), so position: sticky/fixed bars, framer
 *   useScroll and IntersectionObserver keep working unchanged.
 * - Radix dialogs/sheets lock scrolling by tagging <body data-scroll-locked>; Lenis is
 *   paused for exactly that time, and wheel events inside dialogs, popovers, menus and any
 *   [data-lenis-prevent] element scroll natively.
 * - Same-page anchor links (e.g. "#how-it-works") glide to their target below the navbar.
 */
export function SmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return;

    let disposed = false;
    let lenis: import('lenis').default | null = null;
    let raf = 0;
    let lockObserver: MutationObserver | null = null;

    import('lenis').then(({ default: Lenis }) => {
      if (disposed) return;
      lenis = new Lenis({
        lerp: 0.085,
        wheelMultiplier: 0.95,
        smoothWheel: true,
        syncTouch: false,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
        // Offset comes from each target's own scroll-margin-top (e.g. scroll-mt-20), as with native anchors.
        anchors: true,
        prevent: (node) =>
          !!node.closest?.(
            '[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-radix-scroll-area-viewport], [data-lenis-prevent]',
          ),
      });

      const loop = (time: number) => {
        lenis?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const syncLock = () => {
        if (!lenis) return;
        if (document.body.hasAttribute('data-scroll-locked')) lenis.stop();
        else lenis.start();
      };
      lockObserver = new MutationObserver(syncLock);
      lockObserver.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
      syncLock();
    });

    // Turning on reduced motion (or switching to touch) mid-session drops back to native.
    const teardown = () => {
      if (!fine.matches || reduced.matches) {
        cancelAnimationFrame(raf);
        lockObserver?.disconnect();
        lenis?.destroy();
        lenis = null;
      }
    };
    reduced.addEventListener('change', teardown);
    fine.addEventListener('change', teardown);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      lockObserver?.disconnect();
      lenis?.destroy();
      reduced.removeEventListener('change', teardown);
      fine.removeEventListener('change', teardown);
    };
  }, []);

  return null;
}
