
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
  ArrowLeft
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSupabaseClient, useDoc, useCollection, useMemoStable, useUser, addDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, collection, query, where, serverTimestamp } from '@/lib/supabase-compat';
import { supabase } from '@/lib/supabase';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useMemo, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function SellerProfile() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useUser();
  const db = useSupabaseClient();
  const { toast } = useToast();
  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // Fetch Seller Info
  const sellerRef = useMemoStable(() => {
    if (!id) return null;
    return doc(db, 'sellers', id);
  }, [db, id]);
  const { data: seller, isLoading: isSellerLoading } = useDoc<any>(sellerRef);

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
  const reviewsQuery = useMemoStable(() => {
    if (!id) return null;
    return query(collection(db, 'reviews'), where('seller_id', '==', id));
  }, [db, id]);
  const { data: reviews } = useCollection<any>(reviewsQuery);

  const averageRating = useMemo(() => {
    const revs = reviews || [];
    if (revs.length === 0) return 0;
    const sum = revs.reduce((acc: number, r: any) => acc + Number(r.rating || 5), 0);
    return sum / revs.length;
  }, [reviews]);

  const handleSendReport = () => {
    if (!user) { toast({ title: "עליך להתחבר כדי לדווח" }); return; }
    if (!reportReason.trim()) { toast({ variant: "destructive", title: "אנא ציין סיבה לדיווח" }); return; }
    
    setIsReporting(true);
    const reportData = {
      seller_id: id,
      seller_name: `${seller.first_name} ${seller.last_name}`,
      reporter_id: user.uid,
      reporter_name: user.displayName || user.email || 'משתמש באתר',
      reason: reportReason,
      created_at: serverTimestamp()
    };

    addDocumentNonBlocking(collection(db, 'reports'), reportData);
    
    setTimeout(() => {
      setIsReporting(false);
      setIsReportDialogOpen(false);
      setReportReason('');
      toast({ title: "הדיווח נשלח למנהל המערכת לבדיקה" });
    }, 800);
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
                  <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white text-right" dir="rtl">
                    <div className="bg-destructive p-6 text-white text-right">
                       <DialogHeader>
                          <DialogTitle className="text-xl font-headline font-black flex items-center gap-3 text-white">
                            <Flag className="w-6 h-6" /> דיווח למנהל המערכת
                          </DialogTitle>
                       </DialogHeader>
                    </div>
                    <div className="p-8 space-y-4">
                       <div className="space-y-2">
                          <Label className="text-xs font-black uppercase text-slate-900">מה סיבת הדיווח?</Label>
                          <Textarea 
                            value={reportReason} 
                            onChange={e => setReportReason(e.target.value)} 
                            placeholder="פרט כאן את הבעיה..." 
                            className="min-h-[120px] rounded-2xl text-slate-900 border-slate-200 placeholder:text-slate-400 focus:ring-destructive/10" 
                          />
                       </div>
                       <p className="text-[10px] font-bold text-slate-600 leading-relaxed italic">
                         * הדיווח ישלח באופן דיסקרטי למנהלי 'חותם'. אנו לוקחים כל פנייה ברצינות רבה לשמירה על כשרות וקדושת המערכת.
                       </p>
                    </div>
                    <DialogFooter className="p-6 bg-muted/30 border-t flex gap-3">
                       <Button onClick={handleSendReport} disabled={isReporting} className="flex-1 bg-destructive text-white h-12 rounded-xl font-black uppercase shadow-lg hover:bg-destructive/90 transition-colors">
                         {isReporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח דיווח'}
                       </Button>
                       <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)} className="h-12 rounded-xl font-bold text-slate-900">ביטול</Button>
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
                                <Link href={`/products/${p.id}`}>לפרטים מלאים ←</Link>
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
                      <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden shadow-premium border border-muted/50">
                        <Image src={sample} alt={`Sample ${i}`} fill className="object-cover group-hover:scale-110 transition-transform duration-1000" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <FileText className="text-white w-8 h-8" />
                        </div>
                      </div>
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
                  {reviews && reviews.length > 0 ? (
                    reviews.map((rev: any) => (
                      <Card key={rev.id} className="border-none shadow-premium rounded-2xl bg-muted/10 p-6 text-right">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-primary/40 uppercase tracking-tighter">דירוג סופר:</span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= (rev.rating || 5) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`} />)}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground">{rev.created_at?.toDate ? rev.created_at.toDate().toLocaleDateString('he-IL') : 'היום'}</span>
                        </div>
                        <p className="font-black text-primary text-sm mb-2">{rev.buyer_name}</p>
                        <p className="text-xs text-primary/70 leading-relaxed italic">"{rev.comment}"</p>
                      </Card>
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
