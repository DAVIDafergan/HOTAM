"use client";

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from '@/components/SmartImage';
import { Button } from '@/components/ui/button';
import {
  BadgeCheck,
  ChevronDown,
  MapPin,
  Star,
  UserRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

// Cards are revealed a page at a time; "load more" appends the next page.
const SCRIBES_PAGE_SIZE = 6;

// Each card reveals itself when it scrolls into view. A single container-level
// whileInView (amount 0.2) never fires once the list is taller than ~5 viewports,
// leaving every card stuck at opacity 0 — invisible but still clickable.
const CARD_STAGGER_SECONDS = 0.06;

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
  sales_count?: number | null;
  script_level?: string | null;
  writing_samples?: string[] | null;
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

function ProfileStat({ value, label, icon }: { value: string | number; label: string; icon?: ReactNode }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="flex items-center justify-center gap-0.5 text-sm sm:text-base font-black text-primary tabular-nums leading-none">
        {icon}
        {value}
      </p>
      <p className="mt-1 text-[9px] sm:text-[10px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function ScribeProfileCard({ scribe }: { scribe: TopScribeCard }) {
  const displayName = `${scribe.first_name || ''} ${scribe.last_name || ''}`.trim() || 'סופר סת"ם';
  const cityLabel = scribe.city?.trim() || extractCity(scribe.address);
  const avg = scribe.review_count > 0 ? Number(scribe.avg_rating).toFixed(1) : '—';
  const coverImage = Array.isArray(scribe.writing_samples) ? scribe.writing_samples.find(Boolean) : undefined;
  const sales = Number(scribe.sales_count || 0);

  return (
    <Link
      href={`/sellers/${scribe.id}`}
      className="group block h-full rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <article className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-premium transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl">
        {/* Cover — the scribe's own writing sample when available, brand gradient otherwise */}
        <div className="relative h-20 sm:h-24 w-full overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent/70">
          {coverImage && (
            <Image
              src={coverImage}
              alt=""
              fill
              kind="writing_sample"
              sizes="(min-width: 1024px) 33vw, 50vw"
              className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/50 to-transparent" />
        </div>

        {/* Avatar overlapping the cover */}
        <div className="relative -mt-9 sm:-mt-11 flex justify-center">
          <div className="relative h-[4.5rem] w-[4.5rem] sm:h-[5.5rem] sm:w-[5.5rem] overflow-hidden rounded-full border-4 border-white bg-muted shadow-lg flex items-center justify-center">
            {scribe.profile_image ? (
              <Image src={scribe.profile_image} alt={displayName} fill kind="avatar" sizes="88px" className="object-cover" />
            ) : (
              <UserRound className="h-8 w-8 text-primary/20" />
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-3 sm:px-5 pb-4 sm:pb-5 pt-2 text-center">
          <h3 className="flex items-center justify-center gap-1 font-headline text-[0.95rem] sm:text-lg font-black text-primary transition-colors group-hover:text-accent-strong">
            <span className="truncate">{displayName}</span>
            <BadgeCheck className="h-4 w-4 shrink-0 fill-accent text-white" aria-label="סופר מאומת" />
          </h3>
          {scribe.script_level && (
            <p className="mt-0.5 truncate text-[10px] sm:text-xs font-semibold text-primary/60">כתב {scribe.script_level}</p>
          )}
          <p className="mt-1 flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 text-accent" />
            <span className="truncate">{cityLabel || 'ישראל'}</span>
          </p>

          <div className="my-3 sm:my-4 flex items-center divide-x divide-x-reverse divide-primary/10 rounded-2xl bg-[#F8F9FA] py-2.5">
            <ProfileStat value={sales} label="מכירות" />
            <ProfileStat value={avg} label="דירוג" icon={<Star className="h-3 w-3 fill-accent text-accent" />} />
            <ProfileStat value={scribe.experience_years != null ? scribe.experience_years : '—'} label="שנות ניסיון" />
          </div>

          <span className="mt-auto inline-flex h-10 w-full items-center justify-center rounded-full bg-primary text-[11px] sm:text-xs font-bold text-primary-foreground transition-colors group-hover:bg-accent group-hover:text-primary">
            צפה בפרופיל
          </span>
        </div>
      </article>
    </Link>
  );
}

export function TopScribesCards({ topScribes }: { topScribes: TopScribeCard[] }) {
  const shouldReduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(SCRIBES_PAGE_SIZE);
  const visibleScribes = topScribes.slice(0, visibleCount);
  const remaining = topScribes.length - visibleScribes.length;

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 md:gap-7">
        {visibleScribes.map((scribe, index) => (
          <motion.div
            key={scribe.id}
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, ease: EASE, delay: (index % SCRIBES_PAGE_SIZE) * CARD_STAGGER_SECONDS }}
          >
            <ScribeProfileCard scribe={scribe} />
          </motion.div>
        ))}
      </div>

      {remaining > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((count) => count + SCRIBES_PAGE_SIZE)}
            className="h-12 rounded-full border-primary/15 bg-white px-8 text-sm font-bold text-primary shadow-sm hover:bg-accent hover:text-primary hover:border-accent"
          >
            טען עוד סופרים ({remaining})
            <ChevronDown className="mr-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
