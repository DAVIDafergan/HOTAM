"use client";

import { useState, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  CheckCircle2, 
  MapPin, 
  Star,
  Loader2,
  Truck,
  ShoppingCart,
  CalendarCheck,
  UserRound,
  Quote,
  X,
  ScrollText,
  ShieldAlert,
  Clock,
  ArrowLeft,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useFirestore, useDoc, useMemoFirebase, useUser, setDocumentNonBlocking, useCollection, addDocumentNonBlocking } from '@/firebase';
import { doc, arrayUnion, arrayRemove, collection, serverTimestamp, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import unsplashLoader from '@/lib/unsplashLoader';
import { cn } from '@/lib/utils';

export function ProductDetailsClient({ productId }: { productId: string }) {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);

  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const productRef = useMemoFirebase(() => {
    if (!productId) return null;
    return doc(db, 'products', productId);
  }, [db, productId]);

  const { data: product, isLoading: isProductLoading } = useDoc<any>(productRef);

  const customerRef = useMemoFirebase(() => user ? doc(db, 'customers', user.uid) : null, [db, user?.uid]);
  const sellerOwnRef = useMemoFirebase(() => user ? doc(db, 'sellers', user.uid) : null, [db, user?.uid]);
  
  const { data: customerData } = useDoc<any>(customerRef);
  const { data: sellerOwnData } = useDoc<any>(sellerOwnRef);

  const profileData = customerData || sellerOwnData;
  const profileRef = customerData ? customerRef : (sellerOwnData ? sellerOwnRef : null);
  const isFavorite = profileData?.favoriteProductIds?.includes(productId);

  const sellerRef = useMemoFirebase(() => {
    if (!product?.sellerId) return null;
    return doc(db, 'sellers', product.sellerId);
  }, [db, product?.sellerId]);

  const { data: seller, isLoading: isSellerLoading } = useDoc<any>(sellerRef);

  const reviewsQuery = useMemoFirebase(() => {
    if (!productId) return null;
    return query(collection(db, 'reviews'), where('productId', '==', productId));
  }, [db, productId]);
  const { data: reviews } = useCollection<any>(reviewsQuery);

  const handleToggleFavorite = () => {
    if (!user || !profileRef) {
      toast({ title: "התחברות נדרשת" });
      return;
    }
    setDocumentNonBlocking(profileRef, {
      favoriteProductIds: isFavorite ? arrayRemove(productId) : arrayUnion(productId)
    }, { merge: true });
    
    toast({ 
      title: isFavorite ? "הוסר מהמועדפים" : "נוסף למועדפים - תוכלו למצוא אותו באיזור האישי" 
    });
  };

  const handlePurchaseClick = () => {
    if (!user) { router.push('/login'); return; }
    if (product?.quantity <= 0) { toast({ variant: "destructive", title: "אזל מהמלאי" }); return; }
    router.push(`/checkout/${productId}`);
  };

  const handleTorahCoordination = () => {
    if (!user) { router.push('/login'); return; }
    setIsProcessingRequest(true);

    const requestData = {
      sellerId: product.sellerId,
      productId: productId,
      productName: 'ספר תורה',
      productImage: product.images?.[0] || '',
      amount: product.price,
      status: 'torah_request',
      buyerId: user.uid,
      createdAt: serverTimestamp(),
      isTorahRequest: true,
      deliveryMethod: 'תיאום מול האתר'
    };

    addDocumentNonBlocking(collection(db, 'orders'), requestData);
    
    setTimeout(() => {
      setIsProcessingRequest(false);
      toast({ 
        title: "הבקשה נשלחה בהצלחה", 
        description: "נציג 'חותם' יחזור אליך בהקדם לתיאום פגישה להתרשמות מהספר." 
      });
      router.push('/customer/dashboard');
    }, 1000);
  };

  const handleShare = async () => {
    const shareData = {
      title: `חותם | ${product?.productType}`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); toast({ title: "הקישור הועתק" }); }
    } catch (err) {}
  };

  if (isProductLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center">המוצר לא נמצא</div>;

  const rawImages = Array.isArray(product.images) ? product.images : [];
  const images = rawImages.length > 0 ? rawImages : [logoImg];
  const currentImage = images[selectedImageIdx] || logoImg;
  const displayPrice = (Number(product.price) * 1.18).toFixed(0);

  return (
    <div className="min-h-screen bg-[#FDFCF0] pb-32" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-24 md:py-32 max-w-5xl">
        
        {/* Mobile Header Actions */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white/50 border">
            <ChevronRight className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleShare} className="rounded-full bg-white shadow-sm"><Share2 className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={handleToggleFavorite} className={cn("rounded-full bg-white shadow-sm transition-all", isFavorite ? 'bg-accent text-primary' : '')}><Heart className={cn("w-4 h-4", isFavorite ? 'fill-current' : '')} /></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-premium bg-white border-4 border-white">
              <Image loader={unsplashLoader} src={currentImage} alt={product.productType} fill priority className="object-cover" />
              {product.quantity <= 0 && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <Badge variant="destructive" className="px-8 py-3 text-sm font-black uppercase tracking-widest rounded-full shadow-2xl">אזל מהמלאי</Badge>
                </div>
              )}
              <div className="absolute top-4 right-4 hidden md:block">
                <Badge className="bg-primary/80 backdrop-blur-md text-white border-none px-4 py-1.5 rounded-full font-black text-[10px] uppercase">
                  {product.scriptLevel}
                </Badge>
              </div>
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar px-1">
                {images.map((img: string, i: number) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedImageIdx(i)} 
                    className={cn(
                      "relative w-20 h-20 rounded-2xl overflow-hidden border-4 transition-all shrink-0 shadow-sm",
                      selectedImageIdx === i ? 'border-accent scale-105' : 'border-white hover:border-accent/30'
                    )}
                  >
                    <Image loader={unsplashLoader} src={img} alt="Thumb" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="text-right space-y-6 md:space-y-8">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 justify-start items-center">
                <Badge variant="outline" className="border-accent/40 text-accent font-black text-[10px] py-1 px-3 rounded-full bg-accent/5">
                  {product.scriptLevel}
                </Badge>
                <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] py-1 px-3 rounded-full">
                  <CheckCircle2 className="w-3 h-3 ml-1.5" />
                  זמין במלאי ({product.quantity})
                </Badge>
              </div>
              <h1 className="text-3xl md:text-5xl font-headline font-black text-primary leading-[1.1] tracking-tight">
                {product.productType} 
                {product.subType && product.subType !== 'all' && (
                  <span className="text-accent block md:inline md:mr-3 mt-1 md:mt-0 font-black">{product.subType}</span>
                )}
              </h1>
            </div>

            {/* Price Card - Optimized for Mobile */}
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-white overflow-hidden">
               <div className="p-6 md:p-8 flex flex-col gap-6">
                  <div className="flex flex-col items-center md:items-start text-center md:text-right gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-primary text-5xl md:text-6xl font-black tabular-nums tracking-tighter">{displayPrice}</span>
                      <span className="text-accent text-2xl md:text-3xl font-black">₪</span>
                    </div>
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] mt-1">מחיר סופי כולל מע"מ ומשלוח</p>
                  </div>

                  <div className="h-px bg-primary/5 w-full" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center md:items-end gap-1.5 p-3 rounded-2xl bg-slate-50/50">
                      <Clock className="w-5 h-5 text-accent" />
                      <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">זמן אספקה</span>
                      <span className="text-xs font-black text-primary leading-none">
                        {product.productType === 'ספר תורה' ? 'בתיאום אישי' : `${product.deliveryTime || '3'} ימים`}
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-1.5 p-3 rounded-2xl bg-slate-50/50">
                      <Truck className="w-5 h-5 text-accent" />
                      <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">עלות משלוח</span>
                      <span className="text-xs font-black text-emerald-600 leading-none">
                        {Number(product.deliveryFee) > 0 ? `₪${product.deliveryFee}` : 'משלוח חינם'}
                      </span>
                    </div>
                  </div>
               </div>
            </Card>

            <div className="space-y-4">
              <h3 className="font-black text-sm text-primary/40 uppercase tracking-widest flex items-center justify-end gap-2">
                על כלי הקודש <ScrollText className="w-4 h-4" />
              </h3>
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-[2.5rem] border-r-[6px] border-accent shadow-sm italic text-primary/80 font-medium text-lg leading-relaxed">
                "{product.description}"
              </div>
            </div>
          </div>
        </div>

        {/* Technical Details Tabs */}
        <div className="mt-12 md:mt-20">
          <Tabs defaultValue="specs" className="text-right">
            <TabsList className="w-full flex bg-white/40 backdrop-blur-xl p-1.5 rounded-3xl shadow-premium h-16 border border-white/50 mb-8">
              <TabsTrigger value="specs" className="flex-1 py-3 text-[10px] md:text-xs font-black rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">מפרט טכני</TabsTrigger>
              <TabsTrigger value="seller" className="flex-1 py-3 text-[10px] md:text-xs font-black rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">הסופר הכותב</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1 py-3 text-[10px] md:text-xs font-black rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">ביקורות ({(reviews || []).length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="specs" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="border-none shadow-premium rounded-[3rem] bg-white p-6 md:p-10">
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                  <SpecItem label="סוג כתב ומסורת" value={product.scriptType} />
                  <SpecItem label="רמת הידור הלכתית" value={product.scriptLevel} />
                  <SpecItem label="גודל קלף (סנטימטר)" value={product.parchmentSize || 'סטנדרט'} />
                  <SpecItem label="רמת הגהה וביקורת" value={product.proofreadingLevel || 'גברא'} />
                  <SpecItem label="מלאי זמין כעת" value={`${product.quantity} יחידות`} />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="seller" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="border-none shadow-premium rounded-[3rem] bg-white p-8 md:p-12">
                {isSellerLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-10 h-10 animate-spin text-primary/30" /></div>
                ) : seller ? (
                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-[6px] border-accent/10 shrink-0 bg-muted flex items-center justify-center shadow-xl">
                      {seller.profileImage ? (
                        <Image src={seller.profileImage} alt="Scribe" fill className="object-cover" />
                      ) : (
                        <UserRound className="w-12 h-12 text-primary/10" />
                      )}
                    </div>
                    <div className="flex-1 space-y-5 text-center md:text-right">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center md:justify-end gap-3">
                          <h3 className="text-2xl md:text-3xl font-headline font-black text-primary tracking-tight">{seller.firstName} {seller.lastName}</h3>
                          <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] uppercase px-3 py-1">סופר מאומת</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm font-bold flex items-center justify-center md:justify-end gap-2">
                          {seller.address} <MapPin className="w-4 h-4 text-accent" />
                        </p>
                      </div>
                      <p className="text-base md:text-lg italic leading-relaxed text-primary/70 max-w-2xl mx-auto md:mr-0">
                        "{seller.notes || 'סופר סת\"ם מוסמך וירא שמיים, כותב בקדושה ובטהרה.'}"
                      </p>
                      <div className="pt-2">
                        <Button asChild variant="outline" className="rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white font-black uppercase text-xs h-12 px-10 transition-all shadow-md">
                          <Link href={`/sellers/${seller.id}`}>לפרופיל המלא ודוגמאות כתיבה <ArrowLeft className="w-4 h-4 mr-2" /></Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="border-none shadow-premium rounded-[3rem] bg-white p-8 md:p-12">
                {reviews && reviews.length > 0 ? (
                  <div className="grid gap-8">
                    {reviews.map((rev: any) => (
                      <div key={rev.id} className="border-b border-muted/50 pb-8 last:border-0 last:pb-0 text-right">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} className={cn("w-4 h-4", s <= (rev.rating || 5) ? 'fill-accent text-accent' : 'text-muted-foreground/20')} />
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{rev.createdAt?.toDate ? rev.createdAt.toDate().toLocaleDateString('he-IL') : 'היום'}</span>
                        </div>
                        <h5 className="font-black text-primary text-lg mb-2">{rev.buyerName}</h5>
                        <p className="text-base text-primary/70 leading-relaxed italic font-medium">"{rev.comment}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 space-y-6">
                    <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
                      <Star className="w-10 h-10 text-primary/10" />
                    </div>
                    <p className="text-lg font-bold text-muted-foreground/50 italic tracking-tight">טרם נכתבו ביקורות למוצר זה.</p>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Floating Action Bar - Optimized for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-2xl border-t border-primary/5 h-24 md:h-28 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        <div className="container mx-auto px-4 h-full flex items-center justify-between gap-4 max-w-5xl">
          <div className="flex-1 flex gap-3 md:gap-6">
             {product.productType === 'ספר תורה' ? (
               <Button 
                onClick={handleTorahCoordination} 
                disabled={isProcessingRequest} 
                className="flex-1 bg-accent text-primary hover:bg-accent/90 h-14 md:h-16 rounded-2xl md:rounded-[1.5rem] font-black uppercase tracking-widest gap-3 shadow-xl transition-all hover:scale-[1.02] active:scale-95"
               >
                 {isProcessingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-6 h-6" />}
                 <span>תיאום ופגישה</span>
               </Button>
             ) : (
               <Button 
                onClick={handlePurchaseClick} 
                disabled={product.quantity <= 0} 
                className="flex-1 bg-primary text-white hover:bg-primary/90 h-14 md:h-16 rounded-2xl md:rounded-[1.5rem] font-black uppercase tracking-widest gap-3 shadow-xl transition-all hover:scale-[1.02] active:scale-95"
               >
                 <ShoppingCart className="w-6 h-6" /> 
                 <span>רכישה מאובטחת</span>
               </Button>
             )}
             <Button 
              variant="outline" 
              asChild 
              className="flex-1 border-2 border-primary/10 text-primary h-14 md:h-16 rounded-2xl md:rounded-[1.5rem] font-black uppercase tracking-widest gap-3 hover:bg-primary/5 transition-all shadow-sm"
             >
              <Link href={`/chat/${product.sellerId}?productId=${productId}`}>
                <MessageCircle className="w-6 h-6 text-accent" /> 
                <span className="hidden sm:inline">התייעצות</span>
                <span className="sm:hidden">צ'אט</span>
              </Link>
             </Button>
          </div>
          <div className="hidden sm:flex flex-col items-end border-r pr-6 md:pr-10 border-muted">
            <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] mb-1">סה"כ לתשלום</span>
            <div className="flex items-center gap-1.5 text-3xl font-black text-primary tabular-nums tracking-tighter">
              <span className="text-accent text-lg">₪</span>
              <span>{displayPrice}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-5 border-b border-primary/5 px-2 last:border-0 group hover:bg-primary/5 transition-colors rounded-xl">
      <span className="font-black text-primary text-sm md:text-base">{value}</span>
      <div className="flex items-center gap-3">
        <span className="text-[10px] md:text-xs font-black text-primary/30 uppercase tracking-widest">{label}</span>
        <div className="w-1.5 h-1.5 rounded-full bg-accent opacity-40" />
      </div>
    </div>
  );
}
