"use client";

import { Heart, ChevronLeft, Truck, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
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
  const normalizedDeliveryType = (() => {
    const raw = String(product.delivery_type || '').toLowerCase();
    if (raw === 'delivery' || raw === 'shipping' || raw === 'shipping_only') return 'shipping';
    if (raw === 'pickup' || raw === 'pickup_only') return 'pickup';
    return 'both';
  })();
  const deliveryLabel =
    normalizedDeliveryType === 'shipping'
      ? 'משלוח בלבד'
      : normalizedDeliveryType === 'pickup'
        ? 'איסוף עצמי'
        : 'משלוח ואיסוף';

  // Logic for displaying title for Judaica
  const displayTitle = product.product_type === 'מוצרי יודאיקה שונים' ? (product.sub_type || 'מוצר יודאיקה') : product.product_type;
  const displayBadge = product.product_type === 'מוצרי יודאיקה שונים' ? 'יודאיקה' : product.product_type;
  const productHref = `/products/${product.id}`;

  const prefetchProductPage = () => {
    router.prefetch(productHref);
  };

  return (
    <Link href={productHref} prefetch={false} onMouseEnter={prefetchProductPage} onFocus={prefetchProductPage} onTouchEnd={prefetchProductPage}>
      <Card className="group relative overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_25px_60px_rgba(15,23,42,0.14)]">
        <div className="relative h-44 overflow-hidden bg-primary/5">
          <Image 
            loader={unsplashLoader} 
            src={mainImage} 
            alt={displayTitle} 
            fill 
            className="object-cover transition-transform duration-1000 group-hover:scale-110" 
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-primary/80 via-primary/10 to-transparent" />
          <button 
            onClick={handleToggleFavorite} 
            className={cn(
              "absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all",
              isFavorite ? 'bg-accent text-primary shadow-lg' : 'bg-white/80 backdrop-blur-md text-primary/40 hover:bg-white shadow-sm'
            )}
          >
            <Heart className={cn("h-4 w-4", isFavorite ? 'fill-current' : '')} />
          </button>
          <Badge className="absolute right-3 top-3 rounded-full border-none bg-white/90 px-3 py-1 text-[10px] font-black text-primary shadow-lg backdrop-blur-md">
            {displayBadge}
          </Badge>
          <div className="absolute bottom-3 right-3 flex flex-wrap justify-end gap-2">
            <Badge className="rounded-full border-none bg-accent px-3 py-1 text-[10px] font-black text-primary shadow-md">
              {product.script_level}
            </Badge>
            <Badge className="rounded-full border border-white/10 bg-primary/80 px-3 py-1 text-[10px] font-black text-white backdrop-blur-md">
              {deliveryLabel}
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-4 p-5 text-right">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all group-hover:bg-accent group-hover:text-primary">
                <ChevronLeft className="h-4 w-4" />
              </div>
              <div className="space-y-1 text-right">
                <h3 className="font-headline text-lg font-black leading-tight text-primary">
                  {displayTitle}
                  {product.sub_type && product.product_type !== 'מוצרי יודאיקה שונים' ? ` · ${product.sub_type}` : ''}
                </h3>
                <p className="text-xs font-bold text-primary/45">
                  {product.script_type || 'כתב מהודר'} {product.proofreading_level ? `• הגהה ${product.proofreading_level}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="outline" className="rounded-full border-primary/10 bg-primary/[0.03] px-3 py-1 text-[11px] font-bold text-primary/70">
                <Sparkles className="ml-1.5 h-3 w-3 text-accent" />
                רמת הידור {product.script_level}
              </Badge>
              {typeof distanceKm === 'number' && (
                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  <MapPin className="ml-1.5 h-3 w-3" />
                  {distanceKm} ק״מ ממך
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] bg-[#FBFAF7] p-3">
            <div className="space-y-1 rounded-[1.25rem] border border-primary/5 bg-white px-3 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">זמינות</p>
              <div className="flex items-center justify-end gap-1.5 text-sm font-black text-primary">
                <span>{product.quantity} יח'</span>
                <CheckCircle2 className="h-4 w-4 text-accent" />
              </div>
            </div>
            <div className="space-y-1 rounded-[1.25rem] border border-primary/5 bg-white px-3 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/35">אספקה</p>
              <div className="flex items-center justify-end gap-1.5 text-sm font-black text-primary">
                <span>{product.delivery_time ? `${product.delivery_time} ימים` : 'מהיר'}</span>
                <Truck className="h-4 w-4 text-accent" />
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between border-t border-primary/5 pt-4">
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/30">כולל מע״מ</p>
              <p className="text-sm font-bold text-primary/45">₪{finalPrice} ללקוח</p>
            </div>
            <div className="text-right">
              <div className="flex items-end justify-end gap-1.5 text-primary">
                <span className="text-3xl font-black tracking-tight">{product.price}</span>
                <span className="pb-1 text-lg font-black text-accent">₪</span>
              </div>
              <p className="text-[10px] font-black text-primary/40">לפני מע״מ</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
