'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const SplashScreen = dynamic(() => import('@/components/SplashScreen').then(mod => mod.SplashScreen), { 
  ssr: false 
});
const Toaster = dynamic(() => import('@/components/ui/toaster').then(mod => mod.Toaster), { 
  ssr: false 
});

export function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <SplashScreen />
      {children}
      <Toaster />
    </>
  );
}
