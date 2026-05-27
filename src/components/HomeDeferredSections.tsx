"use client";

import Link from 'next/link';
import Image from '@/components/SmartImage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  MapPin,
  PenTool,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
} from 'lucide-react';
import { useMemo } from 'react';
import { useUser, useSupabaseClient, useDoc, useMemoStable, useCollection } from '@/lib/supabase-hooks';
import { collection, query, where, doc, limit } from '@/lib/supabase-compat';
import { motion } from 'framer-motion';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';
import homeAnimations from '@/components/home-animations.module.css';

const TOP_SCRIBES_LIMIT = 5;
const TOP_SCRIBES_SECTION_TITLE = `${TOP_SCRIBES_LIMIT} סופרים מובילים`;

export function HomeDeferredSections() {
  const { user } = useUser();
  const db = useSupabaseClient();

  const sellerRef = useMemoStable(() => (user?.uid ? doc(db, 'sellers', user.uid) : null), [db, user?.uid]);
  const { data: sellerData } = useDoc<any>(sellerRef);
  const isSeller = !!sellerData;

  const sellersQuery = useMemoStable(() => query(collection(db, 'sellers'), where('is_approved', '==', true)), [db]);
  const { data: allSellers } = useCollection<any>(sellersQuery);

  const reviewsQuery = useMemoStable(() => query(collection(db, 'reviews'), limit(100)), [db]);
  const { data: allReviews } = useCollection<any>(reviewsQuery);

  const getTimestampMillis = (ts: any): number => {
    if (!ts) return 0;
    if (ts.seconds) return ts.seconds * 1000;
    return new Date(ts).getTime();
  };

  const sellerReviewStats = useMemo(() => {
    const stats = new Map<string, { total: number; sum: number; high: number }>();
    (allReviews || []).forEach((review: any) => {
      const sellerId = review?.seller_id;
      if (!sellerId) return;
      const rating = Number(review?.rating ?? 5);
      const current = stats.get(sellerId) || { total: 0, sum: 0, high: 0 };
      current.total += 1;
      current.sum += rating;
      if (rating >= 4) current.high += 1;
      stats.set(sellerId, current);
    });
    return stats;
  }, [allReviews]);

  const topScribes = useMemo(() => {
    if (!allSellers) return [];
    const anyHasReviews = sellerReviewStats.size > 0;

    if (!anyHasReviews) {
      return [...allSellers]
        .sort((a, b) => getTimestampMillis(b.created_at) - getTimestampMillis(a.created_at))
        .slice(0, TOP_SCRIBES_LIMIT);
    }

    return [...allSellers]
      .sort((a, b) => {
        const statsA = sellerReviewStats.get(a.id) || { total: 0, sum: 0, high: 0 };
        const statsB = sellerReviewStats.get(b.id) || { total: 0, sum: 0, high: 0 };
        if (statsB.high !== statsA.high) return statsB.high - statsA.high;
        const avgA = statsA.total > 0 ? statsA.sum / statsA.total : 0;
        const avgB = statsB.total > 0 ? statsB.sum / statsB.total : 0;
        if (avgB !== avgA) return avgB - avgA;
        if (statsB.total !== statsA.total) return statsB.total - statsA.total;
        const salesA = a.sales_count || 0;
        const salesB = b.sales_count || 0;
        if (salesB !== salesA) return salesB - salesA;
        return (a.first_name || '').localeCompare(b.first_name || '');
      })
      .slice(0, TOP_SCRIBES_LIMIT);
  }, [allSellers, sellerReviewStats]);

  return (
    <>
      {topScribes.length > 0 && (
        <section className="section-shell bg-[#F8F9FA]" aria-labelledby="top-scribes-heading">
          <div className="container mx-auto px-4 md:px-5">
            <div className="text-center mb-14 md:mb-24 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 rounded-full text-accent font-black text-[10px] uppercase tracking-widest">
                <Trophy className="w-3.5 h-3.5" /> נבחרת הסופרים
              </div>
              <h2 id="top-scribes-heading" className="text-[2.2rem] md:text-[3rem] font-headline font-black text-primary tracking-tight">
                {TOP_SCRIBES_SECTION_TITLE}
              </h2>
              <div className="w-16 h-1 rounded-full bg-accent mx-auto" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 md:gap-7">
              {topScribes.map((scribe, i) => (
                <motion.div
                  key={scribe.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link href={`/sellers/${scribe.id}`}>
                    <Card className="group overflow-hidden border border-primary/5 shadow-premium rounded-[2.15rem] bg-white hover:-translate-y-1 transition-all duration-300 text-center p-5">
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-accent/10 group-hover:scale-110 transition-transform duration-500" />
                        <div className="w-full h-full rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-muted flex items-center justify-center">
                          {scribe.profile_image ? (
                            <Image src={scribe.profile_image} alt={scribe.first_name} fill kind="avatar" sizes="64px" className="object-cover" />
                          ) : (
                            <UserRound className="w-7 h-7 text-primary/10" />
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-accent text-primary p-1 rounded-full shadow-lg border-2 border-white">
                          <ShieldCheck className="w-3 h-3" />
                        </div>
                      </div>
                      <h3 className="text-[0.95rem] font-headline font-black text-primary mb-1.5 group-hover:text-accent transition-colors">{scribe.first_name} {scribe.last_name}</h3>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-4 flex items-center justify-center gap-1.5">
                        <MapPin size={10} className="text-accent" /> {scribe.address?.split(' ')[0]}
                      </p>
                      <div className="flex items-center justify-center gap-3 border-t pt-4">
                        <div className="text-right">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">ניסיון</p>
                          <p className="text-xs font-black text-primary tabular-nums">{scribe.experience_years}ש'</p>
                        </div>
                        <div className="w-px h-5 bg-muted" />
                        <div className="text-right">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">דירוג</p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Star className="w-2.5 h-2.5 fill-accent text-accent" />
                            {(() => {
                              const stats = sellerReviewStats.get(scribe.id);
                              const avg = stats && stats.total > 0
                                ? (stats.sum / stats.total).toFixed(1)
                                : '—';
                              return <span className="text-xs font-black text-primary">{avg}</span>;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button variant="outline" className="rounded-full w-full h-10 border-primary/10 text-[9px] font-black uppercase tracking-wide group-hover:bg-primary group-hover:text-white transition-all">
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

      <TorahExpertBanner />

      {!isSeller && (
        <section className="section-shell bg-primary text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
            <svg width="100%" height="100%"><pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
          </div>
          <div className="container mx-auto px-4 md:px-5 text-center relative z-10 space-y-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className={`inline-block p-5 bg-accent/20 rounded-full text-accent mb-2 ${homeAnimations.animateFloating}`}
            >
              <PenTool className="w-10 h-10" />
            </motion.div>
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
          </div>
        </section>
      )}
    </>
  );
}
