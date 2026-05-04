"use client";

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShoppingBag, 
  MessageSquare, 
  Heart, 
  Settings, 
  Package,
  Clock,
  ArrowRight,
  MessageCircle,
  Loader2,
  Lock,
  Save,
  CheckCircle2,
  Star,
  UserCheck,
  PackageCheck,
  ShieldCheck,
  Info,
  UserRound
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUser, useApp, useSupabaseClient, useDoc, useMemoStable, useCollection, updateDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, collection, query, where, documentId } from '@/lib/supabase-compat';
import { supabase } from '@/lib/supabase';
import { ProductCard } from '@/components/ProductCard';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import unsplashLoader from '@/lib/unsplashLoader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function CustomerDashboard() {
  const { user, isUserLoading } = useUser();
  const { profile, isProfileLoading } = useApp();
  const db = useSupabaseClient();
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('orders');
  const [isSaving, setIsSaving] = useState(false);

  // Route guard — redirect non-customers and unauthenticated users.
  // Prefer the DB profile role (more authoritative / up-to-date) and fall back
  // to the JWT user_metadata role for users whose metadata was set at signup.
  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const role = profile?.role ?? user.role;
    if (role === 'seller') {
      router.push('/seller/dashboard');
    } else if (role === 'admin') {
      router.push('/admin');
    }
  }, [user, isUserLoading, profile, isProfileLoading, router]);

  // Review state
  const [ratingOrderId, setRatingOrderId] = useState<any>(null);
  const [scribeRatingVal, setScribeRatingVal] = useState(5);
  const [productRatingVal, setProductRatingVal] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);

  const customerRef = useMemoStable(() => {
    if (!user) return null;
    return doc(db, 'customers', user.uid);
  }, [db, user?.uid]);

  const { data: customer, isLoading: isCustomerLoading } = useDoc<any>(customerRef);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    notif_msg_email: true,
    notif_status_email: true,
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        notif_msg_email: customer.notif_msg_email ?? true,
        notif_status_email: customer.notif_status_email ?? true,
      });
    }
  }, [customer]);

  const canLoadData = !!user && !!customer;

  const [orders, setOrders] = useState<any[] | null>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setOrders(null);
      setIsOrdersLoading(false);
      return;
    }
    setIsOrdersLoading(true);
    supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', user.uid)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          toast({ title: "שגיאה בטעינת ההזמנות", variant: "destructive" });
        } else {
          setOrders(data);
        }
        setIsOrdersLoading(false);
      });
  }, [user?.uid]);

  const chatsQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
  }, [db, user?.uid, canLoadData]);
  const { data: chats, isLoading: isChatsLoading } = useCollection<any>(chatsQuery);

  const favoritesQuery = useMemoStable(() => {
    if (!canLoadData || !customer?.favorite_product_ids || customer.favorite_product_ids.length === 0) return null;
    return query(collection(db, 'products'), where(documentId(), 'in', customer.favorite_product_ids.slice(0, 30)));
  }, [db, canLoadData, customer?.favorite_product_ids]);
  const { data: favoriteProducts, isLoading: isFavoritesLoading } = useCollection<any>(favoritesQuery);

  const handleSaveProfile = () => {
    if (!user || !customerRef) return;
    setIsSaving(true);
    updateDocumentNonBlocking(customerRef, {
      ...formData,
      updatedAt: new Date().toISOString()
    });
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "הפרופיל עודכן" });
    }, 500);
  };

  const handleManualRating = () => {
    if (!ratingOrderId || !user) return;
    setIsRatingSubmitting(true);

    const reviewData = {
      order_id: ratingOrderId.id,
      seller_id: ratingOrderId.seller_id,
      product_id: ratingOrderId.product_id,
      buyer_id: user.uid,
      buyer_name: `${customer?.first_name || 'לקוח'} ${customer?.last_name || 'חותם'}`,
      rating: scribeRatingVal,
      product_rating: productRatingVal,
      comment: ratingComment,
    };

    supabase.from('reviews').insert(reviewData).then(({ error }) => {
      if (error) {
        console.error('[reviews] insert error:', error.message);
        toast({ variant: 'destructive', title: 'שגיאה בשמירת הדירוג', description: 'אנא נסה שנית.' });
      }
    });
    updateDocumentNonBlocking(doc(db, 'orders', ratingOrderId.id), { is_rated: true });

    setTimeout(() => {
      setIsRatingSubmitting(false);
      setRatingOrderId(null);
      setRatingComment('');
      toast({ title: "תודה על הדירוג!" });
    }, 1000);
  };

  if (isUserLoading || isProfileLoading || isCustomerLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  const navItems = [
    { id: 'orders', label: 'הזמנות', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { id: 'messages', label: 'הודעות', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'favorites', label: 'מועדפים', icon: <Heart className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'הגדרות', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col" dir="rtl">
      <Navbar />
      
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-5xl flex-1">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4 text-right">
          <div className="text-right order-1 md:order-2">
            <h1 className="text-3xl md:text-4xl font-headline font-black text-primary tracking-tight">שלום, {customer?.first_name}</h1>
            <p className="text-muted-foreground font-medium text-sm">ניהול רכישות הקודש ואישור מסירה</p>
          </div>
          <Button variant="outline" asChild size="sm" className="gap-2 rounded-full text-xs h-10 px-6 order-2 md:order-1 border-primary/10 bg-white shadow-sm">
            <Link href="/search?view=all"><ArrowRight className="w-4 h-4" /> המשך בקניות</Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white/50 backdrop-blur-md p-1.5 rounded-3xl shadow-premium border h-16 w-full flex overflow-x-auto">
            {navItems.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="flex-1 rounded-[1.2rem] data-[state=active]:bg-primary data-[state=active]:text-white gap-2 text-xs font-black uppercase tracking-widest transition-all">
                {item.icon} {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
             {isOrdersLoading ? (
               <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
             ) : orders && orders.length > 0 ? (
               <div className="grid gap-4">
                 {orders.map((order: any) => (
                   <Card key={order.id} className="border-none shadow-premium rounded-[2rem] bg-white p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 hover:shadow-xl transition-all">
                     <div className="relative w-20 h-20 rounded-2xl overflow-hidden border shrink-0">
                       <Image loader={unsplashLoader} src={order.product_image || 'https://picsum.photos/seed/order/200/200'} alt={order.product_name} fill sizes="80px" className="object-cover" />
                     </div>
                     <div className="flex-1 text-right w-full">
                       <div className="flex items-center justify-start gap-3 mb-1">
                         <h4 className="font-black text-primary text-lg">{order.product_name}</h4>
                         {order.status === 'paid' ? (
                           <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px] uppercase"><ShieldCheck className="w-3 h-3 ml-1" /> הכסף בהקפאה</Badge>
                         ) : order.status === 'completed' ? (
                           <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] uppercase"><CheckCircle2 className="w-3 h-3 ml-1" /> עסקה הושלמה</Badge>
                         ) : <Badge variant="outline" className="text-[9px] font-black uppercase">{order.status}</Badge>}
                       </div>
                       
                       {order.status === 'paid' && (
                         <div className="mt-3 p-4 bg-accent/5 rounded-2xl border border-accent/20 space-y-2">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-accent uppercase tracking-widest">קוד אימות למסירה לסופר:</span>
                              <span className="text-2xl font-black text-primary tracking-[0.2em] tabular-nums">{order.verification_code}</span>
                           </div>
                           <p className="text-[9px] font-bold text-primary/60 leading-tight">
                             <Info className="w-3 h-3 inline ml-1" /> מסור קוד זה לסופר רק לאחר שקיבלת את המוצר והוא לשביעות רצונך. מסירת הקוד משחררת את התשלום לסופר.
                           </p>
                         </div>
                       )}

                       <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-primary/60">
                         <span className="bg-primary/5 px-3 py-1 rounded-full">₪{order.amount}</span>
                         <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                       </div>
                     </div>
                     <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                        <Button variant="outline" asChild size="sm" className="rounded-full h-10 px-6 border-primary/10 font-bold text-xs"><Link href={`/products/${order.product_id}`}>צפה במוצר</Link></Button>
                        {order.status === 'completed' && !order.is_rated && (
                          <Button variant="secondary" size="sm" onClick={() => setRatingOrderId(order)} className="rounded-full h-10 px-6 bg-accent/10 text-accent font-black text-xs gap-2"><Star className="w-3 h-3 fill-current" /> דרג סופר</Button>
                        )}
                     </div>
                   </Card>
                 ))}
               </div>
             ) : <div className="py-20 text-center text-muted-foreground italic">אין הזמנות פעילות.</div>}
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            {chats && chats.length > 0 ? (
              <div className="grid gap-4">
                {chats.map((chat: any) => {
                  const otherId = chat.participants.find((p: string) => p !== user?.uid);
                  return otherId ? <CustomerChatListItem key={chat.id} otherUserId={otherId} chat={chat} /> : null;
                })}
              </div>
            ) : <div className="py-20 text-center text-muted-foreground italic">אין הודעות עדיין.</div>}
          </TabsContent>

          <TabsContent value="favorites">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteProducts?.map((p: any) => <ProductCard key={p.id} product={p} />)}
            </div>
            {(!favoriteProducts || favoriteProducts.length === 0) && <div className="py-20 text-center text-muted-foreground italic">אין מועדפים שמורים.</div>}
          </TabsContent>

          <TabsContent value="settings">
            <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-5 sm:p-8 md:p-12 space-y-10">
              <div className="flex items-center justify-end gap-2 border-b pb-6">
                <h3 className="text-2xl font-headline font-black text-primary">הגדרות חשבון</h3>
                <Lock className="w-6 h-6 text-accent" />
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase">שם פרטי</Label><Input value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="rounded-xl h-12" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase">שם משפחה</Label><Input value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="rounded-xl h-12" /></div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">מספר טלפון</Label><Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="rounded-xl h-12" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">כתובת למשלוח</Label><Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="rounded-xl h-12" /></div>
                </div>
                <div className="space-y-6">
                   <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl">
                      <span className="text-sm font-bold">עדכוני סטטוס במייל</span>
                      <Switch checked={formData.notif_status_email} onCheckedChange={(v) => setFormData({...formData, notif_status_email: v})} />
                    </div>
                </div>
              </div>
              <div className="pt-8 border-t flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary text-white rounded-full px-12 h-14 font-black uppercase shadow-lg gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} שמור שינויים
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Rating Dialog */}
      <Dialog open={!!ratingOrderId} onOpenChange={() => setRatingOrderId(null)}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-w-md bg-white text-slate-900" dir="rtl">
          <div className="bg-primary p-8 text-white text-right">
            <DialogTitle className="text-2xl font-headline font-black">דרג את החוויה שלך</DialogTitle>
            <DialogDescription className="text-white/60">המשוב שלך עוזר לסופר וגם ללקוחות הבאים.</DialogDescription>
          </div>
          <div className="p-8 space-y-8 text-right">
             <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-primary">איך אתה מדרג את הסופר והמוצר?</Label>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setScribeRatingVal(s)}><Star className={`w-8 h-8 ${s <= scribeRatingVal ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} /></button>
                  ))}
                </div>
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 mr-1">כתוב ביקורת</Label>
                <Textarea placeholder="שתף את חווית השירות והכתיבה..." value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} className="rounded-2xl min-h-[100px]" />
             </div>
          </div>
          <DialogFooter className="p-6 bg-muted/30 border-t flex gap-3">
            <Button onClick={handleManualRating} disabled={isRatingSubmitting} className="flex-1 bg-primary text-white h-12 font-black uppercase">{isRatingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח ביקורת'}</Button>
            <Button variant="ghost" onClick={() => setRatingOrderId(null)} className="h-12 font-bold">ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerChatListItem({ chat, otherUserId }: any) {
  const db = useSupabaseClient();
  const { data: otherUser } = useDoc<any>(doc(db, 'sellers', otherUserId));
  return (
    <Link href={`/chat/${otherUserId}`}>
      <Card className="p-5 bg-white rounded-3xl shadow-premium hover:shadow-xl transition-all border border-transparent hover:border-accent/10">
        <div className="flex items-center gap-5 text-right">
          <Avatar className="h-14 w-14 border-2 border-primary/5 shadow-sm">
            <AvatarImage src={otherUser?.profile_image} />
            <AvatarFallback><UserRound className="w-7 h-7 text-primary/20" /></AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-baseline">
              <h4 className="font-black text-primary text-base truncate">{otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'טוען...'}</h4>
              <span className="text-[9px] text-muted-foreground font-bold">{chat.last_message_at?.toDate ? chat.last_message_at.toDate().toLocaleDateString('he-IL') : ''}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-medium mt-1">{chat.last_message_text || 'אין הודעות עדיין'}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
