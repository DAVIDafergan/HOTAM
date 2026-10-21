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
  ZoomIn,
  PenLine,
  Award,
  Ruler,
  Package,
  Home,
  ChevronLeft,
  MessageSquare,
  BadgeCheck,
  Store
} from 'lucide-react';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { useSupabaseClient, useApp } from '@/lib/supabase-hooks';
import { doc } from '@/lib/supabase-compat';
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
import { logEvent } from '@/lib/log-event';
import unsplashLoader from '@/lib/unsplashLoader';
import { cn } from '@/lib/utils';
import { Price } from '@/components/Price';
import { useActiveSeasons } from '@/hooks/use-active-seasons';
import { getTorahDeliveryTimeLabel } from '@/lib/torah-delivery-time';
import { PROFILE_NOT_FOUND_CODE } from '@/lib/supabase-errors';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  describeJudaicaAttributes, getJudaicaCategory, resolveSellerType, seasonalBadgeLabel, shouldShowSeasonalBadge,
} from '@/lib/product-catalog';

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
// reviews has no user_name column (confirmed via live PostgREST 400 error) —
// selecting it made this fallback fetch fail outright.
const REVIEW_FALLBACK_FIELDS = [
  'id',
  'product_id',
  'buyer_id',
  'buyer_name',
  'rating',
  'product_rating',
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
  sellerRating = null,
}: {
  productId: string;
  initialProduct?: any | null;
  initialSeller?: any | null;
  initialReviews?: any[];
  sellerRating?: { avg: number; count: number } | null;
}) {
  const { user, profile } = useApp();
  const db = useSupabaseClient();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const activeSeasons = useActiveSeasons();
  const [detailsTab, setDetailsTab] = useState('specs');
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
  const openDetailsTab = (tab: string) => {
    setDetailsTab(tab);
    detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [isProcessingFavorite, setIsProcessingFavorite] = useState(false);
  const [isCoordinationPhoneDialogOpen, setIsCoordinationPhoneDialogOpen] = useState(false);
  const [coordinationPhoneInput, setCoordinationPhoneInput] = useState('');

  // Feeds the admin overview's "most-viewed products" — nothing measured product views at
  // all before this. One event per page load, not per re-render (productId only changes on
  // an actual navigation to a different product).
  useEffect(() => {
    if (!productId) return;
    logEvent('product_viewed', { product_id: productId });
  }, [productId]);

  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const [product, setProduct] = useState<any>(initialProduct);
  const [seller, setSeller] = useState<any>(initialSeller);
  const [isLoadingFallback, setIsLoadingFallback] = useState(!initialProduct && !!productId);

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
                // Post-purchase reviews carry the scribe rating in `rating`; show the product's.
                rating: Number(review?.product_rating) || review?.rating,
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
        variant: "success",
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

  // Actually creates the torah_request order. Admin needs the buyer's real contact
  // details to follow up (this is the whole point of the flow), so a missing phone
  // blocks submission until handleTorahCoordination prompts for one.
  const submitTorahCoordination = async (phone: string) => {
    setIsProcessingRequest(true);

    const buyerName = (profileData?.first_name || profileData?.last_name)
      ? `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim()
      : (user!.displayName || 'משתמש');
    const buyerEmail = profileData?.email || user!.email || '';

    const requestData = {
      seller_id: product.seller_id,
      product_id: productId,
      product_name: product.sub_type && product.sub_type !== 'all' ? product.sub_type : product.product_type,
      product_image: product.images?.[0] || '',
      amount: product.price,
      status: 'torah_request',
      buyer_id: user!.uid,
      buyer_name: buyerName,
      buyer_phone: phone,
      buyer_email: buyerEmail,
      delivery_method: 'תיאום מול האתר'
    };

    const { error } = await supabase.from('orders').insert(requestData);
    setIsProcessingRequest(false);

    if (error) {
      console.error('[torah coordination] insert error:', error.message);
      toast({
        variant: 'destructive',
        title: 'משהו השתבש',
        description: 'הבקשה לא נשלחה. נסו שוב או צרו איתנו קשר.',
      });
      return;
    }

    setIsCoordinationPhoneDialogOpen(false);
    setCoordinationPhoneInput('');
    toast({
      variant: "success",
      title: "הבקשה נשלחה בהצלחה",
      description: "נציג 'חותם' יחזור אליך בהקדם לתיאום פגישה להתרשמות מהספר."
    });
    router.push('/customer/dashboard');
  };

  const handleTorahCoordination = () => {
    if (!user) { router.push('/login?redirect=' + encodeURIComponent(pathname)); return; }
    const existingPhone = profileData?.phone?.trim();
    if (!existingPhone) {
      setIsCoordinationPhoneDialogOpen(true);
      return;
    }
    submitTorahCoordination(existingPhone);
  };

  const handleCoordinationPhoneSubmit = () => {
    const phone = coordinationPhoneInput.trim();
    if (!phone) {
      toast({ variant: 'destructive', title: 'נא להזין מספר טלפון' });
      return;
    }
    submitTorahCoordination(phone);
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
      else { await navigator.clipboard.writeText(url); toast({ variant: "success", title: "הקישור הועתק" }); }
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
      toast({ variant: "success", title: 'תודה על הביקורת!' });
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
      toast({ variant: "success", title: 'הביקורת נמחקה בהצלחה' });
    } finally {
      setDeletingReviewId(null);
    }
  };

  if (isLoadingFallback && !product) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center">המוצר לא נמצא</div>;

  const rawImages = Array.isArray(product.images) ? product.images : [];
  const images = rawImages.length > 0 ? rawImages : [logoImg];
  const currentImage = images[selectedImageIdx] || logoImg;
  const displayPrice = Math.round(Number(product.price) * VAT_MULTIPLIER).toLocaleString('he-IL');
  const productDisplayTitle = `${product.product_type}${product.sub_type && product.sub_type !== 'all' ? ` ${product.sub_type}` : ''}`;
  // Richer image alt text (size + script + quality) instead of just the
  // product name, so each product photo carries real descriptive/keyword
  // context for image search — built from the same fields already shown
  // in the spec tab, not invented.
  const productAltDescription = [
    productDisplayTitle,
    product.parchment_size ? `${product.parchment_size} ס"מ` : '',
    product.script_type ? `כתב ${product.script_type}` : '',
    product.script_level || '',
  ].filter(Boolean).join(' ') + ' - חותם';
  // ספר תורה and ספר הפטרות are both custom/coordinated orders — the buyer never buys
  // instantly or contacts the seller directly; they leave a request that "חותם" staff
  // (not the seller) follow up on, via the same torah_request order flow.
  const isCoordinationOnlyProduct = product.product_type === 'ספר תורה'
    || (product.product_type === 'מוצרי יודאיקה שונים' && product.sub_type === 'ספר הפטרות');
  const normalizedDeliveryType = (() => {
    const raw = String(product.delivery_type || '').toLowerCase();
    if (raw === 'delivery' || raw === 'shipping' || raw === 'shipping_only') return 'delivery';
    if (raw === 'pickup' || raw === 'pickup_only') return 'pickup';
    return 'both';
  })();
  const hasDelivery = normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both';
  const hasPickup = normalizedDeliveryType === 'pickup' || normalizedDeliveryType === 'both';
  const isInStock = Number(product.quantity) > 0;
  const productRatings = (reviews || []).map((r: any) => Number(r.rating)).filter((n: number) => Number.isFinite(n) && n > 0);
  const productRatingAvg = productRatings.length > 0 ? productRatings.reduce((a: number, n: number) => a + n, 0) / productRatings.length : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: productRatings.filter((n: number) => Math.round(n) === star).length,
  }));
  const sellerFullName = seller ? `${seller.first_name || ''} ${seller.last_name || ''}`.trim() : '';
  const judaicaCategory = getJudaicaCategory(product.product_type);
  // Who's selling: a Judaica seller gets neutral wording (their type, or the product's kind
  // when the seller row isn't available).
  const isJudaicaSeller = seller ? resolveSellerType(seller.seller_type) === 'judaica_seller' : Boolean(judaicaCategory);
  const judaicaSpecRows = judaicaCategory ? describeJudaicaAttributes(judaicaCategory, product.attributes || {}) : [];
  const showSeasonalBadge = shouldShowSeasonalBadge(product.product_type, activeSeasons);
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
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24 max-w-6xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700">

        {/* Mobile Header Actions */}
        <div className="mb-4 flex justify-end md:hidden">
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleShare} className="rounded-full bg-card border-border shadow-none" aria-label="שיתוף"><Share2 className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={handleToggleFavorite} aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'} className={cn("rounded-full bg-card border-border shadow-none", isFavorite ? 'text-rose-600' : '')}><Heart className={cn("w-4 h-4 transition-transform duration-200", isFavorite ? 'fill-current' : '')} /></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
          {/* Product images — swipeable gallery */}
          <div className="space-y-4">
            <div className="relative group">
              <div
                ref={galleryScrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide aspect-[4/5] w-full rounded-[2rem] bg-secondary/50 shadow-premium-lg ring-1 ring-border/70 [-webkit-overflow-scrolling:touch] scroll-smooth"
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
                    <Image loader={unsplashLoader} src={img} alt={`${productAltDescription} - תמונה ${i + 1} מתוך ${images.length}`} fill priority={i === 0} loading={i === 0 ? undefined : 'lazy'} kind="product" sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  </button>
                ))}
              </div>
              {product.quantity <= 0 && (
                <div className="absolute inset-0 rounded-[2rem] bg-black/45 flex items-center justify-center">
                  <Badge variant="destructive" className="px-6 py-2.5 text-[15px] font-bold rounded-full shadow-lg">אזל מהמלאי</Badge>
                </div>
              )}
              <div className="absolute bottom-4 left-4 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-[13px] font-semibold text-primary shadow-md">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>הגדלה</span>
                </div>
              </div>
              {product.script_level && (
                <div className="absolute top-4 right-4 hidden md:block">
                  <Badge className="bg-card/95 text-primary border-none px-4 py-1.5 rounded-full font-semibold text-[13px] shadow-sm">
                    {product.script_level}
                  </Badge>
                </div>
              )}
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
                      selectedImageIdx === i ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'ring-1 ring-border opacity-75 hover:opacity-100 hover:ring-primary/30'
                    )}
                  >
                    <Image loader={unsplashLoader} src={img} alt={`תמונה ממוזערת ${i + 1} - ${productAltDescription}`} fill loading="lazy" kind="product" sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="text-right space-y-6 md:space-y-8 md:sticky md:top-28">
            <nav aria-label="breadcrumb" className="flex items-center justify-start gap-1.5 text-[13px] font-medium text-muted-foreground flex-wrap">
              <Link href="/" className="flex min-h-[32px] items-center gap-1 hover:text-primary transition-colors">
                <Home className="w-3.5 h-3.5" /> דף הבית
              </Link>
              <ChevronLeft className="w-3 h-3 shrink-0" />
              <Link href={`/search?product=${encodeURIComponent(product.product_type)}`} className="flex min-h-[32px] items-center hover:text-primary transition-colors">{product.product_type}</Link>
              <ChevronLeft className="w-3 h-3 shrink-0" />
              <span aria-current="page" className="text-primary/80">{productDisplayTitle}</span>
            </nav>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 justify-start items-center">
                {product.script_level && (
                  <Badge variant="gold" className="text-[13px] py-1.5 px-3 whitespace-nowrap">
                    {product.script_level}
                  </Badge>
                )}
                {showSeasonalBadge && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 text-[13px] py-1.5 px-3 rounded-full whitespace-nowrap">
                    {seasonalBadgeLabel(product.product_type)}
                  </Badge>
                )}
                {isInStock ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50/70 text-emerald-800 text-[13px] py-1.5 px-3 rounded-full whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    זמין במלאי ({product.quantity})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-rose-200 bg-rose-50/70 text-rose-800 text-[13px] py-1.5 px-3 rounded-full whitespace-nowrap">
                    אזל מהמלאי
                  </Badge>
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  {product.sub_type && product.sub_type !== 'all' && (
                    <p className="eyebrow mb-1">{product.product_type}</p>
                  )}
                  <h1 className="text-[38px] md:text-[56px] font-headline font-medium text-primary leading-[1.08]">
                    {productDisplayTitle}
                  </h1>
                  <button
                    type="button"
                    onClick={() => openDetailsTab('reviews')}
                    className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-full text-sm font-semibold text-primary/75 transition-colors hover:text-primary"
                  >
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("h-4 w-4", s <= Math.round(productRatingAvg) ? 'fill-accent text-accent' : 'text-primary/15')} />
                      ))}
                    </span>
                    {productRatings.length > 0 ? (
                      <span>{productRatingAvg.toFixed(1)} · {productRatings.length} ביקורות</span>
                    ) : (
                      <span className="text-primary/65">עדיין אין ביקורות — היו הראשונים</span>
                    )}
                  </button>
                </div>
                <div className="hidden md:flex items-center gap-1.5 shrink-0 pt-1">
                  <button
                    onClick={handleShare}
                    aria-label="שיתוף"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-primary/70 transition-colors duration-200 hover:bg-primary/5 hover:text-primary active:scale-95"
                  >
                    <Share2 className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    onClick={handleToggleFavorite}
                    aria-label={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border border-border transition-colors duration-200 hover:bg-primary/5 active:scale-95",
                      isFavorite ? "text-rose-600" : "text-primary/70 hover:text-primary"
                    )}
                  >
                    <Heart className={cn("w-[18px] h-[18px] transition-transform duration-200", isFavorite && "fill-current")} />
                  </button>
                </div>
              </div>
            </div>

            {/* Price — clean, no decorative card chrome */}
            <div className="space-y-5 border-y border-border/80 py-6">
              <div className="flex items-baseline justify-start gap-3">
                <Price value={displayPrice} className="text-[36px] md:text-[44px] leading-none" />
                <span className="text-sm font-medium text-muted-foreground">כולל מע"מ</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <section aria-labelledby="delivery-time-label" className="flex flex-col items-start gap-1 rounded-2xl border border-border/70 bg-card p-4 text-right">
                  <Clock className="w-4 h-4 text-accent-strong mb-1" />
                  <span id="delivery-time-label" className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">זמן אספקה</span>
                  <span className="text-[15px] font-bold text-primary leading-snug whitespace-nowrap">
                    {product.product_type === 'ספר תורה' ? getTorahDeliveryTimeLabel(product.delivery_time) : `${product.delivery_time || '3'} ימים`}
                  </span>
                </section>
                {hasDelivery ? (
                  <section aria-labelledby="delivery-fee-label" className="flex flex-col items-start gap-1 rounded-2xl border border-border/70 bg-card p-4 text-right">
                    <Truck className="w-4 h-4 text-accent-strong mb-1" />
                    <span id="delivery-fee-label" className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">עלות משלוח</span>
                    <span className="text-[15px] font-bold text-emerald-800 leading-snug whitespace-nowrap">
                      {Number(product.delivery_fee) > 0 ? `₪${product.delivery_fee}` : 'משלוח חינם'}
                    </span>
                  </section>
                ) : (
                  <section aria-labelledby="stock-status-label" className="flex flex-col items-start gap-1 rounded-2xl border border-border/70 bg-card p-4 text-right">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
                    <span id="stock-status-label" className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">זמינות</span>
                    <span className="text-[15px] font-bold text-emerald-800 leading-snug whitespace-nowrap">{product.quantity > 0 ? 'במלאי' : 'אזל זמנית'}</span>
                  </section>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-start gap-x-5 gap-y-2 pt-1">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-primary/75">
                  {hasDelivery ? (
                    <><Truck className="w-3.5 h-3.5 text-accent-strong shrink-0" /> משלוח עד הבית</>
                  ) : (
                    <><Store className="w-3.5 h-3.5 text-accent-strong shrink-0" /> איסוף עצמי</>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-primary/75">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent-strong shrink-0" /> אבטחת תשלום
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-primary/75">
                  <ShieldAlert className="w-3.5 h-3.5 text-accent-strong shrink-0" /> מדיניות החזרה
                </span>
              </div>
            </div>

            {judaicaCategory?.notice && (
              <div className="flex items-start gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4" role="note" data-product-notice>
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-sm font-semibold leading-relaxed text-amber-900">
                  {judaicaCategory.notice.text}{' '}
                  <Link href={judaicaCategory.notice.href} className="underline decoration-amber-500 underline-offset-2">{judaicaCategory.notice.linkLabel}</Link>
                </p>
              </div>
            )}

            {/* Seller "post author" card — who wrote this, at a glance */}
            {seller && (
              <Link
                href={`/sellers/${seller.id}`}
                className="group flex items-center gap-4 rounded-[1.75rem] border border-border/70 bg-card p-4 shadow-premium transition-shadow duration-300 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-secondary ring-1 ring-accent/40 flex items-center justify-center">
                  {seller.profile_image ? (
                    <Image src={seller.profile_image} alt={sellerFullName || 'סופר'} fill kind="avatar" sizes="56px" className="object-cover" />
                  ) : (
                    <UserRound className="h-6 w-6 text-primary/25" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-[13px] font-medium text-muted-foreground">{judaicaCategory ? 'נמכר על ידי' : 'נכתב על ידי'}</p>
                  <p className="flex items-center gap-1 font-body text-lg font-semibold text-primary">
                    <span className="truncate">{sellerFullName || 'סופר סת״ם'}</span>
                    {seller.is_approved && <BadgeCheck className="h-4 w-4 shrink-0 fill-accent text-white" aria-label="סופר מאומת" />}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] font-medium text-muted-foreground">
                    {sellerCity && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-accent" />{sellerCity}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-accent text-accent" />
                      {sellerRating ? `${sellerRating.avg.toFixed(1)} (${sellerRating.count})` : (isJudaicaSeller ? 'מוכר חדש' : 'סופר חדש')}
                    </span>
                  </div>
                </div>
                <span className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border border-primary/20 px-4 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  לפרופיל
                  <ArrowLeft className="h-3.5 w-3.5" />
                </span>
              </Link>
            )}

            <div className="space-y-3">
              <h2 className="font-body text-xl font-semibold text-primary flex items-center justify-start gap-2">
                <ScrollText className="w-4 h-4 shrink-0 text-accent-strong" /> {judaicaCategory ? 'על המוצר' : 'על כלי הקודש'}
              </h2>
              <p className="text-primary/80 text-[17px] font-light leading-[1.85] whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {(deliveryAreaText || normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both' || normalizedDeliveryType === 'pickup') && (
              <div className="space-y-4 rounded-[1.75rem] border border-border/70 bg-card/60 p-5">
                {(normalizedDeliveryType === 'delivery' || normalizedDeliveryType === 'both') && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-start gap-2">
                      <Truck className="w-4 h-4 text-accent-strong" />
                      <span className="text-sm font-bold text-primary">ערים זמינות למשלוח</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-start">
                      {deliveryAreaText ? (
                        deliveryAreaText.split(', ').filter(Boolean).map((city: string) => (
                          <Badge key={city} variant="outline" className="bg-card text-primary/80 border-border font-medium text-[13px] px-3 py-1.5 rounded-full">
                            <MapPin className="w-3 h-3 text-accent-strong" />{city}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50/70 text-emerald-800 border-emerald-200 font-medium text-[13px] px-3 py-1.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />כל הארץ
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {(normalizedDeliveryType === 'pickup' || normalizedDeliveryType === 'both') && (
                  <div className={cn("space-y-1", (normalizedDeliveryType === 'both') && "pt-3 border-t border-primary/5")}>
                    <div className="flex items-center justify-start gap-2">
                      <MapPin className="w-4 h-4 text-accent-strong shrink-0" />
                      <span className="text-sm font-bold text-primary/80">איסוף עצמי מ{sellerCity || 'עיר הסופר'}</span>
                    </div>
                    {pickupAddress && (
                      <p className="text-sm text-primary/85 text-right">{pickupAddress}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Technical Details Tabs */}
        <div ref={detailsSectionRef} className="mt-16 md:mt-28 scroll-mt-28">
          <Tabs value={detailsTab} onValueChange={setDetailsTab} dir="rtl" className="text-right">
            <TabsList className="mb-8 md:mb-10 inline-flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto no-scrollbar rounded-full border border-border/70 bg-card p-1.5 shadow-premium sm:w-auto">
             <TabsTrigger value="specs" className="flex-none rounded-full px-5 py-2.5 text-[15px] font-semibold text-primary/70 transition-colors duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap">מפרט טכני</TabsTrigger>
             <TabsTrigger value="seller" className="flex-none rounded-full px-5 py-2.5 text-[15px] font-semibold text-primary/70 transition-colors duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap">{judaicaCategory ? 'המוכר' : 'הסופר הכותב'}</TabsTrigger>
             <TabsTrigger value="reviews" className="flex-none rounded-full px-5 py-2.5 text-[15px] font-semibold text-primary/70 transition-colors duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap">ביקורות ({(reviews || []).length})</TabsTrigger>
            </TabsList>

            <TabsContent value="specs" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h2 className="sr-only">מפרט טכני</h2>
              {judaicaCategory ? (
                <div className="grid sm:grid-cols-2 gap-3 max-w-3xl" data-judaica-specs>
                  {product.sub_type && <SpecItem icon={Package} label="סוג" value={product.sub_type} />}
                  {judaicaSpecRows.map(([label, value]) => (
                    <SpecItem key={label} icon={CheckCircle2} label={label} value={value} />
                  ))}
                  <SpecItem icon={Package} label="מלאי זמין כעת" value={`${product.quantity} יחידות`} />
                </div>
              ) : (
              <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                <SpecItem icon={PenLine} label="סוג כתב ומסורת" value={product.script_type} />
                <SpecItem icon={Award} label="רמת הידור הלכתית" value={product.script_level} />
                <SpecItem icon={Ruler} label="גודל קלף (סנטימטר)" value={product.parchment_size || 'סטנדרט'} />
                <SpecItem icon={ShieldCheck} label="רמת הגהה וביקורת" value={product.proofreading_level || 'גברא'} />
                <SpecItem icon={Package} label="מלאי זמין כעת" value={`${product.quantity} יחידות`} />
              </div>
              )}
            </TabsContent>

            <TabsContent value="seller" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-3xl">
                {seller ? (
                  <div className="rounded-[2rem] md:rounded-[2.5rem] bg-card border border-border/70 shadow-premium p-6 md:p-10">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shrink-0 ring-2 ring-accent/15 shadow-md">
                        {seller.profile_image ? (
                          <Image src={seller.profile_image} alt="" fill kind="avatar" sizes="112px" className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/15 flex items-center justify-center">
                            <span className="text-3xl font-headline font-medium text-primary/50">
                              {`${seller.first_name?.[0] ?? ''}${seller.last_name?.[0] ?? ''}` || <UserRound className="w-10 h-10 text-primary/20" />}
                            </span>
                          </div>
                        )}
                        {seller.is_approved && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-accent text-primary p-1.5 rounded-full shadow-md border-2 border-white">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-4 text-center sm:text-right">
                        <div className="space-y-1.5">
                          <h2 className="text-[26px] sm:text-[32px] font-body font-semibold text-primary truncate">
                            {seller.first_name} {seller.last_name}
                          </h2>
                          <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                            {seller.is_approved && (
                              <span className="text-[13px] font-semibold text-accent-strong">{isJudaicaSeller ? 'מוכר מאושר' : 'סופר מאומת'}</span>
                            )}
                            <p className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-accent" /> {sellerCity || 'לא צוין'}
                            </p>
                          </div>
                        </div>

                        <blockquote className="border-r-2 border-accent/40 pr-4 py-0.5 text-center sm:text-right">
                          <p className="text-base sm:text-lg leading-relaxed text-primary/85">
                            {seller.notes || (isJudaicaSeller ? 'מוכר מוצרי יודאיקה באתר חותם.' : 'סופר סת"ם מוסמך וירא שמיים, כותב בקדושה ובטהרה.')}
                          </p>
                        </blockquote>

                        <div className="pt-2 flex justify-center sm:justify-start">
                          <Button asChild variant="outline" className="px-8">
                            <Link href={`/sellers/${seller.id}`}>{isJudaicaSeller ? 'לפרופיל המוכר' : 'לפרופיל המלא ודוגמאות כתיבה'} <ArrowLeft className="w-4 h-4 mr-2" /></Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm font-bold py-10 text-center md:text-right">
                    {isJudaicaSeller ? 'פרטי המוכר אינם זמינים כרגע.' : 'פרטי הסופר אינם זמינים כרגע.'}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="max-w-3xl">
                {productRatings.length > 0 && (
                  <div className="mb-8 flex flex-col items-center gap-6 rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-premium sm:flex-row sm:items-center">
                    <div className="shrink-0 text-center">
                      <p className="font-headline text-5xl font-medium num text-primary">{productRatingAvg.toFixed(1)}</p>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={cn("h-4 w-4", s <= Math.round(productRatingAvg) ? 'fill-accent text-accent' : 'text-primary/15')} />
                        ))}
                      </div>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{productRatings.length} ביקורות</p>
                    </div>
                    <div className="w-full flex-1 space-y-1.5">
                      {ratingDistribution.map(({ star, count }) => (
                        <div key={star} className="flex items-center gap-2 text-[13px] font-semibold text-primary/75">
                          <span className="w-3 tabular-nums">{star}</span>
                          <Star className="h-3 w-3 shrink-0 fill-accent text-accent" />
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/[0.06]">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(count / productRatings.length) * 100}%` }} />
                          </div>
                          <span className="w-6 text-left tabular-nums text-primary/65">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-body text-xl font-semibold text-primary">ביקורות לקוחות</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={reviewSortOrder === 'newest' ? 'default' : 'outline'}
                      onClick={() => setReviewSortOrder('newest')}
                      size="sm" className="text-[13px] h-10 px-4"
                    >
                      החדשות ביותר
                    </Button>
                    <Button
                      type="button"
                      variant={reviewSortOrder === 'oldest' ? 'default' : 'outline'}
                      onClick={() => setReviewSortOrder('oldest')}
                      size="sm" className="text-[13px] h-10 px-4"
                    >
                      הוותיקות ביותר
                    </Button>
                  </div>
                </div>

                <div className="mb-8 rounded-[1.75rem] border border-border/70 bg-card/70 p-5 md:p-7 space-y-5 text-right">
                  <div className="space-y-1">
                    <h4 className="font-body text-lg font-semibold text-primary">פרסום ביקורת</h4>
                    <p className="text-sm text-muted-foreground">שתפו בקצרה על המוצר כדי לעזור לקונים הבאים.</p>
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
                        <Label>ביקורת</Label>
                        <Textarea
                          placeholder="שתף את הרשמך מהמוצר..."
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          className="rounded-2xl min-h-[100px]"
                          disabled={!user || isOwnProductReviewBlocked || isReviewSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>דירוג כוכבים</Label>
                        <div className="flex justify-center gap-1.5 rounded-2xl border border-border bg-card p-2">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={s} type="button" onClick={() => setReviewRating(s)} disabled={!user || isOwnProductReviewBlocked || isReviewSubmitting} aria-label={`${s} כוכבים`} className="rounded-full p-2.5 transition-colors hover:bg-accent/10 disabled:cursor-not-allowed">
                              <Star className={`w-5 h-5 transition-colors ${s <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
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
                        className="w-full h-12"
                      >
                        {isReviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : getProductReviewSubmitLabel()}
                      </Button>
                    </>
                  )}
                </div>

                {sortedProductReviews.length > 0 ? (
                  <div className="grid gap-6">
                    {sortedProductReviews.map((rev: any) => (
                      <div key={rev.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 border border-primary/10 flex-shrink-0">
                          {!rev.is_anonymous && <AvatarImage src={rev.reviewer_image || undefined} />}
                          <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                            {rev.is_anonymous ? 'א' : (rev.buyer_name || 'מ').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <p className="font-semibold text-primary text-sm">{rev.is_anonymous ? 'אנונימי' : (rev.buyer_name || 'משתמש')}</p>
                            <span className="text-xs font-medium text-muted-foreground num">{rev.created_at ? new Date(rev.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-right">
                            <div className="flex justify-start gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} className={cn("w-3 h-3", s <= (Number(rev.rating) || 0) ? 'fill-accent text-accent' : 'text-muted-foreground/20')} />
                              ))}
                            </div>
                            <p className="text-base text-primary/80 leading-relaxed">{rev.comment}</p>
                          </div>
                          {user?.uid === rev.buyer_id && (
                            <div className="flex justify-start mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProductReview(rev.id)}
                                disabled={deletingReviewId === rev.id}
                                className="h-8 px-2 text-xs text-destructive/50 hover:text-destructive hover:bg-destructive/5 gap-1 rounded-full"
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
                  <div className="text-center py-16 space-y-4">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                      <Star className="w-8 h-8 text-accent-strong" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-body text-xl font-semibold text-primary">היו הראשונים לכתוב ביקורת</p>
                      <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
                        שתפו את החוויה שלכם עם כלי הקודש הזה ועזרו לקונים הבאים להחליט.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Floating Action Bar - Optimized for Mobile */}
      <div data-sticky-footer className="fixed bottom-0 left-0 right-0 z-[100] bg-card/[0.97] border-t border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-12px_hsl(var(--shadow-color)/0.18)]">
        <div className="container mx-auto px-3 sm:px-4 h-20 sm:h-24 flex items-center justify-between gap-3 md:gap-4 max-w-6xl">
          <div className="flex-1 flex gap-2.5 md:gap-4">
             {isCoordinationOnlyProduct ? (
               <Button
                onClick={handleTorahCoordination}
                disabled={isProcessingRequest}
                variant="gold"
                className="flex-1 h-14 text-base gap-2.5"
               >
                 {isProcessingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                 <span>תיאום ופגישה</span>
               </Button>
             ) : (
               <Button
                onClick={handlePurchaseClick}
                disabled={product.quantity <= 0}
                variant="gold"
                className="flex-1 h-14 text-base gap-2.5"
               >
                 <ShoppingCart className="w-5 h-5" />
                 <span>רכישה מאובטחת</span>
               </Button>
             )}
             {/* ספר תורה / ספר הפטרות requests are handled by "חותם" staff, not a direct
                 chat with the seller — hiding this keeps the buyer's only contact path
                 through the coordination request above, which lands with the admin team. */}
             {!isCoordinationOnlyProduct && (
               <Button
                variant="outline"
                asChild
                className="flex-1 sm:flex-none sm:px-8 h-14 text-base gap-2.5"
               >
                <Link href={`/chat/${product.seller_id}?productId=${productId}`}>
                  <MessageCircle className="!w-5 !h-5 text-accent-strong" />
                  <span>{isJudaicaSeller ? 'שאלה למוכר' : 'שאלה לסופר'}</span>
                </Link>
               </Button>
             )}
          </div>
          <div className="hidden sm:flex flex-col items-end border-r pr-6 md:pr-10 border-border">
            <span className="text-[13px] font-medium text-muted-foreground mb-1">סה"כ לתשלום</span>
            <Price value={displayPrice} className="text-[28px] leading-none" />
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
          <DialogHeader className="space-y-2 pl-12 text-right">
            <DialogTitle className="text-white">{productDisplayTitle}</DialogTitle>
            <p className="text-xs font-bold text-white/70">הגדל/הקטן עם הכפתורים וגרור לצדדים לעיון נוח — בנייד גרור לאחר הגדלה</p>
          </DialogHeader>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Label className="text-xs font-black text-white/70">רמת זום</Label>
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
                  alt={productAltDescription}
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

      {/* One missing field — the buyer's phone — blocks the whole point of the ספר תורה /
          ספר הפטרות coordination flow (admin has no way to follow up without it), so this
          asks for just that instead of a full form. */}
      <Dialog open={isCoordinationPhoneDialogOpen} onOpenChange={(open) => { if (!isProcessingRequest) setIsCoordinationPhoneDialogOpen(open); }}>
        <DialogContent className="max-w-sm rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto" dir="rtl">
          <div className="p-8 space-y-5 text-right">
            <DialogHeader className="space-y-2 text-right">
              <DialogTitle className="text-xl font-body font-semibold text-primary">מספר טלפון ליצירת קשר</DialogTitle>
              <p className="text-sm font-medium text-muted-foreground">
                כדי שנציג 'חותם' יוכל לחזור אליכם לתיאום הפגישה, נא להשאיר מספר טלפון.
              </p>
            </DialogHeader>
            <Input
              type="tel"
              value={coordinationPhoneInput}
              onChange={e => setCoordinationPhoneInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCoordinationPhoneSubmit(); }}
              placeholder="050-0000000"
              className="h-14 rounded-2xl text-right"
              dir="ltr"
              autoFocus
              disabled={isProcessingRequest}
            />
            <Button
              onClick={handleCoordinationPhoneSubmit}
              disabled={isProcessingRequest}
              className="w-full bg-accent text-primary h-14 rounded-2xl font-black"
            >
              {isProcessingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : 'שליחת הבקשה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function SpecItem({ label, value, icon: Icon }: { label: string, value: string, icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4">
      <div className="shrink-0 w-11 h-11 rounded-full bg-secondary/70 flex items-center justify-center">
        <Icon className="w-5 h-5 text-accent-strong" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="block font-bold text-primary text-base truncate">{value}</span>
      </div>
    </div>
  );
}
