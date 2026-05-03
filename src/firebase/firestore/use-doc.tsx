'use client';

import { useState, useEffect, useRef } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { transformRow, type SupabaseDocRef } from '@/lib/supabase-compat';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a single Supabase row in real-time.
 *
 * Accepts a SupabaseDocRef created by the doc() compat helper.
 * Must be memoized with useMemoFirebase() (same contract as the old Firebase hook).
 */
export function useDoc<T = any>(
  memoizedDocRef: (SupabaseDocRef & { __memo?: boolean }) | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const docRefRef = useRef(memoizedDocRef);
  docRefRef.current = memoizedDocRef;

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        const { data: row, error: qError } = await docRefRef.current!.client
          .from(docRefRef.current!.table)
          .select('*')
          .eq('id', docRefRef.current!.id)
          .maybeSingle();

        if (!isMounted) return;

        if (qError) throw qError;

        setData(row ? ({ ...transformRow(row), id: String(row.id) } as WithId<T>) : null);
        setError(null);
        setIsLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: docRefRef.current?.path ?? 'unknown',
        });
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        errorEmitter.emit('permission-error', contextualError);
      }
    };

    setIsLoading(true);
    fetchData();

    // Real-time subscription for this specific row
    const channelName = `doc:${memoizedDocRef.table}:${memoizedDocRef.id}`;
    let channel: RealtimeChannel | null = null;
    try {
      channel = memoizedDocRef.client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: memoizedDocRef.table,
            filter: `id=eq.${memoizedDocRef.id}`,
          },
          () => { fetchData(); },
        )
        .subscribe();
    } catch {
      // Realtime not available — silent fallback
    }

    return () => {
      isMounted = false;
      if (channel) {
        try { memoizedDocRef.client.removeChannel(channel); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedDocRef]);

  return { data, isLoading, error };
}