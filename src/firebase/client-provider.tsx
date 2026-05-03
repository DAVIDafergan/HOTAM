'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { supabase } from '@/lib/supabase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // The Supabase client is already a singleton; just pass it to the provider.
  const client = useMemo(() => supabase, []);

  return (
    <FirebaseProvider client={client}>
      {children}
    </FirebaseProvider>
  );
}