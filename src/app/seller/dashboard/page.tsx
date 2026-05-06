
"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { 
  BarChart3, 
  Package, 
  Settings, 
  MessageSquare, 
  Trash2, 
  Plus,
  Minus,
  Edit,
  LayoutDashboard,
  ClipboardList,
  X,
  Loader2,
  Menu,
  ChevronLeft,
  ChevronRight,
  Camera,
  Star,
  UserRound,
  Clock,
  ShieldCheck,
  Banknote,
  ShoppingBag,
  Truck,
  Scroll,
  CheckCircle2,
  Building2,
  Info,
  Maximize2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  MapPin,
  ShieldAlert,
  ChevronDown,
  MessageCircle,
  Mail,
  Smartphone,
  Phone,
  Landmark,
  IdCard,
  ExternalLink
} from 'lucide-react';
import Image from 'next/image';
import { 
  useUser, 
  useSupabaseClient, 
  useCollection, 
  useDoc,
  useMemoStable,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/lib/supabase-hooks';
import { collection, query, where, doc, increment } from '@/lib/supabase-compat';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

const PRODUCT_SUBTYPES: Record<string, string[]> = {
  'מזוזה': ['קלף', 'קלף + בית'],
  'מגילה': ['אסתר', 'רות', 'איכה', 'שיר השירים', 'קהלת'],
  'מוצרי יודאיקה שונים': ['פיטום הקטורת', 'אשת חיל', 'למנצח', 'ספר הפטרות']
};

const ISRAEL_CITIES = [
  'כל הארץ',
  'ירושלים', 'תל אביב-יפו', 'חיפה', 'ראשון לציון', 'פתח תקווה', 'אשדוד',
  'נתניה', 'באר שבע', 'בני ברק', 'חולון', 'רמת גן', 'אשקלון', 'רחובות',
  'בת ים', 'בית שמש', 'כפר סבא', 'הרצליה', 'חדרה', 'מודיעין-מכבים-רעות',
  'לוד', 'רמלה', 'נצרת', 'עכו', 'אילת', 'עפולה', 'נהריה', 'טבריה', 'צפת',
  'קריית גת', 'קריית אתא', 'קריית ביאליק', 'קריית מוצקין', 'קריית שמונה',
  'רעננה', 'הוד השרון', 'יבנה', 'גבעתיים', 'גבעת שמואל', 'אור יהודה',
  'אריאל', 'מעלה אדומים', 'בית שאן', 'אלעד', 'נס ציונה', 'רא"ש העין',
  'מגדל העמק', 'דימונה', 'אופקים', 'ירוחם', 'מצפה רמון', 'סח\'נין', 'שפרעם',
  'נוף הגליל', 'טירה', 'טירת כרמל', 'קלנסוואה', 'כרמיאל', 'נשר',
  'פרדס חנה-כרכור', 'זכרון יעקב', 'יקנעם עילית', 'מעלות-תרשיחא',
  'באר יעקב', 'גדרה', 'שוהם', 'מזכרת בתיה', 'גן יבנה', 'קריית מלאכי',
  'ג\'לג\'וליה', 'בנימינה-גבעת עדה', 'אבן יהודה', 'ראש העין',
];

const ITEMS_PER_PAGE = 7;

function SellerDashboardContent() {
  const { user, isUserLoading } = useUser();
  const db = useSupabaseClient();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const sellerRef = useMemoStable(() => {
    if (!user) return null;
    return doc(db, 'sellers', user.uid);
  }, [db, user?.uid]);
  const { data: seller, isLoading: isSellerLoading } = useDoc<any>(sellerRef);

  // Route guard — redirect non-sellers and unauthenticated users.
  useEffect(() => {
    if (isUserLoading || isSellerLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role && user.role !== 'seller') {
      router.push(user.role === 'admin' ? '/admin' : '/customer/dashboard');
    }
  }, [user, isUserLoading, isSellerLoading, router]);

  const canLoadData = !!user && !!seller;

  const [productsData, setProductsData] = useState<any[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  useEffect(() => {
    if (!canLoadData || !user) return;
    setIsProductsLoading(true);
    supabase
      .from('products')
      .select('*')
      .eq('seller_id', user.uid)
      .then(({ data, error }) => {
        if (error) console.error('products fetch error:', error.message);
        else setProductsData(data || []);
      })
      .finally(() => setIsProductsLoading(false));
  }, [canLoadData, user?.uid]);

  const products = (productsData || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const ordersQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'orders'), where('seller_id', '==', user.uid));
  }, [db, user?.uid, canLoadData]);
  const { data: ordersData } = useCollection<any>(ordersQuery);
  const orders = (ordersData || []).sort((a: any, b: any) => {
    const timeA = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
    const timeB = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
    return timeB - timeA;
  });

  const chatsQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
  }, [db, user?.uid, canLoadData]);
  const { data: chatsData } = useCollection<any>(chatsQuery);
  const chats = (chatsData || []).filter((c: any) => c.participants && c.participants.length > 0);

  const unreadCount = useMemo(() => {
    if (!user || !chats) return 0;
    return chats.filter((c: any) => c[`unread_${user.uid}`] === true).length;
  }, [chats, user?.uid]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [inventoryPage, setInventoryPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [chatsPage, setChatsPage] = useState(1);

  const [formStep, setFormStep] = useState(1);
  const totalFormSteps = 4;

  const [verificationCodes, setVerificationCodes] = useState<Record<string, string>>({});
  const [isVerifying, setIsVerifying] = useState<string | null>(null);

  const [formType, setFormType] = useState('');
  const [formSubType, setFormSubType] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formScript, setFormScript] = useState('');
  const [formQuality, setFormQuality] = useState('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formParchmentSize, setFormParchmentSize] = useState('');
  const [formProofreading, setFormProofreading] = useState('');
  const [formDeliveryTime, setFormDeliveryTime] = useState('3');
  const [formDeliveryType, setFormDeliveryType] = useState('pickup');
  const [formDeliveryFee, setFormDeliveryFee] = useState<string>('');
  const [formDeliveryArea, setFormDeliveryArea] = useState<string[]>(['כל הארץ']);
  const [citySearch, setCitySearch] = useState('');

  const [megRows, setMegRows] = useState('');
  const [megHeight, setMegHeight] = useState('');
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: '', 
    last_name: '', 
    phone: '', 
    address: '', 
    profile_image: '', 
    notes: '',
    notification_email: true,
    notification_sms: true,
    notification_voice: false
  });

  useEffect(() => {
    if (seller) {
      setProfileData({
        first_name: seller.first_name || '',
        last_name: seller.last_name || '',
        phone: seller.phone || '',
        address: seller.address || '',
        profile_image: seller.profile_image || '',
        notes: seller.notes || '',
        notification_email: seller.notification_email ?? true,
        notification_sms: seller.notification_sms ?? true,
        notification_voice: seller.notification_voice ?? false
      });
    }
  }, [seller]);

  // Apply any pending seller profile that was saved in localStorage during onboarding
  // when email confirmation was required (the full profile couldn't be written to the
  // DB at registration time because no session existed yet).
  useEffect(() => {
    if (!canLoadData || !user || !seller || !db) return;
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem('pendingSellerProfile');
      if (!raw) return;

      const { _pending_email, ...profileData } = JSON.parse(raw);

      // Safety check: only apply if the stored email matches the authenticated user.
      if (_pending_email && _pending_email !== seller.email) {
        localStorage.removeItem('pendingSellerProfile');
        return;
      }

      // Only apply if the profile is still incomplete (phone is a reliable indicator).
      if (seller.phone) {
        localStorage.removeItem('pendingSellerProfile');
        return;
      }

      db.from('sellers')
        .update({ ...profileData, updated_at: new Date().toISOString() })
        .eq('id', user.uid)
        .then(({ error }) => {
          if (!error) {
            localStorage.removeItem('pendingSellerProfile');
            toast({ title: 'הפרופיל הושלם', description: 'כל הפרטים שהזנת בהרשמה נשמרו בהצלחה.' });
          }
        });
    } catch {
      localStorage.removeItem('pendingSellerProfile');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadData, user?.uid, seller?.email]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['inventory', 'sales', 'chats', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleVerifyOrder = (order: any) => {
    const inputCode = verificationCodes[order.id];
    if (!inputCode || inputCode !== order.verification_code) {
      toast({ variant: "destructive", title: "קוד שגוי", description: "הקוד אינו תואם." });
      return;
    }
    setIsVerifying(order.id);
    const totalAmount = Number(order.amount);
    const platformFee = totalAmount * 0.20; 
    const sellerNet = totalAmount - platformFee;

    updateDocumentNonBlocking(doc(db, 'orders', order.id), {
      status: 'completed',
      completed_at: new Date().toISOString(),
      platform_fee: platformFee,
      seller_net: sellerNet,
      verified_by_seller: true,
      is_seen_by_seller: true
    });

    updateDocumentNonBlocking(doc(db, 'sellers', user!.uid), {
      sales_count: increment(1)
    });

    setTimeout(() => { setIsVerifying(null); toast({ title: "העסקה הושלמה!" }); }, 1000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'profile') => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'product') setFormImages(prev => [...prev, reader.result as string]);
        else setProfileData(prev => ({ ...prev, profile_image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    });
  };

  const openEditDialog = (p: any) => {
    setEditingProduct(p);
    setFormType(p.product_type || '');
    setFormSubType(p.sub_type || '');
    setFormDescription(p.description || '');
    setFormQuantity(p.quantity || 1);
    setFormScript(p.script_type || '');
    setFormQuality(p.script_level || '');
    setFormPrice(p.price ? String(p.price) : '');
    setFormImages(p.images || []);
    setFormParchmentSize(p.parchment_size || '');
    setFormProofreading(p.proofreading_level || '');
    setFormDeliveryTime(p.delivery_time || '3');
    setFormDeliveryType(p.delivery_type || 'pickup');
    setFormDeliveryFee(p.delivery_fee ? String(p.delivery_fee) : '');
    setFormDeliveryArea(Array.isArray(p.delivery_area) ? p.delivery_area : [p.delivery_area || 'כל הארץ']);
    setFormStep(1);
    
    if (p.product_type === 'מגילה' && p.parchment_size) {
      const parts = p.parchment_size.split(', ');
      if (parts[0]) setMegRows(parts[0].replace(' שורות', ''));
      if (parts[1]) setMegHeight(parts[1]);
    } else {
      setMegRows('');
      setMegHeight('');
    }
    
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormType(''); setFormSubType(''); setFormDescription(''); setFormQuantity(1);
    setFormScript(''); setFormQuality(''); setFormPrice(''); setFormImages([]);
    setFormParchmentSize(''); setFormProofreading(''); setFormDeliveryTime('3');
    setFormDeliveryType('pickup'); setFormDeliveryFee(''); setFormDeliveryArea(['כל הארץ']);
    setCitySearch('');
    setMegRows(''); setMegHeight('');
    setFormStep(1);
  };

  const handleSubmitProduct = async () => {
    if (!user) return;
    
    let finalSize = formParchmentSize;
    if (formType === 'מגילה') {
      if (!megRows || !megHeight) {
        toast({ variant: "destructive", title: "חסר גודל מגילה", description: "אנא בחר מספר שורות וגובה קלף." });
        return;
      }
      finalSize = `${megRows} שורות, ${megHeight}`;
    }

    if (
      !formType || 
      (formType !== 'תפילין' && !formSubType) ||
      !formScript || 
      !formQuality || 
      !formProofreading ||
      !finalSize ||
      formPrice === '' || Number(formPrice) <= 0 || 
      formQuantity < 1 ||
      !formDeliveryTime ||
      !formDeliveryType ||
      (formDeliveryType !== 'pickup' && formDeliveryArea.length === 0)
    ) {
      toast({ variant: "destructive", title: "שדות חובה חסרים", description: "אנא מלא את כל השדות המסומנים בכוכבית." });
      return;
    }

    if (formImages.length === 0) {
      toast({ variant: "destructive", title: "חסרה תמונה", description: "יש להעלות לפחות תמונה אחת של המוצר." });
      return;
    }

    const data = {
      seller_id: user.uid,
      product_type: formType,
      sub_type: formType === 'תפילין' ? 'כללי' : formSubType,
      description: formDescription,
      quantity: formQuantity,
      script_type: formScript,
      script_level: formQuality,
      price: Number(formPrice),
      images: formImages,
      parchment_size: finalSize,
      proofreading_level: formProofreading,
      delivery_time: formDeliveryTime,
      delivery_type: formDeliveryType,
      delivery_fee: formDeliveryType === 'pickup' ? 0 : Number(formDeliveryFee),
      delivery_area: formDeliveryArea,
    };

    if (editingProduct) {
      updateDocumentNonBlocking(doc(db, 'products', editingProduct.id), data);
    } else {
      const { error } = await supabase.from('products').insert([data]);
      if (error) {
        console.error("Supabase insert error:", error);
        toast({ variant: "destructive", title: "שגיאה בהוספת המוצר", description: error.message });
        return;
      }
    }
    
    setIsDialogOpen(false); 
    resetForm();
    toast({ title: "המוצר עודכן בהצלחה" });
  };

  const updateStock = (productId: string, diff: number) => {
    updateDocumentNonBlocking(doc(db, 'products', productId), {
      quantity: increment(diff)
    });
  };

  const totalNetEarnings = useMemo(() => orders.filter(o => o.status === 'completed').reduce((acc: number, o: any) => acc + (Number(o.seller_net) || 0), 0), [orders]);

  const paginatedProducts = products.slice((inventoryPage - 1) * ITEMS_PER_PAGE, inventoryPage * ITEMS_PER_PAGE);
  const paginatedOrders = orders.slice((salesPage - 1) * ITEMS_PER_PAGE, salesPage * ITEMS_PER_PAGE);
  const paginatedChats = chats.slice((chatsPage - 1) * ITEMS_PER_PAGE, chatsPage * ITEMS_PER_PAGE);

  const navItems = [
    { id: 'inventory', label: 'ניהול מלאי', icon: <Package className="w-5 h-5" /> },
    { id: 'sales', label: 'מכירות', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'chats', label: 'הודעות', icon: <MessageSquare className="w-5 h-5" />, badge: unreadCount },
    { id: 'settings', label: 'הגדרות ופרופיל', icon: <Settings className="w-5 h-5" /> },
  ];

  if (isUserLoading || isSellerLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col w-full">
      <div className="md:hidden flex items-center justify-between mb-6">
           <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
             <SheetTrigger asChild>
               <Button variant="outline" className="rounded-2xl h-14 px-5 border-primary/10 bg-white shadow-premium gap-3 font-black text-primary">
                 <Menu className="w-5 h-5 text-accent" />
                 <span>{navItems.find(i => i.id === activeTab)?.label}</span>
               </Button>
             </SheetTrigger>
             <SheetContent side="right" className="w-[280px] p-0 border-none bg-white rounded-l-[2.5rem]">
               <SheetHeader className="sr-only">
                 <SheetTitle>תפריט ניהול סופר</SheetTitle>
                 <SheetDescription>מעבר בין מלאי, מכירות, הודעות והגדרות חשבון</SheetDescription>
               </SheetHeader>
               <div className="bg-primary p-8 text-white">
                 <div className="text-right">
                   <div className="flex items-center justify-between">
                     <h2 className="text-white font-headline font-black text-2xl flex items-center gap-3"><LayoutDashboard className="w-6 h-6 text-accent" /> ניהול סופר</h2>
                   </div>
                 </div>
               </div>
               <div className="p-4 space-y-2 mt-4">
                 {navItems.map((item) => (
                   <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileNavOpen(false); }} className={cn("w-full flex items-center justify-between p-4 rounded-2xl transition-all font-black text-sm", activeTab === item.id ? "bg-primary text-white shadow-lg" : "text-primary/60 hover:bg-primary/5")}>
                     <div className="flex items-center gap-3">{item.icon}<span>{item.label}</span></div>
                     {item.badge ? <Badge className="bg-destructive text-white border-none rounded-full px-2 py-0.5 text-[10px]">{item.badge}</Badge> : <ChevronLeft className="w-4 h-4 opacity-30" />}
                   </button>
                 ))}
               </div>
             </SheetContent>
           </Sheet>
           <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="icon" className="w-14 h-14 rounded-2xl bg-accent text-primary shadow-lg"><Plus className="w-7 h-7" /></Button>
        </div>

        <div className="hidden md:flex flex-col md:flex-row items-center justify-between mb-10 md:mb-12 gap-6 text-right">
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-accent text-primary hover:bg-accent/90 rounded-full px-8 py-6 font-black uppercase tracking-wider shadow-xl transition-all"><Plus className="w-5 h-5 ml-2" /> העלאת מוצר חדש</Button>
          <div className="text-right">
            <h1 className="text-3xl font-headline font-black text-primary tracking-tight">שלום, {seller?.first_name}</h1>
            <div className="flex items-center justify-end gap-2 text-emerald-600 font-bold text-xs"><CheckCircle2 className="w-4 h-4" /><span>סופר מאומת</span></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-10">
          <QuickStat label="יתרה למוכר" value={`₪${totalNetEarnings.toFixed(0)}`} icon={<Banknote className="w-4 h-4" />} color="bg-emerald-50 text-emerald-600" />
          <QuickStat label="מוצרים" value={String(products.length)} icon={<Package className="w-4 h-4" />} color="bg-blue-50 text-blue-600" />
          <QuickStat label="הודעות" value={String(unreadCount)} icon={<MessageSquare className="w-4 h-4" />} color="bg-purple-50 text-purple-600" highlight={unreadCount > 0} />
          <QuickStat label="סטטוס" value="פעיל" icon={<TrendingUp className="w-4 h-4" />} color="bg-orange-50 text-orange-600" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="hidden md:flex bg-white/50 backdrop-blur-md p-1.5 rounded-3xl shadow-premium h-16 border">
            {navItems.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="flex-1 rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white gap-2 text-xs font-black uppercase transition-all">
                {item.icon} {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
             {products.length === 0 && <div className="py-24 text-center bg-white rounded-[2rem] border-2 border-dashed text-muted-foreground italic">אין מוצרים במלאי. לחץ על כפתור הפלוס להוספה.</div>}
             {paginatedProducts.map((p: any) => (
               <Card key={p.id} className="border-none shadow-premium rounded-[2rem] bg-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                 <div className="w-20 h-20 bg-muted rounded-2xl shrink-0 overflow-hidden relative border"><Image src={p.images?.[0] || logoImg} alt="product" fill className="object-cover" /></div>
                 <div className="flex-1 text-right w-full">
                    <h4 className="font-black text-lg text-primary">{p.product_type}</h4>
                    <p className="text-[10px] text-muted-foreground font-bold">{p.script_type} | {p.script_level}</p>
                    <div className="flex items-center justify-end gap-3 mt-2">
                       <Badge variant="secondary" className="font-black text-xs">₪{p.price}</Badge>
                       <div className="flex items-center bg-muted/30 rounded-full px-2 py-1 gap-2 border">
                          <button onClick={() => updateStock(p.id, -1)} disabled={p.quantity <= 0} className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-destructive/10 text-destructive disabled:opacity-30"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="text-[10px] font-black text-primary px-1">מלאי: {p.quantity}</span>
                          <button onClick={() => updateStock(p.id, 1)} className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-emerald-100 text-emerald-600"><Plus className="w-3.5 h-3.5" /></button>
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(p)} className="rounded-full hover:bg-primary hover:text-white transition-all"><Edit className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => deleteDocumentNonBlocking(doc(db, 'products', p.id))} className="text-destructive rounded-full hover:bg-destructive hover:text-white transition-all"><Trash2 className="w-4 h-4" /></Button>
                 </div>
               </Card>
             ))}
             <Pagination current={inventoryPage} total={products.length} onChange={setInventoryPage} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
             {orders.length > 0 ? (
               <div className="grid gap-4">
                 {paginatedOrders.map((o: any) => {
                   const isExpanded = expandedOrderId === o.id;
                   const isTorahRequest = o.status === 'torah_request';
                   return (
                     <Card key={o.id} className={cn("border-none shadow-premium rounded-[2rem] bg-white overflow-hidden text-right transition-all", isExpanded ? "ring-2 ring-primary/10" : "hover:shadow-lg")}>
                       <div 
                         className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
                         onClick={() => {
                           setExpandedOrderId(isExpanded ? null : o.id);
                           if (!o.is_seen_by_seller) {
                             updateDocumentNonBlocking(doc(db, 'orders', o.id), { is_seen_by_seller: true });
                           }
                         }}
                       >
                         <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-colors", o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : isTorahRequest ? 'bg-accent/10 text-accent' : 'bg-primary/5 text-primary')}>
                              {isTorahRequest ? <Scroll className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
                            </div>
                            <div className="text-right flex-1">
                               <p className="font-black text-primary text-base leading-tight group-hover:text-accent transition-colors">{o.product_name}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <Badge className={cn("border-none font-black text-[8px] uppercase px-2 py-0.5", o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : isTorahRequest ? 'bg-accent/10 text-accent' : 'bg-blue-100 text-blue-700')}>
                                   {o.status === 'completed' ? 'הושלם ושולם' : isTorahRequest ? 'בקשת תיאום והתרשמות' : 'ממתין למסירה'}
                                 </Badge>
                                 <span className="text-[10px] text-muted-foreground font-bold">#{o.id?.slice(0, 8)}</span>
                                 {!o.is_seen_by_seller && <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase">חדש!</Badge>}
                               </div>
                            </div>
                         </div>
                         
                         <div className="flex items-center justify-between w-full sm:w-auto gap-8">
                            <div className="text-right">
                               <p className="text-lg font-black text-primary leading-none">₪{o.amount}</p>
                               <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1">סה"כ בעסקה</p>
                            </div>
                            <div className={cn("p-2 rounded-full transition-transform", isExpanded ? "rotate-180 bg-primary text-white" : "bg-muted text-primary/40 group-hover:bg-primary group-hover:text-white")}>
                               <ChevronDown className="w-4 h-4" />
                            </div>
                         </div>
                       </div>

                       <AnimatePresence>
                         {isExpanded && (
                           <motion.div 
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: 'auto', opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden border-t border-primary/5 bg-slate-50/30"
                           >
                             {isTorahRequest ? (
                               <div className="p-10 text-center space-y-6">
                                  <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto border-2 border-accent/20">
                                    <MessageCircle className="w-10 h-10 text-accent" />
                                  </div>
                                  <div className="max-w-md mx-auto space-y-3">
                                    <h4 className="text-2xl font-headline font-black text-primary">מתעניינים בספר תורה שלך!</h4>
                                    <p className="text-base text-primary/70 font-medium leading-relaxed">
                                      בשל אופי המוצר, הפרטים האישיים מנוהלים על ידי צוות 'חותם'. אנא צור איתנו קשר לתיאום פגישה אישית להתרשמות הלקוח מהספר.
                                    </p>
                                  </div>
                                  <div className="pt-4">
                                    <Button asChild className="bg-primary text-white hover:bg-primary/90 rounded-full px-12 h-14 font-black uppercase tracking-widest shadow-xl gap-3">
                                      <a href="https://wa.me/972500000000" target="_blank" rel="noopener noreferrer">
                                        צרו קשר עם הנהלת האתר
                                      </a>
                                    </Button>
                                  </div>
                               </div>
                             ) : (
                               <>
                                 <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                       <h5 className="font-black text-xs uppercase text-primary/40 flex items-center justify-end gap-2">פרטי לקוח למשלוח <Truck className="w-4 h-4" /></h5>
                                       <div className="bg-white p-6 rounded-[2rem] border border-primary/5 space-y-3 shadow-sm">
                                          <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{o.buyer_name}</span><span className="text-[10px] text-muted-foreground font-black">שם מלא</span></div>
                                          <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{o.buyer_phone}</span><span className="text-[10px] text-muted-foreground font-black">טלפון</span></div>
                                          <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{o.buyer_address}</span><span className="text-[10px] text-muted-foreground font-black">כתובת</span></div>
                                       </div>
                                    </div>
                                    <div className="space-y-4">
                                       <h5 className="font-black text-xs uppercase text-primary/40 flex items-center justify-end gap-2">אישור מסירה <ShieldCheck className="w-4 h-4" /></h5>
                                       <div className={cn("bg-white p-6 rounded-[2rem] border space-y-4 shadow-sm", o.status === 'completed' ? 'border-emerald-100' : 'border-blue-100')}>
                                          {o.status === 'completed' ? <div className="text-center py-4"><CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" /><p className="font-black text-emerald-600 text-sm mt-2">העסקה הושלמה והתשלום שוחרר</p></div> : (
                                            <>
                                              <p className="text-[11px] font-bold text-primary/70">הזן קוד אימות מהלקוח לשחרור התשלום:</p>
                                              <div className="flex gap-3">
                                                <Input placeholder="קוד 6 ספרות" className="text-center font-black h-12 rounded-xl" value={verificationCodes[o.id] || ''} onChange={e => setVerificationCodes({...verificationCodes, [o.id]: e.target.value})} />
                                                <Button onClick={() => handleVerifyOrder(o)} disabled={isVerifying === o.id || !verificationCodes[o.id]} className="bg-primary text-white h-12 rounded-xl px-8 font-black">אמת קוד</Button>
                                              </div>
                                              <p className="text-[9px] text-muted-foreground italic text-center">הקוד נשלח ללקוח בעת התשלום ומופיע לו בלוח הבקרה.</p>
                                            </>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="px-8 pb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-primary/5 pt-6 bg-white/40">
                                    <div className="flex items-center gap-6 text-[10px] font-bold text-primary/40">
                                       <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> נוצר ב: {o.created_at?.toDate ? o.created_at.toDate().toLocaleDateString('he-IL') : '-'}</span>
                                       {o.completed_at && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> הושלם ב: {new Date(o.completed_at).toLocaleDateString('he-IL')}</span>}
                                    </div>
                                    <div className="flex items-center gap-4">
                                       <div className="text-right">
                                          <p className="text-[9px] font-black text-muted-foreground uppercase leading-none">הכנסה נטו לסופר (לאחר עמלת אתר):</p>
                                          <p className="text-xl font-black text-emerald-600">₪{o.seller_net?.toFixed(0) || (o.amount * 0.80).toFixed(0)}</p>
                                       </div>
                                    </div>
                                 </div>
                               </>
                             )}
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </Card>
                   );
                 })}
                 <Pagination current={salesPage} total={orders.length} onChange={setSalesPage} />
               </div>
             ) : <div className="py-20 text-center text-muted-foreground italic">אין מכירות רשומות.</div>}
          </TabsContent>

          <TabsContent value="chats" className="space-y-4">
             {chats.length > 0 ? (
               <div className="grid gap-4">
                 {paginatedChats.map((c: any) => {
                   const otherId = c.participants?.find((p: string) => p !== user?.uid);
                   if (!otherId) return null;
                   return <SellerChatListItem key={c.id} chat={c} otherUserId={otherId} userId={user?.uid ?? ''} />;
                 })}
                 <Pagination current={chatsPage} total={chats.length} onChange={setChatsPage} />
               </div>
             ) : <div className="py-24 text-center bg-white rounded-[2rem] border-2 border-dashed text-muted-foreground italic">אין הודעות חדשות.</div>}
          </TabsContent>

          <TabsContent value="settings">
             <Card className="p-5 sm:p-8 md:p-12 border-none shadow-premium rounded-[3rem] bg-white text-right">
                <div className="flex items-center justify-between border-b pb-6 mb-10"><h3 className="text-2xl font-black text-primary">הגדרות ופרופיל אישי</h3><Settings className="w-6 h-6 text-accent" /></div>
                
                <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                   <div className="space-y-8">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-accent/20 bg-muted flex items-center justify-center">
                          {profileData.profile_image ? <Image src={profileData.profile_image} alt="profile" fill className="object-cover" /> : <UserRound className="w-12 h-12 text-primary/10" />}
                          <button onClick={() => document.getElementById('profile-img-up')?.click()} className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera className="w-6 h-6" /></button>
                        </div>
                        <input id="profile-img-up" type="file" onChange={(e) => handleImageUpload(e, 'profile')} className="hidden" accept="image/*" />
                        <div className="text-center space-y-3">
                          <Badge className="bg-accent/10 text-accent border-none font-black text-[9px] uppercase px-3 py-1">תמונת פנים מומלצת</Badge>
                          
                          <div className="flex items-start gap-2 bg-destructive/5 p-3 rounded-xl border border-destructive/10">
                            <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-[9px] font-black text-destructive leading-tight">
                              אזהרת אבטחה: חובה להעלות תמונת פנים של הסופר בלבד. כל ניסיון להעלות תמונה שאינה של בעל החשבון יביא לחסימה מיידית.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                        <h4 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Settings className="w-4 h-4 text-accent" /> התראות על הזמנות
                        </h4>
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-primary/40" />
                                <span className="text-xs font-bold text-primary">התראות במייל</span>
                              </div>
                              <Switch 
                                checked={profileData.notification_email} 
                                onCheckedChange={v => setProfileData({...profileData, notification_email: v})} 
                              />
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-3.5 h-3.5 text-primary/40" />
                                <span className="text-xs font-bold text-primary">התראות ב-SMS</span>
                              </div>
                              <Switch 
                                checked={profileData.notification_sms} 
                                onCheckedChange={v => setProfileData({...profileData, notification_sms: v})} 
                              />
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-primary/40" />
                                <span className="text-xs font-bold text-primary">שיחה קולית אוטומטית</span>
                              </div>
                              <Switch 
                                checked={profileData.notification_voice} 
                                onCheckedChange={v => setProfileData({...profileData, notification_voice: v})} 
                              />
                           </div>
                        </div>
                      </div>
                   </div>

                   <div className="md:col-span-2 space-y-10">
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary/40">שם פרטי</Label><Input value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} className="h-12 rounded-xl font-bold" /></div>
                           <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary/40">שם משפחה</Label><Input value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} className="h-12 rounded-xl font-bold" /></div>
                        </div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary/40">טלפון</Label><Input value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="h-12 rounded-xl font-bold" dir="ltr" /></div>
                         <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary/40">כתובת</Label><Input value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} className="h-12 rounded-xl font-bold" /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-primary/40">אודותיך (יוצג ללקוח)</Label><Textarea value={profileData.notes} onChange={e => setProfileData({...profileData, notes: e.target.value})} className="rounded-2xl min-h-[100px] font-medium" placeholder="ספר ללקוחות על ההנהגה שלך..." /></div>
                      </div>

                      <div className="pt-8 border-t space-y-8">
                         <div className="flex items-center justify-between">
                            <h4 className="text-lg font-black text-primary flex items-center gap-2"><Building2 className="w-5 h-5 text-accent" /> פרטי עסק וחשבון (ללא אפשרות שינוי)</h4>
                            <Button asChild variant="link" className="text-accent font-black text-xs uppercase tracking-tighter gap-2">
                               <Link href="/contact">צור קשר לשינוי פרטים <ExternalLink className="w-3 h-3" /></Link>
                            </Button>
                         </div>

                         <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4 p-6 bg-muted/30 rounded-2xl border">
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">פרטי עסק רשמיים</p>
                               <div className="space-y-3">
                                  <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.business_name}</span><span className="text-[10px] font-black uppercase text-primary/40">שם עסק</span></div>
                                  <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.business_id}</span><span className="text-[10px] font-black uppercase text-primary/40">ח.פ / עוסק</span></div>
                                  <div className="flex justify-between"><span className="text-sm font-bold opacity-60">{seller?.business_type === 'osek_patur' ? 'עוסק פטור' : 'עוסק מורשה/חברה'}</span><span className="text-[10px] font-black uppercase text-primary/40">סוג</span></div>
                               </div>
                            </div>

                            <div className="space-y-4 p-6 bg-muted/30 rounded-2xl border">
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">פרטי חשבון בנק</p>
                               <div className="space-y-3">
                                  <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.bank_name}</span><span className="text-[10px] font-black uppercase text-primary/40">בנק</span></div>
                                  <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.bank_branch}</span><span className="text-[10px] font-black uppercase text-primary/40">סניף</span></div>
                                  <div className="flex justify-between"><span className="text-sm font-bold opacity-60">{seller?.bank_account_number}</span><span className="text-[10px] font-black uppercase text-primary/40">חשבון</span></div>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
                
                <div className="pt-10 flex justify-end">
                   <Button 
                    onClick={() => { 
                      setIsSavingProfile(true); 
                      updateDocumentNonBlocking(sellerRef!, profileData); 
                      setTimeout(() => { setIsSavingProfile(false); toast({ title: "הפרופיל עודכן" }); }, 800); 
                    }} 
                    className="rounded-full px-16 h-14 bg-primary text-white font-black shadow-xl hover:bg-primary/90 transition-all" 
                    disabled={isSavingProfile}
                   >
                     {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור שינויים'}
                   </Button>
                </div>
             </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-h-[95vh] flex flex-col" dir="rtl">
            <div className="bg-primary p-6 text-white text-right relative shrink-0">
              <div className="absolute top-4 left-6 flex gap-1.5">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={cn("h-1 rounded-full transition-all duration-500", formStep === s ? "w-8 bg-accent shadow-sm" : "w-2 bg-white/20")} />
                ))}
              </div>
              <DialogHeader>
                <DialogTitle className="text-xl font-headline font-black flex items-center gap-3">
                  <ClipboardList className="w-6 h-6 text-accent" />
                  {editingProduct ? 'עדכון מלאכת קודש' : 'פרסום מוצר חדש'}
                </DialogTitle>
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">
                  שלב {formStep} מתוך {totalFormSteps}
                </p>
              </DialogHeader>
            </div>

            <div className="p-5 md:p-10 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {formStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6 text-right">
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">סוג המוצר *</Label>
                        <div className="relative">
                           <Select value={formType} onValueChange={v => { setFormType(v); setFormSubType(''); setFormParchmentSize(''); setMegRows(''); setMegHeight(''); }} modal={false}>
                            <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5 bg-slate-50/50 focus:border-primary/20 text-right font-bold transition-all">
                              <SelectValue placeholder="בחר סוג כלי קודש..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl shadow-2xl">
                              <SelectItem value="מזוזה" className="font-bold py-3">מזוזה</SelectItem>
                              <SelectItem value="תפילין" className="font-bold py-3">תפילין</SelectItem>
                              <SelectItem value="מגילה" className="font-bold py-3">מגילה</SelectItem>
                              <SelectItem value="ספר תורה" className="font-bold py-3">ספר תורה</SelectItem>
                              <SelectItem value="מוצרי יודאיקה שונים" className="font-bold py-3">מוצר יודאיקה</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formType !== 'תפילין' && formType !== '' && (
                        <div className="space-y-3 animate-in slide-in-from-top-2">
                          <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">תת-סוג / דגם *</Label>
                          {PRODUCT_SUBTYPES[formType] ? (
                            <div className="grid grid-cols-2 gap-2">
                              {PRODUCT_SUBTYPES[formType].map(opt => (
                                <button 
                                  key={opt} 
                                  type="button" 
                                  onClick={() => setFormSubType(opt)} 
                                  className={cn(
                                    "px-4 py-3 rounded-xl border-2 text-xs font-black transition-all", 
                                    formSubType === opt ? "bg-primary text-white border-primary shadow-lg scale-[1.02]" : "bg-white border-primary/5 hover:border-accent/40"
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <Input 
                              value={formSubType} 
                              onChange={e => setFormSubType(e.target.value)} 
                              className="h-14 rounded-2xl border-2 border-primary/5 bg-slate-50/50" 
                              placeholder="למשל: סדר פיטום הקטורת..." 
                            />
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">תיאור והערות נוספות</Label>
                        <Textarea 
                          value={formDescription} 
                          onChange={e => setFormDescription(e.target.value)} 
                          placeholder="פרט על איכות הקלף, הדיו או רמת הכתיבה..."
                          className="rounded-2xl border-2 border-primary/5 bg-slate-50/50 min-h-[120px] text-sm font-medium" 
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {formStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-right">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">סוג כתב (מסורת) *</Label>
                        <Select value={formScript} onValueChange={v => { setFormScript(v); setFormParchmentSize(''); }} modal={false}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue placeholder="בחר מסורת..." /></SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl">
                            <SelectItem value="ספרדי" className="font-bold py-3">ספרדי</SelectItem>
                            <SelectItem value="אשכנזי - בית יוסף" className="font-bold py-3">אשכנזי - בית יוסף</SelectItem>
                            <SelectItem value="אשכנזי - האר''י" className="font-bold py-3">אשכנזי - האר"י</SelectItem>
                            <SelectItem value="אשכנזי - אדמו''ר הזקן" className="font-bold py-3">אשכנזי - אדמו"ר הזקן</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">רמת הידור *</Label>
                        <Select value={formQuality} onValueChange={setFormQuality} modal={false}>
                          <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue placeholder="בחר הידור..." /></SelectTrigger>
                          <SelectContent className="rounded-2xl shadow-xl">
                            <SelectItem value="כשר" className="font-bold py-3">כשר</SelectItem>
                            <SelectItem value="מהודר" className="font-bold py-3 text-accent">מהודר</SelectItem>
                            <SelectItem value="מהודר מאד" className="font-bold py-3 text-primary">מהודר מאד</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">רמת הגהה שבוצעה *</Label>
                       <Select value={formProofreading} onValueChange={setFormProofreading} modal={false}>
                         <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue placeholder="בחר רמת הגהה..." /></SelectTrigger>
                         <SelectContent className="rounded-2xl shadow-xl">
                           <SelectItem value="מחשב" className="font-bold py-3">מחשב בלבד</SelectItem>
                           <SelectItem value="גברא" className="font-bold py-3">גברא (אנושית) בלבד</SelectItem>
                           <SelectItem value="מחשב + גברא" className="font-bold py-3">מחשב + גברא (מומלץ)</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>

                    {formType === 'מגילה' ? (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black text-primary/40">מס' שורות *</Label>
                            <Select value={megRows} onValueChange={setMegRows} modal={false}>
                               <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue placeholder="שורות..." /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  {['11', '21', '28', '42'].map(r => <SelectItem key={r} value={r} className="font-bold">{r}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black text-primary/40">גובה קלף *</Label>
                            <Select value={megHeight} onValueChange={setMegHeight} modal={false}>
                               <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue placeholder="גובה (ס''מ)..." /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  {megRows === '11' ? (
                                    <>
                                      <SelectItem value={'8-10 ס"מ'} className="font-bold">{'8-10 ס"מ'}</SelectItem>
                                      <SelectItem value={'15-20 ס"מ'} className="font-bold">{'15-20 ס"מ'}</SelectItem>
                                    </>
                                  ) : (
                                    ['12', '15', '20', '25', '30', '35', '40', '45', '50'].map(h => <SelectItem key={h} value={`${h} ס"מ`} className="font-bold">{h} ס"מ</SelectItem>)
                                  )}
                               </SelectContent>
                            </Select>
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">גודל הקלף / בתים (ס"מ) *</Label>
                        <div className="relative">
                          <Input 
                            value={formParchmentSize} 
                            onChange={e => setFormParchmentSize(e.target.value)} 
                            className="h-14 rounded-2xl border-2 border-primary/5 bg-slate-50/50 pr-12 font-bold" 
                            placeholder="למשל: 12 או 32-34..."
                          />
                          <Maximize2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/20" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {formStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-right">
                    <div className="bg-emerald-50/50 p-6 rounded-3xl border-2 border-emerald-100/50 space-y-5 shadow-sm">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">מחיר למוכר (₪) *</Label>
                        <div className="relative">
                          <Input 
                            type="number" 
                            value={formPrice} 
                            onChange={e => setFormPrice(e.target.value)} 
                            className="h-16 rounded-2xl border-2 border-emerald-200/50 bg-white pr-14 text-2xl font-black text-emerald-600" 
                          />
                          <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-300" />
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                             <Info className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold">עמלת אתר (20%): ₪{(Number(formPrice) * 0.2).toFixed(0)}</span>
                          </div>
                          <div className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">
                            הרווח שלך: ₪{(Number(formPrice) * 0.8).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">כמות זמינה במלאי *</Label>
                        <div className="relative">
                          <Input 
                            type="number" 
                            value={formQuantity} 
                            onChange={e => setFormQuantity(Number(e.target.value))} 
                            className="h-14 rounded-2xl border-2 border-primary/5 bg-slate-50/50 pr-12 font-bold" 
                          />
                          <Package className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/20" />
                        </div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] font-black uppercase text-primary/40 tracking-wider">זמן אספקה (ימי עסקים) *</Label>
                         <Select value={formDeliveryTime} onValueChange={setFormDeliveryTime} modal={false}>
                           <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue /></SelectTrigger>
                           <SelectContent className="rounded-xl">
                             <SelectItem value="1" className="font-bold">יום אחד (מיידי)</SelectItem>
                             <SelectItem value="3" className="font-bold">עד 3 ימים</SelectItem>
                             <SelectItem value="7" className="font-bold">עד 7 ימים</SelectItem>
                             <SelectItem value="14" className="font-bold">עד 14 ימים</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                    </div>

                    <div className="space-y-4 p-5 rounded-[2rem] border-2 border-dashed border-primary/10">
                       <Label className="text-[10px] font-black uppercase text-primary/40">הגדרות משלוח ואיסוף</Label>
                       <RadioGroup value={formDeliveryType} onValueChange={setFormDeliveryType} className="grid grid-cols-2 gap-3">
                          <button 
                            type="button" 
                            onClick={() => setFormDeliveryType('pickup')} 
                            className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all", formDeliveryType === 'pickup' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white border-primary/5')}
                          >
                            <MapPin className="w-5 h-5" />
                            <span className="text-[10px] font-black">איסוף עצמי בלבד</span>
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setFormDeliveryType('shipping')} 
                            className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all", formDeliveryType === 'shipping' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white border-primary/5')}
                          >
                            <Truck className="w-5 h-5" />
                            <span className="text-[10px] font-black">משלוח עד הבית</span>
                          </button>
                       </RadioGroup>
                       
                       {formDeliveryType === 'shipping' && (
                          <div className="space-y-4 pt-2 animate-in slide-in-from-top-1">
                             <div className="space-y-1">
                               <Label className="text-[9px] font-black">עלות משלוח (₪)</Label>
                               <Input type="number" value={formDeliveryFee} onChange={e => setFormDeliveryFee(e.target.value)} className="h-10 rounded-xl" />
                             </div>
                             <div className="space-y-2">
                               <Label className="text-[9px] font-black">ערים לשירות משלוח</Label>
                               <p className="text-[9px] text-primary/40 font-medium leading-tight">בחר אחת או יותר מרשימת הערים. סמן "כל הארץ" לכיסוי מלא.</p>
                               {formDeliveryArea.length > 0 && !formDeliveryArea.includes('כל הארץ') && (
                                 <div className="flex flex-wrap gap-1.5 p-2 bg-primary/5 rounded-xl border border-primary/10 min-h-[40px]">
                                   {formDeliveryArea.map(city => (
                                     <span key={city} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-white text-[10px] font-black rounded-full">
                                       {city}
                                       <button type="button" aria-label={`הסר ${city}`} onClick={() => setFormDeliveryArea(prev => prev.filter(c => c !== city))} className="hover:text-accent transition-colors ml-0.5">×</button>
                                     </span>
                                   ))}
                                 </div>
                               )}
                               <Input
                                 value={citySearch}
                                 onChange={e => setCitySearch(e.target.value)}
                                 placeholder="חפש עיר..."
                                 className="h-10 rounded-xl text-sm"
                               />
                               <div className="max-h-44 overflow-y-auto border rounded-xl bg-white divide-y divide-primary/5">
                                 {ISRAEL_CITIES
                                   .filter(city => !citySearch || city.includes(citySearch))
                                   .map(city => {
                                     const isAllCountry = city === 'כל הארץ';
                                     const isChecked = formDeliveryArea.includes(city);
                                     return (
                                       <label key={city} className={cn("flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-primary/5 transition-colors", isChecked ? 'bg-primary/5' : '')}>
                                         <span className={cn("text-xs font-bold", isChecked ? 'text-primary' : 'text-primary/60')}>{city}</span>
                                         <input
                                           type="checkbox"
                                           checked={isChecked}
                                           onChange={e => {
                                             if (isAllCountry) {
                                               setFormDeliveryArea(e.target.checked ? ['כל הארץ'] : []);
                                             } else {
                                               if (e.target.checked) {
                                                 setFormDeliveryArea(prev => [...prev.filter(c => c !== 'כל הארץ'), city]);
                                               } else {
                                                 setFormDeliveryArea(prev => prev.filter(c => c !== city));
                                               }
                                             }
                                           }}
                                           className="w-4 h-4 accent-primary"
                                         />
                                       </label>
                                     );
                                   })
                                 }
                               </div>
                             </div>
                          </div>
                       )}
                    </div>
                  </motion.div>
                )}

                {formStep === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-right">
                    <div className="bg-primary/5 p-8 rounded-[2.5rem] border-2 border-dashed border-primary/10 text-center space-y-5">
                       <div className="space-y-2">
                          <Label className="text-xs font-black uppercase text-primary tracking-widest block">צילומי המוצר (עד 6) *</Label>
                          <p className="text-[10px] font-bold text-primary/40 leading-relaxed">חובה להעלות צילום תקריב של הכתב וצילום כללי של המוצר</p>
                       </div>

                       <div className="grid grid-cols-3 gap-3">
                         {formImages.map((img, i) => (
                           <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-premium group">
                             <Image src={img} alt="preview" fill className="object-cover" />
                             <button 
                               onClick={() => setFormImages(formImages.filter((_, idx) => idx !== i))} 
                               className="absolute inset-0 bg-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                             >
                               <Trash2 className="w-6 h-6" />
                             </button>
                           </div>
                         ))}
                         {formImages.length < 6 && (
                           <button 
                            type="button" 
                            onClick={() => document.getElementById('wizard-img-up')?.click()} 
                            className="aspect-square border-2 border-dashed border-primary/10 rounded-2xl flex flex-col items-center justify-center text-primary/30 hover:bg-white hover:border-accent/40 hover:text-accent transition-all bg-white/40"
                           >
                             <Camera className="w-8 h-8 mb-2" />
                             <span className="text-[10px] font-black uppercase">הוסף תמונה</span>
                           </button>
                         )}
                       </div>
                       <input id="wizard-img-up" type="file" onChange={(e) => handleImageUpload(e, 'product')} className="hidden" multiple accept="image/*" />
                    </div>
                    
                    <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-start gap-4">
                       <ShieldAlert className="w-6 h-6 text-orange-600 shrink-0" />
                       <div className="space-y-1">
                          <p className="text-[11px] font-black text-orange-900 leading-none">הצהרת כשרות ואחריות</p>
                          <p className="text-[10px] font-medium text-orange-800/70 leading-relaxed">
                            בלחיצה על פרסום, הנך מצהיר כי כלי הקודש נכתב בהתאם לכל כללי ההלכה, בטהרה, ועל קלף כשר כחוק.
                          </p>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-3 shrink-0">
              {formStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={() => setFormStep(s => s - 1)} 
                  className="flex-1 h-14 rounded-2xl border-primary/10 bg-white font-black text-xs uppercase"
                >
                  חזור
                </Button>
              )}
              {formStep < totalFormSteps ? (
                <Button 
                  onClick={() => setFormStep(s => s + 1)} 
                  className="flex-[2] bg-primary text-white h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] transition-transform"
                >
                  המשך לשלב הבא <ChevronLeft className="w-4 h-4 mr-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmitProduct} 
                  className="flex-[2] bg-accent text-primary h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-[1.02] transition-transform"
                >
                  <Sparkles className="w-4 h-4 ml-2" /> פרסם עכשיו באתר
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

function QuickStat({ label, value, icon, color, highlight = false }: any) {
  return (
    <Card className={cn("border-none shadow-premium rounded-[2rem] p-4 bg-white flex flex-col items-center justify-center text-center transition-all", highlight ? "ring-2 ring-primary/20" : "")}>
      <div className={cn("p-3 rounded-2xl shadow-sm mb-2", color)}>{icon}</div>
      <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">{label}</p>
      <p className="text-lg font-black text-primary tabular-nums">{value}</p>
    </Card>
  );
}

function Pagination({ current, total, onChange }: { current: number, total: number, onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-8 pb-4">
      <Button variant="outline" size="sm" onClick={() => onChange(current - 1)} disabled={current === 1} className="rounded-xl h-10 px-4 font-bold border-primary/10 bg-white"><ChevronRight className="w-4 h-4 ml-2" /> הקודם</Button>
      <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">עמוד {current} מתוך {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onChange(current + 1)} disabled={current === totalPages} className="rounded-xl h-10 px-4 font-bold border-primary/10 bg-white">הבא <ChevronLeft className="w-4 h-4 mr-2" /></Button>
    </div>
  );
}

function SellerChatListItem({ chat, otherUserId, userId }: any) {
  const db = useSupabaseClient();
  const otherUserRef = useMemoStable(() => (db && otherUserId) ? doc(db, 'customers', otherUserId) : null, [db, otherUserId]);
  const { data: otherUser } = useDoc<any>(otherUserRef);
  const isUnread = chat[`unread_${userId}`] === true;

  return (
    <Link href={`/chat/${otherUserId}`}>
      <Card className={cn("p-5 bg-white rounded-3xl shadow-premium hover:shadow-xl transition-all border border-transparent hover:border-accent/10", isUnread && "ring-2 ring-accent/20")}>
        <div className="flex items-center gap-5 text-right">
          <Avatar className="h-14 w-14 border-2 border-primary/5 shadow-sm relative">
            <AvatarImage src={otherUser?.profile_image} />
            <AvatarFallback className="bg-primary/5 text-primary font-black">{otherUser?.first_name?.charAt(0) || '?'}</AvatarFallback>
            {isUnread && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-destructive rounded-full border-2 border-white" />}
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-baseline">
              <h4 className="font-black text-primary text-base truncate">{otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'טוען...'}</h4>
              <span className="text-[9px] text-muted-foreground font-bold whitespace-nowrap bg-muted/30 px-2 py-0.5 rounded-full">{chat.last_message_at?.toDate ? chat.last_message_at.toDate().toLocaleDateString('he-IL') : ''}</span>
            </div>
            <p className={cn("text-xs truncate mt-1", isUnread ? "font-black text-primary" : "text-muted-foreground font-medium")}>{chat.last_message_text || 'תחילת שיחה'}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function SellerDashboard() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-6xl flex-1">
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
          <SellerDashboardContent />
        </Suspense>
      </main>
    </div>
  );
}
