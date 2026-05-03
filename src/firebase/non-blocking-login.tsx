'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Initiate email/password sign-up. */
export function initiateEmailSignUp(client: SupabaseClient, email: string, password: string) {
  return client.auth.signUp({ email, password }).then(({ data, error }) => {
    if (error) {
      // Map Supabase error codes to Firebase-compatible error codes so existing
      // error-handling UI strings keep working.
      const mappedError: any = new Error(error.message);
      if (error.message.toLowerCase().includes('already registered')) {
        mappedError.code = 'auth/email-already-in-use';
      } else {
        mappedError.code = 'auth/unknown';
      }
      throw mappedError;
    }
    return data;
  });
}

/** Initiate email/password sign-in. */
export function initiateEmailSignIn(client: SupabaseClient, email: string, password: string) {
  return client.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error) {
      const mappedError: any = new Error(error.message);
      mappedError.code = 'auth/invalid-credential';
      throw mappedError;
    }
    return data;
  });
}

/** Initiate Google OAuth sign-in (redirect flow). */
export function initiateGoogleSignIn(client: SupabaseClient) {
  return client.auth.signInWithOAuth({
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
export function initiatePasswordReset(client: SupabaseClient, email: string) {
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
  }).then(({ error }) => {
    if (error) throw new Error(error.message);
  });
}

/** @deprecated Anonymous sign-in is not used in this app. */
export function initiateAnonymousSignIn(_client: SupabaseClient) {
  return Promise.reject(new Error('Anonymous sign-in is not supported with Supabase.'));
}
