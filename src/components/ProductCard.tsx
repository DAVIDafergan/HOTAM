"use client";

import { Heart, MapPin } from 'lucide-react';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useApp, useSupabaseClient, setDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, arrayUnion, arrayRemove } from '@/lib/supabase-compat';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export type ProductCardViewMode = 'grid' | 'list';

export function ProductCard({
  product,
  distanceKm,
  priority,
  viewMode = 'grid',
}: {
  product: any;
  distanceKm?: number;
  priority?: boolean;
  viewMode?: ProductCardViewMode;
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
      title: isFavorite ? "הוסר מהמועדפים" : "נוסף למועדפים - תוכלו למצוא אותו באיזור האישי"
    });
  };

  const finalPrice = (Number(product.price) * 1.18).toFixed(0);

  // Logic for displaying title for Judaica
  const displayTitle = product.product_type === 'מוצרי יודאיקה שונים' ? (product.sub_type || 'מוצר יודאיקה') : product.product_type;
  const productHref = `/products/${product.id}`;

  const prefetchProductPage = () => {
    router.prefetch(productHref);
  };

  return (
    <Link
      href={productHref}
      prefetch={false}
      onMouseEnter={prefetchProductPage}
      onFocus={prefetchProductPage}
      onTouchEnd={prefetchProductPage}
      className={cn(
        "group block touch-manipulation rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
        !isList && "h-full"
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-[1.5rem] bg-white transition-all duration-500 ease-out hover:-translate-y-1",
          isList ? "flex flex-row items-stretch gap-3 p-2.5 sm:gap-4 sm:p-3" : "flex h-full flex-col"
        )}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden bg-primary/[0.03] shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-primary/[0.04] transition-shadow duration-500 group-hover:shadow-[0_20px_45px_rgba(15,23,42,0.10)]",
            isList ? "aspect-square w-24 rounded-xl sm:w-28" : "aspect-[4/5] w-full rounded-[1.5rem]"
          )}
        >
          <Image
            src={mainImage}
            alt={displayTitle}
            fill
            kind="product"
            priority={priority}
            sizes={isList ? "112px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
          <button
            onClick={handleToggleFavorite}
            className={cn(
              "absolute z-10 flex items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 touch-manipulation hover:scale-110 active:scale-90",
              // Keep the visible chip compact on the small list thumbnail, but expand the
              // actual tap target to ~44px via an invisible hit-area, per touch-target guidance.
              isList ? "left-1.5 top-1.5 h-7 w-7 before:absolute before:-inset-2.5 before:content-['']" : "left-3 top-3 h-11 w-11",
              isFavorite ? 'bg-white text-primary shadow-md' : 'bg-white/60 text-primary/50 hover:bg-white/90 hover:text-primary'
            )}
            aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            <Heart className={cn(isList ? "h-3.5 w-3.5" : "h-4 w-4", "transition-transform duration-200", isFavorite ? 'fill-current' : '')} />
          </button>
          {typeof distanceKm === 'number' && !isList && (
            <div className="absolute right-3 top-3 z-10">
              <div className="flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-primary/70">
                <MapPin className="h-3 w-3 text-primary/40" />
                {distanceKm} ק״מ
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col text-right min-w-0",
            isList ? "gap-1.5 py-1 pl-1" : "gap-3 p-4 sm:p-5"
          )}
        >
          <div className="space-y-0.5">
            <h3
              className={cn(
                "font-headline font-bold leading-snug text-primary",
                isList ? "text-sm line-clamp-2 sm:text-base" : "text-[15px] line-clamp-1 sm:text-base"
              )}
            >
              {displayTitle}
              {product.sub_type && product.product_type !== 'מוצרי יודאיקה שונים' ? ` · ${product.sub_type}` : ''}
            </h3>
            <p className="text-[12px] font-medium leading-relaxed text-primary/40 line-clamp-1">
              {product.script_type || 'כתב מהודר'} {product.proofreading_level ? `• הגהה ${product.proofreading_level}` : ''}
            </p>
            {isList && typeof distanceKm === 'number' && (
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-primary/40">
                <MapPin className="h-3 w-3 text-primary/30" />
                {distanceKm} ק״מ ממך
              </div>
            )}
          </div>

          <div className="mt-auto space-y-0.5">
            <div className="flex items-baseline justify-end gap-1 text-primary">
              <span className={cn("font-black tracking-tight", isList ? "text-lg sm:text-xl" : "text-xl sm:text-2xl")}>{finalPrice}</span>
              <span className="text-sm font-bold text-primary/50">₪</span>
            </div>
            <p className="text-[10px] font-medium text-primary/30">המחירים כוללים מע״מ</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
