"use client";

import { useState, useEffect, useRef } from 'react';
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
  UserRound,
  Trash2
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
import { PROFILE_NOT_FOUND_CODE } from '@/lib/supabase-errors';
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
import { loadGoogleMapsPlacesScript } from '@/lib/google-maps';

export default function CustomerDashboard() {
  const { user, isUserLoading } = useUser();
  const { profile, isProfileLoading } = useApp();
  const db = useSupabaseClient();
  const { toast } = useToast();
  const router = useRouter();
  const customerAddressInputRef = useRef<HTMLInputElement>(null);
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

  const { data: customer, isLoading: isCustomerLoading, isLoaded: isCustomerLoaded } = useDoc<any>(customerRef);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    notif_msg_email: true,
    notif_status_email: true,
  });

  // When the customer profile loads, populate the form. If names are empty in the
  // DB but available in the auth metadata (set during registration), sync them now.
  useEffect(() => {
    if (customer && isCustomerLoaded) {
      const rawMeta = user?._raw?.user_metadata ?? {};
      const metaFirstName = (rawMeta.first_name ?? rawMeta.firstName ?? '') as string;
      const metaLastName  = (rawMeta.last_name  ?? rawMeta.lastName  ?? '') as string;
      const firstName = customer.first_name || metaFirstName;
      const lastName  = customer.last_name  || metaLastName;

      setFormData({
        first_name: firstName,
        last_name: lastName,
        phone: customer.phone || '',
        address: customer.address || '',
        notif_msg_email: customer.notif_msg_email ?? true,
        notif_status_email: customer.notif_status_email ?? true,
      });

      // Persist synced names back to DB if they were missing
      if ((!customer.first_name && firstName) || (!customer.last_name && lastName)) {
        supabase
          .from('customers')
          .update({ first_name: firstName, last_name: lastName })
          .eq('id', user!.uid)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to sync names:', error);
              toast({ title: 'שגיאה בשמירת השם', description: error.message, variant: 'destructive' });
            }
          });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, isCustomerLoaded, user?.uid]);

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
          setOrders((data || []).filter((order: any) => order.status !== 'pending_payment'));
        }
        setIsOrdersLoading(false);
      });
  }, [user?.uid]);

  useEffect(() => {
    if (!customerAddressInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (cancelled || !customerAddressInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(customerAddressInputRef.current, {
          types: ['address'],
          fields: ['formatted_address'],
          componentRestrictions: { country: 'il' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            setFormData((prev) => ({ ...prev, address: place.formatted_address }));
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (autocomplete && window.google?.maps?.event?.clearInstanceListeners) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      } else if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, []);

   const chatsQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
  }, [db, user?.uid, canLoadData]);
  const { data: rawChats, isLoading: isChatsLoading } = useCollection<any>(chatsQuery);

  const chats = (rawChats || []).sort((a: any, b: any) => {
    const timeA = a.updated_at ? new Date(a.updated_at).getTime() : (a.last_message_at ? new Date(a.last_message_at).getTime() : 0);
    const timeB = b.updated_at ? new Date(b.updated_at).getTime() : (b.last_message_at ? new Date(b.last_message_at).getTime() : 0);
    return timeB - timeA;
  });

  const CHATS_PER_PAGE = 6;
  const [chatsPage, setChatsPage] = useState(1);
  const totalChatPages = Math.ceil(chats.length / CHATS_PER_PAGE);
  const paginatedChats = chats.slice((chatsPage - 1) * CHATS_PER_PAGE, chatsPage * CHATS_PER_PAGE);

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
      updated_at: new Date().toISOString()
    });
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "הפרופיל עודכן" });
    }, 500);
  };

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No session');
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (!res.ok) throw new Error('Delete failed');
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('[delete-account]', err);
      toast({ variant: 'destructive', title: 'שגיאה במחיקת החשבון', description: 'אנא נסה שנית.' });
      setIsDeletingAccount(false);
    }
  };

  const handleManualRating = async () => {
    if (!ratingOrderId || !user) return;
    setIsRatingSubmitting(true);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.uid)
      .maybeSingle();
    if (profileError) {
      console.error('[profiles] fetch error:', profileError.message);
      if (profileError.code !== PROFILE_NOT_FOUND_CODE) {
        toast({ variant: 'destructive', title: 'שגיאה בשמירת הדירוג', description: 'אנא נסה שנית.' });
        setIsRatingSubmitting(false);
        return;
      }
    }

    const reviewData = {
      order_id: ratingOrderId.id,
      seller_id: ratingOrderId.seller_id,
      product_id: ratingOrderId.product_id,
      buyer_id: user.uid,
      buyer_name: profile?.full_name || user.displayName || 'משתמש',
      is_anonymous: false,
      rating: scribeRatingVal,
      product_rating: productRatingVal,
      comment: ratingComment,
    };

    const { error } = await supabase.from('reviews').insert(reviewData);
    if (error) {
      console.error('[reviews] insert error:', error.message);
      toast({ variant: 'destructive', title: 'שגיאה בשמירת הדירוג', description: 'אנא נסה שנית.' });
      setIsRatingSubmitting(false);
      return;
    }
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

  const unreadChatsCount = chats.filter((c: any) => c?.unread_state?.[user?.uid ?? ''] === true).length;

  const navItems = [
    { id: 'orders', label: 'הזמנות', icon: <ShoppingBag className="w-4 h-4" />, count: orders?.length ?? 0 },
    { id: 'messages', label: 'הודעות', icon: <MessageSquare className="w-4 h-4" />, count: unreadChatsCount },
    { id: 'favorites', label: 'מועדפים', icon: <Heart className="w-4 h-4" />, count: 0 },
    { id: 'settings', label: 'הגדרות', icon: <Settings className="w-4 h-4" />, count: 0 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] via-[#F0F4F8] to-[#F8F9FA] flex flex-col" dir="rtl">
      <Navbar />

      <main className="container mx-auto px-4 py-20 md:py-28 max-w-5xl flex-1">
        {/* Profile Hero Header */}
        <div className="relative mb-8 rounded-[2.5rem] overflow-hidden shadow-premium">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />
          <div className="absolute inset-0 opacity-5">
            <svg width="100%" height="100%"><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white"/></pattern><rect width="100%" height="100%" fill="url(#dots)"/></svg>
          </div>
          <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center shadow-xl shrink-0">
              <UserRound className="w-10 h-10 md:w-12 md:h-12 text-white/70" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.3em] mb-1">אזור אישי</p>
              <h1 className="text-3xl md:text-4xl font-headline font-black text-white tracking-tight leading-tight">
                שלום, {customer?.first_name || 'לקוח'} {customer?.last_name || ''}
              </h1>
              <p className="text-white/50 text-sm font-medium mt-1">{user?.email}</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px] font-black text-white">{orders?.length ?? 0} הזמנות</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px] font-black text-white">{chats.length} שיחות</span>
                </div>
              </div>
            </div>
            <Button variant="outline" asChild size="sm" className="gap-2 rounded-full text-xs h-10 px-6 bg-white/10 border-white/20 text-white hover:bg-white/20 shrink-0">
              <Link href="/search?view=all"><ArrowRight className="w-3.5 h-3.5" /> המשך בקניות</Link>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="bg-white p-1.5 rounded-2xl shadow-sm border border-primary/5 h-auto w-full grid grid-cols-4 gap-1">
            {navItems.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="relative rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg gap-2 text-xs font-black uppercase tracking-wider transition-all py-3 flex flex-col sm:flex-row items-center"
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden text-[9px]">{item.label}</span>
                {item.count > 0 && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-accent text-primary text-[8px] font-black rounded-full flex items-center justify-center shadow-sm">{item.count}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-3 focus-visible:outline-none">
            {isOrdersLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : orders && orders.length > 0 ? (
              <div className="grid gap-3">
                {orders.map((order: any) => (
                  <Card key={order.id} className="border-none shadow-sm rounded-2xl bg-white p-4 sm:p-5 hover:shadow-md transition-all group">
                    <div className="flex items-start gap-4">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-primary/5 shrink-0 shadow-sm">
                        <Image loader={unsplashLoader} src={order.product_image || 'https://picsum.photos/seed/order/200/200'} alt={order.product_name} fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="flex-1 text-right min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {order.status === 'paid' ? (
                              <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3 ml-1" /> בהקפאה</Badge>
                            ) : order.status === 'completed' ? (
                              <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px] uppercase px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3 ml-1" /> הושלמה</Badge>
                            ) : <Badge variant="outline" className="text-[9px] font-black uppercase rounded-full px-2">{order.status}</Badge>}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                        </div>
                        <h4 className="font-black text-primary text-base leading-tight mb-1 truncate">{order.product_name}</h4>
                        <p className="text-sm font-black text-accent">₪{order.amount}</p>

                        {order.status === 'paid' && (
                          <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">קוד אימות:</span>
                              <span className="text-xl font-black text-primary tracking-[0.2em] tabular-nums">{order.verification_code}</span>
                            </div>
                            <p className="text-[9px] font-bold text-primary/50 leading-tight">
                              <Info className="w-3 h-3 inline ml-1" /> מסור לסופר רק לאחר קבלת המוצר.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button variant="outline" asChild size="sm" className="rounded-xl h-9 px-4 border-primary/10 font-bold text-xs"><Link href={`/products/${order.product_id}`}>צפה</Link></Button>
                        {order.status === 'completed' && !order.is_rated && (
                          <Button variant="secondary" size="sm" onClick={() => setRatingOrderId(order)} className="rounded-xl h-9 px-4 bg-accent/10 text-accent font-black text-xs gap-1"><Star className="w-3 h-3 fill-current" /> דרג</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-primary/5">
                <ShoppingBag className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">אין הזמנות פעילות.</p>
                <Button asChild variant="outline" className="mt-4 rounded-full px-8 h-10 text-xs font-black border-primary/10"><Link href="/search?view=all">גלה כלי קודש</Link></Button>
              </div>
            )}
          </TabsContent>

          {/* Messages/Chats Tab */}
          <TabsContent value="messages" className="space-y-3 focus-visible:outline-none">
            {isChatsLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : chats.length > 0 ? (
              <div className="space-y-3">
                <div className="grid gap-3">
                  {paginatedChats.map((chat: any) => {
                    const otherId = chat.participants.find((p: string) => p !== user?.uid);
                    return otherId ? <CustomerChatListItem key={chat.id} otherUserId={otherId} chat={chat} currentUserId={user?.uid ?? ''} /> : null;
                  })}
                </div>
                {totalChatPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <Button variant="outline" size="sm" onClick={() => setChatsPage(p => Math.max(1, p - 1))} disabled={chatsPage === 1} className="rounded-xl h-9 px-4 font-bold border-primary/10 bg-white text-xs"><ArrowRight className="w-3.5 h-3.5 ml-1.5" /> הקודם</Button>
                    <span className="text-[11px] font-black text-primary/40 uppercase tracking-widest">עמוד {chatsPage} / {totalChatPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setChatsPage(p => Math.min(totalChatPages, p + 1))} disabled={chatsPage === totalChatPages} className="rounded-xl h-9 px-4 font-bold border-primary/10 bg-white text-xs">הבא <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" /></Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-primary/5">
                <MessageCircle className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">אין הודעות עדיין.</p>
              </div>
            )}
          </TabsContent>

          {/* Favorites Tab */}
          <TabsContent value="favorites" className="focus-visible:outline-none">
            {isFavoritesLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : favoriteProducts && favoriteProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {favoriteProducts.map((p: any) => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-primary/5">
                <Heart className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">אין מועדפים שמורים.</p>
                <Button asChild variant="outline" className="mt-4 rounded-full px-8 h-10 text-xs font-black border-primary/10"><Link href="/search?view=all">גלה כלי קודש</Link></Button>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="focus-visible:outline-none">
            <Card className="border-none shadow-sm rounded-2xl bg-white p-6 sm:p-8">
              <div className="flex items-center justify-end gap-3 border-b pb-5 mb-8">
                <div className="text-right">
                  <h3 className="text-xl font-headline font-black text-primary">הגדרות חשבון</h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">עדכן את הפרטים האישיים שלך</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">שם פרטי</Label>
                      <Input value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="rounded-xl h-11 border-primary/10 focus:border-primary/30" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">שם משפחה</Label>
                      <Input value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="rounded-xl h-11 border-primary/10 focus:border-primary/30" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">דואר אלקטרוני</Label>
                    <Input value={user?.email ?? ''} readOnly className="rounded-xl h-11 bg-muted/30 text-muted-foreground cursor-not-allowed border-primary/5" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">מספר טלפון</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="rounded-xl h-11 border-primary/10 focus:border-primary/30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">כתובת למשלוח</Label>
                    <Input ref={customerAddressInputRef} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="rounded-xl h-11 border-primary/10 focus:border-primary/30" />
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/50">התראות במייל</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-primary/5">
                      <span className="text-sm font-bold">הודעות צ'אט חדשות</span>
                      <Switch checked={formData.notif_msg_email} onCheckedChange={(v) => setFormData({...formData, notif_msg_email: v})} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-primary/5">
                      <span className="text-sm font-bold">עדכוני סטטוס הזמנות</span>
                      <Switch checked={formData.notif_status_email} onCheckedChange={(v) => setFormData({...formData, notif_status_email: v})} />
                    </div>
                  </div>
                  <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex items-start gap-3">
                    <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-primary/60 leading-relaxed">כתובת המייל נקבעת בעת ההרשמה ואינה ניתנת לשינוי.</p>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t mt-6 flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary text-white rounded-full px-10 h-12 font-black uppercase shadow-lg gap-2 hover:bg-primary/90 transition-all">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} שמור שינויים
                </Button>
              </div>
              <div className="pt-6 border-t mt-6">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-red-700">מחיקת חשבון</p>
                    <p className="text-[11px] text-red-500 font-medium mt-0.5">פעולה זו בלתי הפיכה — כל הנתונים יימחקו לצמיתות</p>
                  </div>
                  <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} className="rounded-full gap-2 shrink-0">
                    <Trash2 className="w-4 h-4" /> מחק חשבון
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-w-md bg-white text-slate-900" dir="rtl">
          <div className="bg-red-600 p-8 text-white text-right">
            <DialogTitle className="text-2xl font-headline font-black">מחיקת חשבון</DialogTitle>
            <DialogDescription className="text-white/70 mt-1">פעולה זו בלתי הפיכה. כל הנתונים שלך יימחקו לצמיתות.</DialogDescription>
          </div>
          <div className="p-8 space-y-5 text-right">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">למה אתה רוצה למחוק את החשבון? (אופציונלי)</Label>
              <Textarea
                placeholder="ספר לנו את הסיבה..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="rounded-2xl min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-muted/30 border-t flex gap-3">
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="flex-1 h-12 font-black uppercase gap-2"
            >
              {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              אישור מחיקה
            </Button>
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeletingAccount} className="h-12 font-bold">
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function CustomerChatListItem({ chat, otherUserId, currentUserId }: any) {
  const db = useSupabaseClient();
  const { data: otherUser } = useDoc<any>(doc(db, 'sellers', otherUserId));
  const isUnread = chat?.unread_state?.[currentUserId] === true;
  return (
    <Link href={`/chat/${otherUserId}`}>
      <Card className={`p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-accent/10 ${isUnread ? 'ring-2 ring-accent/20' : ''}`}>
        <div className="flex items-center gap-4 text-right">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 border-2 border-primary/5 shadow-sm">
              <AvatarImage src={otherUser?.profile_image} />
              <AvatarFallback className="bg-primary/5 text-primary font-black text-sm">{otherUser?.first_name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            {isUnread && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive rounded-full border-2 border-white" />}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[10px] text-muted-foreground font-bold whitespace-nowrap bg-muted/30 px-2 py-0.5 rounded-full">
                {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString('he-IL') : ''}
              </span>
              <h4 className="font-black text-primary text-sm truncate">{otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'טוען...'}</h4>
            </div>
            <p className={`text-xs truncate mt-1 ${isUnread ? 'font-black text-primary' : 'text-muted-foreground font-medium'}`}>{chat.last_message_text || 'אין הודעות עדיין'}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
