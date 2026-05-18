'use client';

import React, {
  DependencyList,
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useEffect,
} from 'react';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { ErrorBoundaryListener } from '@/components/ErrorBoundaryListener';
import { useDoc } from '@/lib/use-doc';
import { doc } from '@/lib/supabase-compat';

const SELLER_FIELD_KEYS = [
  'first_name',
  'last_name',
  'phone',
  'address',
  'age',
  'marital_status',
  'business_type',
  'business_id',
  'business_name',
  'bank_name',
  'bank_branch',
  'bank_account_number',
  'has_scribe_certificate',
  'certificate_url',
  'torah_study_frequency',
  'mikveh_frequency',
  'notes',
  'experience_years',
  'script_level',
  'script_types',
  'writing_samples',
  'profile_image',
] as const;

function pickSellerFields(source: unknown): Record<string, unknown> {
  if (!source || typeof source !== 'object') return {};
  const record = source as Record<string, unknown>;
  return SELLER_FIELD_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

// ─── Auth-compatible user shape ───────────────────────────────────────────────

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  /** Role from user_metadata set at signup: 'customer' | 'seller' | 'admin' */
  role: 'customer' | 'seller' | 'admin' | null;
  /** Raw Supabase user for advanced use-cases */
  _raw: SupabaseUser;
}

function toAppUser(u: SupabaseUser): AppUser {
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName:
      u.user_metadata?.full_name ??
      u.user_metadata?.name ??
      (u.email ? u.email.split('@')[0] : null),
    photoURL: u.user_metadata?.avatar_url ?? null,
    emailVerified: u.email_confirmed_at != null,
    phoneNumber: u.phone ?? null,
    role: (u.user_metadata?.role as 'customer' | 'seller' | 'admin') ?? null,
    _raw: u,
  };
}

// ─── Auth proxy ───────────────────────────────────────────────────────────────

export interface AuthProxy {
  signOut(): Promise<void>;
  /** The underlying Supabase client — passed to initiateEmailSignIn() etc. */
  _client: SupabaseClient;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ProviderProps {
  children: ReactNode;
  client: SupabaseClient;
}

export interface AppContextState {
  areServicesAvailable: boolean;
  /** The Supabase client — used everywhere as `db` (passed to collection/doc/query) */
  client: SupabaseClient | null;
  /** Auth proxy used by Navbar's signOut() and the auth helpers */
  auth: AuthProxy | null;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
  profile: any | null;
  isProfileLoading: boolean;
}

export interface AppServicesAndUser {
  client: SupabaseClient;
  auth: AuthProxy;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
  profile: any | null;
  isProfileLoading: boolean;
}

export const AppContext = createContext<AppContextState | undefined>(undefined);

export const AppProvider: React.FC<ProviderProps> = ({ children, client }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    // Hydrate from existing session immediately
    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toAppUser(session.user) : null);
      setIsUserLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAppUser(session.user) : null);
      setIsUserLoading(false);
      setUserError(null);

      // After Google OAuth redirect, check if a pending seller registration exists
      if (_event === 'SIGNED_IN' && session?.user && typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('hotam_pending_customer_name');
        if (raw) {
          try {
            const pending = JSON.parse(raw) as Record<string, unknown>;
            if (pending.role === 'seller') {
              const pendingSellerProfileRaw = window.localStorage.getItem('pendingSellerProfile');
              let pendingSellerProfile: Record<string, unknown> = {};
              if (pendingSellerProfileRaw) {
                try {
                  pendingSellerProfile = JSON.parse(pendingSellerProfileRaw) as Record<string, unknown>;
                } catch (err) {
                  console.error('[auth] failed to parse pending seller profile:', err);
                }
              }

              const pendingBasic = pickSellerFields(pending);
              const pendingProfile = pickSellerFields(pendingSellerProfile);
              const firstName =
                (pendingProfile.first_name as string | undefined) ??
                (pendingBasic.first_name as string | undefined) ??
                (session.user.user_metadata?.first_name as string | undefined) ??
                null;
              const lastName =
                (pendingProfile.last_name as string | undefined) ??
                (pendingBasic.last_name as string | undefined) ??
                (session.user.user_metadata?.last_name as string | undefined) ??
                null;
              const payload = {
                ...pendingBasic,
                ...pendingProfile,
                id: session.user.id,
                email: session.user.email ?? null,
                first_name: firstName,
                last_name: lastName,
              };

              void (async () => {
                try {
                  const response = await fetch('/api/register-seller', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(payload),
                  });
                  if (!response.ok) {
                    const bodyText = await response.text();
                    console.error('[auth] register-seller failed:', response.status, bodyText);
                  }
                } catch (err) {
                  console.error('[auth] register-seller error:', err);
                } finally {
                  window.localStorage.removeItem('hotam_pending_customer_name');
                }
              })();
            }
          } catch (err) {
            console.error('[auth] failed to parse pending customer name:', err);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [client]);

  // ── Profile fetching (role-based) ─────────────────────────────────────────
  const customerRef = useMemoStable(() => {
    if (!user?.uid || user?.role === 'seller' || user?.role === 'admin') return null;
    return doc(client, 'customers', user.uid);
  }, [user?.uid, user?.role]);

  const { data: customerData, isLoading: isCustLoading } = useDoc<any>(customerRef);

  const sellerRef = useMemoStable(() => {
    if (!user?.uid || (user?.role !== 'seller' && user?.role !== 'admin')) return null;
    return doc(client, 'sellers', user.uid);
  }, [user?.uid, user?.role]);

  const { data: sellerData, isLoading: isSellLoading } = useDoc<any>(sellerRef);

  const profile = useMemo(() => {
    if (sellerData) return { ...sellerData, role: 'seller' };
    if (customerData) return { ...customerData, role: 'customer' };
    return null;
  }, [customerData, sellerData]);

  const isProfileLoading = isCustLoading || isSellLoading;

  // ── Auth proxy ─────────────────────────────────────────────────────────────
  const auth: AuthProxy = useMemo(() => ({
    signOut: async () => {
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.warn('[auth] signOut error (ignored):', err);
      }
    },
    _client: client,
  }), [client]);

  const contextValue = useMemo((): AppContextState => ({
    areServicesAvailable: true,
    client,
    auth,
    user,
    isUserLoading,
    userError,
    profile,
    isProfileLoading,
  }), [client, auth, user, isUserLoading, userError, profile, isProfileLoading]);

  return (
    <AppContext.Provider value={contextValue}>
      <ErrorBoundaryListener />
      {children}
    </AppContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useApp = (): AppServicesAndUser => {
  const context = useContext(AppContext);
  if (!context || !context.areServicesAvailable) {
    throw new Error('useApp must be used within an AppProvider.');
  }
  return {
    client: context.client!,
    auth: context.auth!,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
    profile: context.profile,
    isProfileLoading: context.isProfileLoading,
  };
};

export const useAuth = () => useApp().auth;
export const useSupabaseClient = () => useApp().client;
export const useUser = () => {
  const { user, isUserLoading, userError } = useApp();
  return { user, isUserLoading, userError };
};

export function useMemoStable<T>(factory: () => T, deps: DependencyList): T & { __memo?: boolean } {
  const memoized = useMemo(factory, deps) as any;
  if (memoized && typeof memoized === 'object') {
    memoized.__memo = true;
  }
  return memoized;
}
