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

      // After sign-in, finalize any pending profile data persisted before auth.
      if (_event === 'SIGNED_IN' && session?.user && typeof window !== 'undefined') {
        const authToken = session.access_token;
        const userEmail = session.user.email ?? null;
        const normalizedUserEmail = userEmail?.trim().toLowerCase();
        const registerSeller = async (payload: Record<string, unknown>) => {
          const response = await fetch('/api/register-seller', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            const bodyText = await response.text();
            throw new Error(`register-seller failed (${response.status}): ${bodyText}`);
          }
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
              Authorization: `Bearer ${authToken}`,
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

        const flushPendingSellerProfile = async () => {
          let welcomeEmailSent = false;

          const pendingSellerProfileRaw = window.localStorage.getItem('pendingSellerProfile');
          if (pendingSellerProfileRaw) {
            try {
              const parsed = JSON.parse(pendingSellerProfileRaw) as Record<string, unknown>;
              const pendingEmail = typeof parsed._pending_email === 'string'
                ? parsed._pending_email.trim().toLowerCase()
                : null;
              if (pendingEmail && normalizedUserEmail && pendingEmail === normalizedUserEmail) {
                const { _pending_email: _ignoredPendingEmail, ...pendingPayload } = parsed;
                await registerSeller({
                  id: session.user.id,
                  email: userEmail,
                  ...pendingPayload,
                });
                window.localStorage.removeItem('pendingSellerProfile');
              }
            } catch (err) {
              console.error('[auth] pendingSellerProfile processing error:', err);
            }
          }

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
                });
                window.localStorage.removeItem('hotam_pending_customer_name');
              } else if (role === 'customer') {
                window.localStorage.removeItem('hotam_pending_customer_name');
                welcomeEmailSent = await sendWelcomeEmail();
              }
            } catch (err) {
              console.error('[auth] hotam_pending_customer_name processing error:', err);
            }
          }
          return welcomeEmailSent;
        };

        void (async () => {
          const welcomeEmailSent = await flushPendingSellerProfile();
          if (!welcomeEmailSent) {
            try {
              await sendWelcomeEmail();
            } catch (err) {
              console.error('[auth] welcome email error:', err);
            }
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
