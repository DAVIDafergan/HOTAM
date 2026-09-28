import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getJudaicaHomeData } from '@/lib/storefront-data';
import {
  PRODUCT_GROUPS, daysLeftInSeason, getActiveSeasons, type ProductGroup, type Season,
} from '@/lib/product-catalog';
import {
  KippahIllustration, SeasonIllustration, SilverIllustration, TallitIllustration,
} from '@/components/judaica/JudaicaIllustrations';
import { HomeJudaicaProducts } from '@/components/HomeJudaicaProducts';

// The three fixed tiles, always shown (navigation only). Their products preview needs
// real stock: it appears once there are at least this many in-stock products.
const TILE_GROUPS = ['tallit', 'silver', 'kippah'] as const;
const PREVIEW_MIN_PRODUCTS = 4;
const PREVIEW_LIMIT = 12;

const TILE_ART: Record<(typeof TILE_GROUPS)[number], { Art: ComponentType<SVGProps<SVGSVGElement>>; tone: string; note: string }> = {
  tallit: { Art: TallitIllustration, tone: 'bg-[#EFE4D1]', note: 'טלית, טלית קטן, גופיית ציצית ועוד' },
  silver: { Art: SilverIllustration, tone: 'bg-[#E6E4E0]', note: 'סט קידוש · פמוטי שבת' },
  kippah: { Art: KippahIllustration, tone: 'bg-[#F1E4D3]', note: 'סרוגות, קטיפה, בד ועור' },
};

const groupHref = (key: string) => `/search?view=results&group=${key}`;
const typeHref = (type: string) => `/search?view=results&product=${encodeURIComponent(type)}`;

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-black tracking-[0.2em] text-accent-strong md:text-xs">
      <span className="h-px w-6 bg-accent md:w-9" aria-hidden="true" />
      {children}
    </div>
  );
}

function daysLeftLabel(days: number): string {
  if (days <= 1) return 'יום אחרון';
  return `נותרו ${days} ימים`;
}

function SeasonBanner({ season, compact, tone }: { season: Season; compact: boolean; tone: 'ink' | 'olive' }) {
  const days = daysLeftInSeason(season.key);
  const patternId = `judaica-lattice-${season.key}`;
  return (
    <Link
      href={typeHref(season.category)}
      data-season-banner={season.key}
      className={cn(
        'group relative flex overflow-hidden rounded-[2rem] text-primary-foreground shadow-[0_24px_50px_-20px_rgba(28,24,21,0.55)] transition-transform duration-300 hover:-translate-y-1 md:rounded-[2.5rem]',
        tone === 'ink' ? 'bg-primary' : 'bg-[#2E4A2E]',
        compact ? 'min-h-[250px]' : 'min-h-[290px] md:min-h-[280px]',
      )}
    >
      <svg className="pointer-events-none absolute inset-y-0 left-0 h-full w-[45%] text-[#E2B35B]" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M22 2 L42 22 L22 42 L2 22 Z" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.13" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div className="relative z-10 flex flex-1 flex-col justify-center gap-3 p-6 pl-32 md:gap-4 md:py-0 md:pr-14 md:pl-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-black text-primary md:text-xs">עונתי · {season.until}</span>
          <span className="flex items-center gap-1.5 rounded-full border border-[#E2B35B]/45 px-3 py-1 text-[11px] font-bold text-[#E2B35B] md:text-xs">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {daysLeftLabel(days)}
          </span>
        </div>
        <h3 className={cn('font-headline font-black leading-none text-primary-foreground', compact ? 'text-4xl md:text-5xl' : 'text-4xl md:text-6xl')}>
          {season.title}
        </h3>
        <p className="max-w-md text-sm font-medium text-primary-foreground/75 md:text-lg">{season.description}</p>
        <span className="mt-1 inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-full bg-accent px-7 text-sm font-black text-primary shadow-lg transition-colors group-hover:bg-accent/90 md:self-start md:text-base">
          {season.cta}
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className={cn('pointer-events-none absolute left-2 top-10 flex items-center justify-center text-[#E2B35B] md:relative md:left-auto md:top-auto', compact ? 'md:w-[220px]' : 'md:w-[440px]')}>
        <div className="absolute hidden rounded-full border border-[#E2B35B]/20 md:block md:h-[230px] md:w-[230px]" aria-hidden="true" />
        <SeasonIllustration season={season.key} className={cn('h-28 w-28', compact ? 'md:h-40 md:w-40' : 'md:h-56 md:w-56')} />
      </div>
    </Link>
  );
}

function CategoryTile({ group }: { group: ProductGroup & { key: (typeof TILE_GROUPS)[number] } }) {
  const { Art, tone, note } = TILE_ART[group.key];
  return (
    <div data-judaica-tile={group.key} className="flex flex-col rounded-[1.75rem] bg-card p-3 shadow-[0_18px_44px_-24px_rgba(28,24,21,0.35)] md:rounded-[2.25rem] md:p-4 md:pb-6">
      <div className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-0">
        <Link
          href={groupHref(group.key)}
          aria-label={group.label}
          className={cn(
            'flex h-[104px] w-24 shrink-0 items-center justify-center rounded-t-[3.5rem] rounded-b-2xl border border-accent/25 text-primary transition-transform duration-300 hover:-translate-y-1 md:h-[300px] md:w-full md:rounded-t-[11rem] md:rounded-b-3xl',
            tone,
          )}
        >
          <Art className="h-16 w-16 md:h-44 md:w-44" strokeWidth={1.6} />
        </Link>
        <div className="flex flex-1 items-center justify-between gap-3 md:px-3 md:pt-6">
          <div className="flex flex-col gap-1">
            <Link href={groupHref(group.key)} className="font-headline text-xl font-black text-primary hover:text-accent-strong md:text-3xl">
              {group.label}
            </Link>
            <span className="text-xs font-semibold text-muted-foreground md:hidden">{note}</span>
          </div>
          <Link
            href={groupHref(group.key)}
            aria-label={`לכל המוצרים: ${group.label}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-[#E2B35B] transition-transform hover:-translate-x-1"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="hidden flex-wrap gap-2 px-3 pt-4 md:flex">
        {group.types.map((type) => (
          <Link
            key={type}
            href={typeHref(type)}
            className="rounded-full border border-[#EDE3D3] bg-[#F7F1E7] px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:border-accent/40 hover:bg-accent/10"
          >
            {type === 'כיפה' ? 'כל הכיפות' : type}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** "לחג, לשבת ולכל יום": in-season banners (only with stock) above the three fixed tiles. */
export async function HomeJudaicaSection() {
  const { counts } = await getJudaicaHomeData();
  const banners = getActiveSeasons().filter((season) => (counts[season.category] || 0) > 0);
  const tiles = TILE_GROUPS.map((key) => PRODUCT_GROUPS.find((group) => group.key === key)!) as (ProductGroup & { key: (typeof TILE_GROUPS)[number] })[];

  return (
    <section className="relative py-12 md:py-20" aria-labelledby="home-judaica-heading" dir="rtl" data-home-judaica>
      <div className="container mx-auto space-y-6 px-4 md:space-y-9 md:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2 md:space-y-3">
            <SectionEyebrow>יודאיקה בחותם</SectionEyebrow>
            <h2 id="home-judaica-heading" className="font-headline text-[2rem] font-black leading-tight tracking-tight text-primary md:text-[2.9rem]">
              לחג, לשבת ולכל יום
            </h2>
            <p className="text-sm font-medium text-muted-foreground md:text-lg">כלי קודש ומוצרי יודאיקה ממוכרים מאומתים, ישירות אליכם</p>
          </div>
          <Link
            href="/search?view=all"
            className="hidden items-center gap-2 self-start rounded-full border border-primary/15 bg-white/50 px-6 py-3 text-sm font-black text-primary transition-colors hover:border-accent/40 hover:bg-white md:inline-flex md:self-auto"
          >
            לכל המוצרים באתר
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {banners.length > 0 && (
          <div className={cn('grid gap-4 md:gap-6', banners.length > 1 && 'md:grid-cols-2')}>
            {banners.map((season, i) => (
              <SeasonBanner key={season.key} season={season} compact={banners.length > 1} tone={i === 1 ? 'olive' : 'ink'} />
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3 md:gap-7">
          {tiles.map((group) => <CategoryTile key={group.key} group={group} />)}
        </div>
      </div>
    </section>
  );
}

/** "יודאיקה שתמצאו אצלנו": real products from the three tile groups, hidden until there's enough stock. */
export async function HomeJudaicaProductsSection() {
  const { products } = await getJudaicaHomeData();
  const groups = TILE_GROUPS.map((key) => PRODUCT_GROUPS.find((group) => group.key === key)!);
  const tileTypes = new Set(groups.flatMap((group) => group.types));
  const preview = products.filter((p) => tileTypes.has(p.product_type)).slice(0, PREVIEW_LIMIT);
  if (preview.length < PREVIEW_MIN_PRODUCTS) return null;

  return (
    <section className="relative py-10 md:py-16" aria-labelledby="home-judaica-products-heading" dir="rtl" data-home-judaica-products>
      <div className="container mx-auto space-y-6 px-4 md:space-y-8 md:px-5">
        <HomeJudaicaProducts
          products={preview}
          groups={groups.map(({ key, label, types }) => ({ key, label, types }))}
          heading={
            <div className="space-y-2 md:space-y-3">
              <SectionEyebrow>מבחר מהמאגר</SectionEyebrow>
              <h2 id="home-judaica-products-heading" className="font-headline text-[2rem] font-black leading-tight tracking-tight text-primary md:text-[2.9rem]">
                יודאיקה שתמצאו אצלנו
              </h2>
            </div>
          }
        />
      </div>
    </section>
  );
}
