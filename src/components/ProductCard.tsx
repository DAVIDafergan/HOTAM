"use client";

import { Heart, ChevronLeft, MapPin } from 'lucide-react';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useSupabaseClient, useDoc, useMemoStable, setDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, arrayUnion, arrayRemove } from '@/lib/supabase-compat';
import { useToast } from '@/hooks/use-toast';
import unsplashLoader from '@/lib/unsplashLoader';
import { cn } from '@/lib/utils';

export function ProductCard({ product, distanceKm }: { product: any; distanceKm?: number }) {
  const { user } = useUser();
  const db = useSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();
  
  const customerRef = useMemoStable(() => user ? doc(db, 'customers', user.uid) : null, [db, user?.uid]);
  const sellerOwnRef = useMemoStable(() => user ? doc(db, 'sellers', user.uid) : null, [db, user?.uid]);
  
  const { data: customerData } = useDoc<any>(customerRef);
  const { data: sellerOwnData } = useDoc<any>(sellerOwnRef);

  const profileData = customerData || sellerOwnData;
  const profileRef = customerData ? customerRef : (sellerOwnData ? sellerOwnRef : null);
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
      className="block h-full touch-manipulation rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
    >
      <Card className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(15,23,42,0.14)] active:scale-[0.995] md:active:scale-100">
        <div className="relative h-48 overflow-hidden bg-primary/5 sm:h-52">
          <Image 
            loader={unsplashLoader} 
            src={mainImage} 
            alt={displayTitle} 
            fill 
            kind="product"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-1000 group-hover:scale-110" 
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
          <button 
            onClick={handleToggleFavorite} 
            className={cn(
              "absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full transition-all touch-manipulation",
              isFavorite ? 'bg-white text-primary shadow-lg' : 'bg-white/70 backdrop-blur-md text-primary/40 hover:bg-white shadow-sm'
            )}
            aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            <Heart className={cn("h-4 w-4", isFavorite ? 'fill-current' : '')} />
          </button>
        </div>
        <CardContent className="flex flex-1 flex-col space-y-3 p-4 text-right sm:p-5">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all group-hover:bg-primary/10">
                <ChevronLeft className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-right">
                <h3 className="font-headline text-base font-black leading-snug text-primary sm:text-lg">
                  {displayTitle}
                  {product.sub_type && product.product_type !== 'מוצרי יודאיקה שונים' ? ` · ${product.sub_type}` : ''}
                </h3>
                <p className="text-[11px] font-medium leading-relaxed text-primary/50 sm:text-xs">
                  {product.script_type || 'כתב מהודר'} {product.proofreading_level ? `• הגהה ${product.proofreading_level}` : ''}
                </p>
              </div>
            </div>
            {typeof distanceKm === 'number' && (
              <div className="flex justify-end">
                <Badge variant="outline" className="rounded-full border-primary/15 bg-transparent px-3 py-1 text-[11px] font-medium text-primary/60">
                  <MapPin className="ml-1.5 h-3 w-3" />
                  {distanceKm} ק״מ ממך
                </Badge>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-end justify-between border-t border-primary/5 pt-3.5">
            <div className="text-left">
              <p className="text-[10px] font-medium tracking-[0.15em] text-primary/30">כולל מע״מ</p>
              <p className="text-[13px] font-medium text-primary/45 sm:text-sm">₪{finalPrice}</p>
            </div>
            <div className="text-right">
              <div className="flex items-end justify-end gap-1 text-primary">
                <span className="text-[1.8rem] font-black tracking-tight sm:text-3xl">{product.price}</span>
                <span className="pb-1 text-base font-black text-primary/70 sm:text-lg">₪</span>
              </div>
              <p className="text-[10px] font-medium text-primary/35">לפני מע״מ</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
