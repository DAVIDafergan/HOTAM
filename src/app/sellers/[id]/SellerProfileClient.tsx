
"use client";

import { Navbar } from '@/components/Navbar';
import { ProductCard } from '@/components/ProductCard';
import { fromPublicView } from '@/lib/public-views';
import { SellerProfileSkeleton } from '@/components/SellerProfileSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  ShieldCheck, 
  MapPin, 
  Star, 
  CheckCircle2, 
  BookOpen, 
  Award,
  Loader2,
  Package,
  FileText,
  Flag,
  ArrowLeft,
  Trash2,
  ZoomIn,
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AmbientBackdrop } from '@/components/motion/AmbientBackdrop';
import { CountUp } from '@/components/motion/CountUp';
import { Reveal } from '@/components/motion/Reveal';
import Image from '@/components/SmartImage';
import Link from 'next/link';
import { resolveSellerType } from '@/lib/product-catalog';
import { usePathname } from 'next/navigation';
import { useSupabaseClient, useUser } from '@/lib/supabase-hooks';
import { supabase } from '@/lib/supabase';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PROFILE_NOT_FOUND_CODE } from '@/lib/supabase-errors';
import { PUBLIC_SELLER_PROFILE_COLUMNS } from '@/lib/constants';

type SellerProfileClientProps = {
  sellerId: string;
  initialSeller?: any | null;
  initialProducts?: any[];
  initialReviews?: any[];
};

const normalizeSellerReview = (review: any) => {
  const profile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
  const fullName = profile?.full_name;

  return {
    ...review,
    buyer_name: fullName || review?.user_name || review?.buyer_name || 'משתמש',
    reviewer_image: profile?.avatar_url || null,
  };
};

export default function SellerProfile({
  sellerId,
  initialSeller = null,
  initialProducts = [],
  initialReviews = [],
}: SellerProfileClientProps) {
  const MIN_SAMPLE_ZOOM_LEVEL = 1;
  const MAX_SAMPLE_ZOOM_LEVEL = 4;
  const SAMPLE_ZOOM_STEP = 0.25;
  const SAMPLE_WHEEL_ZOOM_DELTA = 0.2;
  const BASE_SAMPLE_PAN_LIMIT_PX = 220;
  const id = sellerId;
  const { user } = useUser();
  const db = useSupabaseClient();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const hasServerData = Boolean(initialSeller) || initialProducts.length > 0 || initialReviews.length > 0;

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewIsAnonymous, setReviewIsAnonymous] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [reviewSortOrder, setReviewSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedWritingSample, setSelectedWritingSample] = useState<string | null>(null);
  const [isSampleDialogOpen, setIsSampleDialogOpen] = useState(false);
  const [sampleZoomLevel, setSampleZoomLevel] = useState(1);
  const [samplePan, setSamplePan] = useState({ x: 0, y: 0 });
  const sampleDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState('products');
  const tabsRef = useRef<HTMLElement>(null);

  // Fetch Seller Info
  const [seller, setSeller] = useState<any>(initialSeller);
  const [isSellerLoading, setIsSellerLoading] = useState(!hasServerData);

  // Fetch Seller's Products
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [isProductsLoading, setIsProductsLoading] = useState(!hasServerData);

  // Fetch Reviews
  const [reviews, setReviews] = useState<any[]>(initialReviews);

  useEffect(() => {
    setSeller(initialSeller);
    setProducts(initialProducts);
    setReviews(initialReviews);
    setIsSellerLoading(!hasServerData);
    setIsProductsLoading(!hasServerData);
  }, [hasServerData, initialProducts, initialReviews, initialSeller]);

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    void (async () => {
      if (!hasServerData) {
        setIsSellerLoading(true);
        setIsProductsLoading(true);
      }

      // Scribe rating = profile-page ratings + post-purchase scribe ratings (reviews with
      // an order_id) — same definition as getPublicSellerReviews and the homepage card.
      const [sellerResult, productsResult, reviewsResult, orderReviewsResult] = await Promise.all([
        fromPublicView(supabase, 'sellers_public', (from) => from.select(PUBLIC_SELLER_PROFILE_COLUMNS).eq('id', id).maybeSingle()),
        supabase.from('products').select('*').eq('seller_id', id),
        supabase.from('supermarket_reviews').select('*, profiles(full_name, avatar_url)').eq('supermarket_id', id),
        supabase
          .from('reviews')
          .select('id, order_id, seller_id, buyer_id, buyer_name, rating, comment, is_anonymous, created_at, profiles(full_name, avatar_url)')
          .eq('seller_id', id)
          .not('order_id', 'is', null),
      ]);

      if (isCancelled) return;

      if (sellerResult.error) console.error('[seller] fetch error:', sellerResult.error.message);
      // Keep the server's city when the row has none (the server derives it from the address,
      // which never reaches the browser).
      else {
        const fresh = sellerResult.data as any;
        setSeller((prev: any) => (fresh ? { ...fresh, city: fresh.city || prev?.city || null } : null));
      }

      if (productsResult.error) console.error('products fetch error:', productsResult.error.message);
      else setProducts(productsResult.data || []);

      if (reviewsResult.error) console.error('[supermarket_reviews] fetch error:', reviewsResult.error.message);
      if (orderReviewsResult.error) console.error('[reviews] order reviews fetch error:', orderReviewsResult.error.message);
      if (!reviewsResult.error || !orderReviewsResult.error) {
        setReviews([
          ...(reviewsResult.data ?? []).map((review: any) => ({ ...normalizeSellerReview(review), source: 'profile' })),
          ...(orderReviewsResult.data ?? []).map((review: any) => ({ ...normalizeSellerReview(review), source: 'order' })),
        ]);
      }

      setIsSellerLoading(false);
      setIsProductsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [hasServerData, id]);

  const averageRating = useMemo(() => {
    // Ignore rows without a valid rating instead of counting them as 5 stars.
    const ratings = (reviews || []).map((r: any) => Number(r.rating)).filter((n: number) => Number.isFinite(n) && n > 0);
    if (ratings.length === 0) return 0;
    return ratings.reduce((acc: number, n: number) => acc + n, 0) / ratings.length;
  }, [reviews]);

  const isOwnSellerReviewBlocked = Boolean(user && user.role === 'seller' && user.uid === id);
  const sellerCity =
    seller?.city ||
    (typeof seller?.address === 'string' && seller.address.includes(',')
      ? seller.address.split(',').pop()?.trim()
      : '') ||
    '';
  const currentUserSellerReview = useMemo(
    () => (user ? (reviews || []).find((rev: any) => rev?.buyer_id === user.uid) : null),
    [reviews, user]
  );
  const hasUserReviewedSeller = Boolean(currentUserSellerReview);
  const shouldHideSellerReviewComposer = isOwnSellerReviewBlocked || hasUserReviewedSeller;
  const sortedSellerReviews = useMemo(() => {
    const list = [...(reviews || [])];
    list.sort((a: any, b: any) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return reviewSortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [reviews, reviewSortOrder]);
  // Judaica sellers aren't scribes: neutral wording, and none of the halachic profile (stats,
  // certificate, script types, writing samples) — which a Judaica seller with a pending
  // upgrade request may already have uploaded, unapproved.
  const isJudaicaSeller = resolveSellerType(seller?.seller_type) === 'judaica_seller';
  const sellerNoun = isJudaicaSeller ? 'מוכר' : 'סופר';
  const sellerFullName = [seller?.first_name, seller?.last_name].filter(Boolean).join(' ').trim() || `ה${sellerNoun}`;
  const getSellerReviewSubmitLabel = () => {
    if (!user) return 'התחבר כדי לפרסם ביקורת';
    if (isOwnSellerReviewBlocked) return 'לא ניתן לדרג את עצמך';
    if (hasUserReviewedSeller) return 'כבר פרסמת ביקורת';
    return 'פרסם ביקורת';
  };

  const showSelfReviewBlockedToast = () => {
    toast({
      variant: 'destructive',
      title: 'לא ניתן לדרג את עצמך',
      description: `${sellerNoun} לא יכול לפרסם דירוג או ביקורת על עצמו.`,
    });
  };

  const showAlreadyReviewedSellerToast = () => {
    toast({
      variant: 'destructive',
      title: `כבר פרסמת ביקורת על ${sellerNoun} זה`,
      description: `ניתן לפרסם ביקורת אחת בלבד לכל ${sellerNoun}.`,
    });
  };

  const handleSendReport = async () => {
    if (!user) { toast({ title: "עליך להתחבר כדי לדווח" }); return; }
    if (!reportReason.trim()) { toast({ variant: "destructive", title: "אנא ציין סיבה לדיווח" }); return; }
    
    setIsReporting(true);
    const reportData = {
      seller_id: id,
      seller_name: `${seller.first_name} ${seller.last_name}`,
      reporter_id: user.uid,
      reporter_name: user.displayName || user.email || 'משתמש באתר',
      reason: reportReason,
      created_at: new Date().toISOString()
    };
    const { error } = await db.from('reports').insert(reportData);
    setIsReporting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'שליחת הדיווח נכשלה', description: error.message });
      return;
    }
    setIsReportDialogOpen(false);
    setReportReason('');
    toast({ variant: "success", title: "הדיווח נשלח בהצלחה", description: "הפנייה הועברה למנהלי המערכת לבדיקה דיסקרטית." });
  };

  const handleSubmitSellerReview = async () => {
    if (!user) { router.push('/login?redirect=' + encodeURIComponent(pathname)); return; }
    if (!id) {
      toast({ variant: 'destructive', title: `שגיאה בזיהוי ה${sellerNoun}`, description: 'אנא רענן את העמוד ונסה שוב.' });
      return;
    }
    if (isOwnSellerReviewBlocked) {
      showSelfReviewBlockedToast();
      return;
    }
    if (hasUserReviewedSeller) {
      showAlreadyReviewedSellerToast();
      return;
    }
    const userId = user?.uid;
    if (!userId) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    setIsReviewSubmitting(true);
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) {
      console.error('[profiles] fetch error:', profileError.message);
      if (profileError.code !== PROFILE_NOT_FOUND_CODE) {
        setIsReviewSubmitting(false);
        toast({ variant: 'destructive', title: 'שגיאה בשמירת הדירוג', description: 'אנא נסה שנית.' });
        return;
      }
    }
    const realName = profileRow?.full_name || user.displayName || 'משתמש';
    const reviewData = {
      supermarket_id: id,
      buyer_id: userId,
      buyer_name: realName,
      is_anonymous: reviewIsAnonymous,
      rating: reviewRating,
      comment: reviewComment,
    };
    const { data: inserted, error } = await supabase.from('supermarket_reviews').insert(reviewData).select().single();
    setIsReviewSubmitting(false);
    if (error) {
      console.error('[supermarket_reviews] insert error:', error.message);
      if (error?.code === '23505') {
        showAlreadyReviewedSellerToast();
        return;
      }
      toast({ variant: 'destructive', title: 'שגיאה בשמירת הדירוג', description: 'אנא נסה שנית.' });
    } else {
      const reviewerImage = profileRow?.avatar_url || null;
      setReviews(prev => [...prev, { ...inserted, buyer_name: realName, reviewer_image: reviewerImage, source: 'profile' }]);
      router.refresh();
      setReviewComment('');
      setReviewRating(5);
      setReviewIsAnonymous(false);
      toast({ variant: "success", title: 'תודה על הדירוג!' });
    }
  };

  const handleDeleteSellerReview = async (reviewId: string, source?: string) => {
    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    setDeletingReviewId(reviewId);
    try {
      const { error, count } = await supabase
        .from(source === 'order' ? 'reviews' : 'supermarket_reviews')
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

  if (isSellerLoading) {
    return <SellerProfileSkeleton />;
  }

  if (!seller) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-2xl font-bold mb-4">המוכר לא נמצא</h1>
        <Button asChild><Link href="/">חזרה לדף הבית</Link></Button>
      </div>
    );
  }

  const stats = [
    { 
      label: 'ניסיון', 
      value: `${seller.experience_years || '0'} שנות ניסיון`, 
      icon: <Award className="w-4 h-4" /> 
    },
    { 
      label: 'טבילות', 
      value: seller.mikveh_frequency === 'daily' ? 'טובל כל יום' : 
             seller.mikveh_frequency === 'before' ? 'טובל לפני הכתיבה' : 
             seller.mikveh_frequency === 'ezra' ? 'טבילת עזרא' :
             seller.mikveh_frequency === 'never' ? 'לא טובל בכלל' : 'לא צוין', 
      icon: <CheckCircle2 className="w-4 h-4" /> 
    },
    { 
      label: 'לימוד תורה', 
      value: seller.torah_study_frequency === 'full-day' ? 'אברך יום שלם' : 
             seller.torah_study_frequency === 'half-day' ? 'אברך חצי יום' : 'קובע עיתים', 
      icon: <BookOpen className="w-4 h-4" /> 
    },
    { 
      label: 'הסמכה', 
      value: seller.has_scribe_certificate === 'valid' ? 'תעודה בתוקף' : 
             seller.has_scribe_certificate === 'expired' ? 'הייתה תעודה בעבר' : 'ללא תעודה', 
      icon: <ShieldCheck className="w-4 h-4" /> 
    },
  ];

  const clampSampleZoomLevel = (zoom: number) =>
    Math.min(MAX_SAMPLE_ZOOM_LEVEL, Math.max(MIN_SAMPLE_ZOOM_LEVEL, Number(zoom.toFixed(2))));

  const updateSampleZoom = (zoom: number) => {
    const nextZoom = clampSampleZoomLevel(zoom);
    setSampleZoomLevel(nextZoom);
    if (nextZoom <= MIN_SAMPLE_ZOOM_LEVEL) setSamplePan({ x: 0, y: 0 });
  };

  const updateSamplePan = (x: number, y: number) => {
    if (sampleZoomLevel <= MIN_SAMPLE_ZOOM_LEVEL) {
      setSamplePan({ x: 0, y: 0 });
      return;
    }

    const limit = BASE_SAMPLE_PAN_LIMIT_PX * sampleZoomLevel;
    setSamplePan({
      x: Math.max(-limit, Math.min(limit, x)),
      y: Math.max(-limit, Math.min(limit, y)),
    });
  };

  const sampleCursor = sampleZoomLevel <= MIN_SAMPLE_ZOOM_LEVEL
    ? 'zoom-in'
    : sampleDragOriginRef.current
      ? 'grabbing'
      : 'grab';

  // ── Presentation helpers (UI only) ───────────────────────────────────────────────────
  const productCount = (products || []).length;
  const reviewCount = (reviews || []).length;
  const ratingDisplay = averageRating > 0 ? averageRating.toFixed(1) : '—';
  const ratingBuckets = [5, 4, 3, 2, 1].map((star) => {
    const n = (reviews || []).filter((r: any) => Math.round(Number(r.rating) || 0) === star).length;
    return { star, n, pct: reviewCount > 0 ? Math.round((n / reviewCount) * 100) : 0 };
  });
  const bioText: string = seller.notes || (isJudaicaSeller
    ? 'מוכר מוצרי יודאיקה באתר חותם.'
    : 'מלאכת שמיים ושליחות קודש. כל תג נכתב מתוך כוונה טהורה על קלף איכותי, בחרדת קודש ובהתאם לכל כללי ההלכה.');
  const bioParagraphs = bioText.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const scriptTypes: string[] = isJudaicaSeller ? [] : (seller.script_types || []).filter(Boolean);
  const isOwnProfile = Boolean(user && user.uid === id);
  const heroStats = [
    ...(!isJudaicaSeller ? [{ label: 'שנות ניסיון', value: Number(seller.experience_years) || 0 }] : []),
    { label: 'מוצרים', value: productCount },
    { label: 'ביקורות', value: reviewCount },
    { label: 'דירוג', value: ratingDisplay },
  ];
  const openTab = (tab: string) => {
    setActiveTab(tab);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const emptyState = (icon: React.ReactNode, title: string, text?: string, action?: React.ReactNode) => (
    <div className="flex flex-col items-center rounded-[2rem] border border-dashed border-primary/20 bg-card/60 px-6 py-14 text-center md:py-20">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary/55">{icon}</div>
      <p className="font-body text-[19px] font-semibold text-primary">{title}</p>
      {text && <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />

      <main>
        {/* ── Header: who this is, how they are rated, the two main actions ── */}
        <section className="relative overflow-hidden border-b border-border/70 pt-[calc(7rem+env(safe-area-inset-top))] pb-10 md:pt-36 md:pb-14" aria-labelledby="seller-name">
          <AmbientBackdrop />
          <div className="container relative z-10 mx-auto max-w-6xl px-5 md:px-8">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:gap-10 md:text-right">
              <div className="relative h-28 w-28 shrink-0 md:h-40 md:w-40 fade-up">
                <div className="absolute -inset-2 rounded-full border border-accent/35" aria-hidden="true" />
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-card bg-secondary shadow-premium">
                  {seller.profile_image ? (
                    <Image src={seller.profile_image} alt={sellerFullName} fill kind="avatar" sizes="(max-width: 768px) 112px, 160px" className="object-cover" priority />
                  ) : (
                    <span className="font-headline text-[40px] font-semibold text-primary/50 md:text-[56px]" aria-hidden="true">{(seller.first_name || sellerNoun).replace(/^הרב\s+/, '').charAt(0)}</span>
                  )}
                </div>
                {seller.is_approved && (
                  <span className="absolute bottom-1 left-1 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-card bg-gold-deep text-white shadow-md md:h-11 md:w-11" title="פרופיל מאומת">
                    <ShieldCheck className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <p className={cn('eyebrow fade-up fade-up-1', 'justify-center md:justify-start')}>
                  {isJudaicaSeller ? 'מוכר יודאיקה' : 'סופר סת״ם'}{seller.is_approved ? ' · פרופיל מאומת' : ''}
                </p>
                <h1 id="seller-name" className="fade-up fade-up-1 font-headline text-[36px] font-semibold leading-[1.1] text-primary md:text-[56px]">
                  {sellerFullName}
                </h1>
                <div className="fade-up fade-up-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[15px] text-primary/80 md:justify-start">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent-strong" aria-hidden="true" />{sellerCity || 'ישראל'}</span>
                  <button type="button" onClick={() => openTab('reviews')} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('h-4 w-4', n <= Math.round(averageRating) ? 'fill-accent text-accent' : 'text-primary/15')} />)}
                    </span>
                    {reviewCount > 0 ? <span><span className="num">{ratingDisplay}</span> · <span className="num">{reviewCount}</span> ביקורות</span> : <span>אין דירוגים עדיין</span>}
                  </button>
                </div>
                {scriptTypes.length > 0 && (
                  <ul className="fade-up fade-up-2 flex flex-wrap justify-center gap-2 md:justify-start" aria-label="סוגי כתב">
                    {scriptTypes.map((type) => (
                      <li key={type} className="rounded-full border border-accent/35 bg-card/80 px-3.5 py-1.5 text-[13px] font-semibold text-accent-strong">כתב {type}</li>
                    ))}
                    {seller.script_level && <li className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[13px] font-semibold text-primary/80">{seller.script_level}</li>}
                  </ul>
                )}
                <p className="fade-up fade-up-3 mx-auto max-w-2xl text-[17px] leading-[1.75] text-primary/85 line-clamp-3 md:mx-0 md:text-[18px]">
                  {bioParagraphs[0]}
                </p>
                {(bioParagraphs.length > 1 || bioParagraphs[0]?.length > 160) && (
                  <button type="button" onClick={() => openTab('about')} className="fade-up fade-up-3 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-accent-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    המשך לקרוא על ה{sellerNoun} <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className="fade-up fade-up-3 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center md:justify-start">
                  <Button variant="gold" size="lg" onClick={() => openTab('products')} className="h-14 w-full gap-2 sm:w-auto">
                    <Package className="!h-[18px] !w-[18px]" /> {productCount > 0 ? `לכל המוצרים (${productCount})` : 'למוצרים'}
                  </Button>
                  {!isOwnProfile && (
                    <Button variant="outline" size="lg" asChild className="h-14 w-full gap-2 sm:w-auto">
                      <Link href={`/chat/${id}`}>
                        <MessageCircle className="!h-[18px] !w-[18px] text-accent-strong" /> שליחת הודעה ל{sellerNoun}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Key numbers as a ledger: elegant numerals, hairline dividers */}
            <dl className={cn('mt-10 grid divide-x divide-x-reverse divide-border/80 rounded-[1.75rem] border border-border/70 bg-card/80 py-5 shadow-premium md:mt-12 md:py-7', heroStats.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
              {heroStats.map((stat) => (
                <div key={stat.label} className="flex min-w-0 flex-col items-center gap-1.5 px-1 text-center">
                  <dd className="order-1 font-numbers text-[30px] leading-none text-primary md:text-[44px]">
                    <CountUp value={stat.value} />
                  </dd>
                  <dt className="order-2 text-[12px] font-semibold text-muted-foreground md:text-[14px]">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Tabs: products · samples · reviews · about ── */}
        <section ref={tabsRef} className="container mx-auto max-w-6xl scroll-mt-24 px-5 py-10 md:px-8 md:py-16" aria-label={`תוכן הפרופיל של ${sellerFullName}`}>
          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
            <TabsList indicatorClassName="bg-primary shadow-none" className="no-scrollbar mb-8 flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-full border border-border/70 bg-card p-1.5 shadow-premium sm:w-auto md:mb-10">
              {[
                { v: 'products', l: 'מוצרים', n: productCount },
                ...(!isJudaicaSeller ? [{ v: 'samples', l: 'דוגמאות כתיבה', n: (seller.writing_samples || []).length }] : []),
                { v: 'reviews', l: 'ביקורות', n: reviewCount },
                { v: 'about', l: `על ה${sellerNoun}`, n: null as number | null },
              ].map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="min-h-11 flex-none gap-1.5 px-4 text-[15px] font-semibold text-primary/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-5">
                  {t.l}{typeof t.n === 'number' && <span className="num text-[13px] opacity-70">{t.n}</span>}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="products" className="mt-0">
              {isProductsLoading ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card">
                      <Skeleton className="aspect-square w-full rounded-none md:aspect-[4/5]" />
                      <div className="space-y-2 p-3 md:p-5">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-5 w-1/3 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : productCount > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
                  {products.map((p: any, i: number) => (
                    <Reveal key={p.id} delay={(i % 3) * 80}>
                      <ProductCard product={p} density="compact" />
                    </Reveal>
                  ))}
                </div>
              ) : (
                emptyState(
                  <Package className="h-7 w-7" strokeWidth={1.5} />,
                  `ה${sellerNoun} עדיין לא העלה מוצרים`,
                  'בינתיים אפשר לעיין בכל כלי הקודש באתר, או לשלוח הודעה ולשאול על הזמנה.',
                  <Button variant="outline" asChild className="gap-2"><Link href="/search?view=all">לכל כלי הקודש <ArrowLeft className="h-4 w-4" /></Link></Button>,
                )
              )}
            </TabsContent>

            {!isJudaicaSeller && (
              <TabsContent value="samples" className="mt-0">
                {(seller.writing_samples || []).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
                    {(seller.writing_samples || []).map((sample: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedWritingSample(sample);
                          setSampleZoomLevel(MIN_SAMPLE_ZOOM_LEVEL);
                          setSamplePan({ x: 0, y: 0 });
                          sampleDragOriginRef.current = null;
                          setIsSampleDialogOpen(true);
                        }}
                        className="group relative aspect-square overflow-hidden rounded-[1.25rem] border border-border/70 bg-secondary shadow-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 md:rounded-[1.5rem]"
                        aria-label={`הגדלת דוגמת כתיבה ${i + 1}`}
                      >
                        <span className="media-rise absolute inset-0">
                          <Image src={sample} alt={sellerFullName === 'הסופר' ? `דוגמת כתיבה ${i + 1}` : `דוגמת כתיבה ${i + 1} של ${sellerFullName}`} fill kind="writing_sample" sizes="(max-width: 768px) 50vw, 360px" className="object-cover zoom-on-hover" />
                        </span>
                        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-[13px] font-semibold text-primary shadow-md">
                          <ZoomIn className="h-3.5 w-3.5 text-accent-strong" /> הגדלה
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  emptyState(<PenToolIcon className="h-7 w-7" />, 'אין עדיין דוגמאות כתיבה', `ה${sellerNoun} יוכל להוסיף דוגמאות מהאזור האישי.`)
                )}
              </TabsContent>
            )}

            <TabsContent value="reviews" className="mt-0">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-12">
                {/* Summary */}
                <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
                  <div className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-premium">
                    <div className="flex items-center gap-5">
                      <p className="font-numbers text-[56px] leading-none text-primary num">{ratingDisplay}</p>
                      <div className="space-y-1.5">
                        <div className="flex gap-0.5" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn('h-5 w-5', n <= Math.round(averageRating) ? 'fill-accent text-accent' : 'text-primary/15')} />)}
                        </div>
                        <p className="text-[14px] text-muted-foreground">{reviewCount > 0 ? <><span className="num">{reviewCount}</span> ביקורות</> : 'אין דירוגים עדיין'}</p>
                      </div>
                    </div>
                    {reviewCount > 0 && (
                      <ul className="mt-5 space-y-2" aria-label="התפלגות הדירוגים">
                        {ratingBuckets.map((b) => (
                          <li key={b.star} className="flex items-center gap-3 text-[13px] text-primary/75">
                            <span className="w-3 num">{b.star}</span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                              <span className="block h-full rounded-full bg-gold-deep" style={{ width: `${b.pct}%` }} />
                            </span>
                            <span className="w-6 text-left num">{b.n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {shouldHideSellerReviewComposer ? (
                    <p className="rounded-2xl border border-border/70 bg-card/70 px-5 py-3 text-[14px] text-primary/80">ניתן לדרג פעם אחת בלבד</p>
                  ) : (
                    <div className="space-y-5 rounded-[1.75rem] border border-border/70 bg-card p-6 text-right">
                      <div className="space-y-1">
                        <h3 className="font-body text-lg font-semibold text-primary">כתבו ביקורת</h3>
                        <p className="text-sm text-muted-foreground">כמה מילים על השירות וה{isJudaicaSeller ? 'מוצרים' : 'כתיבה'} יעזרו ללקוחות אחרים.</p>
                      </div>
                      {!user && (
                        <p className="text-sm font-semibold text-muted-foreground">
                          כדי לפרסם ביקורת צריך <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="text-primary underline">להתחבר לחשבון</Link>.
                        </p>
                      )}
                      <div className="space-y-2">
                        <Label>דירוג</Label>
                        <div className="flex justify-between gap-1 rounded-2xl border border-border bg-background/60 p-1.5">
                          {[1, 2, 3, 4, 5].map(sv => (
                            <button key={sv} type="button" onClick={() => setReviewRating(sv)} disabled={!user || isReviewSubmitting} aria-label={`${sv} כוכבים`} aria-pressed={sv <= reviewRating} className="flex h-11 flex-1 items-center justify-center rounded-xl transition-colors hover:bg-accent/10 disabled:cursor-not-allowed">
                              <Star className={`h-5 w-5 transition-colors ${sv <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="seller-review-text">ביקורת</Label>
                        <Textarea
                          id="seller-review-text"
                          placeholder={isJudaicaSeller ? 'שתפו את חוויית השירות והמוצרים...' : 'שתפו את חוויית השירות והכתיבה...'}
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          className="min-h-[100px] rounded-2xl"
                          disabled={!user || isReviewSubmitting}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-border bg-background/60 p-4">
                        <Label htmlFor="seller-review-anon" className="cursor-pointer text-sm font-semibold text-primary">פרסם כאנונימי</Label>
                        <Switch id="seller-review-anon" checked={reviewIsAnonymous} onCheckedChange={setReviewIsAnonymous} disabled={!user || isReviewSubmitting} />
                      </div>
                      <Button onClick={handleSubmitSellerReview} disabled={!user || isReviewSubmitting} className="h-12 w-full">
                        {isReviewSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : getSellerReviewSubmitLabel()}
                      </Button>
                    </div>
                  )}
                </div>

                {/* List */}
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-body text-xl font-semibold text-primary">מה הלקוחות אומרים</h3>
                    {reviewCount > 1 && (
                      <div className="inline-flex rounded-full border border-border/70 bg-card p-1" role="group" aria-label="מיון ביקורות">
                        {([['newest', 'החדשות'], ['oldest', 'הוותיקות']] as const).map(([v, l]) => (
                          <button key={v} type="button" onClick={() => setReviewSortOrder(v)} aria-pressed={reviewSortOrder === v} className={cn('min-h-10 rounded-full px-4 text-[13px] font-semibold transition-colors duration-300', reviewSortOrder === v ? 'bg-primary text-primary-foreground' : 'text-primary/70 hover:text-primary')}>{l}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  {sortedSellerReviews.length > 0 ? (
                    <div className="space-y-4">
                      {sortedSellerReviews.map((rev: any) => (
                        <Reveal key={rev.id}>
                          <article className="rounded-[1.5rem] border border-border/70 bg-card p-5 text-right shadow-premium md:p-6">
                            <header className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 shrink-0 border border-accent/30">
                                {!rev.is_anonymous && <AvatarImage src={rev.reviewer_image || undefined} />}
                                <AvatarFallback className="bg-secondary font-headline text-base font-semibold text-primary/70">
                                  {rev.is_anonymous ? 'א' : (rev.buyer_name || 'מ').charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold text-primary">{rev.is_anonymous ? 'אנונימי' : (rev.buyer_name || 'משתמש')}</p>
                                <p className="text-[13px] text-muted-foreground num">{rev.created_at ? new Date(rev.created_at).toLocaleDateString('he-IL') : 'היום'}{rev.source === 'order' ? ' · לאחר רכישה' : ''}</p>
                              </div>
                              <div className="flex shrink-0 gap-0.5" aria-label={`${Number(rev.rating) || 0} מתוך 5`}>
                                {[1, 2, 3, 4, 5].map(sv => <Star key={sv} className={`h-3.5 w-3.5 ${sv <= (Number(rev.rating) || 0) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />)}
                              </div>
                            </header>
                            {rev.comment && <p className="mt-4 max-w-none text-[16px] leading-[1.75] text-primary/85">{rev.comment}</p>}
                            {user?.uid === rev.buyer_id && (
                              <div className="mt-3 flex justify-start">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSellerReview(rev.id, rev.source)}
                                  disabled={deletingReviewId === rev.id}
                                  className="h-10 gap-1 rounded-full px-3 text-xs text-destructive/80 hover:bg-destructive/5 hover:text-destructive"
                                >
                                  {deletingReviewId === rev.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  מחק
                                </Button>
                              </div>
                            )}
                          </article>
                        </Reveal>
                      ))}
                    </div>
                  ) : (
                    emptyState(<Star className="h-7 w-7" strokeWidth={1.5} />, 'עדיין אין ביקורות', `לקוחות שרכשו מה${sellerNoun} יוכלו לשתף כאן את החוויה שלהם.`)
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about" className="mt-0">
              <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,380px)] lg:gap-14">
                <Reveal as="article" className="min-w-0">
                  <p className="eyebrow mb-4">על ה{sellerNoun}</p>
                  <div className="space-y-5">
                    {bioParagraphs.map((para, i) => (
                      <p key={i} className={cn('max-w-[62ch] text-primary/85', i === 0 ? 'font-headline text-[22px] font-semibold leading-[1.6] text-primary md:text-[26px]' : 'text-[17px] leading-[1.85] md:text-[18px]')}>
                        {para}
                      </p>
                    ))}
                  </div>
                  {scriptTypes.length > 0 && (
                    <div className="mt-8">
                      <p className="mb-3 text-[15px] font-semibold text-primary">מתמחה בכתב</p>
                      <ul className="flex flex-wrap gap-2">
                        {scriptTypes.map((type) => (
                          <li key={type} className="rounded-full border border-accent/35 bg-accent/[0.06] px-4 py-2 text-[14px] font-semibold text-accent-strong">{type}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Reveal>

                <Reveal delay={120} className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                  {!isJudaicaSeller && (
                    <div className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-premium">
                      <h3 className="mb-4 font-body text-lg font-semibold text-primary">הנהגה והסמכה</h3>
                      <dl className="divide-y divide-border/70">
                        {stats.map((stat) => (
                          <div key={stat.label} className="flex items-center justify-between gap-3 py-3">
                            <dt className="flex items-center gap-2 text-[14px] text-muted-foreground"><span className="text-accent-strong">{stat.icon}</span>{stat.label}</dt>
                            <dd className="text-[15px] font-semibold text-primary">{stat.value}</dd>
                          </div>
                        ))}
                      </dl>
                      {seller.certificate_url && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="mt-5 h-12 w-full gap-2">
                              <FileText className="h-4 w-4" /> הצגת תעודת הסופר
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl overflow-hidden rounded-[2rem] border-none bg-card p-0 shadow-2xl" dir="rtl">
                            <div className="relative bg-primary p-6 pl-16 text-right text-white">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-3 font-body text-xl font-semibold text-white">
                                  <ShieldCheck className="h-6 w-6 text-accent" /> תעודת הסמכה - {seller.first_name} {seller.last_name}
                                </DialogTitle>
                              </DialogHeader>
                            </div>
                            <div className="flex min-h-[400px] items-center justify-center bg-card p-4">
                              <div className="relative aspect-[1/1.4] max-h-[70vh] w-full">
                                <Image src={seller.certificate_url} alt={`תעודת סופר - ${sellerFullName}`} fill className="object-contain" />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}

                  <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="h-11 w-full gap-2 text-sm font-semibold text-destructive hover:bg-destructive/5">
                        <Flag className="h-3.5 w-3.5" /> דיווח על {sellerNoun} זה
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg overflow-hidden rounded-[2rem] border-none bg-card p-0 text-right shadow-2xl" dir="rtl">
                      <div className="bg-destructive p-6 pl-16 text-right text-white">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-3 font-body text-xl font-semibold text-white">
                            <Flag className="h-6 w-6 text-white" /> דיווח למנהל המערכת
                          </DialogTitle>
                        </DialogHeader>
                      </div>
                      <div className="space-y-5 bg-card p-6 text-primary md:p-8">
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-right">
                          <p className="text-sm font-bold text-red-800">מתי כדאי לדווח?</p>
                          <p className="mt-1 text-sm leading-relaxed text-red-800/85">
                            השתמש בדיווח במקרה של חשש להטעיה, תוכן פוגעני, התנהלות לא תקינה או מידע שגוי בפרופיל.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>פרט את סיבת הדיווח</Label>
                          <Textarea
                            value={reportReason}
                            onChange={e => setReportReason(e.target.value)}
                            placeholder="כתוב כאן מה קרה, מתי, ומה נדרש לבדיקה..."
                            className="min-h-[120px] rounded-2xl"
                          />
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          הדיווח יישלח בצורה דיסקרטית למנהלי &apos;חותם&apos;. נבדוק כל פנייה במהירות וברצינות.
                        </p>
                      </div>
                      <DialogFooter className="flex gap-3 border-t border-border bg-secondary/40 p-6">
                        <Button variant="destructive" onClick={handleSendReport} disabled={isReporting || !reportReason.trim()} className="h-12 flex-1">
                          {isReporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שלח דיווח'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsReportDialogOpen(false)} className="h-12">ביטול</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Reveal>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <Dialog
        open={isSampleDialogOpen}
        onOpenChange={(open) => {
          setIsSampleDialogOpen(open);
          if (!open) {
            setSampleZoomLevel(MIN_SAMPLE_ZOOM_LEVEL);
            setSamplePan({ x: 0, y: 0 });
            sampleDragOriginRef.current = null;
          }
        }}
      >
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-5xl overflow-y-auto rounded-[2rem] border-none bg-black/95 p-3 sm:p-6 shadow-2xl" dir="rtl">
          <DialogHeader className="space-y-2 pl-12 text-right">
            <DialogTitle className="text-white">דוגמת כתיבה מוגדלת</DialogTitle>
            <p className="text-xs font-bold text-white/70">ניתן לבצע זום ולגרור את הדוגמה לעיון מדויק בפרטי הכתיבה.</p>
          </DialogHeader>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Label className="text-xs font-black text-white/70">רמת זום</Label>
            <Button type="button" size="sm" variant="outline" className="h-10 px-4 text-xs" onClick={() => updateSampleZoom(sampleZoomLevel - SAMPLE_ZOOM_STEP)}>−</Button>
            <input
              type="range"
              min={MIN_SAMPLE_ZOOM_LEVEL}
              max={MAX_SAMPLE_ZOOM_LEVEL}
              step={SAMPLE_ZOOM_STEP}
              value={sampleZoomLevel}
              onChange={(event) => updateSampleZoom(Number(event.target.value))}
              className="w-36 accent-accent"
              aria-label="רמת זום דוגמת כתיבה"
            />
            <Button type="button" size="sm" variant="outline" className="h-10 px-4 text-xs" onClick={() => updateSampleZoom(sampleZoomLevel + SAMPLE_ZOOM_STEP)}>+</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-10 px-4 text-xs text-white hover:bg-white/10 hover:text-white"
              onClick={() => {
                setSampleZoomLevel(MIN_SAMPLE_ZOOM_LEVEL);
                setSamplePan({ x: 0, y: 0 });
                sampleDragOriginRef.current = null;
              }}
            >
              איפוס
            </Button>
          </div>
          <div
            role="img"
            aria-label="דוגמת כתיבה מוגדלת"
            onWheel={(event) => {
              event.preventDefault();
              const delta = event.deltaY > 0 ? -SAMPLE_WHEEL_ZOOM_DELTA : SAMPLE_WHEEL_ZOOM_DELTA;
              updateSampleZoom(sampleZoomLevel + delta);
            }}
            onMouseDown={(event) => {
              if (sampleZoomLevel <= MIN_SAMPLE_ZOOM_LEVEL) return;
              sampleDragOriginRef.current = { x: event.clientX - samplePan.x, y: event.clientY - samplePan.y };
            }}
            onMouseMove={(event) => {
              if (!sampleDragOriginRef.current || sampleZoomLevel <= MIN_SAMPLE_ZOOM_LEVEL) return;
              updateSamplePan(event.clientX - sampleDragOriginRef.current.x, event.clientY - sampleDragOriginRef.current.y);
            }}
            onMouseUp={() => {
              sampleDragOriginRef.current = null;
            }}
            onMouseLeave={() => {
              sampleDragOriginRef.current = null;
            }}
            onTouchStart={(event) => {
              if (sampleZoomLevel <= MIN_SAMPLE_ZOOM_LEVEL) return;
              const touch = event.touches[0];
              sampleDragOriginRef.current = { x: touch.clientX - samplePan.x, y: touch.clientY - samplePan.y };
            }}
            onTouchMove={(event) => {
              if (!sampleDragOriginRef.current || sampleZoomLevel <= MIN_SAMPLE_ZOOM_LEVEL) return;
              event.preventDefault();
              const touch = event.touches[0];
              updateSamplePan(touch.clientX - sampleDragOriginRef.current.x, touch.clientY - sampleDragOriginRef.current.y);
            }}
            onTouchEnd={() => {
              sampleDragOriginRef.current = null;
            }}
            className="relative block h-[60vh] w-full touch-none overflow-hidden rounded-[1.5rem] bg-black text-center"
          >
            <div className="relative h-full min-h-[24rem] w-full">
              {selectedWritingSample && (
                <Image
                  src={selectedWritingSample}
                  alt={`דוגמת כתיבה - ${sellerFullName}`}
                  fill
                  className="object-contain transition-transform duration-150"
                  style={{
                    transform: `translate(${samplePan.x}px, ${samplePan.y}px) scale(${sampleZoomLevel})`,
                    cursor: sampleCursor,
                    transformOrigin: 'center center',
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function PenToolIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l5 5" />
      <path d="M11 11l1 1" />
    </svg>
  );
}
