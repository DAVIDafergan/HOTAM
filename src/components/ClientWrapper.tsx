'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const Toaster = dynamic(() => import('@/components/ui/toaster').then(mod => mod.Toaster), { 
  ssr: false 
});

export function ClientWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
