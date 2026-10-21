import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  HandHeart,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { HeroAnimation } from '@/components/HeroAnimation';
import { ScrollFadeIn } from '@/components/ScrollFadeIn';
import { StaggerGrid, StaggerItem } from '@/components/StaggerGrid';
import SignatureInkAnimation from '@/components/SignatureInkAnimationLoader';
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

        <section className="section-shell relative overflow-hidden" aria-labelledby="about-heading">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <ScrollFadeIn className="max-w-3xl mx-auto text-center mb-10 md:mb-16">
              <SectionHeading id="about-heading" eyebrow="על חותם" title="חותם – מלאכת שמיים ושקיפות מלאה" align="center" className="mb-2 md:mb-4" />
              <SignatureInkAnimation />
              <p className="lead mx-auto max-w-2xl">
                פלטפורמת חותם נולדה מתוך חזון לחבר בין עולם הסת''ם העתיק לבין הטכנולוגיה המודרנית, תוך שמירה על קדושה וכשרות ללא פשרות. אנו מאפשרים לכם לרכוש כלי קודש ישירות מסופרי סת''ם יראי שמיים, ללא פערי תיווך ובשקיפות מלאה על זהות הכותב, רמת ההידור והנהגת הקדושה שלו.
              </p>
            </ScrollFadeIn>

            <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <StaggerItem>
                <AboutCard
                  icon={<HandHeart className="w-6 h-6" strokeWidth={1.6} />}
                  title="קנייה ישירה מהסופר"
                  desc="חיבור ישיר ואישי המבטל את פערי התיווך ומבטיח תגמול הוגן לסופר ומחיר אטרקטיבי ללקוח."
                />
              </StaggerItem>
              <StaggerItem>
                <AboutCard
                  icon={<ShieldCheck className="w-6 h-6" strokeWidth={1.6} />}
                  title="אימות והסמכה קפדנית"
                  desc="כל סופר באתר עובר תהליך אימות מסמכים, תעודות ורקע מקצועי כדי להבטיח את כשרות המוצר."
                />
              </StaggerItem>
              <StaggerItem>
                <AboutCard
                  icon={<Users className="w-6 h-6" strokeWidth={1.6} />}
                  title="שקיפות ללא פשרות"
                  desc="מידע מלא על הנהגת הסופר, תדירות הטבילה, סדר יום של לימוד תורה ודוגמאות כתיבה חיות."
                />
              </StaggerItem>
            </StaggerGrid>

            <div className="mt-10 md:mt-16 flex justify-center">
              <Button size="lg" asChild className="gap-2.5 px-10">
                <Link href="/search?view=all">
                  <Search className="w-4 h-4" />
                  צפו בכל המוצרים באתר
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <HomeDeferredSections />
      </main>

      <SiteFooter />
    </div>
  );
}

function AboutCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className="h-full p-7 md:p-9 rounded-3xl bg-card border border-border/70 shadow-premium text-right">
      <div className="w-12 h-12 rounded-2xl bg-secondary/70 flex items-center justify-center text-primary mb-5 md:mb-7">
        {icon}
      </div>
      <h3 className="title-card mb-2.5">{title}</h3>
      <p className="text-[15.5px] text-primary/70 leading-relaxed">{desc}</p>
    </div>
  );
}
