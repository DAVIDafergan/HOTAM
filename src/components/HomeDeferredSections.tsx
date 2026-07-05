import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  PenTool,
  Trophy,
} from 'lucide-react';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';
import homeAnimations from '@/components/home-animations.module.css';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { TopScribesCards, type TopScribeCard } from '@/components/TopScribesCards';
import { ScrollFadeIn } from '@/components/ScrollFadeIn';

const TOP_SCRIBES_LIMIT = 5;
const TOP_SCRIBES_SECTION_TITLE = `${TOP_SCRIBES_LIMIT} סופרים מובילים`;

type TopScribeRpcRow = TopScribeCard;

export async function HomeDeferredSections() {
  const supabase = await createSupabaseServerClient();

  let topScribes: TopScribeCard[] = [];
  let isSeller = false;

  if (supabase) {
    const [{ data: topScribesData }, { data: authData }] = await Promise.all([
      supabase.rpc('get_top_scribes', { limit_count: TOP_SCRIBES_LIMIT }),
      supabase.auth.getUser(),
    ]);

    topScribes = (topScribesData || []).map((scribe: TopScribeRpcRow) => ({
      ...scribe,
      avg_rating: Number(scribe.avg_rating || 0),
      review_count: Number(scribe.review_count || 0),
    }));

    const currentUserId = authData.user?.id;
    if (currentUserId) {
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('id')
        .eq('id', currentUserId)
        .maybeSingle();

      isSeller = !!sellerData;
    }
  }

  return (
    <>
      {topScribes.length > 0 && (
        <section className="section-shell bg-[#F8F9FA]" aria-labelledby="top-scribes-heading">
          <div className="container mx-auto px-4 md:px-5">
            <ScrollFadeIn className="text-center mb-14 md:mb-24 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 rounded-full text-accent font-black text-[10px] uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5" /> נבחרת הסופרים
              </div>
              <h2 id="top-scribes-heading" className="text-[2.2rem] md:text-[3rem] font-headline font-black text-primary tracking-tight">
                {TOP_SCRIBES_SECTION_TITLE}
              </h2>
              <div className="w-16 h-1 rounded-full bg-accent mx-auto" />
            </ScrollFadeIn>

            <TopScribesCards topScribes={topScribes} />
          </div>
        </section>
      )}

      <TorahExpertBanner />

      {!isSeller && (
        <section className="section-shell bg-primary text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
            <svg width="100%" height="100%"><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
          </div>
          <ScrollFadeIn className="container mx-auto px-4 md:px-5 text-center relative z-10 space-y-10">
            <div className={`inline-block p-5 bg-accent/20 rounded-full text-accent mb-2 ${homeAnimations.animateFloating}`}>
              <PenTool className="w-10 h-10" />
            </div>
            <div className="space-y-6">
              <h2 className="text-[2.25rem] md:text-[3.2rem] font-headline font-black tracking-tight leading-tight">הנך סופר סת''ם ירא שמיים?</h2>
              <p className="text-base md:text-[1.35rem] text-white/70 max-w-xl mx-auto leading-relaxed font-medium">
                הצטרף לנבחרת הסופרים המקצועית של HOTAM. פתח חנות אישית, נהל הזמנות בקלות ומכור את מלאכת הקודש שלך ישירות ללקוח, ללא פערי תיווך ובקדושה.
              </p>
            </div>
            <div className="flex justify-center pt-4">
              <Button size="lg" asChild className="bg-accent text-primary hover:bg-accent/90 px-12 rounded-full font-black uppercase tracking-widest h-16 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95">
                <Link href="/onboarding/seller">הצטרף כסופר למערכת</Link>
              </Button>
            </div>
          </ScrollFadeIn>
        </section>
      )}
    </>
  );
}
