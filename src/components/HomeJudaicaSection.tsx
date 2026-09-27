import Link from 'next/link';
import Image, { type StaticImageData } from 'next/image';
import { ArrowLeft, Clock, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import SmartImage from '@/components/SmartImage';
import { getJudaicaHomeData } from '@/lib/storefront-data';
import {
  PRODUCT_GROUPS, daysLeftInSeason, getActiveSeasons, type ProductGroup, type Season,
} from '@/lib/product-catalog';
import { SeasonIllustration } from '@/components/judaica/JudaicaIllustrations';
import tallitPhoto from '../../public/images/home/tallit.jpg';
import shabbatSilverPhoto from '../../public/images/home/shabbat-silver.jpg';
import mezuzahCasePhoto from '../../public/images/home/mezuzah-case.jpg';

// The three fixed category tiles. Each is always shown (photo + link); real in-stock products
// from its group appear under the photo once the group has any.
const TILE_GROUPS = ['tallit', 'silver', 'mezuzah_case'] as const;
type TileKey = (typeof TILE_GROUPS)[number];
const TILE_PREVIEW_MAX = 4;

const TILE_PHOTO: Record<TileKey, { photo: StaticImageData; alt: string; note: string }> = {
  tallit: { photo: tallitPhoto, alt: 'טלית צמר מקופלת עם עטרה ופסים כחולים', note: 'טלית, טלית קטן, גופיית ציצית ועוד' },
  silver: { photo: shabbatSilverPhoto, alt: 'זוג פמוטי כסף עם נרות דולקים וגביע קידוש', note: 'סט קידוש · פמוטי שבת' },
  mezuzah_case: { photo: mezuzahCasePhoto, alt: 'בית מזוזה מעוטר בכסף וזהב עם האות ש', note: 'בתי מזוזה בכל הגדלים והסגנונות' },
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

function productTitle(product: any): string {
  return product.product_type === 'מוצרי יודאיקה שונים' ? (product.sub_type || 'מוצר יודאיקה') : product.product_type;
}

/** A compact real-product card for the tile preview (same price rule as ProductCard: incl. VAT). */
function TileProductCard({ product }: { product: any }) {
  const image = Array.isArray(product.images) ? product.images.find(Boolean) : null;
  const price = Math.round(Number(product.price) * 1.18).toLocaleString('he-IL');
  return (
    <Link
      href={`/products/${product.id}`}
      data-tile-product
      className="group/card flex flex-col overflow-hidden rounded-2xl border border-primary/5 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-[#F3EDE3]">
        {image ? (
          <SmartImage
            src={image}
            alt={productTitle(product)}
            fill
            kind="product"
            sizes="(max-width: 768px) 45vw, 180px"
            className="object-cover transition-transform duration-500 group-hover/card:scale-105 motion-reduce:transition-none"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-primary/15" aria-hidden="true">
            <ImageIcon className="h-8 w-8" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2.5 text-right">
        <span className="truncate text-sm font-bold text-primary">{productTitle(product)}</span>
        <span className="text-sm font-black text-accent-strong">₪{price}</span>
      </div>
    </Link>
  );
}

function CategoryTile({ group, products }: { group: ProductGroup & { key: TileKey }; products: any[] }) {
  const { photo, alt, note } = TILE_PHOTO[group.key];
  // An even grid reads best: 4, else 2, else the single product there is.
  const shown = products.slice(0, products.length >= TILE_PREVIEW_MAX ? TILE_PREVIEW_MAX : products.length >= 2 ? 2 : products.length);
  return (
    <div data-judaica-tile={group.key} className="flex flex-col rounded-[1.75rem] bg-card p-3 shadow-[0_18px_44px_-24px_rgba(28,24,21,0.35)] md:rounded-[2.25rem] md:p-4 md:pb-6">
      {/* Ark-style arch: gentle zoom on hover (and on scroll where supported), gold frame lights up. */}
      <Link
        href={groupHref(group.key)}
        aria-label={group.label}
        className="group/photo relative block h-[220px] overflow-hidden rounded-t-[7rem] rounded-b-2xl bg-primary shadow-[0_0_0_1px_rgba(226,179,91,0.35)] transition-shadow duration-500 hover:shadow-[0_0_0_1px_rgba(226,179,91,0.9),0_22px_44px_-16px_rgba(190,137,45,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:h-[300px] md:rounded-t-[11rem] md:rounded-b-3xl"
      >
        <div className="judaica-scroll-zoom absolute inset-0">
          <Image
            src={photo}
            alt={alt}
            fill
            placeholder="blur"
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover/photo:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover/photo:scale-100"
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-t-[6.5rem] rounded-b-xl border border-[#E2B35B]/0 transition-colors duration-500 group-hover/photo:border-[#E2B35B]/70 md:rounded-t-[10.5rem] md:rounded-b-2xl"
        />
      </Link>
      <div className="flex items-center justify-between gap-3 px-1 pt-4 md:px-3 md:pt-6">
        <div className="flex flex-col gap-1">
          <Link href={groupHref(group.key)} className="font-headline text-2xl font-black text-primary hover:text-accent-strong md:text-3xl">
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
      <div className="hidden flex-wrap gap-2 px-3 pt-4 md:flex">
        {group.types.map((type) => (
          <Link
            key={type}
            href={typeHref(type)}
            className="rounded-full border border-[#EDE3D3] bg-[#F7F1E7] px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:border-accent/40 hover:bg-accent/10"
          >
            {type === 'בית מזוזה' ? 'כל בתי המזוזות' : type}
          </Link>
        ))}
      </div>
      {shown.length > 0 && (
        <div className="mt-4 space-y-3 px-1 md:px-3" data-tile-products={group.key}>
          <div className="grid grid-cols-2 gap-2.5">
            {shown.map((product) => <TileProductCard key={product.id} product={product} />)}
          </div>
          {products.length > shown.length && (
            <Link href={groupHref(group.key)} className="flex items-center justify-center gap-1.5 py-1 text-sm font-black text-accent-strong hover:text-primary">
              לכל {products.length} המוצרים
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** "לחג, לשבת ולכל יום": in-season banners (only with stock) above the three category tiles. */
export async function HomeJudaicaSection() {
  const { counts, products } = await getJudaicaHomeData();
  const banners = getActiveSeasons().filter((season) => (counts[season.category] || 0) > 0);
  const tiles = TILE_GROUPS.map((key) => PRODUCT_GROUPS.find((group) => group.key === key)!) as (ProductGroup & { key: TileKey })[];

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

        <div className="grid items-start gap-4 md:grid-cols-3 md:gap-7">
          {tiles.map((group) => (
            <CategoryTile key={group.key} group={group} products={products.filter((p) => group.types.includes(p.product_type))} />
          ))}
        </div>
      </div>
    </section>
  );
}
