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
      u.user_metadata?.first_name ??
      (u.email ? u.email.split('@')[0] : null),
    photoURL: u.user_metadata?.avatar_url ?? null,
    emailVerified: u.email_confirmed_at != null,
    phoneNumber: u.phone ?? null,
    role: (u.user_metadata?.role as 'customer' | 'seller' | 'admin') ?? null,
    _raw: u,
  };
}

async function resolveAppUser(u: SupabaseUser, accessToken?: string | null): Promise<AppUser> {
  const baseUser = toAppUser(u);
  if (!accessToken) return baseUser;

  try {
    const response = await fetch('/api/auth/session-role', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!response.ok) return baseUser;

    const payload = await response.json().catch(() => null) as { role?: AppUser['role'] } | null;
    const resolvedRole = payload?.role;
    if (resolvedRole === 'customer' || resolvedRole === 'seller' || resolvedRole === 'admin') {
      return { ...baseUser, role: resolvedRole };
    }
  } catch (err) {
    console.error('[auth] role resolution error:', err);
  }

  return baseUser;
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
    let isCancelled = false;

    const setResolvedUserNonBlocking = (sourceUser: SupabaseUser, accessToken?: string | null) => {
      setUser(toAppUser(sourceUser));
      void resolveAppUser(sourceUser, accessToken)
        .then((resolvedUser) => {
          if (isCancelled) return;
          setUser((current) => (current?.uid === resolvedUser.uid ? resolvedUser : current));
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('[auth] deferred role resolution error:', err);
          }
        });
    };

    // Hydrate from existing session immediately without waiting for role API
    void client.auth.getSession()
      .then(({ data }) => {
        if (isCancelled) return;
        const session = data.session;
        const sessionUser = session?.user ?? null;
        if (!sessionUser) {
          setUser(null);
          setIsUserLoading(false);
          return;
        }

        setResolvedUserNonBlocking(sessionUser, session?.access_token);
        setIsUserLoading(false);

        void client.auth.getUser()
          .then(({ data: freshUserData }) => {
            if (isCancelled || !freshUserData.user) return;
            setResolvedUserNonBlocking(freshUserData.user, session?.access_token);
          })
          .catch((err) => {
            if (!isCancelled) {
              console.error('[auth] session hydration user refresh error:', err);
            }
          });
      })
      .catch((err) => {
        if (isCancelled) return;
        setUserError(err instanceof Error ? err : new Error('Unable to initialize auth session'));
        setIsUserLoading(false);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setResolvedUserNonBlocking(session.user, session.access_token);
        void client.auth.getUser()
          .then(({ data: freshUserData }) => {
            if (isCancelled || !freshUserData.user) return;
            setResolvedUserNonBlocking(freshUserData.user, session.access_token);
          })
          .catch((err) => {
            if (!isCancelled) {
              console.error('[auth] auth-state user refresh error:', err);
            }
          });
      } else {
        setUser(null);
      }
      setIsUserLoading(false);
      setUserError(null);

      // After sign-in/session restore, reconcile role/profile state.
      if ((_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') && session?.user && typeof window !== 'undefined') {
        const authToken = session.access_token;
        const userEmail = session.user.email ?? null;
        const normalizedUserEmail = userEmail?.trim().toLowerCase();
        const userMeta = (session.user.user_metadata ?? {}) as Record<string, any>;

        const registerSeller = async (payload: Record<string, unknown>, source: string) => {
          console.info('[auth] seller recovery start', { source, userId: session.user.id, event: _event });
          const response = await fetch('/api/register-seller', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + authToken,
            },
            body: JSON.stringify({ ...payload, recovery_source: source }),
          });
          if (!response.ok) {
            const bodyText = await response.text();
            throw new Error(`register-seller failed (${response.status}): ${bodyText}`);
          }
          console.info('[auth] seller recovery success', { source, userId: session.user.id, event: _event });
        };

        const isEmailVerified = session.user.email_confirmed_at != null;

        const flushPendingCustomerProfile = async () => {
          const rawPendingName = window.localStorage.getItem('hotam_pending_customer_name');
          if (rawPendingName) {
            try {
              const pending = JSON.parse(rawPendingName) as Record<string, unknown>;
              const role = typeof pending.role === 'string' ? pending.role : null;

              if (role === 'seller') {
                await registerSeller({
                  id: session.user.id,
                  email: userEmail,
                  first_name: typeof pending.first_name === 'string' ? pending.first_name : null,
                  last_name: typeof pending.last_name === 'string' ? pending.last_name : null,
                  is_email_verified: isEmailVerified,
                }, 'legacy-customer-cache');
                window.localStorage.removeItem('hotam_pending_customer_name');
              } else if (role === 'customer') {
                const firstName = typeof pending.first_name === 'string' ? pending.first_name.trim() : '';
                const lastName = typeof pending.last_name === 'string' ? pending.last_name.trim() : '';
                if (firstName || lastName) {
                  const { error } = await client
                    .from('customers')
                    .update({
                      first_name: firstName,
                      last_name: lastName,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', session.user.id);
                  if (error) {
                    throw error;
                  }
                }
                window.localStorage.removeItem('hotam_pending_customer_name');
              }
            } catch (err) {
              console.error('[auth] hotam_pending_customer_name processing error:', err);
            }
          }
        };

        const hasSellerMetadataHint = Boolean(
          userMeta.role === 'seller' ||
          userMeta.business_name ||
          userMeta.business_id ||
          userMeta.script_types ||
          userMeta.writing_samples,
        );

        const buildSellerPayloadFromMetadata = () => ({
          id: session.user.id,
          email: userEmail,
          first_name: userMeta.first_name ?? userMeta.firstName ?? null,
          last_name: userMeta.last_name ?? userMeta.lastName ?? null,
          phone: userMeta.phone ?? null,
          city: userMeta.city ?? null,
          address: userMeta.address ?? null,
          age: typeof userMeta.age === 'number' ? userMeta.age : null,
          marital_status: userMeta.marital_status ?? null,
          business_type: userMeta.business_type ?? null,
          business_id: userMeta.business_id ?? null,
          business_name: userMeta.business_name ?? null,
          bank_name: userMeta.bank_name ?? null,
          bank_branch: userMeta.bank_branch ?? null,
          bank_account_number: userMeta.bank_account_number ?? null,
          has_scribe_certificate: userMeta.has_scribe_certificate ?? null,
          certificate_url: userMeta.certificate_url ?? null,
          torah_study_frequency: userMeta.torah_study_frequency ?? null,
          mikveh_frequency: userMeta.mikveh_frequency ?? null,
          notes: userMeta.notes ?? null,
          experience_years: typeof userMeta.experience_years === 'number' ? userMeta.experience_years : null,
          script_level: userMeta.script_level ?? null,
          script_types: Array.isArray(userMeta.script_types) ? userMeta.script_types : [],
          writing_samples: Array.isArray(userMeta.writing_samples) ? userMeta.writing_samples : [],
          is_email_verified: isEmailVerified,
          updated_at: new Date().toISOString(),
        });

        const reconcileSellerAccount = async () => {
          const [sellerResult, customerResult] = await Promise.all([
            client.from('sellers').select('id', { count: 'exact', head: true }).eq('id', session.user.id),
            client.from('customers').select('id', { count: 'exact', head: true }).eq('id', session.user.id),
          ]);
          const sellerCount = sellerResult.count ?? 0;
          const customerCount = customerResult.count ?? 0;
          const roleFromMetadata = userMeta.role as string | undefined;
          const shouldBeSeller = roleFromMetadata === 'seller' || sellerCount > 0 || hasSellerMetadataHint;

          console.info('[auth] seller reconciliation check', {
            event: _event,
            userId: session.user.id,
            roleFromMetadata,
            sellerCount,
            customerCount,
            shouldBeSeller,
          });

          if (!shouldBeSeller) {
            // One final check: if a customers row exists but auth metadata says
            // seller, the DB trigger misfired. Recover.
            if (customerCount > 0 && roleFromMetadata === 'seller') {
              console.warn('[auth] seller registered as customer — forcing recovery');
              await registerSeller(buildSellerPayloadFromMetadata(), 'misfire-recovery');
              const { data: { user: refreshedUser } } = await client.auth.getUser();
              const { data: { session: refreshedSession } } = await client.auth.getSession();
              if (refreshedUser) setUser(await resolveAppUser(refreshedUser, refreshedSession?.access_token));
            }
            return;
          }

          const metadataPayload = buildSellerPayloadFromMetadata();
          const pendingSellerProfileRaw = window.localStorage.getItem('pendingSellerProfile');
          if (pendingSellerProfileRaw) {
            try {
              const parsed = JSON.parse(pendingSellerProfileRaw) as Record<string, unknown>;
              const pendingEmail = typeof parsed._pending_email === 'string'
                ? parsed._pending_email.trim().toLowerCase()
                : null;
              if (!pendingEmail || (normalizedUserEmail && pendingEmail === normalizedUserEmail)) {
                const { _pending_email: _ignoredPendingEmail, ...pendingPayload } = parsed;
                await registerSeller({ ...metadataPayload, ...pendingPayload }, 'local-cache-recovery');
                const { data: { user: refreshedUser } } = await client.auth.getUser();
                const { data: { session: refreshedSession } } = await client.auth.getSession();
                if (refreshedUser) setUser(await resolveAppUser(refreshedUser, refreshedSession?.access_token));
                window.localStorage.removeItem('pendingSellerProfile');
                return;
              }
              window.localStorage.removeItem('pendingSellerProfile');
            } catch (err) {
              console.error('[auth] pendingSellerProfile processing error:', err);
              window.localStorage.removeItem('pendingSellerProfile');
            }
          }

          await registerSeller(metadataPayload, 'metadata-recovery');
          const { data: { user: refreshedUser } } = await client.auth.getUser();
          const { data: { session: refreshedSession } } = await client.auth.getSession();
          if (refreshedUser) setUser(await resolveAppUser(refreshedUser, refreshedSession?.access_token));
        };

        void (async () => {
          try {
            await reconcileSellerAccount();
          } catch (err) {
            console.error('[auth] seller reconciliation error:', err);
          }

          try {
            await flushPendingCustomerProfile();
          } catch (err) {
            console.error('[auth] flush pending customer profile error:', err);
          }

          // Refresh the user object so any role update done by /api/register-seller
          // (via the admin API) is reflected on the client without requiring a
          // full sign-out/sign-in cycle.
          try {
            const { data: { user: refreshedUser } } = await client.auth.getUser();
            const { data: { session: refreshedSession } } = await client.auth.getSession();
            if (refreshedUser) setUser(await resolveAppUser(refreshedUser, refreshedSession?.access_token));
          } catch (err) {
            console.error('[auth] user refresh error:', err);
          }
        })();
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
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
    // If auth metadata says seller but sellerData not yet loaded, do not
    // fall through to customerData — return null so UI waits for seller row.
    if (user?.role === 'seller') return null;
    if (customerData) return { ...customerData, role: 'customer' };
    return null;
  }, [customerData, sellerData, user?.role]);

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
