'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthProxy } from '@/lib/app-provider';

type AuthLike = SupabaseClient | AuthProxy;

function getClient(auth: AuthLike): SupabaseClient {
  if ('_client' in auth) return (auth as AuthProxy)._client;
  return auth as SupabaseClient;
}

function getBaseOrigin(): string | undefined {
  if (typeof window !== 'undefined' && window.location.origin) return window.location.origin;
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return envSiteUrl && /^https?:\/\//i.test(envSiteUrl) ? envSiteUrl.replace(/\/+$/, '') : undefined;
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
  const baseOrigin = getBaseOrigin();

  return ensureEmailNotRegistered(auth, normalizedEmail).then(() =>
    getClient(auth).auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        ...(metadata ? { data: metadata } : {}),
        ...(baseOrigin ? { emailRedirectTo: `${baseOrigin}/login` } : {}),
      },
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
function buildOAuthRedirectTo(redirectPath?: string): string | undefined {
  const baseOrigin = getBaseOrigin();
  const origin =
    baseOrigin ||
    (typeof window !== 'undefined' && window.location.origin ? window.location.origin : undefined);
  if (!origin) return undefined;
  if (!redirectPath) return origin;
  const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
  return `${origin}${normalizedPath}`;
}

export function initiateGoogleSignIn(auth: AuthLike, redirectPath?: string) {
  return getClient(auth).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: buildOAuthRedirectTo(redirectPath) },
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
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  const baseOrigin = getBaseOrigin();
  const redirectTo = baseOrigin ? `${baseOrigin}/reset-password` : undefined;

  const serverResetRequest =
    typeof window !== 'undefined'
      ? fetch('/api/auth/password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
        }).then((response) => {
          if (!response.ok) throw new Error('Password reset API failed');
          return response.json() as Promise<{ ok?: boolean }>;
        }).then((body) => body.ok === true)
      : Promise.resolve(false);

  return serverResetRequest.then(async (sentByServer) => {
    if (sentByServer) return;

    return getClient(auth).auth.resetPasswordForEmail(normalizedEmail, { redirectTo }).then(async ({ error }) => {
      if (!error) return;

      const msg = error.message?.toLowerCase() ?? '';
      const isRedirectIssue =
        msg.includes('redirect') ||
        msg.includes('invalid') ||
        msg.includes('not allowed') ||
        msg.includes('url');

      if (isRedirectIssue) {
        const fallback = await getClient(auth).auth.resetPasswordForEmail(normalizedEmail);
        if (fallback.error) throw new Error(fallback.error.message);
        return;
      }

      throw new Error(error.message);
    });
  });
}

/** Resend signup confirmation email. */
export function resendEmailConfirmation(auth: AuthLike, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  const baseOrigin = getBaseOrigin();

  return getClient(auth).auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: baseOrigin ? { emailRedirectTo: `${baseOrigin}/login` } : undefined,
  }).then(({ error }) => {
    if (error) throw new Error(error.message);
  });
}

/** @deprecated Anonymous sign-in is not supported with Supabase. */
export function initiateAnonymousSignIn(_auth: AuthLike): never {
  throw new Error('Anonymous sign-in is not supported with Supabase.');
}
