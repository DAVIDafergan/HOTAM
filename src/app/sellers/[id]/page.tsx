
"use client";

import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Quote,
  Award,
  Loader2,
  Package,
  UserRound,
  FileText,
  Flag,
  ArrowLeft,
  Trash2,
  ZoomIn
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useSupabaseClient, useUser } from '@/lib/supabase-hooks';
import { supabase } from '@/lib/supabase';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PROFILE_NOT_FOUND_CODE } from '@/lib/supabase-errors';

const MIN_SAMPLE_ZOOM_LEVEL = 1;
const MAX_SAMPLE_ZOOM_LEVEL = 4;
const SAMPLE_ZOOM_STEP = 0.25;
const SAMPLE_WHEEL_ZOOM_DELTA = 0.2;
const BASE_SAMPLE_PAN_LIMIT_PX = 220;

export default function SellerProfile() {
  const params = useParams();
  const idParam = params?.id;
  const id = typeof idParam === 'string' ? idParam : Array.isArray(idParam) ? idParam[0] : undefined;
  const { user } = useUser();
  const db = useSupabaseClient();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

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

  // Fetch Seller Info
  const [seller, setSeller] = useState<any>(null);
  const [isSellerLoading, setIsSellerLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsSellerLoading(true);
    supabase
      .from('sellers')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[seller] fetch error:', error.message);
        else setSeller(data || null);
      })
      .finally(() => setIsSellerLoading(false));
  }, [id]);

  // Fetch Seller's Products
  const [products, setProducts] = useState<any[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsProductsLoading(true);
    supabase
      .from('products')
      .select('*')
      .eq('seller_id', id)
      .then(({ data, error }) => {
        if (error) console.error('products fetch error:', error.message);
        else setProducts(data || []);
      })
      .finally(() => setIsProductsLoading(false));
  }, [id]);

  // Fetch Reviews
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('supermarket_reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('supermarket_id', id)
      .then(({ data, error }) => {
        if (error) console.error('[supermarket_reviews] fetch error:', error.message);
        else {
          const normalized = (data ?? []).map((review: any) => {
            const profile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
            const fullName = profile?.full_name;
            return {
              ...review,
              buyer_name: fullName || review?.user_name || review?.buyer_name || 'משתמש',
              reviewer_image: profile?.avatar_url || null,
            };
          });
          setReviews(normalized);
        }
      });
  }, [id]);

  const averageRating = useMemo(() => {
    const revs = reviews || [];
    if (revs.length === 0) return 0;
    const sum = revs.reduce((acc: number, r: any) => acc + Number(r.rating || 5), 0);
    return sum / revs.length;
  }, [reviews]);

  const isOwnSellerReviewBlocked = Boolean(user && user.role === 'seller' && user.uid === id);
  const currentUserSellerReview = useMemo(
    () => (user ? (reviews || []).find((rev: any) => rev?.buyer_id === user.uid) : null),
    [reviews, user]
  );
  const hasUserReviewedSeller = Boolean(currentUserSellerReview);
  const sortedSellerReviews = useMemo(() => {
    const list = [...(reviews || [])];
    list.sort((a: any, b: any) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return reviewSortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [reviews, reviewSortOrder]);
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
      description: 'סופר לא יכול לפרסם דירוג או ביקורת על עצמו.',
    });
  };

  const showAlreadyReviewedSellerToast = () => {
    toast({
      variant: 'destructive',
      title: 'כבר פרסמת ביקורת על סופר זה',
      description: 'ניתן לפרסם ביקורת אחת בלבד לכל סופר.',
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
    toast({ title: "הדיווח נשלח בהצלחה", description: "הפנייה הועברה למנהלי המערכת לבדיקה דיסקרטית." });
  };

  const handleSubmitSellerReview = async () => {
    if (!user) { router.push('/login?redirect=' + encodeURIComponent(pathname)); return; }
    if (!id) {
      toast({ variant: 'destructive', title: 'שגיאה בזיהוי הסופר', description: 'אנא רענן את העמוד ונסה שוב.' });
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
      user_name: realName,
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
      setReviews(prev => [...prev, { ...inserted, buyer_name: realName, reviewer_image: reviewerImage }]);
      router.refresh();
      setReviewComment('');
      setReviewRating(5);
      setReviewIsAnonymous(false);
      toast({ title: 'תודה על הדירוג!' });
    }
  };

  const handleDeleteSellerReview = async (reviewId: string) => {
    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
      return;
    }
    setDeletingReviewId(reviewId);
    try {
      console.log('[reviews] deleting:', { reviewId, buyerId: user.uid, authUid: (await supabase.auth.getUser()).data.user?.id });
      const { error, count } = await supabase
        .from('supermarket_reviews')
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

  if (isSellerLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">הסופר לא נמצא</h2>
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
             seller.mikveh_frequency === 'ezra' ? 'טבילת עזרא' : 'לא צוין', 
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

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-white overflow-hidden text-center p-8 md:p-10 relative">
              <div className="absolute top-0 left-0 w-full h-24 bg-primary/5" />
              <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 z-10">
                <div className="absolute inset-0 rounded-full border-4 border-accent/10" />
                <div className="w-full h-full rounded-full border-[6px] border-white shadow-xl overflow-hidden relative bg-muted flex items-center justify-center">
                  {seller.profile_image ? (
                    <Image src={seller.profile_image} alt={`${seller.first_name} ${seller.last_name}`} fill className="object-cover" />
                  ) : (
                    <UserRound className="w-16 h-16 text-primary/20" />
                  )}
                </div>
                {seller.is_approved && (
                  <div className="absolute -bottom-1 -right-1 bg-accent text-primary p-2 rounded-full shadow-lg border-2 border-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                )}
              </div>
              
              <h1 className="text-2xl md:text-3xl font-headline font-black text-primary mb-1 tracking-tight">
                {seller.first_name} {seller.last_name}
              </h1>
              <p className="text-muted-foreground flex items-center justify-center gap-2 mb-6 font-bold text-[10px] uppercase tracking-tighter">
                {seller.address} <MapPin className="w-3 h-3 text-accent" />
              </p>
              
              <div className="flex flex-col items-center gap-1 mb-8">
                {reviews && reviews.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= averageRating ? 'text-accent fill-accent' : 'text-muted-foreground/20'}`} />
                    ))}
                    <span className="text-[10px] font-black text-primary mr-2">({reviews.length} ביקורות)</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest italic">אין דירוגים עדיין</span>
                )}
                {seller.is_approved && <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">(פרופיל מאומת)</span>}
              </div>

              <div className="grid grid-cols-1 gap-2 text-right">
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-transparent hover:border-accent/10 transition-all">
                    <span className="text-[10px] md:text-[11px] font-black text-primary uppercase tracking-tight">{stat.value}</span>
                    <div className="flex items-center gap-2 text-muted-foreground transition-colors">
                      <span className="text-[8px] font-bold uppercase tracking-widest">{stat.label}</span>
                      {stat.icon}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 space-y-3">
                {seller.certificate_url && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-accent text-primary hover:bg-accent/90 py-6 rounded-2xl gap-2 text-xs font-black uppercase tracking-wider shadow-lg">
                        <FileText className="w-4 h-4" /> הצג תעודת סופר
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white" dir="rtl">
                      <div className="bg-primary p-6 text-white text-right relative">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-headline font-black flex items-center gap-3 text-white">
                            <ShieldCheck className="w-6 h-6 text-accent" /> תעודת הסמכה - {seller.first_name} {seller.last_name}
                          </DialogTitle>
                        </DialogHeader>
                      </div>
                      <div className="p-4 bg-white flex justify-center items-center min-h-[400px]">
                        <div className="relative w-full aspect-[1/1.4] max-h-[70vh]">
                           <Image 
                             src={seller.certificate_url} 
                             alt="תעודת סופר" 
                             fill 
                             className="object-contain"
                           />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/5 rounded-2xl gap-2 text-[10px] font-black uppercase tracking-widest h-12">
                      <Flag className="w-3.5 h-3.5" /> דיווח על סופר זה
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white text-right" dir="rtl">
                    <div className="bg-gradient-to-br from-red-700 to-red-500 p-6 pr-16 text-white text-right">
                       <DialogHeader>
                          <DialogTitle className="text-xl font-headline font-black flex items-center gap-3 text-white">
                            <Flag className="w-6 h-6 text-white" /> דיווח למנהל המערכת
                          </DialogTitle>
                       </DialogHeader>
                    </div>
                    <div className="p-8 space-y-5 bg-white text-slate-900">
                        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-right">
                          <p className="text-sm font-black text-red-700">מתי כדאי לדווח?</p>
                          <p className="text-[12px] text-red-700/80 mt-1 leading-relaxed">
                            השתמש בדיווח במקרה של חשש להטעיה, תוכן פוגעני, התנהלות לא תקינה או מידע שגוי בפרופיל.
                          </p>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-xs font-black uppercase text-slate-900">פרט את סיבת הדיווח</Label>
                           <Textarea 
                              value={reportReason} 
                              onChange={e => setReportReason(e.target.value)} 
                              placeholder="כתוב כאן מה קרה, מתי, ומה נדרש לבדיקה..." 
                              className="min-h-[120px] rounded-2xl text-slate-900 bg-slate-50 border-slate-300 placeholder:text-slate-500 focus-visible:ring-red-400/40" 
                            />
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                         הדיווח יישלח בצורה דיסקרטית למנהלי 'חותם'. נבדוק כל פנייה במהירות וברצינות.
                        </p>
                    </div>
                      <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                        <Button variant="destructive" onClick={handleSendReport} disabled={isReporting || !reportReason.trim()} className="flex-1 h-12 rounded-xl font-black uppercase shadow-md transition-colors">
                          {isReporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח דיווח'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsReportDialogOpen(false)} className="h-12 rounded-xl font-bold text-slate-800 border-slate-300 hover:bg-slate-100">ביטול</Button>
                     </DialogFooter>
                   </DialogContent>
                 </Dialog>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-6 md:p-10 text-right">
              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-end gap-2 mb-1">
                   <h2 className="text-2xl md:text-3xl font-headline font-black text-primary tracking-tight">על הסופר</h2>
                   <Quote className="w-6 h-6 text-accent/20 rotate-180" />
                </div>
                <p className="text-lg md:text-xl leading-relaxed text-primary/80 italic font-medium">
                  "{seller.notes || 'מלאכת שמיים ושליחות קודש. כל תג נכתב מתוך כוונה טהורה על קלף איכותי, בחרדת קודש ובהתאם לכל כללי ההלכה.'}"
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  {(seller.script_types || []).map((type: string) => (
                    <Badge key={type} variant="secondary" className="bg-accent/10 text-accent border-accent/10 font-black text-[9px] px-4 py-1 uppercase tracking-wider">
                      מומחה לכתב {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <Tabs defaultValue="products" dir="rtl" className="w-full">
                <TabsList className="bg-muted/30 p-1 rounded-2xl mb-8 flex h-14 shadow-inner border border-muted">
                  <TabsTrigger value="products" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-premium text-[10px] md:text-xs font-black uppercase tracking-widest">מוצרים למכירה</TabsTrigger>
                  <TabsTrigger value="samples" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-premium text-[10px] md:text-xs font-black uppercase tracking-widest">דוגמאות כתיבה</TabsTrigger>
                  <TabsTrigger value="reviews" className="flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-premium text-[10px] md:text-xs font-black uppercase tracking-widest">ביקורות ({(reviews || []).length})</TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                   {isProductsLoading ? (
                     <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                   ) : products && products.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                       {products.map((p: any) => (
                          <Card key={p.id} className="group overflow-hidden border-none shadow-premium rounded-2xl bg-muted/10 hover:bg-white hover:shadow-2xl transition-all duration-500">
                            <div className="relative h-40 md:h-44">
                              <Image src={p.images?.[0] || logoImg} alt={p.product_type} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                              <Badge className="absolute top-3 right-3 bg-primary/80 text-white text-[8px] px-3 py-1 rounded-full backdrop-blur-md">
                                {p.script_level}
                              </Badge>
                            </div>
                            <div className="p-5 text-right space-y-2">
                              <h4 className="font-black text-primary text-sm md:text-base tracking-tight group-hover:text-accent transition-colors leading-tight">
                                {p.product_type} {p.sub_type && `(${p.sub_type})`}
                              </h4>
                              <p className="text-lg font-black text-accent">₪{p.price}</p>
                               <Button variant="link" size="sm" asChild className="p-0 h-auto mt-1 text-[9px] font-black uppercase tracking-widest">
                                 <Link href={`/products/${p.id}`} prefetch={true}>לפרטים מלאים ←</Link>
                               </Button>
                            </div>
                          </Card>
                       ))}
                     </div>
                   ) : (
                     <div className="text-center py-16 bg-muted/10 rounded-3xl border-2 border-dashed border-muted">
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-10" />
                        <p className="text-muted-foreground font-bold text-sm">הסופר טרם העלה מוצרים למכירה</p>
                     </div>
                   )}
                </TabsContent>

                <TabsContent value="samples" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-2 gap-4">
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
                        className="group relative aspect-square overflow-hidden rounded-2xl border border-muted/50 shadow-premium"
                      >
                        <Image src={sample} alt={`Sample ${i + 1}`} fill className="object-cover transition-transform duration-1000 group-hover:scale-110" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-primary shadow-lg">
                            <ZoomIn className="h-4 w-4 text-accent" />
                            הגדל דוגמה
                          </div>
                        </div>
                      </button>
                    ))}
                    {(!seller.writing_samples || seller.writing_samples.length === 0) && (
                      <div className="col-span-full py-16 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-muted">
                        <PenToolIcon className="w-10 h-10 mx-auto mb-3 opacity-10" />
                        <p className="text-muted-foreground font-bold text-sm">אין דוגמאות כתיבה זמינות מההרשמה</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="reviews" className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                  <div className="flex justify-between items-center mb-4">
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
                    <h4 className="text-sm font-black text-primary/40 uppercase tracking-widest">ביקורות לקוחות</h4>
                  </div>

                  <div className="mb-2 bg-muted/10 rounded-3xl border border-muted/40 p-5 space-y-4 text-right">
                    <h5 className="text-sm font-black text-primary">הוסף ביקורות שלך או דרג</h5>
                    {!user && (
                      <p className="text-xs font-bold text-muted-foreground">
                        כדי לפרסם ביקורת צריך <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="underline text-primary">להתחבר לחשבון</Link>.
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">ביקורת</Label>
                      <Textarea
                        placeholder="שתף את חווית השירות והכתיבה..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        className="rounded-2xl min-h-[100px]"
                        disabled={!user || isOwnSellerReviewBlocked || hasUserReviewedSeller || isReviewSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-primary">דירוג כוכבים</Label>
                      <div className="flex justify-center gap-3">
                        {[1, 2, 3, 4, 5].map(s => (
                          <button key={s} type="button" onClick={() => setReviewRating(s)} disabled={!user || isOwnSellerReviewBlocked || hasUserReviewedSeller || isReviewSubmitting}>
                            <Star className={`w-5 h-5 transition-colors ${s <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-muted/40">
                      <Switch
                        id="seller-review-anon"
                        checked={reviewIsAnonymous}
                        onCheckedChange={setReviewIsAnonymous}
                        disabled={!user || isOwnSellerReviewBlocked || hasUserReviewedSeller || isReviewSubmitting}
                      />
                      <Label htmlFor="seller-review-anon" className="text-sm font-bold text-primary cursor-pointer">פרסם כאנונימי</Label>
                    </div>
                    <Button
                      onClick={handleSubmitSellerReview}
                      disabled={!user || isReviewSubmitting || isOwnSellerReviewBlocked || hasUserReviewedSeller}
                      className="w-full bg-primary text-white h-11 font-black"
                    >
                      {isReviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : getSellerReviewSubmitLabel()}
                    </Button>
                  </div>

                  {sortedSellerReviews.length > 0 ? (
                    sortedSellerReviews.map((rev: any) => (
                      <div key={rev.id} className="flex flex-row-reverse items-start gap-3">
                        <Avatar className="h-8 w-8 border border-primary/10 flex-shrink-0">
                          {!rev.is_anonymous && <AvatarImage src={rev.reviewer_image || undefined} />}
                          <AvatarFallback className="bg-primary/5 text-primary font-black text-[10px]">
                            {rev.is_anonymous ? 'א' : (rev.buyer_name || 'מ').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[10px] font-medium text-muted-foreground">{rev.created_at ? new Date(rev.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                            <p className="font-semibold text-primary text-xs">{rev.is_anonymous ? 'אנונימי' : (rev.buyer_name || 'משתמש')}</p>
                          </div>
                          <div className="bg-muted/15 rounded-2xl px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3 h-3 ${s <= (rev.rating || 5) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />)}
                            </div>
                            <p className="text-xs text-primary/70 leading-relaxed">{rev.comment}</p>
                          </div>
                          {user?.uid === rev.buyer_id && (
                            <div className="flex justify-end mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSellerReview(rev.id)}
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
                    ))
                  ) : (
                    <div className="text-center py-12 bg-muted/10 rounded-3xl border-2 border-dashed border-muted">
                      <Star className="w-10 h-10 mx-auto mb-3 opacity-10" />
                      <p className="text-muted-foreground font-black text-sm uppercase tracking-widest">אין דירוגים עדיין</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>

        </div>
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
          <DialogHeader className="space-y-2 pr-12 text-right">
            <DialogTitle className="text-white">דוגמת כתיבה מוגדלת</DialogTitle>
            <p className="text-xs font-bold text-white/70">ניתן לבצע זום ולגרור את הדוגמה לעיון מדויק בפרטי הכתיבה.</p>
          </DialogHeader>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <Label className="text-[10px] font-black text-white/70">רמת זום</Label>
            <Button type="button" size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => updateSampleZoom(sampleZoomLevel - SAMPLE_ZOOM_STEP)}>−</Button>
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
            <Button type="button" size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => updateSampleZoom(sampleZoomLevel + SAMPLE_ZOOM_STEP)}>+</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-xs text-white hover:bg-white/10 hover:text-white"
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
                  alt="דוגמת כתיבה"
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
