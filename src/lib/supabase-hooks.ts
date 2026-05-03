'use client';

/**
 * @fileOverview Clean re-export of all Supabase-backed auth/data hooks.
 *
 * Import from here instead of '@/firebase' in application code:
 *   import { useUser, useAuth, useFirestore, ... } from '@/lib/supabase-hooks'
 */

export * from '@/firebase/provider';
export * from '@/firebase/client-provider';
export * from '@/firebase/firestore/use-doc';
export * from '@/firebase/firestore/use-collection';
export * from '@/firebase/non-blocking-updates';
export * from '@/firebase/non-blocking-login';
export * from '@/firebase/errors';
export * from '@/firebase/error-emitter';

// Semantic aliases — preferred names going forward
export { FirebaseClientProvider as SupabaseClientProvider } from '@/firebase/client-provider';
export { useFirestore as useSupabaseClient } from '@/firebase/provider';
