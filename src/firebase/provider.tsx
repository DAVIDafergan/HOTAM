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
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useDoc } from './firestore/use-doc';
import { doc } from '@/lib/supabase-compat';

// ─── Auth-compatible user shape (mirrors the Firebase User interface) ─────────

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
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
    _raw: u,
  };
}

// ─── Auth proxy — same surface the app uses from useAuth() ───────────────────

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

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  /** The Supabase client — used everywhere as `db` (passed to collection/doc/query) */
  firestore: SupabaseClient | null;
  /** Auth proxy used by Navbar's signOut() and the non-blocking-login helpers */
  auth: AuthProxy | null;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
  profile: any | null;
  isProfileLoading: boolean;
}

export interface FirebaseServicesAndUser {
  firestore: SupabaseClient;
  auth: AuthProxy;
  user: AppUser | null;
  isUserLoading: boolean;
  userError: Error | null;
  profile: any | null;
  isProfileLoading: boolean;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<ProviderProps> = ({ children, client }) => {
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
    });

    return () => subscription.unsubscribe();
  }, [client]);

  // ── Profile fetching ───────────────────────────────────────────────────────
  const customerRef = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return doc(client, 'customers', user.uid);
  }, [user?.uid]);

  const { data: customerData, isLoading: isCustLoading } = useDoc<any>(customerRef);

  const sellerRef = useMemoFirebase(() => {
    if (!user?.uid || customerData) return null;
    return doc(client, 'sellers', user.uid);
  }, [user?.uid, !!customerData]);

  const { data: sellerData, isLoading: isSellLoading } = useDoc<any>(sellerRef);

  const profile = useMemo(() => {
    if (customerData) return { ...customerData, role: 'customer' };
    if (sellerData) return { ...sellerData, role: 'seller' };
    return null;
  }, [customerData, sellerData]);

  const isProfileLoading = isCustLoading || isSellLoading;

  // ── Auth proxy ─────────────────────────────────────────────────────────────
  const auth: AuthProxy = useMemo(() => ({
    signOut: () => client.auth.signOut().then(() => undefined),
    _client: client,
  }), [client]);

  const contextValue = useMemo((): FirebaseContextState => ({
    areServicesAvailable: true,
    firestore: client,
    auth,
    user,
    isUserLoading,
    userError,
    profile,
    isProfileLoading,
  }), [client, auth, user, isUserLoading, userError, profile, isProfileLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (!context || !context.areServicesAvailable) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return {
    firestore: context.firestore!,
    auth: context.auth!,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
    profile: context.profile,
    isProfileLoading: context.isProfileLoading,
  };
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
/** @deprecated Use useFirestore() */
export const useFirebaseApp = () => useFirebase().firestore;
export const useUser = () => {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T & { __memo?: boolean } {
  const memoized = useMemo(factory, deps) as any;
  if (memoized && typeof memoized === 'object') {
    memoized.__memo = true;
  }
  return memoized;
}
