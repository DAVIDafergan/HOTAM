"use client";

import Link from 'next/link';
import { PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import homeAnimations from '@/components/home-animations.module.css';
import { ScrollFadeIn } from '@/components/ScrollFadeIn';
import { MotionTap } from '@/components/MotionTap';
import { useUser } from '@/lib/supabase-hooks';

// Split out of HomeDeferredSections (a Server Component) so that whether the current user is
// already a seller — the one piece of this page that's genuinely per-user — resolves
// client-side via the existing useUser() hook instead of a cookies()-based server check. That
// cookies() call was what forced the entire home route out of static/ISR rendering.
export function SellerJoinCta() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading || user?.role === 'seller') return null;

  return (
    <section className="section-shell bg-primary text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%"><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
      </div>
      <ScrollFadeIn className="container mx-auto px-4 md:px-5 text-center relative z-10 space-y-6 md:space-y-10">
        <div className={`inline-block p-4 md:p-5 bg-accent/20 rounded-full text-accent mb-2 ${homeAnimations.animateFloating}`}>
          <PenTool className="w-8 h-8 md:w-10 md:h-10" />
        </div>
        <div className="space-y-4 md:space-y-6">
          <h2 className="text-[2.25rem] md:text-[3.2rem] font-headline font-black tracking-tight leading-tight">הנך סופר סת''ם ירא שמיים?</h2>
          <p className="text-base md:text-[1.35rem] text-white/70 max-w-xl mx-auto leading-relaxed font-medium">
            הצטרף לנבחרת הסופרים המקצועית של HOTAM. פתח חנות אישית, נהל הזמנות בקלות ומכור את מלאכת הקודש שלך ישירות ללקוח, ללא פערי תיווך ובקדושה.
          </p>
        </div>
        <div className="flex justify-center pt-4">
          <MotionTap className="inline-block">
            <Button size="lg" asChild className="bg-accent text-primary hover:bg-accent/90 px-12 rounded-full font-bold uppercase tracking-widest h-16 shadow-2xl transition-all duration-300">
              <Link href="/onboarding/seller">הצטרף כסופר למערכת</Link>
            </Button>
          </MotionTap>
        </div>
      </ScrollFadeIn>
    </section>
  );
}
