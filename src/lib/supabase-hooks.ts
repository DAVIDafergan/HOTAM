'use client';

/**
 * @fileOverview Re-export hub for all Supabase-backed auth/data hooks.
 *
 * Application code should import from here:
 *   import { useUser, useAuth, useSupabaseClient, ... } from '@/lib/supabase-hooks'
 */

export * from '@/lib/app-provider';
export * from '@/lib/supabase-client-provider';
export * from '@/lib/use-doc';
export * from '@/lib/use-collection';
export * from '@/lib/db-helpers';
export * from '@/lib/auth-helpers';
export * from '@/lib/errors';
export * from '@/lib/error-emitter';

// Backward-compatible aliases for old Firebase-named identifiers
export { useApp as useFirebase } from '@/lib/app-provider';
export { useSupabaseClient as useFirestore } from '@/lib/app-provider';
export { useMemoStable as useMemoFirebase } from '@/lib/app-provider';
export { SupabaseClientProvider as FirebaseClientProvider } from '@/lib/supabase-client-provider';
export { DatabasePermissionError as FirestorePermissionError } from '@/lib/errors';
