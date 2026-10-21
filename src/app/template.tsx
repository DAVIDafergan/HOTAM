'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Browser-only flag, set after the first page has mounted: the initial (server-rendered)
// page never fades in — it must paint immediately for LCP — only later client-side
// navigations do. (Never set on the server, so SSR output is always un-animated.)
let hasMountedFirstPage = false;

/**
 * Route transition: re-mounted by the App Router on every navigation. A 220ms opacity-only
 * fade (no transform, which would break position: fixed descendants such as the navbar and
 * the sticky purchase bar). Non-blocking: the new page is interactive immediately.
 * Reduced motion: the global rule in globals.css collapses the animation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animate] = useState(() => typeof window !== 'undefined' && hasMountedFirstPage && !pathname?.startsWith('/admin'));
  useEffect(() => {
    hasMountedFirstPage = true;
  }, []);
  return <div className={animate ? 'page-enter' : undefined}>{children}</div>;
}
