'use client';

import React, { useMemo, type ReactNode } from 'react';
import { AppProvider } from '@/lib/app-provider';
import { supabase } from '@/lib/supabase';

interface SupabaseClientProviderProps {
  children: ReactNode;
}

export function SupabaseClientProvider({ children }: SupabaseClientProviderProps) {
  // The Supabase client is already a singleton; just pass it to the provider.
  const client = useMemo(() => supabase, []);

  return (
    <AppProvider client={client}>
      {children}
    </AppProvider>
  );
}
