
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, 
  ArrowLeft, 
  PenTool, 
  ShieldCheck, 
  Users, 
  HandHeart, 
  Sparkles,
  Search,
  Star,
  Trophy,
  ArrowRight,
  UserRound,
  MapPin
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import dynamic from 'next/dynamic';
import { useUser, useSupabaseClient, useDoc, useMemoStable, useCollection } from '@/lib/supabase-hooks';
import { collection, query, where, orderBy, doc } from '@/lib/supabase-compat';
import unsplashLoader from '@/lib/unsplashLoader';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';

const HeroAnimation = dynamic(() => import('@/components/HeroAnimation').then(mod => mod.HeroAnimation), {
  ssr: false
});
const WorkFlow = dynamic(() => import('@/components/WorkFlow').then(mod => mod.WorkFlow), {
  ssr: false
});

export default function Home() {
  const { user } = useUser();
  const db = useSupabaseClient();
  
  const sellerRef = useMemoStable(() => (user?.uid ? doc(db, 'sellers', user.uid) : null), [db, user?.uid]);
  const { data: sellerData } = useDoc<any>(sellerRef);
  const isSeller = !!sellerData;

  const sellersQuery = useMemoStable(() => query(collection(db, 'sellers'), where('is_approved', '==', true)), [db]);
  const { data: allSellers } = useCollection<any>(sellersQuery);

  const reviewsQuery = useMemoStable(() => query(collection(db, 'reviews')), [db]);
  const { data: allReviews } = useCollection<any>(reviewsQuery);

  const topScribes = useMemo(() => {
    if (!allSellers) return [];
    
    const anyHasReviews = (allReviews || []).some((r: any) =>
      allSellers.some((s: any) => s.id === r.seller_id)
    );

    if (!anyHasReviews) {
      // Fall back to most recently joined sellers
      return [...allSellers]
        .sort((a, b) => {
          const dateA = a.created_at ? (a.created_at.seconds ? a.created_at.seconds * 1000 : new Date(a.created_at).getTime()) : 0;
          const dateB = b.created_at ? (b.created_at.seconds ? b.created_at.seconds * 1000 : new Date(b.created_at).getTime()) : 0;
          return dateB - dateA;
        })
        .slice(0, 8);
    }

    // Sort by review count + avg rating first, then fall back to sales_count
    return [...allSellers]
      .sort((a, b) => {
        const reviewsA = (allReviews || []).filter((r: any) => r.seller_id === a.id);
        const reviewsB = (allReviews || []).filter((r: any) => r.seller_id === b.id);
        const countA = reviewsA.length;
        const countB = reviewsB.length;
        if (countB !== countA) return countB - countA;
        const avgA = countA > 0 ? reviewsA.reduce((s: number, r: any) => s + (r.rating ?? 5), 0) / countA : 0;
        const avgB = countB > 0 ? reviewsB.reduce((s: number, r: any) => s + (r.rating ?? 5), 0) / countB : 0;
        if (avgB !== avgA) return avgB - avgA;
        const salesA = a.sales_count || 0;
        const salesB = b.sales_count || 0;
        if (salesB !== salesA) return salesB - salesA;
        return (a.first_name || '').localeCompare(b.first_name || '');
      })
      .slice(0, 8);
  }, [allSellers, allReviews]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <main>
        <h1 className="sr-only">חותם - זירת המסחר המובילה לכלי קודש וסת''ם מהודרים</h1>
        
        {/* Hero & Search Wizard */}
        <HeroAnimation />

        {/* Workflow Section */}
        <WorkFlow />

        {/* Top Scribes Section */}
        {topScribes.length > 0 && (
          <section className="py-14 md:py-24 bg-[#F8F9FA]" aria-labelledby="top-scribes-heading">
            <div className="container mx-auto px-4">
              <div className="text-center mb-10 md:mb-16 space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 rounded-full text-accent font-black text-[10px] uppercase tracking-widest">
                  <Trophy className="w-3.5 h-3.5" /> נבחרת הסופרים
                </div>
                <h2 id="top-scribes-heading" className="text-4xl md:text-5xl font-headline font-black text-primary tracking-tight">
                   סופרים מובילים במערכת
                </h2>
                <div className="w-16 h-1 rounded-full bg-accent mx-auto" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
                {topScribes.map((scribe, i) => (
                  <motion.div
                    key={scribe.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Link href={`/sellers/${scribe.id}`}>
                      <Card className="group overflow-hidden border-none shadow-premium rounded-[2.5rem] bg-white hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-center p-5 sm:p-8">
                        <div className="relative w-24 h-24 mx-auto mb-6">
                           <div className="absolute inset-0 rounded-full border-4 border-accent/10 group-hover:scale-110 transition-transform duration-500" />
                           <div className="w-full h-full rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-muted flex items-center justify-center">
                             {scribe.profile_image ? (
                               <Image src={scribe.profile_image} alt={scribe.first_name} fill className="object-cover" />
                             ) : (
                               <UserRound className="w-10 h-10 text-primary/10" />
                             )}
                           </div>
                           <div className="absolute -bottom-1 -right-1 bg-accent text-primary p-1.5 rounded-full shadow-lg border-2 border-white">
                             <ShieldCheck className="w-3.5 h-3.5" />
                           </div>
                        </div>
                        <h3 className="text-xl font-headline font-black text-primary mb-1 group-hover:text-accent transition-colors">{scribe.first_name} {scribe.last_name}</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center justify-center gap-1.5">
                          <MapPin size={12} className="text-accent" /> {scribe.address?.split(' ')[0]}
                        </p>
                        <div className="flex items-center justify-center gap-4 border-t pt-4">
                           <div className="text-right">
                              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">ניסיון</p>
                              <p className="text-sm font-black text-primary tabular-nums">{scribe.experience_years}ש'</p>
                           </div>
                           <div className="w-px h-6 bg-muted" />
                           <div className="text-right">
                              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">דירוג</p>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                 <Star className="w-3 h-3 fill-accent text-accent" />
                                 {(() => {
                                    const scribesReviews = (allReviews || []).filter((r: any) => r.seller_id === scribe.id);
                                    const avg = scribesReviews.length > 0
                                      ? (scribesReviews.reduce((s: number, r: any) => s + (r.rating ?? 5), 0) / scribesReviews.length).toFixed(1)
                                      : '—';
                                    return <span className="text-sm font-black text-primary">{avg}</span>;
                                  })()}
                              </div>
                           </div>
                        </div>
                        <div className="mt-6">
                           <Button variant="outline" className="rounded-full w-full h-10 border-primary/5 text-[10px] font-black uppercase tracking-widest group-hover:bg-primary group-hover:text-white transition-all">
                             צפה בפרופיל <ArrowLeft className="w-3 h-3 mr-2" />
                           </Button>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* About Section */}
        <section className="py-14 md:py-24 bg-white/30 backdrop-blur-sm relative overflow-hidden" aria-labelledby="about-heading">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center space-y-8 mb-12 md:mb-20">
              <div className="inline-block p-3 bg-accent/10 rounded-2xl text-accent mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 id="about-heading" className="text-4xl md:text-5xl font-headline font-black text-primary tracking-tight">
                חותם – מלאכת שמיים ושקיפות מלאה
              </h2>
              <div className="w-16 h-1 rounded-full bg-accent mx-auto" />
              <p className="text-lg md:text-xl text-primary/70 leading-relaxed font-medium">
                פלטפורמת חותם נולדה מתוך חזון לחבר בין עולם הסת''ם העתיק לבין הטכנולוגיה המודרנית, תוך שמירה על קדושה וכשרות ללא פשרות. אנו מאפשרים לכם לרכוש כלי קודש ישירות מסופרי סת''ם יראי שמיים, ללא פערי תיווך ובשקיפות מלאה על זהות הכותב, רמת ההידור והנהגת הקדושה שלו.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
              <AboutCard 
                icon={<HandHeart className="w-8 h-8" />}
                title="קנייה ישירה מהסופר"
                desc="חיבור ישיר ואישי המבטל את פערי התיווך ומבטיח תגמול הוגן לסופר ומחיר אטרקטיבי ללקוח."
              />
              <AboutCard 
                icon={<ShieldCheck className="w-8 h-8" />}
                title="אימות והסמכה קפדנית"
                desc="כל סופר באתר עובר תהליך אימות מסמכים, תעודות ורקע מקצועי כדי להבטיח את כשרות המוצר."
              />
              <AboutCard 
                icon={<Users className="w-8 h-8" />}
                title="שקיפות ללא פשרות"
                desc="מידע מלא על הנהגת הסופר, תדירות הטבילה, סדר יום של לימוד תורה ודוגמאות כתיבה חיות."
              />
            </div>

            <div className="mt-12 md:mt-20 text-center">
              <Button size="lg" asChild className="rounded-full gap-3 font-black text-white bg-primary hover:bg-primary/90 hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary/30 transition-all duration-300 px-12 h-16 shadow-xl">
                <Link href="/search?view=all">
                  <Search className="w-5 h-5" />
                  צפה בכל המוצרים באתר
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Torah Expert Banner - Bottom of Home Page */}
        <TorahExpertBanner />

        {/* Seller Recruitment */}
        {!isSeller && (
          <section className="py-14 md:py-24 bg-primary text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
              <svg width="100%" height="100%"><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
            </div>
            <div className="container mx-auto px-4 text-center relative z-10 space-y-8">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                className="inline-block p-5 bg-accent/20 rounded-full text-accent mb-2 animate-floating"
              >
                <PenTool className="w-10 h-10" />
              </motion.div>
              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tight leading-tight">הנך סופר סת''ם ירא שמיים?</h2>
                <p className="text-base md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed font-medium">
                  הצטרף לנבחרת הסופרים המקצועית של HOTAM. פתח חנות אישית, נהל הזמנות בקלות ומכור את מלאכת הקודש שלך ישירות ללקוח, ללא פערי תיווך ובקדושה.
                </p>
              </div>
              <div className="flex justify-center pt-4">
                <Button size="lg" asChild className="bg-accent text-primary hover:bg-accent/90 px-12 rounded-full font-black uppercase tracking-widest h-16 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95">
                  <Link href="/onboarding/seller">הצטרף כסופר למערכת</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-white border-t py-10 md:py-16">
        <div className="container mx-auto px-4 flex flex-col items-center justify-center space-y-6">
          <Link href="/" aria-label="חותם - דף הבית" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
             <svg 
                width="40" 
                height="40" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="text-primary"
              >
                <path d="m12 19 7-7 3 3-7 7-3-3z" />
                <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="m2 2 5 5" />
                <path d="m11 11l1 1" />
              </svg>
              <span className="text-3xl font-headline font-black text-primary tracking-tighter uppercase">HOTAM</span>
          </Link>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-primary/60">נבנה ע"י DA ניהול פרויקטים</p>
            <p className="text-[10px] font-black text-muted-foreground/30 tracking-[0.4em] uppercase">Sacred Scribal Art © 2024</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AboutCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-6 md:p-10 rounded-[2.5rem] bg-white shadow-premium border border-primary/5 hover:border-accent/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group text-right"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-primary transition-all mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-headline font-black text-primary mb-4">{title}</h3>
      <p className="text-sm text-primary/60 leading-relaxed font-medium">{desc}</p>
    </motion.div>
  );
}
