"use client";

import { useState, useMemo, useEffect } from 'react';
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
  ChevronRight,
  Trash2,
  ZoomIn
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSupabaseClient, useDoc, useMemoStable, useUser, addDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, collection, serverTimestamp } from '@/lib/supabase-compat';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import unsplashLoader from '@/lib/unsplashLoader';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ProductDetailsClient({ productId, initialProduct = null }: { productId: string; initialProduct?: any | null }) {
  const { user } = useUser();
  const db = useSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [isProcessingFavorite, setIsProcessingFavorite] = useState(false);

  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const productRef = useMemoStable(() => {
    if (!productId) return null;
    return doc(db, 'products', productId);
  }, [db, productId]);

  const { data: liveProduct, isLoading: isProductLoading } = useDoc<any>(productRef);
  const product = liveProduct ?? initialProduct;

  const customerRef = useMemoStable(() => user ? doc(db, 'customers', user.uid) : null, [db, user?.uid]);
  const sellerOwnRef = useMemoStable(() => user ? doc(db, 'sellers', user.uid) : null, [db, user?.uid]);
  
  const { data: customerData } = useDoc<any>(customerRef);
  const { data: sellerOwnData } = useDoc<any>(sellerOwnRef);

  const profileData = customerData || sellerOwnData;
  const profileRef = customerData ? customerRef : (sellerOwnData ? sellerOwnRef : null);
  const isFavorite = profileData?.favorite_product_ids?.includes(productId);

  const sellerRef = useMemoStable(() => {
    if (!product?.seller_id) return null;
    return doc(db, 'sellers', product.seller_id);
  }, [db, product?.seller_id]);

  const { data: seller, isLoading: isSellerLoading } = useDoc<any>(sellerRef);

  const [reviews, setReviews] = useState<any[]>([]);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewIsAnonymous, setReviewIsAnonymous] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  const isOwnProductReviewBlocked = Boolean(
    user && user.role === 'seller' && user.uid === product?.seller_id
  );
  const currentUserProductReview = useMemo(
    () => (user ? (reviews || []).find((rev: any) => rev?.buyer_id === user.uid) : null),
    [reviews, user]
  );
  const hasUserReviewedProduct = Boolean(currentUserProductReview);

  const showOwnProductReviewBlockedToast = () => {
    toast({
      variant: 'destructive',
      title: 'לא ניתן לדרג מוצר שהעלית',
      description: 'סופר לא יכול לפרסם ביקורת או דירוג על מוצר שלו.',
    });
  };

  const showAlreadyReviewedProductToast = () => {
    toast({
      variant: 'destructive',
      title: 'כבר פרסמת ביקורת על מוצר זה',
      description: 'ניתן לפרסם ביקורת אחת בלבד לכל מוצר.',
    });
  };

  const openProductReviewDialog = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (isOwnProductReviewBlocked) {
      showOwnProductReviewBlockedToast();
      return;
    }
    if (hasUserReviewedProduct) {
      showAlreadyReviewedProductToast();
      return;
    }
    setReviewDialogOpen(true);
  };

  useEffect(() => {
    setSelectedImageIdx(0);
    setIsImageDialogOpen(false);
    setIsImageZoomed(false);
    if (!productId) return;
    supabase
      .from('reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('product_id', productId)
      .then(({ data, error }) => {
        if (error) console.error('[reviews] fetch error:', error.message);
        else {
          const normalized = (data ?? []).map((review: any) => {
            const profile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
            const fullName = profile?.full_name;
            return {
              ...review,
              buyer_name: fullName || review?.buyer_name || 'משתמש',
              reviewer_image: profile?.avatar_url || null,
            };
          });
          setReviews(normalized);
        }
      });
  }, [productId]);

  const handleToggleFavorite = async () => {
    if (!user || !profileRef || isProcessingFavorite) {
      if (!user || !profileRef) toast({ title: "התחברות נדרשת" });
      return;
    }

    setIsProcessingFavorite(true);
    try {
      const { data: profileRow, error: fetchError } = await profileRef.client
        .from(profileRef.table)
        .select('favorite_product_ids')
        .eq('id', profileRef.id)
        .single();

      if (fetchError || profileRow === null) {
        toast({ variant: "destructive", title: "שגיאה בעדכון המועדפים" });
        return;
      }

      const currentIds: string[] = profileRow.favorite_product_ids || [];
      const newIds = isFavorite
        ? currentIds.filter((fid: string) => fid !== productId)
        : [...currentIds, productId];

      const { error: updateError } = await profileRef.client
        .from(profileRef.table)
        .update({ favorite_product_ids: newIds })
        .eq('id', profileRef.id);

      if (updateError) {
        toast({ variant: "destructive", title: "שגיאה בעדכון המועדפים" });
        return;
      }

      toast({ 
        title: isFavorite ? "הוסר מהמועדפים" : "נוסף למועדפים - תוכלו למצוא אותו באיזור האישי" 
      });
    } finally {
      setIsProcessingFavorite(false);
    }
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
      seller_id: product.seller_id,
      product_id: productId,
      product_name: 'ספר תורה',
      product_image: product.images?.[0] || '',
      amount: product.price,
      status: 'torah_request',
      buyer_id: user.uid,
      created_at: serverTimestamp(),
      is_torah_request: true,
      delivery_method: 'תיאום מול האתר'
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
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: `חותם | ${product?.product_type}`,
      text: product?.description || `רכישת ${product?.product_type} מהודרת, נכתב על ידי סופר סת"ם ירא שמיים`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(url); toast({ title: "הקישור הועתק" }); }
    } catch (err) {}
  };

  const handleSubmitProductReview = async () => {
    if (!user) { router.push('/login'); return; }
    if (isOwnProductReviewBlocked) {
      showOwnProductReviewBlockedToast();
      return;
    }
    if (hasUserReviewedProduct) {
      showAlreadyReviewedProductToast();
      return;
    }
    setIsReviewSubmitting(true);
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.uid)
      .maybeSingle();
    if (profileError) {
      console.error('[profiles] avatar fetch error:', profileError.message);
    }
    const realName = (profileData ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() : user.displayName || user.email || 'משתמש') || 'משתמש';
    const reviewData = {
      order_id: null,
      seller_id: product?.seller_id || '',
      product_id: productId,
      buyer_id: user.uid,
      buyer_name: realName,
      is_anonymous: reviewIsAnonymous,
      rating: reviewRating,
      product_rating: reviewRating,
      comment: reviewComment,
    };
    const { data: inserted, error } = await supabase.from('reviews').insert(reviewData).select().single();
    setIsReviewSubmitting(false);
    if (error) {
      console.error('[reviews] insert error:', error.message);
      if (error?.code === '23505') {
        showAlreadyReviewedProductToast();
        return;
      }
      toast({ variant: 'destructive', title: 'שגיאה בשמירת הביקורת', description: 'אנא נסה שנית.' });
    } else {
      const reviewerImage = profileRow?.avatar_url || null;
      setReviews(prev => [...prev, { ...inserted, buyer_name: realName, reviewer_image: reviewerImage }]);
      setReviewDialogOpen(false);
      setReviewComment('');
      setReviewRating(5);
      setReviewIsAnonymous(false);
      toast({ title: 'תודה על הביקורת!' });
    }
  };

  const handleDeleteProductReview = async (reviewId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setDeletingReviewId(reviewId);
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('buyer_id', user.uid);

      if (error) {
        console.error('[reviews] delete error:', error.message);
        toast({ variant: 'destructive', title: 'שגיאה במחיקת הביקורת', description: 'אנא נסה שוב.' });
        return;
      }

      setReviews(prev => prev.filter((rev: any) => rev.id !== reviewId));
      toast({ title: 'הביקורת נמחקה בהצלחה' });
    } finally {
      setDeletingReviewId(null);
    }
  };

  if (isProductLoading && !product) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center">המוצר לא נמצא</div>;

  const rawImages = Array.isArray(product.images) ? product.images : [];
  const images = rawImages.length > 0 ? rawImages : [logoImg];
  const currentImage = images[selectedImageIdx] || logoImg;
  const displayPrice = (Number(product.price) * 1.18).toFixed(0);

  return (
    <div className="min-h-screen bg-[#FDFCF0] pb-24 sm:pb-28 md:pb-32" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-5xl">
        
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <button
              type="button"
              aria-label={`פתח תצוגת זום לתמונה ${selectedImageIdx + 1} מתוך ${images.length}`}
              onClick={() => {
                setIsImageZoomed(false);
                setIsImageDialogOpen(true);
              }}
              className="relative block aspect-square w-full rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-premium bg-white border-4 border-white text-right"
            >
              <Image loader={unsplashLoader} src={currentImage} alt={product.product_type} fill priority className="object-cover" />
              {product.quantity <= 0 && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <Badge variant="destructive" className="px-8 py-3 text-sm font-black uppercase tracking-widest rounded-full shadow-2xl">אזל מהמלאי</Badge>
                </div>
              )}
              <div className="absolute bottom-4 left-4">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-primary shadow-md backdrop-blur-sm">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>לחץ לזום</span>
                </div>
              </div>
              <div className="absolute top-4 right-4 hidden md:block">
                <Badge className="bg-primary/80 backdrop-blur-md text-white border-none px-4 py-1.5 rounded-full font-black text-[10px] uppercase">
                  {product.script_level}
                </Badge>
              </div>
            </button>
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
                  {product.script_level}
                </Badge>
                <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] py-1 px-3 rounded-full">
                  <CheckCircle2 className="w-3 h-3 ml-1.5" />
                  זמין במלאי ({product.quantity})
                </Badge>
              </div>
              <h1 className="text-3xl md:text-5xl font-headline font-black text-primary leading-[1.1] tracking-tight">
                {product.product_type} 
                {product.sub_type && product.sub_type !== 'all' && (
                  <span className="text-accent block md:inline md:mr-3 mt-1 md:mt-0 font-black">{product.sub_type}</span>
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
                        {product.product_type === 'ספר תורה' ? 'בתיאום אישי' : `${product.delivery_time || '3'} ימים`}
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-end gap-1.5 p-3 rounded-2xl bg-slate-50/50">
                      <Truck className="w-5 h-5 text-accent" />
                      <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">עלות משלוח</span>
                      <span className="text-xs font-black text-emerald-600 leading-none">
                        {Number(product.delivery_fee) > 0 ? `₪${product.delivery_fee}` : 'משלוח חינם'}
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
        <div className="mt-10 md:mt-20">
          <Tabs defaultValue="specs" className="text-right">
            <TabsList className="w-full flex bg-white/40 backdrop-blur-xl p-1.5 rounded-3xl shadow-premium h-16 border border-white/50 mb-8">
              <TabsTrigger value="specs" className="flex-1 py-3 text-[10px] md:text-xs font-black rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">מפרט טכני</TabsTrigger>
              <TabsTrigger value="seller" className="flex-1 py-3 text-[10px] md:text-xs font-black rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">הסופר הכותב</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1 py-3 text-[10px] md:text-xs font-black rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">ביקורות ({(reviews || []).length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="specs" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="border-none shadow-premium rounded-[3rem] bg-white p-6 md:p-10">
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                  <SpecItem label="סוג כתב ומסורת" value={product.script_type} />
                  <SpecItem label="רמת הידור הלכתית" value={product.script_level} />
                  <SpecItem label="גודל קלף (סנטימטר)" value={product.parchment_size || 'סטנדרט'} />
                  <SpecItem label="רמת הגהה וביקורת" value={product.proofreading_level || 'גברא'} />
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
                      {seller.profile_image ? (
                        <Image src={seller.profile_image} alt="Scribe" fill className="object-cover" />
                      ) : (
                        <UserRound className="w-12 h-12 text-primary/10" />
                      )}
                    </div>
                    <div className="flex-1 space-y-5 text-center md:text-right">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center md:justify-end gap-3">
                          <h3 className="text-2xl md:text-3xl font-headline font-black text-primary tracking-tight">{seller.first_name} {seller.last_name}</h3>
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
                <div className="flex justify-between items-center mb-8">
                  <Button
                    onClick={openProductReviewDialog}
                    disabled={isOwnProductReviewBlocked || hasUserReviewedProduct}
                    className="bg-primary text-white rounded-2xl h-11 px-6 font-black text-xs uppercase tracking-widest gap-2 shadow-md hover:bg-primary/90"
                  >
                    <Star className="w-4 h-4" /> {isOwnProductReviewBlocked ? 'לא ניתן לדרג מוצר שלך' : hasUserReviewedProduct ? 'כבר פרסמת ביקורת' : 'כתוב ביקורת'}
                  </Button>
                  <h4 className="text-sm font-black text-primary/40 uppercase tracking-widest">ביקורות לקוחות</h4>
                </div>
                {reviews && reviews.length > 0 ? (
                  <div className="grid gap-8">
                    {reviews.map((rev: any) => (
                      <div key={rev.id} className="relative border-b border-muted/50 pb-8 last:border-0 last:pb-0 text-right">
                        {user?.uid === rev.buyer_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProductReview(rev.id)}
                            disabled={deletingReviewId === rev.id}
                            className="absolute left-0 top-0 h-7 w-7 rounded-full bg-white/90 text-destructive shadow-sm hover:bg-destructive/5"
                          >
                            {deletingReviewId === rev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        )}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} className={cn("w-4 h-4", s <= (rev.rating || 5) ? 'fill-accent text-accent' : 'text-muted-foreground/20')} />
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{rev.created_at ? new Date(rev.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-9 w-9 border border-primary/10">
                              {!rev.is_anonymous && <AvatarImage src={rev.reviewer_image || undefined} />}
                              <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                                {rev.is_anonymous ? 'א' : (rev.buyer_name || 'מ').charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <h5 className="font-black text-primary text-lg">{rev.is_anonymous ? 'אנונימי' : (rev.buyer_name || 'משתמש')}</h5>
                          </div>
                        </div>
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
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-2xl border-t border-primary/5 h-20 sm:h-24 md:h-28 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        <div className="container mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-3 md:gap-4 max-w-5xl">
          <div className="flex-1 flex gap-2 md:gap-6">
             {product.product_type === 'ספר תורה' ? (
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
              <Link href={`/chat/${product.seller_id}?productId=${productId}`}>
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

      <Dialog
        open={isImageDialogOpen}
        onOpenChange={(open) => {
          setIsImageDialogOpen(open);
          if (!open) {
            setIsImageZoomed(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl rounded-[2rem] border-none bg-black/95 p-3 sm:p-6 shadow-2xl" dir="rtl">
          <DialogHeader className="space-y-2 pr-12 text-right">
            <DialogTitle className="text-white">{product.product_type}</DialogTitle>
            <p className="text-xs font-bold text-white/70">לחץ על התמונה כדי להגדיל ולהקטין</p>
          </DialogHeader>
          <button
            type="button"
            aria-label={isImageZoomed ? 'הקטן את תמונת המוצר' : 'הגדל את תמונת המוצר'}
            onClick={() => setIsImageZoomed(prev => !prev)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setIsImageZoomed(prev => !prev);
              }
            }}
            className="relative block h-[60vh] w-full overflow-auto rounded-[1.5rem] bg-black text-center"
          >
            <div className="relative h-full min-h-[24rem] w-full">
              <Image
                loader={unsplashLoader}
                src={currentImage}
                alt={product.product_type}
                fill
                className={cn(
                  'object-contain transition-transform duration-300',
                  isImageZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                )}
              />
            </div>
          </button>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-w-md bg-white text-slate-900" dir="rtl">
          <div className="bg-primary p-8 text-white text-right">
            <DialogTitle className="text-2xl font-headline font-black">כתוב ביקורת</DialogTitle>
            <p className="text-white/60 text-sm mt-1">חוות דעתך עוזרת לקונים אחרים לבחור נכון</p>
          </div>
          <div className="p-8 space-y-6 text-right">
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-primary">דירוג כוכבים</Label>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} type="button" onClick={() => setReviewRating(s)}>
                    <Star className={`w-9 h-9 transition-colors ${s <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500">ביקורת</Label>
              <Textarea
                placeholder="שתף את הרשמך מהמוצר..."
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                className="rounded-2xl min-h-[100px]"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-muted/40">
              <Switch
                id="product-review-anon"
                checked={reviewIsAnonymous}
                onCheckedChange={setReviewIsAnonymous}
              />
              <Label htmlFor="product-review-anon" className="text-sm font-bold text-primary cursor-pointer">פרסם כאנונימי</Label>
            </div>
          </div>
          <DialogFooter className="p-6 bg-muted/30 border-t flex gap-3">
            <Button
              onClick={handleSubmitProductReview}
              disabled={isReviewSubmitting || isOwnProductReviewBlocked || hasUserReviewedProduct}
              className="flex-1 bg-primary text-white h-12 font-black uppercase"
            >
              {isReviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'פרסם ביקורת'}
            </Button>
            <Button variant="ghost" onClick={() => setReviewDialogOpen(false)} className="h-12 font-bold">ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
