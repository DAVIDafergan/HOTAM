"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ScrollText,
  ShieldAlert,
  Clock,
  ArrowLeft,
  Trash2,
  ZoomIn
} from 'lucide-react';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
import { MotionTap } from '@/components/MotionTap';
import { EASE } from '@/lib/motion';

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
  const buyBoxRef = useRef<HTMLDivElement | null>(null);
  const [isBuyBoxVisible, setIsBuyBoxVisible] = useState(true);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

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
  const avgProductRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / reviews.length;
  }, [reviews]);
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

  // The floating action bar only needs to exist once the in-flow buy box has scrolled out of
  // view — otherwise the page would show two identical CTA pairs at once.
  useEffect(() => {
    const el = buyBoxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsBuyBoxVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToReviews = () => {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      setIsReviewFormOpen(false);
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
      <main className="container mx-auto px-4 pt-28 pb-16 md:py-28 max-w-6xl">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-16 items-start">
          {/* Product Images — Amazon-style swipeable gallery with dot indicator + thumbnails */}
          <div className="space-y-2 md:space-y-4">
            <div className="relative">
              <div
                ref={galleryScrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-[1.5rem] md:rounded-[1.75rem] aspect-[3/2] md:aspect-[4/5] bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)] ring-1 ring-primary/5 [-webkit-overflow-scrolling:touch] scroll-smooth"
              >
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    ref={el => { gallerySlideRefs.current[i] = el; }}
                    type="button"
                    aria-label={`פתח תצוגת זום לתמונה ${i + 1} מתוך ${images.length}`}
                    onClick={() => openImageZoom(i)}
                    className="group relative w-full h-full shrink-0 snap-center text-right"
                  >
                    <Image loader={unsplashLoader} src={img} alt={product.product_type} fill priority={i === 0} kind="product" sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  </button>
                ))}
              </div>

              {product.quantity <= 0 && (
                <div className="absolute inset-0 rounded-[1.5rem] md:rounded-[1.75rem] bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                  <Badge variant="destructive" className="px-8 py-3 text-sm font-black uppercase tracking-widest rounded-full shadow-2xl">אזל מהמלאי</Badge>
                </div>
              )}

              <div className="absolute top-3 right-3 md:top-4 md:right-4 pointer-events-none">
                <Badge className="bg-white/90 backdrop-blur-md text-primary border-none px-3.5 py-1.5 rounded-full font-bold text-[10px] uppercase shadow-sm">
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
                      "relative w-12 h-12 md:w-20 md:h-20 rounded-2xl overflow-hidden shrink-0 transition-all duration-200",
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
          <div className="text-right space-y-2 md:space-y-6 md:sticky md:top-28">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  {product.sub_type && product.sub_type !== 'all' && (
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{product.product_type}</p>
                  )}
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-headline font-black text-primary leading-[1.15] tracking-tight">
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
                <div className="flex md:hidden items-center gap-1.5 shrink-0 pt-1">
                  <button
                    onClick={handleShare}
                    aria-label="שיתוף"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-primary/10 shadow-sm text-primary/40 transition-all duration-200 active:scale-90"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-all duration-200 active:scale-90",
                      isFavorite ? "bg-primary text-white border-primary" : "bg-white text-primary/40 border-primary/10"
                    )}
                  >
                    <Heart className={cn("w-4 h-4 transition-transform duration-200", isFavorite && "fill-current")} />
                  </button>
                </div>
              </div>

              {/* Trust row — rating (or script-level, when there's nothing to rate yet) ·
                  seller name · verified badge, all in one line, Amazon-style. */}
              <div className="flex items-center justify-end gap-2 flex-wrap text-xs font-semibold">
                {seller && (
                  <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                    סופר מאומת
                  </Badge>
                )}
                {seller && (
                  <Link href={`/sellers/${seller.id}`} className="text-primary hover:text-accent transition-colors duration-200">
                    {seller.first_name} {seller.last_name}
                  </Link>
                )}
                {seller && <span className="text-primary/20">·</span>}
                {reviews.length > 0 ? (
                  <button
                    type="button"
                    onClick={scrollToReviews}
                    className="flex items-center gap-1 text-primary/70 hover:text-accent transition-colors duration-200"
                  >
                    <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                    <span className="whitespace-nowrap">{avgProductRating.toFixed(1)} ({reviews.length} ביקורות)</span>
                  </button>
                ) : (
                  <Badge variant="outline" className="border-accent/30 text-accent font-bold text-[10px] py-0.5 px-2.5 rounded-full bg-accent/5 whitespace-nowrap">
                    {product.script_level}
                  </Badge>
                )}
              </div>
            </div>

            {/* Price — clean, no decorative card chrome */}
            <div className="space-y-2 md:space-y-5 border-y border-primary/8 py-3 md:py-6">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-primary text-3xl sm:text-5xl md:text-6xl font-black tabular-nums tracking-tighter">{displayPrice}</span>
                <span className="text-primary/60 text-lg sm:text-2xl md:text-3xl font-bold">₪</span>
              </div>
              <p className="text-xs font-bold text-primary/40 uppercase tracking-[0.15em]">
                {hasDelivery ? 'המחירים כוללים מע"מ ומשלוח' : 'המחירים כוללים מע"מ'}
              </p>
            </div>

            {/* Buy Box — primary CTA visible immediately, no scroll required. Its own
                visibility (tracked via IntersectionObserver) gates the floating bottom bar
                so the two CTA pairs never show at once. */}
            <motion.div
              ref={buyBoxRef}
              initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="space-y-2"
            >
              <MotionTap>
                {product.product_type === 'ספר תורה' ? (
                  <Button
                    onClick={handleTorahCoordination}
                    disabled={isProcessingRequest}
                    className="w-full bg-accent text-primary hover:bg-accent/90 h-12 md:h-16 rounded-2xl font-black text-sm md:text-base gap-3 shadow-lg transition-shadow duration-300 hover:shadow-xl"
                  >
                    {isProcessingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                    תיאום ופגישה
                  </Button>
                ) : (
                  <Button
                    onClick={handlePurchaseClick}
                    disabled={product.quantity <= 0}
                    className="w-full bg-primary text-white hover:bg-primary/90 h-12 md:h-16 rounded-2xl font-black text-sm md:text-base gap-3 shadow-lg transition-shadow duration-300 hover:shadow-xl disabled:opacity-50"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    רכישה מאובטחת
                  </Button>
                )}
              </MotionTap>
              <MotionTap>
                <Button
                  variant="outline"
                  asChild
                  className="w-full border-primary/15 text-primary h-10 md:h-12 rounded-2xl font-bold text-sm gap-2 hover:bg-primary/5 transition-colors duration-200"
                >
                  <Link href={`/chat/${product.seller_id}?productId=${productId}`}>
                    <MessageCircle className="w-4 h-4 text-accent" />
                    התייעצות עם הסופר
                  </Link>
                </Button>
              </MotionTap>
            </motion.div>

            {/* Logistics — compact single-layer strip, not a tall card */}
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-primary/[0.03] px-4 py-3 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-primary/30 shrink-0" />
                <span className="font-medium text-primary/50 whitespace-nowrap">זמן אספקה</span>
                <span className="font-black text-primary whitespace-nowrap">
                  {product.product_type === 'ספר תורה' ? 'בתיאום אישי' : `${product.delivery_time || '3'} ימים`}
                </span>
              </div>
              <div className="w-px h-4 bg-primary/10 shrink-0" />
              {hasDelivery ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Truck className="w-3.5 h-3.5 text-primary/30 shrink-0" />
                  <span className="font-medium text-primary/50 whitespace-nowrap">משלוח</span>
                  <span className="font-black text-emerald-600 whitespace-nowrap">
                    {Number(product.delivery_fee) > 0 ? `₪${product.delivery_fee}` : 'חינם'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-medium text-primary/50 whitespace-nowrap">זמינות</span>
                  <span className="font-black text-emerald-600 whitespace-nowrap">{product.quantity > 0 ? 'במלאי' : 'אזל זמנית'}</span>
                </div>
              )}
            </div>

            {/* Seller Summary — social-profile-style card, visible immediately (no tab click needed) */}
            {seller && (
              <motion.div
                initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.05, ease: EASE }}
              >
                <Link
                  href={`/sellers/${seller.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-white p-3 hover:border-accent/30 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden shrink-0 bg-muted ring-1 ring-primary/10">
                    {seller.profile_image ? (
                      <Image src={seller.profile_image} alt={`${seller.first_name} ${seller.last_name}`} fill kind="avatar" sizes="48px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><UserRound className="w-5 h-5 text-primary/20" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right space-y-0.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-black text-primary text-sm truncate">{seller.first_name} {seller.last_name}</span>
                      <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black uppercase px-2 py-0.5 shrink-0">סופר מאומת</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end text-[11px] font-medium text-muted-foreground">
                      {reviews.length > 0 && (
                        <>
                          <span className="flex items-center gap-0.5 whitespace-nowrap">
                            <Star className="w-3 h-3 fill-accent text-accent" />
                            {avgProductRating.toFixed(1)} ({reviews.length})
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span className="truncate">{sellerCity || 'ישראל'}</span>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-primary/20 group-hover:text-accent group-hover:-translate-x-0.5 transition-all duration-200 shrink-0" />
                </Link>
              </motion.div>
            )}

            <div className="space-y-3">
              <SectionHeading icon={<ScrollText className="w-3.5 h-3.5 shrink-0" />}>על כלי הקודש</SectionHeading>
              <p className="text-primary/75 font-medium text-base leading-relaxed">
                {product.description}
              </p>
            </div>
          </div>
        </div>

        {/* ── Below-grid, full-width continuous sections — replaces the old tabs so every
             piece of information is reachable by scrolling, not clicking. ── */}

        <PageSection>
          <SectionHeading icon={<ScrollText className="w-3.5 h-3.5 shrink-0" />}>מפרט טכני</SectionHeading>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-1 max-w-3xl text-right">
            <SpecItem label="סוג כתב ומסורת" value={product.script_type} />
            <SpecItem label="רמת הידור הלכתית" value={product.script_level} />
            <SpecItem label="גודל קלף (סנטימטר)" value={product.parchment_size || 'סטנדרט'} />
            <SpecItem label="רמת הגהה וביקורת" value={product.proofreading_level || 'גברא'} />
            <SpecItem label="מלאי זמין כעת" value={`${product.quantity} יחידות`} />
          </div>
        </PageSection>

        {(deliveryAreaText || normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both' || normalizedDeliveryType === 'pickup') && (
          <PageSection>
            <SectionHeading icon={<Truck className="w-3.5 h-3.5 shrink-0" />}>משלוח ואיסוף</SectionHeading>
            <div className="space-y-4 max-w-3xl text-right">
              {(normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both') && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] font-medium text-primary/50 uppercase tracking-widest">ערים זמינות למשלוח</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {deliveryAreaText ? (
                      deliveryAreaText.split(', ').filter(Boolean).map((city: string) => (
                        <Badge key={city} variant="outline" className="text-primary/70 border-primary/15 font-medium text-[11px] px-3 py-1 rounded-full">
                          <MapPin className="w-3 h-3 ml-1 text-primary/30" />{city}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-200 font-medium text-[11px] px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3 ml-1" />כל הארץ
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {(normalizedDeliveryType === 'pickup' || normalizedDeliveryType === 'both') && (
                <div className={cn("space-y-1", (normalizedDeliveryType === 'both') && "pt-3 border-t border-primary/8")}>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm font-medium text-primary/80">איסוף עצמי מ{sellerCity || 'עיר הסופר'}</span>
                    <MapPin className="w-3.5 h-3.5 text-primary/30 shrink-0" />
                  </div>
                  {pickupAddress && (
                    <p className="text-xs text-primary/45 font-medium text-right">{pickupAddress}</p>
                  )}
                </div>
              )}
            </div>
          </PageSection>
        )}

        {seller && (
          <PageSection>
            <SectionHeading icon={<UserRound className="w-3.5 h-3.5 shrink-0" />}>על הסופר</SectionHeading>
            <div className="flex flex-col md:flex-row items-center gap-10 max-w-3xl">
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center ring-1 ring-primary/10">
                {seller.profile_image ? (
                  <Image src={seller.profile_image} alt="Scribe" fill kind="avatar" sizes="96px" className="object-cover" />
                ) : (
                  <UserRound className="w-12 h-12 text-primary/10" />
                )}
              </div>
              <div className="flex-1 space-y-4 text-center md:text-right">
                <p className="text-base md:text-lg italic leading-relaxed text-primary/70 max-w-2xl mx-auto md:mr-0">
                  "{seller.notes || 'סופר סת\"ם מוסמך וירא שמיים, כותב בקדושה ובטהרה.'}"
                </p>
                <Button asChild variant="outline" className="rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white font-bold uppercase text-xs h-12 px-10 transition-all shadow-md">
                  <Link href={`/sellers/${seller.id}`}>לפרופיל המלא ודוגמאות כתיבה <ArrowLeft className="w-4 h-4 mr-2" /></Link>
                </Button>
              </div>
            </div>
          </PageSection>
        )}

        <PageSection id="reviews" className="scroll-mt-28">
          <SectionHeading icon={<Star className="w-3.5 h-3.5 shrink-0" />}>ביקורות ({sortedProductReviews.length})</SectionHeading>
          <div className="max-w-3xl">
            {sortedProductReviews.length > 0 && (
              <div className="flex items-center justify-between gap-4 flex-wrap mb-6 text-right">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={reviewSortOrder === 'newest' ? 'default' : 'outline'}
                    onClick={() => setReviewSortOrder('newest')}
                    className="rounded-full text-[10px] h-8 px-4 font-bold"
                  >
                    החדשות ביותר
                  </Button>
                  <Button
                    type="button"
                    variant={reviewSortOrder === 'oldest' ? 'default' : 'outline'}
                    onClick={() => setReviewSortOrder('oldest')}
                    className="rounded-full text-[10px] h-8 px-4 font-bold"
                  >
                    הוותיקות ביותר
                  </Button>
                </div>
                <div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-3xl font-black text-primary tabular-nums">{avgProductRating.toFixed(1)}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={cn("w-4 h-4", s <= Math.round(avgProductRating) ? 'fill-accent text-accent' : 'text-muted-foreground/20')} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">{sortedProductReviews.length} ביקורות</p>
                </div>
              </div>
            )}

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

            {/* Write-a-review — collapsed behind a button by default; the form itself is
                only relevant to someone who already bought the product. */}
            {hasUserReviewedProduct ? (
              <p className="mt-8 text-xs font-medium text-muted-foreground text-right">כבר פרסמת ביקורת על מוצר זה.</p>
            ) : (
              <div className="mt-8 text-right">
                {!isReviewFormOpen ? (
                  <MotionTap className="inline-block">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsReviewFormOpen(true)}
                      className="rounded-full h-11 px-6 font-bold text-sm gap-2 border-primary/15"
                    >
                      <Star className="w-4 h-4 text-accent" /> כתוב ביקורת
                    </Button>
                  </MotionTap>
                ) : shouldReduceMotion ? (
                  <ReviewFormPanel
                    user={user}
                    pathname={pathname}
                    hasUserReviewedProduct={hasUserReviewedProduct}
                    reviewComment={reviewComment}
                    setReviewComment={setReviewComment}
                    reviewRating={reviewRating}
                    setReviewRating={setReviewRating}
                    reviewIsAnonymous={reviewIsAnonymous}
                    setReviewIsAnonymous={setReviewIsAnonymous}
                    isOwnProductReviewBlocked={isOwnProductReviewBlocked}
                    isReviewSubmitting={isReviewSubmitting}
                    handleSubmitProductReview={handleSubmitProductReview}
                    getProductReviewSubmitLabel={getProductReviewSubmitLabel}
                  />
                ) : (
                  <AnimatePresence>
                    <motion.div
                      key="review-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <ReviewFormPanel
                        user={user}
                        pathname={pathname}
                        hasUserReviewedProduct={hasUserReviewedProduct}
                        reviewComment={reviewComment}
                        setReviewComment={setReviewComment}
                        reviewRating={reviewRating}
                        setReviewRating={setReviewRating}
                        reviewIsAnonymous={reviewIsAnonymous}
                        setReviewIsAnonymous={setReviewIsAnonymous}
                        isOwnProductReviewBlocked={isOwnProductReviewBlocked}
                        isReviewSubmitting={isReviewSubmitting}
                        handleSubmitProductReview={handleSubmitProductReview}
                        getProductReviewSubmitLabel={getProductReviewSubmitLabel}
                      />
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}
          </div>
        </PageSection>
      </main>

      {/* Floating Action Bar — only exists while the in-flow buy box is scrolled out of
          view, so there's never more than one visible pair of purchase CTAs. */}
      <AnimatePresence>
        {!isBuyBoxVisible && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-2xl border-t border-primary/8 h-20 sm:h-24 md:h-28 shadow-[0_-8px_30px_rgba(15,23,42,0.06)]"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
        <span className="text-[10px] md:text-xs font-medium text-primary/40 uppercase tracking-widest">{label}</span>
        <div className="w-1.5 h-1.5 rounded-full bg-accent opacity-40" />
      </div>
    </div>
  );
}

// One heading style for every section on the page (specs / delivery / seller / reviews /
// description), so the page reads as consistently "sectioned" instead of each area
// inventing its own header treatment.
function SectionHeading({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center justify-end gap-2 text-xs font-bold text-primary/40 uppercase tracking-widest whitespace-nowrap mb-6">
      {children} {icon}
    </h2>
  );
}

// Uniform vertical rhythm + a single, once-only entrance for every full-width section below
// the image/info grid. Centralizing this guarantees the spacing and animation actually stay
// identical across sections instead of drifting via copy-paste.
function PageSection({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("mt-12 md:mt-20", className)}
    >
      {children}
    </motion.section>
  );
}

// Extracted so the collapsible review form only needs to be written once, regardless of
// whether it's wrapped in a height-animated motion.div (normal) or rendered directly
// (prefers-reduced-motion).
function ReviewFormPanel({
  user,
  pathname,
  hasUserReviewedProduct,
  reviewComment,
  setReviewComment,
  reviewRating,
  setReviewRating,
  reviewIsAnonymous,
  setReviewIsAnonymous,
  isOwnProductReviewBlocked,
  isReviewSubmitting,
  handleSubmitProductReview,
  getProductReviewSubmitLabel,
}: {
  user: any;
  pathname: string;
  hasUserReviewedProduct: boolean;
  reviewComment: string;
  setReviewComment: (v: string) => void;
  reviewRating: number;
  setReviewRating: (v: number) => void;
  reviewIsAnonymous: boolean;
  setReviewIsAnonymous: (v: boolean) => void;
  isOwnProductReviewBlocked: boolean;
  isReviewSubmitting: boolean;
  handleSubmitProductReview: () => void;
  getProductReviewSubmitLabel: () => string;
}) {
  return (
    <div className="mt-4 rounded-3xl border border-primary/10 bg-primary/[0.02] p-5 md:p-6 space-y-4 text-right">
      <div className="space-y-1">
        <h3 className="text-base font-black text-primary">פרסום ביקורת</h3>
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
            <Label className="text-[10px] font-bold uppercase text-slate-500">ביקורת</Label>
            <Textarea
              placeholder="שתף את הרשמך מהמוצר..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              className="rounded-2xl min-h-[100px]"
              disabled={!user || isOwnProductReviewBlocked || isReviewSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-primary">דירוג כוכבים</Label>
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
  );
}
