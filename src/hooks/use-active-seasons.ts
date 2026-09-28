'use client';

import { useEffect, useState } from 'react';
import { getActiveSeasons, type SeasonKey } from '@/lib/product-catalog';

/**
 * The seasons whose window is open today (in the viewer's browser), or null before mount.
 *
 * Decided after mount rather than during render: pages are server-rendered and cached, so a
 * date computed on the server could be stale across a season boundary (and would mismatch
 * on hydration). Starts null, so the "seasonal" badge only ever appears client-side.
 */
export function useActiveSeasons(): ReadonlySet<SeasonKey> | null {
  const [active, setActive] = useState<ReadonlySet<SeasonKey> | null>(null);
  useEffect(() => {
    setActive(new Set(getActiveSeasons().map((season) => season.key)));
  }, []);
  return active;
}
