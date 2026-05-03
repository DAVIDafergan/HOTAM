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


