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
import { MotionTap } from '@/components/MotionTap';
import SignatureInkAnimation from '@/components/SignatureInkAnimationLoader';
import { HomeJudaicaSection } from '@/components/HomeJudaicaSection';
import { SiteFooter } from '@/components/SiteFooter';

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

        <section className="section-shell section-surface relative overflow-hidden" aria-labelledby="about-heading">
          <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-accent/5 rounded-full -mr-20 -mt-20 md:-mr-32 md:-mt-32 blur-3xl pointer-events-none" />
          <div className="container mx-auto px-4 md:px-5 relative z-10">
            <ScrollFadeIn className="max-w-4xl mx-auto text-center space-y-5 md:space-y-10 mb-8 md:mb-28">
              <h2 id="about-heading" className="text-[2.35rem] md:text-[3.3rem] font-headline font-black text-primary tracking-tight">
                חותם – מלאכת שמיים ושקיפות מלאה
              </h2>
              <SignatureInkAnimation />
              <p className="text-lg md:text-[1.35rem] text-primary/70 leading-relaxed font-medium mx-auto max-w-3xl">
                פלטפורמת חותם נולדה מתוך חזון לחבר בין עולם הסת''ם העתיק לבין הטכנולוגיה המודרנית, תוך שמירה על קדושה וכשרות ללא פשרות. אנו מאפשרים לכם לרכוש כלי קודש ישירות מסופרי סת''ם יראי שמיים, ללא פערי תיווך ובשקיפות מלאה על זהות הכותב, רמת ההידור והנהגת הקדושה שלו.
              </p>
            </ScrollFadeIn>

            <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-10">
              <StaggerItem>
                <AboutCard
                  icon={<HandHeart className="w-8 h-8" />}
                  title="קנייה ישירה מהסופר"
                  desc="חיבור ישיר ואישי המבטל את פערי התיווך ומבטיח תגמול הוגן לסופר ומחיר אטרקטיבי ללקוח."
                />
              </StaggerItem>
              <StaggerItem>
                <AboutCard
                  icon={<ShieldCheck className="w-8 h-8" />}
                  title="אימות והסמכה קפדנית"
                  desc="כל סופר באתר עובר תהליך אימות מסמכים, תעודות ורקע מקצועי כדי להבטיח את כשרות המוצר."
                />
              </StaggerItem>
              <StaggerItem>
                <AboutCard
                  icon={<Users className="w-8 h-8" />}
                  title="שקיפות ללא פשרות"
                  desc="מידע מלא על הנהגת הסופר, תדירות הטבילה, סדר יום של לימוד תורה ודוגמאות כתיבה חיות."
                />
              </StaggerItem>
            </StaggerGrid>

            <ScrollFadeIn className="mt-8 md:mt-28 text-center">
              <div className="flex flex-col items-center gap-3">
                <MotionTap className="inline-block">
                  <Button size="lg" asChild className="rounded-full gap-3 font-bold text-primary bg-accent hover:bg-accent/90 focus:ring-4 focus:ring-accent/30 transition-all duration-300 px-12 h-16 shadow-xl">
                    <Link href="/search?view=all">
                      <Search className="w-5 h-5" />
                      צפה בכל המוצרים באתר
                      <ArrowLeft className="w-4 h-4 mr-2" />
                    </Link>
                  </Button>
                </MotionTap>
              </div>
            </ScrollFadeIn>
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
    <div className="p-6 md:p-12 rounded-[2.9rem] bg-white/95 backdrop-blur-sm shadow-premium border border-primary/10 hover:border-accent/25 transition-all duration-500 hover:-translate-y-1.5 group text-right">
      <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-primary transition-all mb-4 md:mb-8">
        {icon}
      </div>
      <h3 className="text-[1.45rem] font-headline font-black text-primary mb-4">{title}</h3>
      <p className="text-base text-primary/60 leading-relaxed font-medium max-w-[28ch]">{desc}</p>
    </div>
  );
}
