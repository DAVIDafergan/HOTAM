import { SectionHeading } from '@/components/SectionHeading';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';
import { getTopScribes } from '@/lib/storefront-data';
import { TopScribesCards, type TopScribeCard } from '@/components/TopScribesCards';
import { ScrollFadeIn } from '@/components/ScrollFadeIn';
import { SellerJoinCta } from '@/components/SellerJoinCta';

const TOP_SCRIBES_SECTION_TITLE = 'הכירו את הסופרים';

type TopScribeRpcRow = TopScribeCard;

export async function HomeDeferredSections() {
  const topScribesData = await getTopScribes();
  const topScribes: TopScribeCard[] = (topScribesData || []).map((scribe: TopScribeRpcRow) => ({
    ...scribe,
    avg_rating: Number(scribe.avg_rating || 0),
    review_count: Number(scribe.review_count || 0),
  }));

  return (
    <>
      {topScribes.length > 0 && (
        <section className="section-shell bg-secondary/40 border-y border-border/60" aria-labelledby="top-scribes-heading">
          <div className="container mx-auto px-4 md:px-6">
            <ScrollFadeIn>
              <SectionHeading id="top-scribes-heading" eyebrow="נבחרת הסופרים" title={TOP_SCRIBES_SECTION_TITLE} lead="סופרים מאומתים, כל אחד עם פרופיל מלא: הסמכה, ניסיון ודוגמאות כתיבה." align="center" />
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
