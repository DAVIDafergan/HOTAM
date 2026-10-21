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
import { Price } from '@/components/Price';
import { useActiveSeasons } from '@/hooks/use-active-seasons';
import {
  describeJudaicaAttributes, getJudaicaCategory, seasonalBadgeLabel, shouldShowSeasonalBadge,
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
  density = 'regular',
  seller: sellerProp,
}: {
  product: any;
  distanceKm?: number;
  priority?: boolean;
  viewMode?: ProductCardViewMode;
  /**
   * 'compact' = a short card on phones (square image, 1–2 line title, one line of chips,
   * no seller header) so two fit side by side; from md up it is the regular card.
   */
  density?: 'regular' | 'compact';
  seller?: ProductCardSeller | null;
}) {
  const { user, profile } = useApp();
  const db = useSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();
  const isList = viewMode === 'list';
  const compact = density === 'compact' && !isList;

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
  const activeSeasons = useActiveSeasons();
  const showSeasonalBadge = shouldShowSeasonalBadge(product.product_type, activeSeasons);

  const prefetchProductPage = () => {
    router.prefetch(productHref);
  };

  const favoriteButton = (
    <button
      onClick={handleToggleFavorite}
      className={cn(
        "fav-btn absolute z-10 flex items-center justify-center rounded-full transition-colors duration-200 touch-manipulation active:scale-90",
        // Keep the visible chip compact on the small list thumbnail, but expand the
        // actual tap target to ~44px via an invisible hit-area, per touch-target guidance.
        isList
          ? "left-1.5 top-1.5 h-7 w-7 before:absolute before:-inset-2.5 before:content-['']"
          : compact
            ? "left-2 top-2 h-8 w-8 before:absolute before:-inset-1.5 before:content-[''] md:left-3 md:top-3 md:h-11 md:w-11 md:before:hidden"
            : "left-3 top-3 h-11 w-11",
        isFavorite ? 'bg-card text-rose-600 shadow-md' : 'bg-card/90 text-primary/70 shadow-sm hover:bg-card hover:text-rose-600'
      )}
      aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
      data-fav={isFavorite ? 'true' : 'false'}
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
        <article className="flex flex-row items-stretch gap-3 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card p-2.5 shadow-premium transition-shadow duration-500 ease-lux group-hover:shadow-premium-lg sm:gap-4 sm:p-3">
          <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-secondary/60 sm:w-32">
            <Image
              src={mainImage}
              alt={displayTitle}
              fill
              kind="product"
              priority={priority}
              sizes="128px"
              className="object-cover zoom-on-hover"
            />
            {favoriteButton}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 pl-1 text-right">
            {sellerName && (
              <p className="flex items-center gap-1 text-[13px] font-medium text-primary/65">
                <span className="truncate">{sellerName}</span>
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-accent text-white" aria-hidden="true" />
              </p>
            )}
            <h3 className="font-body text-[18px] font-semibold leading-snug text-primary line-clamp-2 sm:text-[19px]">
              {displayTitle}{subtitle ? ` · ${subtitle}` : ''}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-primary/65">
              {specChips[0] && <span className="rounded-full bg-secondary/70 px-2.5 py-0.5">{specChips[0]}</span>}
              {typeof distanceKm === 'number' && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" />{distanceKm} ק״מ ממך</span>
              )}
            </div>
            <div className="mt-auto flex items-baseline gap-2">
              <Price value={finalPrice} className="text-[21px] leading-none" />
              <span className="text-xs font-medium text-muted-foreground">כולל מע״מ</span>
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
      <article className={cn("flex h-full flex-col overflow-hidden border border-border/70 bg-card shadow-premium transition-[box-shadow,transform] duration-500 ease-lux md:group-hover:-translate-y-1 group-hover:shadow-premium-lg", compact ? "rounded-[1.25rem] md:rounded-[1.5rem]" : "rounded-[1.5rem]")}>
        {/* Post header — who is selling, like the author row of a social post */}
        {seller && (
          <div className={cn("items-center gap-2.5 px-4 pt-3.5 pb-3", compact ? "hidden md:flex" : "flex")}>
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary ring-1 ring-accent/40">
              {seller.profile_image ? (
                <Image src={seller.profile_image} alt={sellerName || 'סופר'} fill kind="avatar" sizes="36px" className="object-cover" />
              ) : (
                <UserRound className="h-4 w-4 text-primary/25" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="flex items-center gap-1 text-sm font-medium leading-tight text-primary">
                <span className="truncate">{sellerName || 'סופר סת״ם'}</span>
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-accent text-white" aria-label="סופר מאומת" />
              </p>
              {seller.city && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3 text-accent-strong" />
                  <span className="truncate">{seller.city}</span>
                </p>
              )}
            </div>
          </div>
        )}

        <div className={cn("relative w-full shrink-0 overflow-hidden bg-secondary/60", compact ? "aspect-square md:aspect-[4/5]" : "aspect-[4/5]")}>
          {/* Scroll-linked settle (outer) and desktop hover zoom (image) live on separate layers
              so the two transforms never fight. */}
          <div className="media-rise absolute inset-0">
            <Image
              src={mainImage}
              alt={displayTitle}
              fill
              kind="product"
              priority={priority}
              sizes={compact ? "(max-width: 768px) 46vw, (max-width: 1024px) 33vw, 25vw" : "(max-width: 640px) 70vw, (max-width: 1024px) 33vw, 25vw"}
              className="object-cover zoom-on-hover"
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
          {favoriteButton}
          {product.product_type && (
            <div className={cn("absolute z-10 flex max-w-[65%] flex-col items-start gap-1", compact ? "right-2 top-2 md:right-3 md:top-3" : "right-3 top-3")}>
              <span className={cn("max-w-full truncate rounded-full bg-card/95 font-semibold text-primary shadow-sm", compact ? "px-2 py-0.5 text-[11px] md:px-2.5 md:py-1 md:text-xs" : "px-2.5 py-1 text-xs")}>
                {product.product_type}
              </span>
              {showSeasonalBadge && (
                <span className="max-w-full truncate rounded-full bg-amber-100/95 px-2.5 py-1 text-xs font-bold text-amber-800">
                  {seasonalBadgeLabel(product.product_type)}
                </span>
              )}
            </div>
          )}
          <div className={cn("absolute inset-x-3 bottom-3 z-10 items-center justify-between gap-2", compact ? "hidden md:flex" : "flex")}>
            <span className="flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-primary/85 shadow-sm">
              <DeliveryIcon className="h-3 w-3 text-accent-strong" />
              {delivery.label}
            </span>
            {typeof distanceKm === 'number' && (
              <span className="flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-semibold text-primary/85 shadow-sm">
                <MapPin className="h-3 w-3 text-accent-strong" />
                {distanceKm} ק״מ
              </span>
            )}
          </div>
        </div>

        <div className={cn("flex min-w-0 flex-1 flex-col text-right", compact ? "gap-2 p-3 md:gap-3 md:p-5" : "gap-3 p-4 sm:p-5")}>
          <div className={compact ? "space-y-1.5 md:space-y-2" : "space-y-2"}>
            <h3 className={cn("font-body font-semibold leading-snug text-primary line-clamp-2", compact ? "min-h-[2.7em] text-[15px] md:min-h-[2.75em] md:text-[21px]" : "min-h-[2.75em] text-[20px] sm:text-[21px]")}>
              {displayTitle}{subtitle ? ` · ${subtitle}` : ''}
            </h3>
            {compact && sellerName && (
              <p className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground md:hidden">
                <span className="truncate">{sellerName}</span>
                <BadgeCheck className="h-3 w-3 shrink-0 fill-accent text-white" aria-hidden="true" />
              </p>
            )}
            {specChips.length > 0 && (
              // Compact: a single line of chips on phones (overflow clipped), full set from md.
              <div className={cn("flex gap-1.5", compact ? "h-[22px] flex-wrap overflow-hidden md:h-auto" : "flex-wrap")}>
                {specChips.map((chip) => (
                  <span key={chip} className={cn("shrink-0 rounded-full bg-secondary text-primary/80", compact ? "px-2 py-0.5 text-[11px] md:px-2.5 md:py-1 md:text-xs" : "px-2.5 py-1 text-xs font-normal")}>
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={cn("mt-auto flex items-end justify-between gap-2 border-t border-border/60", compact ? "pt-2.5 md:pt-3.5" : "pt-3.5")}>
            <div className="text-right">
              <Price value={finalPrice} className={compact ? "text-[20px] leading-none md:text-[24px]" : "text-[24px] leading-none"} />
              <p className={cn("text-muted-foreground", compact ? "mt-1 text-[11px] md:mt-1.5 md:text-xs" : "mt-1.5 text-xs")}>כולל מע״מ</p>
            </div>
            <span className={cn("h-11 shrink-0 items-center gap-1.5 text-[14px] font-medium text-accent-strong", compact ? "hidden md:inline-flex" : "inline-flex")}>
              לפרטים
              <ArrowLeft className="h-4 w-4 transition-transform duration-300 ease-lux group-hover:-translate-x-1" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
