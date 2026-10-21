"use client";

import { useEffect, useState } from 'react';
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
  // Decide only after mount: this section streams in late, and by then the auth check may have
  // already finished on the client — rendering it during hydration while the server sent nothing
  // was a hydration mismatch (React #418). Server and first client render are now both empty.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || isUserLoading || user?.role === 'seller') return null;

  return (
    <section className="section-shell bg-primary text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%"><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
      </div>
      <ScrollFadeIn className="container mx-auto px-4 md:px-6 text-center relative z-10 space-y-6 md:space-y-8">
        <div className={`inline-flex p-4 rounded-full border border-[#E2B35B]/40 text-[#E2B35B] ${homeAnimations.animateFloating}`}>
          <PenTool className="w-7 h-7 md:w-8 md:h-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-4 md:space-y-6">
          <h2 className="text-[38px] md:text-[60px] font-headline font-light leading-[1.08]">סופרי סת״ם, הצטרפו לחותם</h2>
          <p className="text-[17px] md:text-xl font-light text-white/75 max-w-xl mx-auto leading-relaxed">
            פתחו חנות אישית, נהלו הזמנות בקלות ומכרו את מלאכת הקודש שלכם ישירות ללקוחות — בלי פערי תיווך.
          </p>
        </div>
        <div className="flex justify-center pt-2">
          <MotionTap className="inline-block">
            <Button size="lg" variant="gold" asChild className="px-10">
              <Link href="/onboarding/seller">הצטרפות כמוכר</Link>
            </Button>
          </MotionTap>
        </div>
      </ScrollFadeIn>
    </section>
  );
}
