"use client";

import { Heart, ChevronLeft, Truck, CheckCircle2 } from 'lucide-react';
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

export function ProductCard({ product }: { product: any }) {
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
  const displayBadge = product.product_type === 'מוצרי יודאיקה שונים' ? 'יודאיקה' : product.product_type;
  const productHref = `/products/${product.id}`;

  const prefetchProductPage = () => {
    router.prefetch(productHref);
  };

  return (
    <Link href={productHref} prefetch={false} onMouseEnter={prefetchProductPage} onFocus={prefetchProductPage} onTouchEnd={prefetchProductPage}>
      <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-500 border-none bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-premium relative">
        <div className="relative h-32 sm:h-48 overflow-hidden">
          <Image 
            loader={unsplashLoader} 
            src={mainImage} 
            alt={displayTitle} 
            fill 
            className="object-cover group-hover:scale-110 transition-transform duration-1000" 
          />
          <button 
            onClick={handleToggleFavorite} 
            className={cn(
              "absolute top-2 left-2 sm:top-4 sm:left-4 z-10 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all",
              isFavorite ? 'bg-accent text-primary shadow-lg' : 'bg-white/80 backdrop-blur-md text-primary/40 hover:bg-white shadow-sm'
            )}
          >
            <Heart className={cn("w-3 h-3 sm:w-4 sm:h-4", isFavorite ? 'fill-current' : '')} />
          </button>
          <Badge className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-primary text-white border-none px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[7px] sm:text-[9px] font-black uppercase tracking-tighter shadow-lg">
            {displayBadge}
          </Badge>
        </div>
        <CardContent className="p-3 sm:p-6 text-right space-y-2 sm:space-y-3">
          <h3 className="font-headline font-black text-sm sm:text-lg text-primary truncate flex-1 leading-tight">
            {displayTitle}
          </h3>
          <p className="text-[8px] sm:text-[10px] text-primary/40 font-bold">
            {product.script_type}
          </p>
          
          <div className="flex flex-col items-end pt-2 sm:pt-4 border-t border-muted/50 mt-1 sm:mt-2">
             <div className="flex items-center gap-1 sm:gap-1.5 text-primary font-black text-sm sm:text-base">
               <span className="text-accent text-xs sm:text-sm">₪</span>
               <span>{product.price}</span>
               <span className="text-[8px] sm:text-[10px] font-black text-muted-foreground mr-1">+ מע"מ</span>
             </div>
             <div className="flex items-center gap-1 mt-0.5">
               <span className="text-[7px] sm:text-[9px] text-primary/40 font-bold italic">
                 סה"כ ללקוח: ₪{finalPrice}
               </span>
             </div>
          </div>

          <div className="pt-1 sm:pt-2 flex items-center justify-between">
             <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-primary transition-all">
               <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
             </div>
             <div className="flex items-center gap-1 sm:gap-2 text-[8px] sm:text-[10px] font-black text-primary/60">
               <span>{product.script_level}</span>
               <CheckCircle2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-accent" />
             </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
