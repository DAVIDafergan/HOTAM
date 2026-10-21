import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
} from 'lucide-react';
import { HeroAnimation } from '@/components/HeroAnimation';
import { ScrollFadeIn } from '@/components/ScrollFadeIn';
import { StaggerGrid, StaggerItem } from '@/components/StaggerGrid';
import { HomeJudaicaSection } from '@/components/HomeJudaicaSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SectionHeading } from '@/components/SectionHeading';

// The route no longer touches cookies() anywhere in its render tree (product/scribe data is
// fetched with the public anon client in storefront-data.ts; the one per-user bit — whether to
// show the seller-signup CTA — resolves client-side in SellerJoinCta). That makes it eligible
// for ISR instead of forced per-request dynamic rendering; 5 minutes keeps new products/prices
// reasonably fresh without hitting the DB on every request.
export const revalidate = 300;

const WorkFlow = dynamic(() => import('@/components/WorkFlow').then(mod => mod.WorkFlow), {
  // Mobile stacks the 4 steps vertically (~1310px) instead of 4 flat columns (~660px on
  // desktop) — a single min-height was only ever right for one breakpoint, causing a large
  // shift when the real section swapped in on the other.
  loading: () => <section aria-hidden="true" className="min-h-[1310px] md:min-h-[680px] w-full bg-gradient-to-b from-primary/10 via-primary/5 to-primary/0 animate-pulse" />,
});

const HomeProductsCarousel = dynamic(
  () => import('@/components/HomeProductsCarousel').then(mod => mod.HomeProductsCarousel),
  {
    loading: () => <section aria-hidden="true" className="min-h-[420px] w-full bg-gradient-to-b from-muted/40 via-muted/10 to-transparent animate-pulse" />,
  }
);

const HomeDeferredSections = dynamic(
  () => import('@/components/HomeDeferredSections').then(mod => mod.HomeDeferredSections),
  {
    loading: () => <section aria-hidden="true" className="min-h-[900px] w-full bg-gradient-to-b from-secondary/40 via-secondary/20 to-transparent animate-pulse" />,
  }
);

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main>
        <h1 className="sr-only">חותם - זירת המסחר המובילה לכלי קודש וסת''ם מהודרים</h1>

        <HeroAnimation />

        <HomeProductsCarousel />

        <HomeJudaicaSection />

        <WorkFlow />

        <section className="section-shell relative overflow-hidden" aria-labelledby="why-heading">
          <div className="container mx-auto px-5 md:px-8 relative z-10 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
            <ScrollFadeIn className="lg:sticky lg:top-32 self-start">
              <SectionHeading
                id="why-heading"
                eyebrow="למה חותם"
                title="למה לקנות בחותם"
                lead="חותם מחברת אתכם ישירות לסופרי סת״ם יראי שמיים — בקדושה, בשקיפות מלאה ובלי פערי תיווך."
                className="!mb-8"
              />
              <Button size="lg" asChild className="gap-2.5 px-8">
                <Link href="/search?view=all">
                  לכל כלי הקודש
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
            </ScrollFadeIn>

            <StaggerGrid className="divide-y divide-border/80 border-y border-border/80">
              <StaggerItem>
                <Benefit n="01" title="ישירות מהסופר." desc="בלי מתווכים ובלי פערי תיווך — יודעים בדיוק מי כתב." />
              </StaggerItem>
              <StaggerItem>
                <Benefit n="02" title="סופרים מאומתים בלבד." desc="כל סופר נבדק לפני שהוא מעלה מוצר ראשון — תעודות, הסמכה ורקע מקצועי." />
              </StaggerItem>
              <StaggerItem>
                <Benefit n="03" title="פירוט הלכתי מלא." desc="לכל מוצר: סוג כתב, רמת הידור והגהה. וגם הנהגת הסופר — טבילה, לימוד ודוגמאות כתיבה." />
              </StaggerItem>
              <StaggerItem>
                <Benefit n="04" title="תשלום מאובטח בנאמנות." desc="התשלום משתחרר לסופר רק אחרי שהמוצר הגיע אליכם." />
              </StaggerItem>
            </StaggerGrid>
          </div>
        </section>

        <HomeDeferredSections />
      </main>

      <SiteFooter />
    </div>
  );
}

function Benefit({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-6 md:gap-10 py-7 md:py-9 text-right">
      <span className="price shrink-0 text-[34px] md:text-[44px] leading-none text-accent-strong/80 num" aria-hidden="true">{n}</span>
      <p className="max-w-none text-[17px] md:text-[20px] leading-[1.7] font-light text-primary/80">
        <strong className="font-semibold text-primary">{title}</strong>{' '}{desc}
      </p>
    </div>
  );
}
