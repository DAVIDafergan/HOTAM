"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
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
  Trash2,
  ZoomIn
} from 'lucide-react';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { useSupabaseClient, useApp, addDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, collection, serverTimestamp } from '@/lib/supabase-compat';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import unsplashLoader from '@/lib/unsplashLoader';
import { cn } from '@/lib/utils';
import { PROFILE_NOT_FOUND_CODE } from '@/lib/supabase-errors';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MIN_IMAGE_ZOOM_LEVEL = 1;
const MAX_IMAGE_ZOOM_LEVEL = 4;
const IMAGE_ZOOM_STEP = 0.25;
const IMAGE_WHEEL_ZOOM_DELTA = 0.2;
const VAT_MULTIPLIER = 1.18;
const PRODUCT_FALLBACK_FIELDS = [
  'id',
  'product_type',
  'sub_type',
  'script_type',
  'script_level',
  'description',
  'price',
  'images',
  'quantity',
  'delivery_type',
  'delivery_area',
  'delivery_fee',
  'delivery_time',
  'pickup_address',
  'seller_id',
  'parchment_size',
  'proofreading_level',
].join(', ');
const REVIEW_FALLBACK_FIELDS = [
  'id',
  'product_id',
  'buyer_id',
  'buyer_name',
  'user_name',
  'rating',
  'comment',
  'is_anonymous',
  'created_at',
  'profiles(full_name, avatar_url)',
].join(', ');
// Base horizontal/vertical pan allowance in pixels (multiplied by zoom level).
const BASE_IMAGE_PAN_LIMIT_PX = 220;

export function ProductDetailsClient({
  productId,
  initialProduct = null,
  initialSeller = null,
  initialReviews = [],
}: {
  productId: string;
  initialProduct?: any | null;
  initialSeller?: any | null;
  initialReviews?: any[];
}) {
  const { user, profile } = useApp();
  const db = useSupabaseClient();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [isProcessingFavorite, setIsProcessingFavorite] = useState(false);

  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const [product, setProduct] = useState<any>(initialProduct);
  const [seller, setSeller] = useState<any>(initialSeller);
  const [isLoadingFallback, setIsLoadingFallback] = useState(!initialProduct && !!productId);
  const isProductLoading = false;
  const isSellerLoading = false;

  const profileRef = user && profile?.role
    ? doc(db, profile.role === 'seller' ? 'sellers' : 'customers', user.uid)
    : null;
  const profileData = profile;
  const isFavorite = profileData?.favorite_product_ids?.includes(productId);

  const [reviews, setReviews] = useState<any[]>(initialReviews);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewIsAnonymous, setReviewIsAnonymous] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageZoomLevel, setImageZoomLevel] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  const gallerySlideRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isOwnProductReviewBlocked = Boolean(
    user && user.role === 'seller' && user.uid === product?.seller_id
  );
  const currentUserProductReview = useMemo(
    () => (user ? (reviews || []).find((rev: any) => rev?.buyer_id === user.uid) : null),
    [reviews, user]
  );
  const hasUserReviewedProduct = Boolean(currentUserProductReview);
  const [reviewSortOrder, setReviewSortOrder] = useState<'newest' | 'oldest'>('newest');
  const sortedProductReviews = useMemo(() => {
    const list = [...(reviews || [])];
    list.sort((a: any, b: any) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return reviewSortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [reviews, reviewSortOrder]);
  const getProductReviewSubmitLabel = () => {
    if (!user) return 'התחבר כדי לפרסם ביקורת';
    if (isOwnProductReviewBlocked) return 'לא ניתן לדרג מוצר שלך';
    return 'פרסם ביקורת';
  };

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

  useEffect(() => {
    let isActive = true;

    setSelectedImageIdx(0);
    setIsImageDialogOpen(false);
    setImageZoomLevel(MIN_IMAGE_ZOOM_LEVEL);
    setImagePan({ x: 0, y: 0 });
    dragOriginRef.current = null;
    setProduct(initialProduct);
    setSeller(initialSeller);
    setReviews(initialReviews);

    const shouldFetchProductFallback = !initialProduct && !!productId;
    const shouldFetchReviewsFallback = !!productId && initialReviews.length === 0;

    setIsLoadingFallback(shouldFetchProductFallback);

    if (shouldFetchProductFallback) {
      supabase
        .from('products')
        .select(PRODUCT_FALLBACK_FIELDS)
        .eq('id', productId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!isActive) return;
          setIsLoadingFallback(false);
          if (error) {
            console.error('[product] fallback fetch error:', error.message);
            return;
          }
          if (data) {
            setProduct(data);
          }
        });
    }

    if (shouldFetchReviewsFallback) {
      supabase
        .from('reviews')
        .select(REVIEW_FALLBACK_FIELDS)
        .eq('product_id', productId)
        .then(({ data, error }) => {
          if (!isActive) return;
          if (error) {
            console.error('[reviews] fallback fetch error:', error.message);
            return;
          }
          if (data && data.length > 0) {
            const normalized = data.map((review: any) => {
              const profile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
              return {
                ...review,
                buyer_name: profile?.full_name || review?.buyer_name || 'משתמש',
                reviewer_image: profile?.avatar_url || null,
              };
            });
            setReviews(normalized);
          }
        });
    }

    if (!shouldFetchProductFallback) {
      setIsLoadingFallback(false);
    }

    return () => {
      isActive = false;
    };
  }, [initialProduct, initialSeller, initialReviews, productId]);

  // Tracks which gallery slide is centered in the swipeable scroller so the dot indicator
  // and thumbnail strip stay in sync, regardless of RTL scroll-direction quirks.
  useEffect(() => {
    const container = galleryScrollRef.current;
    const imageCount = Array.isArray(product?.images) ? product.images.length : 0;
    if (!container || imageCount <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const idx = gallerySlideRefs.current.findIndex(el => el === mostVisible.target);
        if (idx !== -1) setSelectedImageIdx(idx);
      },
      { root: container, threshold: [0.5, 0.75, 1] }
    );
    gallerySlideRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [product?.images]);

  const scrollToGalleryImage = (idx: number) => {
    setSelectedImageIdx(idx);
    gallerySlideRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const openImageZoom = (idx: number) => {
    setSelectedImageIdx(idx);
    setImageZoomLevel(MIN_IMAGE_ZOOM_LEVEL);
    setImagePan({ x: 0, y: 0 });
    dragOriginRef.current = null;
    setIsImageDialogOpen(true);
  };

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
    if (!user) { router.push('/login?redirect=' + encodeURIComponent(pathname)); return; }
    if (product?.quantity <= 0) { toast({ variant: "destructive", title: "אזל מהמלאי" }); return; }
    router.push(`/checkout/${productId}`);
  };

  const handleTorahCoordination = () => {
    if (!user) { router.push('/login?redirect=' + encodeURIComponent(pathname)); return; }
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
    const shareBaseTitle = `${product?.product_type}${product?.sub_type && product?.sub_type !== 'all' ? ` ${product.sub_type}` : ''}`;
    const shareTitle = Number(product?.price) > 0 ? `${shareBaseTitle} | ₪${displayPrice}` : shareBaseTitle;
    const shareData = {
      title: shareTitle,
      text: product?.description || `רכישת ${shareBaseTitle} מהודרת במחיר ₪${displayPrice}`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(url); toast({ title: "הקישור הועתק" }); }
    } catch (err) {}
  };

  const handleSubmitProductReview = async () => {
    if (!user) { router.push('/login?redirect=' + encodeURIComponent(pathname)); return; }
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
      .select('avatar_url, full_name')
      .eq('id', user.uid)
      .maybeSingle();
    if (profileError) {
      console.error('[profiles] fetch error:', profileError.message);
      if (profileError.code !== PROFILE_NOT_FOUND_CODE) {
        setIsReviewSubmitting(false);
        toast({ variant: 'destructive', title: 'שגיאה בשמירת הביקורת', description: 'אנא נסה שנית.' });
        return;
      }
    }
    const realName = profileRow?.full_name || user.displayName || 'משתמש';
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
      setReviewComment('');
      setReviewRating(5);
      setReviewIsAnonymous(false);
      toast({ title: 'תודה על הביקורת!' });
    }
  };

  const handleDeleteProductReview = async (reviewId: string) => {
    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    setDeletingReviewId(reviewId);
    try {
      const { error, count } = await supabase
        .from('reviews')
        .delete({ count: 'exact' })
        .eq('id', reviewId)
        .eq('buyer_id', user.uid);

      if (error || count === 0) {
        console.error('[reviews] delete failed:', error?.message ?? 'no rows deleted — RLS mismatch?');
        toast({ variant: 'destructive', title: 'שגיאה במחיקת הביקורת', description: 'אנא נסה שוב.' });
        return;
      }

      setReviews(prev => prev.filter((rev: any) => rev.id !== reviewId));
      toast({ title: 'הביקורת נמחקה בהצלחה' });
    } finally {
      setDeletingReviewId(null);
    }
  };

  if ((isProductLoading || isLoadingFallback) && !product) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center">המוצר לא נמצא</div>;

  const rawImages = Array.isArray(product.images) ? product.images : [];
  const images = rawImages.length > 0 ? rawImages : [logoImg];
  const currentImage = images[selectedImageIdx] || logoImg;
  const displayPrice = (Number(product.price) * VAT_MULTIPLIER).toFixed(0);
  const productDisplayTitle = `${product.product_type}${product.sub_type && product.sub_type !== 'all' ? ` ${product.sub_type}` : ''}`;
  const normalizedDeliveryType = (() => {
    const raw = String(product.delivery_type || '').toLowerCase();
    if (raw === 'delivery' || raw === 'shipping' || raw === 'shipping_only') return 'delivery';
    if (raw === 'pickup' || raw === 'pickup_only') return 'pickup';
    return 'both';
  })();
  const hasDelivery = normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both';
  const deliveryAreaText = (Array.isArray(product.delivery_area) ? product.delivery_area : [product.delivery_area])
    .filter(Boolean)
    .join(', ');
  const pickupAddress = typeof product.pickup_address === 'string' ? product.pickup_address.trim() : '';
  const sellerCity =
    product.seller_city ||
    seller?.city ||
    (pickupAddress && pickupAddress.includes(',') ? pickupAddress.split(',').pop()?.trim() : '') ||
    (typeof seller?.address === 'string' && seller.address.includes(',')
      ? seller.address.split(',').pop()?.trim()
      : seller?.address) ||
    '';
  const clampZoomLevel = (zoom: number) => Math.min(MAX_IMAGE_ZOOM_LEVEL, Math.max(MIN_IMAGE_ZOOM_LEVEL, Number(zoom.toFixed(2))));
  const updateImageZoom = (zoom: number) => {
    const nextZoom = clampZoomLevel(zoom);
    setImageZoomLevel(nextZoom);
    if (nextZoom <= MIN_IMAGE_ZOOM_LEVEL) setImagePan({ x: 0, y: 0 });
  };
  const updateImagePan = (x: number, y: number) => {
    if (imageZoomLevel <= MIN_IMAGE_ZOOM_LEVEL) {
      setImagePan({ x: 0, y: 0 });
      return;
    }
    const limit = BASE_IMAGE_PAN_LIMIT_PX * imageZoomLevel;
    setImagePan({
      x: Math.max(-limit, Math.min(limit, x)),
      y: Math.max(-limit, Math.min(limit, y)),
    });
  };
  const imageCursor = imageZoomLevel <= MIN_IMAGE_ZOOM_LEVEL
    ? 'zoom-in'
    : dragOriginRef.current
      ? 'grabbing'
      : 'grab';

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24 sm:pb-28 md:pb-32" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-6xl">

        {/* Mobile Header Actions */}
        <div className="mb-6 mt-4 flex justify-end md:hidden">
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleShare} className="rounded-full bg-white border-primary/10 shadow-sm transition-all duration-200 hover:scale-105 active:scale-90"><Share2 className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={handleToggleFavorite} className={cn("rounded-full bg-white border-primary/10 shadow-sm transition-all duration-200 hover:scale-105 active:scale-90", isFavorite ? 'bg-primary text-white border-primary' : '')}><Heart className={cn("w-4 h-4 transition-transform duration-200", isFavorite ? 'fill-current' : '')} /></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
          {/* Product Images — swipeable gallery (kept from the prior round as an accepted
              improvement) restored onto the original aspect ratio/sizing/hover treatment. */}
          <div className="space-y-4">
            <div className="relative group">
              <div
                ref={galleryScrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[4/5] w-full rounded-[1.75rem] bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)] ring-1 ring-primary/5 transition-shadow duration-500 hover:shadow-[0_16px_56px_rgba(15,23,42,0.10)] [-webkit-overflow-scrolling:touch] scroll-smooth"
              >
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    ref={el => { gallerySlideRefs.current[i] = el; }}
                    type="button"
                    aria-label={`פתח תצוגת זום לתמונה ${i + 1} מתוך ${images.length}`}
                    onClick={() => openImageZoom(i)}
                    className="relative w-full h-full shrink-0 snap-center text-right"
                  >
                    <Image loader={unsplashLoader} src={img} alt={product.product_type} fill priority={i === 0} kind="product" sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  </button>
                ))}
              </div>
              {product.quantity <= 0 && (
                <div className="absolute inset-0 rounded-[1.75rem] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                  <Badge variant="destructive" className="px-8 py-3 text-sm font-black uppercase tracking-widest rounded-full shadow-2xl">אזל מהמלאי</Badge>
                </div>
              )}
              <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-primary shadow-md backdrop-blur-sm">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>הגדלה</span>
                </div>
              </div>
              <div className="absolute top-4 right-4 hidden md:block">
                <Badge className="bg-white/90 backdrop-blur-md text-primary border-none px-4 py-1.5 rounded-full font-bold text-[10px] uppercase shadow-sm">
                  {product.script_level}
                </Badge>
              </div>
              {images.length > 1 && (
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
                  {images.map((_: string, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full bg-white shadow transition-all duration-300",
                        selectedImageIdx === i ? "w-5 opacity-100" : "w-1.5 opacity-50"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto py-1 no-scrollbar px-0.5">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => scrollToGalleryImage(i)}
                    aria-label={`עבור לתמונה ${i + 1}`}
                    className={cn(
                      "relative w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shrink-0 transition-all duration-200",
                      selectedImageIdx === i ? 'ring-2 ring-primary ring-offset-2' : 'ring-1 ring-primary/10 opacity-70 hover:opacity-100 hover:ring-primary/30'
                    )}
                  >
                    <Image loader={unsplashLoader} src={img} alt="Thumb" fill kind="product" sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="text-right space-y-8 md:sticky md:top-28">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 justify-start items-center">
                <Badge variant="outline" className="border-accent/30 text-accent font-bold text-[11px] py-1 px-3 rounded-full bg-accent/5 whitespace-nowrap">
                  {product.script_level}
                </Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50/60 text-emerald-700 font-bold text-[11px] py-1 px-3 rounded-full whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3 ml-1.5" />
                  זמין במלאי ({product.quantity})
                </Badge>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  {product.sub_type && product.sub_type !== 'all' && (
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{product.product_type}</p>
                  )}
                  <h1 className="text-4xl md:text-5xl font-headline font-black text-primary leading-[1.1] tracking-tight">
                    {product.sub_type && product.sub_type !== 'all' ? product.sub_type : product.product_type}
                  </h1>
                </div>
                <div className="hidden md:flex items-center gap-1.5 shrink-0 pt-1">
                  <button
                    onClick={handleShare}
                    aria-label="שיתוף"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-primary/40 transition-all duration-200 hover:bg-primary/5 hover:text-primary active:scale-90"
                  >
                    <Share2 className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 hover:bg-primary/5 active:scale-90",
                      isFavorite ? "text-primary" : "text-primary/40 hover:text-primary"
                    )}
                  >
                    <Heart className={cn("w-[18px] h-[18px] transition-transform duration-200", isFavorite && "fill-current")} />
                  </button>
                </div>
              </div>
            </div>

            {/* Price — clean, no decorative card chrome */}
            <div className="space-y-5 border-y border-primary/8 py-6">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-primary text-5xl md:text-6xl font-black tabular-nums tracking-tighter">{displayPrice}</span>
                <span className="text-primary/60 text-2xl md:text-3xl font-bold">₪</span>
              </div>
              <p className="text-xs font-bold text-primary/40 uppercase tracking-[0.15em] -mt-3">
                {hasDelivery ? 'המחירים כוללים מע"מ ומשלוח' : 'המחירים כוללים מע"מ'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <section aria-labelledby="delivery-time-label" className="flex flex-col items-end gap-1 rounded-2xl bg-primary/[0.03] p-4 text-right">
                  <Clock className="w-4 h-4 text-primary/30 mb-1" />
                  <span id="delivery-time-label" className="text-[10px] font-bold text-primary/40 uppercase tracking-wide whitespace-nowrap">זמן אספקה</span>
                  <span className="text-sm font-black text-primary leading-none whitespace-nowrap">
                    {product.product_type === 'ספר תורה' ? 'בתיאום אישי' : `${product.delivery_time || '3'} ימים`}
                  </span>
                </section>
                {hasDelivery ? (
                  <section aria-labelledby="delivery-fee-label" className="flex flex-col items-end gap-1 rounded-2xl bg-primary/[0.03] p-4 text-right">
                    <Truck className="w-4 h-4 text-primary/30 mb-1" />
                    <span id="delivery-fee-label" className="text-[10px] font-bold text-primary/40 uppercase tracking-wide whitespace-nowrap">עלות משלוח</span>
                    <span className="text-sm font-black text-emerald-600 leading-none whitespace-nowrap">
                      {Number(product.delivery_fee) > 0 ? `₪${product.delivery_fee}` : 'משלוח חינם'}
                    </span>
                  </section>
                ) : (
                  <section aria-labelledby="stock-status-label" className="flex flex-col items-end gap-1 rounded-2xl bg-primary/[0.03] p-4 text-right">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
                    <span id="stock-status-label" className="text-[10px] font-bold text-primary/40 uppercase tracking-wide whitespace-nowrap">זמינות</span>
                    <span className="text-sm font-black text-emerald-600 leading-none whitespace-nowrap">{product.quantity > 0 ? 'במלאי' : 'אזל זמנית'}</span>
                  </section>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-bold text-xs text-primary/40 uppercase tracking-widest flex items-center justify-end gap-2 whitespace-nowrap">
                על כלי הקודש <ScrollText className="w-3.5 h-3.5 shrink-0" />
              </h2>
              <p className="text-primary/75 font-medium text-base leading-relaxed">
                {product.description}
              </p>
            </div>

            {(deliveryAreaText || normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both' || normalizedDeliveryType === 'pickup') && (
              <div className="space-y-4 rounded-[1.75rem] bg-primary/[0.025] p-5">
                {(normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both') && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">ערים זמינות למשלוח</span>
                      <Truck className="w-3.5 h-3.5 text-primary/30" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {deliveryAreaText ? (
                        deliveryAreaText.split(', ').filter(Boolean).map((city: string) => (
                          <Badge key={city} variant="outline" className="bg-white text-primary/70 border-primary/10 font-medium text-[11px] px-3 py-1 rounded-full">
                            <MapPin className="w-3 h-3 ml-1 text-primary/30" />{city}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-100 font-medium text-[11px] px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3 ml-1" />כל הארץ
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {(normalizedDeliveryType === 'pickup' || normalizedDeliveryType === 'both') && (
                  <div className={cn("space-y-1", (normalizedDeliveryType === 'both') && "pt-3 border-t border-primary/5")}>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-bold text-primary/80">איסוף עצמי מ{sellerCity || 'עיר הסופר'}</span>
                      <MapPin className="w-3.5 h-3.5 text-primary/30 shrink-0" />
                    </div>
                    {pickupAddress && (
                      <p className="text-xs text-primary/45 font-medium text-right">{pickupAddress}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Technical Details Tabs */}
        <div className="mt-16 md:mt-28">
          <Tabs defaultValue="specs" className="text-right">
            <TabsList className="w-full flex bg-transparent p-0 h-auto border-b border-primary/8 rounded-none mb-10 justify-start gap-8">
             <TabsTrigger value="specs" className="flex-none px-0 pb-4 text-sm font-bold text-primary/40 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none transition-all whitespace-nowrap">מפרט טכני</TabsTrigger>
             <TabsTrigger value="seller" className="flex-none px-0 pb-4 text-sm font-bold text-primary/40 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none transition-all whitespace-nowrap">הסופר הכותב</TabsTrigger>
             <TabsTrigger value="reviews" className="flex-none px-0 pb-4 text-sm font-bold text-primary/40 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none transition-all whitespace-nowrap">ביקורות ({(reviews || []).length})</TabsTrigger>
            </TabsList>

            <TabsContent value="specs" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="grid md:grid-cols-2 gap-x-16 gap-y-1 max-w-3xl">
                <SpecItem label="סוג כתב ומסורת" value={product.script_type} />
                <SpecItem label="רמת הידור הלכתית" value={product.script_level} />
                <SpecItem label="גודל קלף (סנטימטר)" value={product.parchment_size || 'סטנדרט'} />
                <SpecItem label="רמת הגהה וביקורת" value={product.proofreading_level || 'גברא'} />
                <SpecItem label="מלאי זמין כעת" value={`${product.quantity} יחידות`} />
              </div>
            </TabsContent>

            <TabsContent value="seller" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-3xl">
                {isSellerLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-10 h-10 animate-spin text-primary/30" /></div>
                ) : seller ? (
                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center ring-1 ring-primary/10">
                      {seller.profile_image ? (
                        <Image src={seller.profile_image} alt="Scribe" fill kind="avatar" sizes="96px" className="object-cover" />
                      ) : (
                        <UserRound className="w-12 h-12 text-primary/10" />
                      )}
                    </div>
                    <div className="flex-1 space-y-5 text-center md:text-right">
                      <div className="space-y-1">
                        <div className="flex items-center justify-center md:justify-end gap-2 min-w-0">
                          <h2 className="text-xl md:text-3xl font-headline font-black text-primary tracking-tight whitespace-nowrap truncate min-w-0">{seller.first_name} {seller.last_name}</h2>
                          <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] uppercase px-3 py-1 shrink-0">סופר מאומת</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm font-bold flex items-center justify-center md:justify-end gap-2">
                          {sellerCity || 'לא צוין'} <MapPin className="w-4 h-4 text-accent" />
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
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-3xl">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={reviewSortOrder === 'newest' ? 'default' : 'outline'}
                      onClick={() => setReviewSortOrder('newest')}
                      className="rounded-full text-[10px] h-8 px-4 font-black"
                    >
                      החדשות ביותר
                    </Button>
                    <Button
                      type="button"
                      variant={reviewSortOrder === 'oldest' ? 'default' : 'outline'}
                      onClick={() => setReviewSortOrder('oldest')}
                      className="rounded-full text-[10px] h-8 px-4 font-black"
                    >
                      הוותיקות ביותר
                    </Button>
                  </div>
                  <h3 className="text-sm font-black text-primary/60 uppercase tracking-widest">ביקורות לקוחות</h3>
                </div>

                <div className="mb-8 rounded-3xl border border-primary/10 bg-primary/[0.02] p-5 md:p-6 space-y-4 text-right">
                  <div className="space-y-1">
                    <h4 className="text-base font-black text-primary">פרסום ביקורת</h4>
                    <p className="text-xs font-medium text-muted-foreground">שתפו בקצרה על המוצר כדי לעזור לקונים הבאים.</p>
                  </div>
                  {!user && (
                    <p className="text-xs font-bold text-muted-foreground">
                      כדי לפרסם ביקורת צריך <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="underline text-primary">להתחבר לחשבון</Link>.
                    </p>
                  )}
                  {hasUserReviewedProduct ? (
                    <p className="text-xs font-medium text-muted-foreground">ניתן לתת רק ביקורת אחת לכל מוצר.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">ביקורת</Label>
                        <Textarea
                          placeholder="שתף את הרשמך מהמוצר..."
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          className="rounded-2xl min-h-[100px]"
                          disabled={!user || isOwnProductReviewBlocked || isReviewSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-primary">דירוג כוכבים</Label>
                        <div className="flex justify-center gap-2.5 rounded-2xl border border-primary/10 bg-white p-3">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={s} type="button" onClick={() => setReviewRating(s)} disabled={!user || isOwnProductReviewBlocked || isReviewSubmitting} className="rounded-full p-1.5 transition-colors hover:bg-accent/10 disabled:cursor-not-allowed">
                              <Star className={`w-5 h-5 transition-colors ${s <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-muted/40">
                        <Switch
                          id="product-review-anon"
                          checked={reviewIsAnonymous}
                          onCheckedChange={setReviewIsAnonymous}
                          disabled={!user || isOwnProductReviewBlocked || isReviewSubmitting}
                        />
                        <Label htmlFor="product-review-anon" className="text-sm font-bold text-primary cursor-pointer">פרסם כאנונימי</Label>
                      </div>
                      <Button
                        onClick={handleSubmitProductReview}
                        disabled={!user || isReviewSubmitting || isOwnProductReviewBlocked}
                        className="w-full bg-primary text-white h-12 font-black rounded-2xl shadow-md"
                      >
                        {isReviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : getProductReviewSubmitLabel()}
                      </Button>
                    </>
                  )}
                </div>

                {sortedProductReviews.length > 0 ? (
                  <div className="grid gap-6">
                    {sortedProductReviews.map((rev: any) => (
                      <div key={rev.id} className="flex flex-row-reverse items-start gap-3">
                        <Avatar className="h-8 w-8 border border-primary/10 flex-shrink-0">
                          {!rev.is_anonymous && <AvatarImage src={rev.reviewer_image || undefined} />}
                          <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                            {rev.is_anonymous ? 'א' : (rev.buyer_name || 'מ').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{rev.created_at ? new Date(rev.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                            <p className="font-semibold text-primary text-xs">{rev.is_anonymous ? 'אנונימי' : (rev.buyer_name || 'משתמש')}</p>
                          </div>
                          <div className="bg-muted/15 rounded-2xl px-4 py-3 text-right">
                            <div className="flex justify-end gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} className={cn("w-3 h-3", s <= (rev.rating || 5) ? 'fill-accent text-accent' : 'text-muted-foreground/20')} />
                              ))}
                            </div>
                            <p className="text-xs text-primary/70 leading-relaxed font-medium">{rev.comment}</p>
                          </div>
                          {user?.uid === rev.buyer_id && (
                            <div className="flex justify-end mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProductReview(rev.id)}
                                disabled={deletingReviewId === rev.id}
                                className="h-6 px-2 text-[10px] text-destructive/50 hover:text-destructive hover:bg-destructive/5 gap-1 rounded-full"
                              >
                                {deletingReviewId === rev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                מחק
                              </Button>
                            </div>
                          )}
                        </div>
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
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Floating Action Bar - Optimized for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-2xl border-t border-primary/8 h-20 sm:h-24 md:h-28 shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
        <div className="container mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-3 md:gap-4 max-w-6xl">
          <div className="flex-1 flex gap-2.5 md:gap-4">
             {product.product_type === 'ספר תורה' ? (
               <Button
                onClick={handleTorahCoordination}
                disabled={isProcessingRequest}
                className="flex-1 bg-accent text-primary hover:bg-accent/90 h-14 md:h-16 rounded-2xl font-bold gap-3 shadow-md transition-all duration-200 hover:shadow-lg active:scale-95"
               >
                 {isProcessingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                 <span>תיאום ופגישה</span>
               </Button>
             ) : (
               <Button
                onClick={handlePurchaseClick}
                disabled={product.quantity <= 0}
                className="flex-1 bg-primary text-white hover:bg-primary/90 h-14 md:h-16 rounded-2xl font-bold gap-3 shadow-md transition-all duration-200 hover:shadow-lg active:scale-95"
               >
                 <ShoppingCart className="w-5 h-5" />
                 <span>רכישה מאובטחת</span>
               </Button>
             )}
             <Button
              variant="outline"
              asChild
              className="flex-1 border-primary/15 text-primary h-14 md:h-16 rounded-2xl font-bold gap-3 hover:bg-primary/5 transition-all duration-200 shadow-none"
             >
              <Link href={`/chat/${product.seller_id}?productId=${productId}`}>
                <MessageCircle className="w-5 h-5 text-accent" />
                <span className="hidden sm:inline">התייעצות</span>
                <span className="sm:hidden">צ'אט</span>
              </Link>
             </Button>
          </div>
          <div className="hidden sm:flex flex-col items-end border-r pr-6 md:pr-10 border-primary/8">
            <span className="text-[10px] font-bold text-primary/35 uppercase tracking-[0.2em] mb-1">סה"כ לתשלום</span>
            <div className="flex items-center gap-1.5 text-3xl font-black text-primary tabular-nums tracking-tighter">
              <span className="text-primary/50 text-lg font-bold">₪</span>
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
            setImageZoomLevel(MIN_IMAGE_ZOOM_LEVEL);
            setImagePan({ x: 0, y: 0 });
            dragOriginRef.current = null;
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] rounded-[1.5rem] sm:rounded-[2rem] border-none bg-black/95 p-3 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto" dir="rtl">
          <DialogHeader className="space-y-2 pr-12 text-right">
            <DialogTitle className="text-white">{productDisplayTitle}</DialogTitle>
            <p className="text-xs font-bold text-white/70">הגדל/הקטן עם הכפתורים וגרור לצדדים לעיון נוח — בנייד גרור לאחר הגדלה</p>
          </DialogHeader>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Label className="text-[10px] font-black text-white/70">רמת זום</Label>
            <Button type="button" size="sm" variant="outline" className="h-10 px-4 text-xs" onClick={() => updateImageZoom(imageZoomLevel - IMAGE_ZOOM_STEP)}>−</Button>
            <input
              type="range"
              min={MIN_IMAGE_ZOOM_LEVEL}
              max={MAX_IMAGE_ZOOM_LEVEL}
              step={IMAGE_ZOOM_STEP}
              value={imageZoomLevel}
              onChange={e => updateImageZoom(Number(e.target.value))}
              className="w-36 accent-accent"
              aria-label="רמת זום"
            />
            <Button type="button" size="sm" variant="outline" className="h-10 px-4 text-xs" onClick={() => updateImageZoom(imageZoomLevel + IMAGE_ZOOM_STEP)}>+</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-10 px-4 text-xs text-white hover:text-white hover:bg-white/10"
              onClick={() => {
                setImageZoomLevel(MIN_IMAGE_ZOOM_LEVEL);
                setImagePan({ x: 0, y: 0 });
                dragOriginRef.current = null;
              }}
            >
              איפוס
            </Button>
          </div>
          <div
            role="img"
            aria-label="תמונת מוצר מוגדלת"
            onWheel={(event) => {
              event.preventDefault();
              const delta = event.deltaY > 0 ? -IMAGE_WHEEL_ZOOM_DELTA : IMAGE_WHEEL_ZOOM_DELTA;
              updateImageZoom(imageZoomLevel + delta);
            }}
            onMouseDown={(event) => {
              if (imageZoomLevel <= MIN_IMAGE_ZOOM_LEVEL) return;
              dragOriginRef.current = { x: event.clientX - imagePan.x, y: event.clientY - imagePan.y };
            }}
            onMouseMove={(event) => {
              if (!dragOriginRef.current || imageZoomLevel <= MIN_IMAGE_ZOOM_LEVEL) return;
              updateImagePan(event.clientX - dragOriginRef.current.x, event.clientY - dragOriginRef.current.y);
            }}
            onMouseUp={() => {
              dragOriginRef.current = null;
            }}
            onMouseLeave={() => {
              dragOriginRef.current = null;
            }}
            onTouchStart={(event) => {
              if (imageZoomLevel <= MIN_IMAGE_ZOOM_LEVEL) return;
              const touch = event.touches[0];
              dragOriginRef.current = { x: touch.clientX - imagePan.x, y: touch.clientY - imagePan.y };
            }}
            onTouchMove={(event) => {
              if (!dragOriginRef.current || imageZoomLevel <= MIN_IMAGE_ZOOM_LEVEL) return;
              event.preventDefault();
              const touch = event.touches[0];
              updateImagePan(touch.clientX - dragOriginRef.current.x, touch.clientY - dragOriginRef.current.y);
            }}
            onTouchEnd={() => {
              dragOriginRef.current = null;
            }}
            className="relative block h-[60vh] w-full overflow-hidden rounded-[1.5rem] bg-black text-center touch-none"
          >
            <div className="relative h-full min-h-[24rem] w-full">
              <Image
                loader={unsplashLoader}
                src={currentImage}
                  alt={productDisplayTitle}
                fill
                className="object-contain transition-transform duration-150"
                style={{
                  transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoomLevel})`,
                  cursor: imageCursor,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </div>
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
