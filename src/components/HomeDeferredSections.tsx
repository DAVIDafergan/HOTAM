import { Trophy } from 'lucide-react';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';
import { getTopScribes } from '@/lib/storefront-data';
import { TopScribesCards, type TopScribeCard } from '@/components/TopScribesCards';
import { ScrollFadeIn } from '@/components/ScrollFadeIn';
import { SellerJoinCta } from '@/components/SellerJoinCta';

const TOP_SCRIBES_LIMIT = 5;
const TOP_SCRIBES_SECTION_TITLE = `${TOP_SCRIBES_LIMIT} סופרים מובילים`;

type TopScribeRpcRow = TopScribeCard;

export async function HomeDeferredSections() {
  const topScribesData = await getTopScribes(TOP_SCRIBES_LIMIT);
  const topScribes: TopScribeCard[] = (topScribesData || []).map((scribe: TopScribeRpcRow) => ({
    ...scribe,
    avg_rating: Number(scribe.avg_rating || 0),
    review_count: Number(scribe.review_count || 0),
  }));

  return (
    <>
      {topScribes.length > 0 && (
        <section className="section-shell bg-[#F8F9FA]" aria-labelledby="top-scribes-heading">
          <div className="container mx-auto px-4 md:px-5">
            <ScrollFadeIn className="text-center mb-8 md:mb-24 space-y-4 md:space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 rounded-full text-accent font-semibold text-[10px] uppercase tracking-widest">
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

      <SellerJoinCta />
    </>
  );
}
