'use client';

/**
 * @fileOverview Clean re-export hub for all Supabase-backed auth/data hooks.
 *
 * Application code should import from here instead of '@/firebase':
 *   import { useUser, useAuth, useFirestore, ... } from '@/lib/supabase-hooks'
 *
 * The implementations live in src/firebase/* but are fully backed by Supabase
 * (no Firebase SDK is used). This file provides a stable, non-Firebase-named
 * import path for application code.
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
