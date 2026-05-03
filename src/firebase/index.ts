'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, FirebaseApp, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Global singletons to prevent multiple initialization issues
let firebaseApp: FirebaseApp | undefined;
let firestoreInstance: Firestore | undefined;
let authInstance: Auth | undefined;

/**
 * Initializes Firebase services as singletons.
 */
export function initializeFirebase() {
  if (!firebaseApp) {
    const apps = getApps();
    firebaseApp = apps.length ? apps[0] : initializeApp(firebaseConfig);
    firestoreInstance = getFirestore(firebaseApp);
    authInstance = getAuth(firebaseApp);
  }

  return {
    firebaseApp: firebaseApp!,
    auth: authInstance!,
    firestore: firestoreInstance!
  };
}

export function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
