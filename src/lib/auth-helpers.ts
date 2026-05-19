'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthProxy } from '@/lib/app-provider';

type AuthLike = SupabaseClient | AuthProxy;

function getClient(auth: AuthLike): SupabaseClient {
  if ('_client' in auth) return (auth as AuthProxy)._client;
  return auth as SupabaseClient;
}

export interface SignUpMetadata {
  role?: 'customer' | 'seller' | 'admin';
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

async function ensureEmailNotRegistered(auth: AuthLike, email: string): Promise<void> {
  const client = getClient(auth);
  const normalizedEmail = email.trim().toLowerCase();

  const [customerResult, sellerResult, adminResult] = await Promise.all([
    client.from('customers').select('id', { count: 'exact', head: true }).eq('email', normalizedEmail),
    client.from('sellers').select('id', { count: 'exact', head: true }).eq('email', normalizedEmail),
    client.from('admins').select('id', { count: 'exact', head: true }).eq('email', normalizedEmail),
  ]);

  if (customerResult.error || sellerResult.error || adminResult.error) {
    const error = customerResult.error ?? sellerResult.error ?? adminResult.error;
    throw new Error(error?.message ?? 'Failed to validate email availability');
  }

  const emailExists =
    (customerResult.count ?? 0) > 0 ||
    (sellerResult.count ?? 0) > 0 ||
    (adminResult.count ?? 0) > 0;

  if (emailExists) {
    const mappedError: any = new Error('User already exists');
    mappedError.code = 'auth/email-already-in-use';
    throw mappedError;
  }
}

/** Initiate email/password sign-up. */
export function initiateEmailSignUp(
  auth: AuthLike,
  email: string,
  password: string,
  metadata?: SignUpMetadata,
) {
  const normalizedEmail = email.trim().toLowerCase();

  return ensureEmailNotRegistered(auth, normalizedEmail).then(() =>
    getClient(auth).auth.signUp({
      email: normalizedEmail,
      password,
      options: metadata ? { data: metadata } : undefined,
    }).then(({ data, error }) => {
      if (error) {
        const mappedError: any = new Error(error.message);
        if (error.message.toLowerCase().includes('already registered')) {
          mappedError.code = 'auth/email-already-in-use';
        } else {
          mappedError.code = 'auth/unknown';
        }
        throw mappedError;
      }
      return data;
    }),
  );
}

/** Initiate email/password sign-in. */
export function initiateEmailSignIn(auth: AuthLike, email: string, password: string) {
  return getClient(auth).auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error) {
      const mappedError: any = new Error(error.message);
      mappedError.code = 'auth/invalid-credential';
      throw mappedError;
    }
    return data;
  });
}

/** Initiate Google OAuth sign-in (redirect flow). */
export function initiateGoogleSignIn(auth: AuthLike) {
  return getClient(auth).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
  }).then(({ data, error }) => {
    if (error) {
      const mappedError: any = new Error(error.message);
      mappedError.code = 'auth/popup-closed-by-user';
      throw mappedError;
    }
    return data;
  });
}

/** Initiate password reset email. */
export function initiatePasswordReset(auth: AuthLike, email: string) {
  return getClient(auth).auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
  }).then(({ error }) => {
    if (error) throw new Error(error.message);
  });
}

/** @deprecated Anonymous sign-in is not supported with Supabase. */
export function initiateAnonymousSignIn(_auth: AuthLike): never {
  throw new Error('Anonymous sign-in is not supported with Supabase.');
}
