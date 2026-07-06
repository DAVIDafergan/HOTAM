"use client";

import Link from 'next/link';
import Image from '@/components/SmartImage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react';
import { motion } from 'framer-motion';

export type TopScribeCard = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  profile_image: string | null;
  city?: string | null;
  address: string | null;
  experience_years: number | null;
  avg_rating: number;
  review_count: number;
};

function extractCity(address: string | null | undefined): string {
  if (!address) return '';
  const parts = address
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  // No comma to safely separate the street/number from the city — never fall back to
  // showing the raw (potentially full street) address, matching the seller profile page.
  return '';
}

export function TopScribesCards({ topScribes }: { topScribes: TopScribeCard[] }) {
  return (
    <div className="flex flex-row gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:gap-6 md:gap-7 sm:overflow-visible sm:snap-none sm:mx-0 sm:px-0 sm:pb-0">
      {topScribes.map((scribe, i) => {
        const displayName = `${scribe.first_name || ''} ${scribe.last_name || ''}`.trim();
        const avg = scribe.review_count > 0 ? Number(scribe.avg_rating).toFixed(1) : '—';
        const cityLabel = scribe.city?.trim() || extractCity(scribe.address);

        return (
          <motion.div
            key={scribe.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="w-[78%] shrink-0 snap-center sm:w-auto"
          >
            <Link href={`/sellers/${scribe.id}`}>
              <Card className="group overflow-hidden border border-primary/5 shadow-premium rounded-[2.15rem] bg-white hover:-translate-y-1 transition-all duration-300 text-center p-5">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-accent/10 group-hover:scale-110 transition-transform duration-500" />
                  <div className="w-full h-full rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-muted flex items-center justify-center">
                    {scribe.profile_image ? (
                      <Image src={scribe.profile_image} alt={scribe.first_name || displayName || 'סופר'} fill kind="avatar" sizes="64px" className="object-cover" />
                    ) : (
                      <UserRound className="w-7 h-7 text-primary/10" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-accent text-primary p-1 rounded-full shadow-lg border-2 border-white">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                </div>
                <h3 className="text-[0.95rem] font-headline font-black text-primary mb-1.5 group-hover:text-accent transition-colors">{displayName}</h3>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-4 flex items-center justify-center gap-1.5">
                  <MapPin size={10} className="text-accent" /> {cityLabel || '—'}
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
                      <span className="text-xs font-black text-primary">{avg}</span>
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
        );
      })}
    </div>
  );
}
