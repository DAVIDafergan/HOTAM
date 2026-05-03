'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useDoc } from './firestore/use-doc';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  profile: any | null;
  isProfileLoading: boolean;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  profile: any | null;
  isProfileLoading: boolean;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth) {
      setUserError(new Error("Auth service not available"));
      setIsUserLoading(false);
      return;
    }

    return onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setIsUserLoading(false);
        setUserError(null);
      },
      (error) => {
        console.error("FirebaseProvider auth error:", error);
        setUserError(error);
        setIsUserLoading(false);
      }
    );
  }, [auth]);

  // Dynamic Profile Fetching - strictly using user?.uid
  const customerRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'customers', user.uid);
  }, [user?.uid, firestore]);
  const { data: customerData, isLoading: isCustLoading } = useDoc<any>(customerRef);

  const sellerRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore || customerData) return null;
    return doc(firestore, 'sellers', user.uid);
  }, [user?.uid, firestore, !!customerData]);
  const { data: sellerData, isLoading: isSellLoading } = useDoc<any>(sellerRef);

  const profile = useMemo(() => {
    if (customerData) return { ...customerData, role: 'customer' };
    if (sellerData) return { ...sellerData, role: 'seller' };
    return null;
  }, [customerData, sellerData]);

  const isProfileLoading = isCustLoading || isSellLoading;

  const contextValue = useMemo((): FirebaseContextState => ({
    areServicesAvailable: !!(firebaseApp && firestore && auth),
    firebaseApp,
    firestore,
    auth,
    user,
    isUserLoading,
    userError,
    profile,
    isProfileLoading,
  }), [firebaseApp, firestore, auth, user, isUserLoading, userError, profile, isProfileLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (!context || !context.areServicesAvailable) {
    throw new Error('useFirebase must be used within a FirebaseProvider with available services.');
  }
  return {
    firebaseApp: context.firebaseApp!,
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
export const useFirebaseApp = () => useFirebase().firebaseApp;
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
