'use client';

import { useState, useEffect, useRef } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { applyFilters, transformRow, type SupabaseQuery } from '@/lib/supabase-compat';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a Supabase table query in real-time.
 *
 * Accepts a SupabaseQuery descriptor created by the query() compat helper.
 * Must be memoized with useMemoFirebase() (same contract as the old Firebase hook).
 */
export function useCollection<T = any>(
  memoizedQuery: (SupabaseQuery & { __memo?: boolean }) | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Stable refs so the subscription callback always sees fresh values
  const queryRef = useRef(memoizedQuery);
  queryRef.current = memoizedQuery;

  useEffect(() => {
    if (!memoizedQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        const builder = applyFilters(
          queryRef.current!.client.from(queryRef.current!.table).select('*'),
          queryRef.current!,
        );
        const { data: rows, error: qError } = await (builder as any);

        if (!isMounted) return;
        if (qError) throw qError;

        const results = (rows ?? []).map((row: any) => ({
          ...transformRow(row),
          id: String(row.id),
        }));
        setData(results as WithId<T>[]);
        setError(null);
        setIsLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: queryRef.current?.path ?? queryRef.current?.table ?? 'unknown',
        });
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        errorEmitter.emit('permission-error', contextualError);
      }
    };

    setIsLoading(true);
    fetchData();

    // Real-time subscription — re-fetch on any change to the table
    const channelName = `collection:${memoizedQuery.table}:${JSON.stringify(memoizedQuery.filters)}`;
    let channel: RealtimeChannel | null = null;
    try {
      channel = memoizedQuery.client
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: memoizedQuery.table }, () => {
          fetchData();
        })
        .subscribe();
    } catch {
      // Realtime not available (e.g. missing env vars during SSR) — silent fallback
    }

    return () => {
      isMounted = false;
      if (channel) {
        try { memoizedQuery.client.removeChannel(channel); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedQuery]);

  return { data, isLoading, error };
}