'use client';

import { useState, useEffect, useRef } from 'react';
import { errorEmitter } from '@/lib/error-emitter';
import { DatabasePermissionError } from '@/lib/errors';
import { transformRow, type SupabaseDocRef } from '@/lib/supabase-compat';
import type { RealtimeChannel } from '@supabase/supabase-js';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

// Columns added by docs/add-seller-types-migration.sql. If a read runs before that migration
// (undefined column), it's retried without them so the seller's dashboard keeps working.
const POST_MIGRATION_SELLER_FIELDS = ['seller_type', 'stam_upgrade_status'];
const UNDEFINED_COLUMN_CODE = '42703';

const SAFE_CLIENT_FIELDS: Record<string, string> = {
  sellers: [
    'id',
    'email',
    'first_name',
    'last_name',
    'city',
    'address',
    'phone',
    'notes',
    'age',
    'profile_image',
    'is_approved',
    'created_at',
    'favorite_product_ids',
    'script_types',
    'script_level',
    'experience_years',
    'writing_samples',
    'torah_study_frequency',
    'mikveh_frequency',
    'has_scribe_certificate',
    'certificate_url',
    'marital_status',
    'notification_email',
    'notification_sms',
    'notification_voice',
    'seller_type',
    'stam_upgrade_status',
  ].join(', '),
  customers: [
    'id',
    'first_name',
    'last_name',
    'phone',
    'address',
    'favorite_product_ids',
    'created_at',
    'notif_msg_email',
    'notif_status_email',
  ].join(', '),
  products: [
    'id',
    'product_type',
    'sub_type',
    'script_type',
    'script_level',
    'description',
    'price',
    'images',
    'quantity',
    'delivery_type',
    'delivery_area',
    'delivery_fee',
    'delivery_time',
    'pickup_address',
    'seller_id',
    'parchment_size',
    'proofreading_level',
    'created_at',
  ].join(', '),
};

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  /** true once the initial fetch has completed (data may still be null for non-existent rows) */
  isLoaded: boolean;
  error: Error | null;
}

/**
 * Subscribe to a single Supabase row in real-time.
 *
 * Accepts a SupabaseDocRef created by the doc() compat helper.
 * Must be memoized with useMemoStable() to ensure referential stability.
 */
export function useDoc<T = any>(
  memoizedDocRef: (SupabaseDocRef & { __memo?: boolean }) | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const docRefRef = useRef(memoizedDocRef);
  docRefRef.current = memoizedDocRef;

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setIsLoaded(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        const table = docRefRef.current!.table;
        const fields = SAFE_CLIENT_FIELDS[table] || '*';
        const readRow = (columns: string) => docRefRef.current!.client
          .from(table)
          .select(columns)
          .eq('id', docRefRef.current!.id)
          .maybeSingle();
        let { data: row, error: qError } = await readRow(fields);
        if (qError?.code === UNDEFINED_COLUMN_CODE && table === 'sellers') {
          const legacyFields = fields.split(', ').filter((f) => !POST_MIGRATION_SELLER_FIELDS.includes(f)).join(', ');
          ({ data: row, error: qError } = await readRow(legacyFields));
        }

        if (!isMounted) return;

        if (qError) throw qError;

        setData(row ? ({ ...transformRow(row as any), id: String((row as any).id) } as WithId<T>) : null);
        setError(null);
        setIsLoading(false);
        setIsLoaded(true);
      } catch (err: any) {
        if (!isMounted) return;
        console.error(
          `[useDoc] Supabase error on table '${docRefRef.current?.table}' id '${docRefRef.current?.id}':`,
          err?.message ?? err,
        );
        const contextualError = new DatabasePermissionError({
          operation: 'get',
          path: docRefRef.current?.path ?? 'unknown',
        });
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        setIsLoaded(true);
        errorEmitter.emit('permission-error', contextualError);
      }
    };

    setIsLoading(true);
    setIsLoaded(false);
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

  return { data, isLoading, isLoaded, error };
}
