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
    let wake: (() => void) | null = null;
    const WAKE_EVENTS = ['wheel', 'keydown', 'click', 'pointerdown'] as const;
    const unbindWake = () => {
      if (wake) for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, { capture: true });
    };

    // Loaded once the page is idle, so it never competes with hydration for the main thread.
    const load = () => import('lenis').then(({ default: Lenis }) => {
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

      // The frame loop only runs while Lenis is actually animating: an always-on rAF loop
      // would make the browser run a full main-thread frame on every vsync even when the page
      // is idle. Any input that can start a scroll (wheel, keys, anchor clicks) wakes it up.
      // Lenis advances by (time − previous time); feeding it a clock that only ticks while the
      // loop runs keeps the first frame after a pause from jumping straight to the target.
      let running = false;
      let clock = 0;
      let last = 0;
      const loop = (now: number) => {
        if (!lenis) return;
        clock += Math.min(Math.max(now - last, 0), 50);
        last = now;
        lenis.raf(clock);
        if (lenis.isScrolling) raf = requestAnimationFrame(loop);
        else running = false;
      };
      wake = () => {
        if (running || !lenis) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      };
      for (const type of WAKE_EVENTS) window.addEventListener(type, wake, { passive: true, capture: true });
      lenis.on('scroll', wake);

      const syncLock = () => {
        if (!lenis) return;
        if (document.body.hasAttribute('data-scroll-locked')) lenis.stop();
        else lenis.start();
      };
      lockObserver = new MutationObserver(syncLock);
      lockObserver.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
      syncLock();
    });
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idleId = hasIdle ? window.requestIdleCallback(() => void load(), { timeout: 3000 }) : window.setTimeout(() => void load(), 1500);

    // Turning on reduced motion (or switching to touch) mid-session drops back to native.
    const teardown = () => {
      if (!fine.matches || reduced.matches) {
        cancelAnimationFrame(raf);
        unbindWake();
        lockObserver?.disconnect();
        lenis?.destroy();
        lenis = null;
      }
    };
    reduced.addEventListener('change', teardown);
    fine.addEventListener('change', teardown);

    return () => {
      disposed = true;
      if (hasIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      cancelAnimationFrame(raf);
      unbindWake();
      lockObserver?.disconnect();
      lenis?.destroy();
      reduced.removeEventListener('change', teardown);
      fine.removeEventListener('change', teardown);
    };
  }, []);

  return null;
}
