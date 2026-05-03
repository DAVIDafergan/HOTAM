'use client';

import { supabase } from '@/lib/supabase';

/**
 * Returns the singleton Supabase client.
 * Kept for compatibility – previously returned { firebaseApp, auth, firestore }.
 */
export function initializeFirebase() {
  return { client: supabase };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
