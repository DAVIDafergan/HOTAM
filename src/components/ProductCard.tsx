"use client";

import { ArrowLeft, BadgeCheck, Heart, MapPin, Package, Store, Truck, UserRound } from 'lucide-react';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useApp, useSupabaseClient, setDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, arrayUnion, arrayRemove } from '@/lib/supabase-compat';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useOutOfSeason } from '@/hooks/use-out-of-season';
import {
  SEASONAL_BADGE_LABEL, describeJudaicaAttributes, getJudaicaCategory, isSeasonalCategory,
} from '@/lib/product-catalog';

export type ProductCardViewMode = 'grid' | 'list';

/** Public seller fields shown in the card's "post" header. */
export type ProductCardSeller = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_image?: string | null;
  city?: string | null;
};

function getDeliveryLabel(deliveryType: unknown): { label: string; icon: typeof Truck } {
  const raw = String(deliveryType || '').toLowerCase();
  if (raw === 'shipping' || raw === 'shipping_only') return { label: 'משלוח', icon: Truck };
  if (raw === 'pickup' || raw === 'pickup_only') return { label: 'איסוף עצמי', icon: Store };
  return { label: 'משלוח / איסוף', icon: Package };
}

export function ProductCard({
  product,
  distanceKm,
  priority,
  viewMode = 'grid',
  seller: sellerProp,
}: {
  product: any;
  distanceKm?: number;
  priority?: boolean;
  viewMode?: ProductCardViewMode;
  seller?: ProductCardSeller | null;
}) {
  const { user, profile } = useApp();
  const db = useSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();
  const isList = viewMode === 'list';

  const profileRef = user && profile?.role
    ? doc(db, profile.role === 'seller' ? 'sellers' : 'customers', user.uid)
    : null;
  const profileData = profile;
  const isFavorite = profileData?.favorite_product_ids?.includes(product.id);

  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';
  const mainImage = product.images?.[0] || logoImg;

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast({ title: "התחברות נדרשת" }); return; }
    if (!profileRef) { toast({ variant: "destructive", title: "פרופיל לא מוכן" }); return; }

    setDocumentNonBlocking(profileRef, {
      favorite_product_ids: isFavorite ? arrayRemove(product.id) : arrayUnion(product.id)
    }, { merge: true });

    toast({
      variant: "success",
      title: isFavorite ? "הוסר מהמועדפים" : "נוסף למועדפים - תוכלו למצוא אותו באיזור האישי"
    });
  };

  const finalPrice = Math.round(Number(product.price) * 1.18).toLocaleString('he-IL');

  // Logic for displaying title for Judaica
  const displayTitle = product.product_type === 'מוצרי יודאיקה שונים' ? (product.sub_type || 'מוצר יודאיקה') : product.product_type;
  const subtitle = product.sub_type && product.product_type !== 'מוצרי יודאיקה שונים' ? product.sub_type : '';
  const productHref = `/products/${product.id}`;

  const seller: ProductCardSeller | null = sellerProp ?? product.seller ?? null;
  const sellerName = seller ? `${seller.first_name || ''} ${seller.last_name || ''}`.trim() : '';
  const delivery = getDeliveryLabel(product.delivery_type);
  const DeliveryIcon = delivery.icon;
  const judaicaCategory = getJudaicaCategory(product.product_type);
  const specChips = (judaicaCategory
    ? describeJudaicaAttributes(judaicaCategory, product.attributes || {}).map(([, value]) => value).slice(0, 3)
    : [
        product.script_type,
        product.proofreading_level ? `הגהה ${product.proofreading_level}` : null,
        product.parchment_size ? `${product.parchment_size} ס״מ` : null,
      ]).filter(Boolean) as string[];
  const outOfSeason = useOutOfSeason();
  const showSeasonalBadge = outOfSeason && isSeasonalCategory(product.product_type);

  const prefetchProductPage = () => {
    router.prefetch(productHref);
  };

  const favoriteButton = (
    <button
      onClick={handleToggleFavorite}
      className={cn(
        "absolute z-10 flex items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 touch-manipulation hover:scale-110 active:scale-90",
        // Keep the visible chip compact on the small list thumbnail, but expand the
        // actual tap target to ~44px via an invisible hit-area, per touch-target guidance.
        isList ? "left-1.5 top-1.5 h-7 w-7 before:absolute before:-inset-2.5 before:content-['']" : "left-3 top-3 h-11 w-11",
        isFavorite ? 'bg-white text-rose-500 shadow-md' : 'bg-white/70 text-primary/60 hover:bg-white hover:text-rose-500'
      )}
      aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
    >
      <Heart className={cn(isList ? "h-3.5 w-3.5" : "h-4 w-4", "transition-transform duration-200", isFavorite ? 'fill-current' : '')} />
    </button>
  );

  const linkProps = {
    href: productHref,
    prefetch: false,
    onMouseEnter: prefetchProductPage,
    onFocus: prefetchProductPage,
    onTouchEnd: prefetchProductPage,
  } as const;

  if (isList) {
    return (
      <Link
        {...linkProps}
        className="group block touch-manipulation rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <article className="flex flex-row items-stretch gap-3 overflow-hidden rounded-[1.5rem] border border-primary/5 bg-white p-2.5 shadow-premium transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl sm:gap-4 sm:p-3">
          <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-xl bg-primary/[0.03] sm:w-28">
            <Image
              src={mainImage}
              alt={displayTitle}
              fill
              kind="product"
              priority={priority}
              sizes="112px"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            />
            {favoriteButton}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 pl-1 text-right">
            {sellerName && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-primary/50">
                <span className="truncate">{sellerName}</span>
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-accent text-white" aria-hidden="true" />
              </p>
            )}
            <h3 className="font-headline text-sm font-bold leading-snug text-primary line-clamp-2 sm:text-base">
              {displayTitle}{subtitle ? ` · ${subtitle}` : ''}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-primary/50">
              {specChips[0] && <span className="rounded-full bg-primary/[0.04] px-2 py-0.5">{specChips[0]}</span>}
              {typeof distanceKm === 'number' && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" />{distanceKm} ק״מ ממך</span>
              )}
            </div>
            <div className="mt-auto flex items-baseline gap-1 text-primary">
              <span className="text-lg font-black tracking-tight tabular-nums sm:text-xl">{finalPrice}</span>
              <span className="text-sm font-bold text-primary/50">₪</span>
              <span className="mr-1 text-[10px] font-medium text-primary/35">כולל מע״מ</span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link
      {...linkProps}
      className="group block h-full touch-manipulation rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-premium transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl">
        {/* Post header — who is selling, like the author row of a social post */}
        {seller && (
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-accent/30">
              {seller.profile_image ? (
                <Image src={seller.profile_image} alt={sellerName || 'סופר'} fill kind="avatar" sizes="36px" className="object-cover" />
              ) : (
                <UserRound className="h-4 w-4 text-primary/25" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="flex items-center gap-1 text-[13px] font-bold leading-tight text-primary">
                <span className="truncate">{sellerName || 'סופר סת״ם'}</span>
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-accent text-white" aria-label="סופר מאומת" />
              </p>
              {seller.city && (
                <p className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 text-accent" />
                  <span className="truncate">{seller.city}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className={cn("relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-primary/[0.03]", !seller && "rounded-t-[1.75rem]")}>
          <Image
            src={mainImage}
            alt={displayTitle}
            fill
            kind="product"
            priority={priority}
            sizes="(max-width: 640px) 70vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
          {favoriteButton}
          {product.product_type && (
            <div className="absolute right-3 top-3 z-10 flex max-w-[65%] flex-col items-start gap-1">
              <span className="max-w-full truncate rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold text-primary backdrop-blur-md">
                {product.product_type}
              </span>
              {showSeasonalBadge && (
                <span className="max-w-full truncate rounded-full bg-amber-100/95 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                  {SEASONAL_BADGE_LABEL}
                </span>
              )}
            </div>
          )}
          <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-primary/80 backdrop-blur-md">
              <DeliveryIcon className="h-3 w-3 text-accent-strong" />
              {delivery.label}
            </span>
            {typeof distanceKm === 'number' && (
              <span className="flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-primary/80 backdrop-blur-md">
                <MapPin className="h-3 w-3 text-accent-strong" />
                {distanceKm} ק״מ
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 text-right sm:p-5">
          <div className="space-y-2">
            <h3 className="font-headline text-[15px] font-bold leading-snug text-primary line-clamp-1 transition-colors group-hover:text-accent-strong sm:text-base">
              {displayTitle}{subtitle ? ` · ${subtitle}` : ''}
            </h3>
            {specChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {specChips.map((chip) => (
                  <span key={chip} className="rounded-full bg-[#F8F9FA] px-2.5 py-1 text-[10px] font-semibold text-primary/60">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 border-t border-primary/5 pt-3">
            <div>
              <div className="flex items-baseline gap-1 text-primary">
                <span className="text-xl font-black tracking-tight tabular-nums sm:text-2xl">{finalPrice}</span>
                <span className="text-sm font-bold text-primary/50">₪</span>
              </div>
              <p className="text-[10px] font-medium text-primary/35">כולל מע״מ</p>
            </div>
            <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-[11px] font-bold text-primary-foreground transition-colors group-hover:bg-accent group-hover:text-primary">
              לפרטים
              <ArrowLeft className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
