"use client";

import { Heart, ChevronLeft, MapPin } from 'lucide-react';
import Image from 'next/image';
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
    <Link href={productHref} prefetch={false} onMouseEnter={prefetchProductPage} onFocus={prefetchProductPage} onTouchEnd={prefetchProductPage}>
      <Card className="group relative overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(15,23,42,0.14)]">
        <div className="relative h-52 overflow-hidden bg-primary/5">
          <Image 
            loader={unsplashLoader} 
            src={mainImage} 
            alt={displayTitle} 
            fill 
            className="object-cover transition-transform duration-1000 group-hover:scale-110" 
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
          <button 
            onClick={handleToggleFavorite} 
            className={cn(
              "absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all",
              isFavorite ? 'bg-white text-primary shadow-lg' : 'bg-white/70 backdrop-blur-md text-primary/40 hover:bg-white shadow-sm'
            )}
          >
            <Heart className={cn("h-4 w-4", isFavorite ? 'fill-current' : '')} />
          </button>
        </div>
        <CardContent className="space-y-3 p-5 text-right">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all group-hover:bg-primary/10">
                <ChevronLeft className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-right">
                <h3 className="font-headline text-lg font-black leading-tight text-primary">
                  {displayTitle}
                  {product.sub_type && product.product_type !== 'מוצרי יודאיקה שונים' ? ` · ${product.sub_type}` : ''}
                </h3>
                <p className="text-xs font-medium text-primary/45">
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

          <div className="flex items-end justify-between border-t border-primary/5 pt-3">
            <div className="text-left">
              <p className="text-[10px] font-medium tracking-[0.15em] text-primary/30">כולל מע״מ</p>
              <p className="text-sm font-medium text-primary/45">₪{finalPrice}</p>
            </div>
            <div className="text-right">
              <div className="flex items-end justify-end gap-1 text-primary">
                <span className="text-3xl font-black tracking-tight">{product.price}</span>
                <span className="pb-1 text-lg font-black text-primary/70">₪</span>
              </div>
              <p className="text-[10px] font-medium text-primary/35">לפני מע״מ</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
