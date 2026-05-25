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
    // Hydrate from existing session immediately
    void Promise.all([client.auth.getUser(), client.auth.getSession()]).then(async ([userResult, sessionResult]) => {
      const freshUser = userResult.data.user;
      const accessToken = sessionResult.data.session?.access_token;
      setUser(freshUser ? await resolveAppUser(freshUser, accessToken) : null);
      setIsUserLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: { user: freshUser } } = await client.auth.getUser();
        setUser(freshUser ? await resolveAppUser(freshUser, session.access_token) : null);
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
        const profileConfirmationEmailStorageKey = `hotam_profile_confirmation_email_sent_${session.user.id}`;
        let welcomeEmailInFlight = false;
        const sendWelcomeEmail = async () => {
          if (!isEmailVerified || !userEmail) {
            return false;
          }
          if (welcomeEmailInFlight) {
            return false;
          }
          if (window.localStorage.getItem(profileConfirmationEmailStorageKey)) {
            return false;
          }
          welcomeEmailInFlight = true;

          const subject = 'הפרופיל שלך בחותם אושר בהצלחה';
          const text = `שלום וברוכים הבאים לחותם!

אישרנו בהצלחה את כתובת המייל שלך והפרופיל שלך פעיל במערכת.
מעכשיו אפשר להיכנס לחשבון, לצפות במוצרים ולהתחיל להשתמש בפלטפורמה.

להתחלת גלישה: https://hotam.shop`;
          const html = `
            <div dir="rtl" style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
              <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.12);border:1px solid rgba(212,175,55,0.18);">
                <div style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);padding:36px 32px;text-align:center;">
                  <img src="https://hotam.shop/icon.svg" alt="Hotam" width="72" height="72" style="display:block;margin:0 auto 16px;" />
                  <div style="color:#d4af37;font-size:13px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">HOTAM</div>
                  <h1 style="margin:14px 0 0;font-size:30px;line-height:1.3;color:#ffffff;font-weight:900;">הפרופיל שלך אושר בהצלחה</h1>
                  <p style="margin:12px 0 0;color:rgba(255,255,255,0.82);font-size:16px;line-height:1.8;">
                    כתובת המייל אומתה והחשבון שלך מוכן לשימוש מלא בפלטפורמת חותם.
                  </p>
                </div>
                <div style="padding:36px 32px 20px;text-align:right;">
                  <div style="background:#fff8e1;border:1px solid rgba(212,175,55,0.25);border-radius:20px;padding:22px 20px;margin-bottom:24px;">
                    <p style="margin:0 0 10px;font-size:18px;font-weight:800;color:#111827;">מה עכשיו?</p>
                    <ul style="margin:0;padding:0 20px 0 0;color:#4b5563;font-size:15px;line-height:2;">
                      <li>הפרופיל שלך מאומת ומוכן לפעילות</li>
                      <li>אפשר להיכנס לחשבון ולהתחיל לגלוש במוצרים</li>
                      <li>ניתן ליצור קשר עם מוכרים ולבצע רכישה בטוחה</li>
                    </ul>
                  </div>
                  <p style="margin:0 0 24px;font-size:16px;line-height:1.9;color:#374151;">
                    שמחים לראות אותך איתנו ונמשיך לשמור על חוויית שימוש בטוחה, אמינה ומכבדת.
                  </p>
                  <div style="text-align:center;padding-bottom:12px;">
                    <a href="https://hotam.shop" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:15px 34px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 10px 25px rgba(17,24,39,0.18);">
                      כניסה לחשבון
                    </a>
                  </div>
                </div>
                <div style="padding:20px 32px 28px;background:#faf7f0;border-top:1px solid rgba(212,175,55,0.12);text-align:center;">
                  <p style="margin:0;font-size:12px;line-height:1.8;color:#6b7280;">
                    אישור פרופיל אוטומטי מ-<strong style="color:#111827;">חותם</strong><br />
                    זירת המסחר המאובטחת והאיכותית לכלי קודש וסת&quot;ם מהודרים
                  </p>
                </div>
              </div>
            </div>
          `;

          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + authToken,
            },
            body: JSON.stringify({
              to: userEmail,
              subject,
              text,
              html,
            }),
          });

          if (!response.ok) {
            throw new Error(`send-email failed (${response.status})`);
          }

          window.localStorage.setItem(profileConfirmationEmailStorageKey, '1');
          return true;
        };

        const flushPendingCustomerProfile = async () => {
          let welcomeEmailSent = false;
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
                welcomeEmailSent = await sendWelcomeEmail();
              }
            } catch (err) {
              console.error('[auth] hotam_pending_customer_name processing error:', err);
            }
          }
          return welcomeEmailSent;
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
        };

        void (async () => {
          try {
            await reconcileSellerAccount();
          } catch (err) {
            console.error('[auth] seller reconciliation error:', err);
          }

          const welcomeEmailSent = await flushPendingCustomerProfile();
          if (!welcomeEmailSent) {
            try {
              await sendWelcomeEmail();
            } catch (err) {
              console.error('[auth] welcome email error:', err);
            }
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
