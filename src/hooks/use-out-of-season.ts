'use client';

import { useEffect, useState } from 'react';
import { isSukkotSeason } from '@/lib/product-catalog';

/**
 * True when today (in the viewer's browser) is outside the Elul–Sukkot window.
 *
 * Decided after mount rather than during render: pages are server-rendered and cached, so a
 * date computed on the server could be stale across the season boundary (and would mismatch
 * on hydration). Starts false, so the "seasonal" badge only ever appears client-side.
 */
export function useOutOfSeason(): boolean {
  const [outOfSeason, setOutOfSeason] = useState(false);
  useEffect(() => {
    setOutOfSeason(!isSukkotSeason());
  }, []);
  return outOfSeason;
}
