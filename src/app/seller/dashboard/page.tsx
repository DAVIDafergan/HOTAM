
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
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
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
  ImageIcon,
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
import Image from '@/components/SmartImage';
import { 
  useUser, 
  useSupabaseClient, 
  useCollection, 
  useDoc,
  useMemoStable,
  updateDocumentNonBlocking
} from '@/lib/supabase-hooks';
import { collection, query, where, doc, increment } from '@/lib/supabase-compat';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { getCommissionRate, getSellerPayoutRate, resolveSellerNet } from '@/lib/commission';
import { cleanupImageAssetsViaApi, uploadImageViaApi } from '@/lib/image-upload';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { getCityFromAddressComponents, loadGoogleMapsPlacesScript } from '@/lib/google-maps';

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

const ITEMS_PER_PAGE = 6;
const SIGNUP_SCRIPT_TYPES = ['ספרדי', 'בית יוסף', 'האר"י', 'אדמו"ר הזקן'];
const SIGNUP_SCRIPT_LEVELS = ['כשר', 'מהודר', 'מהודר מאד'];

type ProductPublishValidationIssue = {
  title: string;
  description: string;
  step: number;
};

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
        setIsProductsLoading(false);
      });
  }, [canLoadData, user?.uid]);

  const products = (productsData || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const productTypeById = useMemo(
    () => new Map((products || []).map((product: any) => [product.id, product.product_type])),
    [products],
  );

  const ordersQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'orders'), where('seller_id', '==', user.uid));
  }, [db, user?.uid, canLoadData]);
  const { data: ordersData } = useCollection<any>(ordersQuery);
  const orders = (ordersData || []).filter((o: any) => o.status !== 'pending_payment').sort((a: any, b: any) => {
    const timeA = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
    const timeB = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
    return timeB - timeA;
  });

  const chatsQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
  }, [db, user?.uid, canLoadData]);
  const { data: chatsData } = useCollection<any>(chatsQuery);
  const chats = (chatsData || [])
    .filter((c: any) => c.participants && c.participants.length > 0)
    .sort((a: any, b: any) => {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : (a.last_message_at ? new Date(a.last_message_at).getTime() : 0);
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : (b.last_message_at ? new Date(b.last_message_at).getTime() : 0);
      return timeB - timeA;
    });

  const unreadCount = useMemo(() => {
    if (!user || !chats) return 0;
    return chats.filter((c: any) => c[`unread_${user.uid}`] === true).length;
  }, [chats, user?.uid]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const sellerCityInputRef = useRef<HTMLInputElement>(null);
  const sellerAddressInputRef = useRef<HTMLInputElement>(null);
  const formPickupAddressInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const writingSamplesInputRef = useRef<HTMLInputElement>(null);
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
  const [formPickupAddress, setFormPickupAddress] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [productPublishError, setProductPublishError] = useState<ProductPublishValidationIssue | null>(null);

  const [megRows, setMegRows] = useState('');
  const [megHeight, setMegHeight] = useState('');
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountReason, setDeleteAccountReason] = useState('');
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
        body: JSON.stringify({ reason: deleteAccountReason }),
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

  const [profileData, setProfileData] = useState({
    first_name: '', 
    last_name: '', 
    phone: '', 
    city: '',
    address: '', 
    age: '' as string | number,
    profile_image: '', 
    notes: '',
    notification_email: true,
    notification_sms: true,
    notification_voice: false,
    experience_years: '' as string | number,
    script_level: '',
    script_types: [] as string[],
    writing_samples: [] as string[],
    torah_study_frequency: '',
    mikveh_frequency: '',
    has_scribe_certificate: 'none',
    certificate_url: '',
    marital_status: '',
  });

  useEffect(() => {
    if (seller) {
      setProfileData({
        first_name: seller.first_name || '',
        last_name: seller.last_name || '',
        phone: seller.phone || '',
        city:
          seller.city ||
          (typeof seller.address === 'string' && seller.address.includes(',')
            ? seller.address.split(',').pop()?.trim() || ''
            : ''),
        address: seller.address || '',
        age: seller.age ?? '',
        profile_image: seller.profile_image || '',
        notes: seller.notes || '',
        notification_email: seller.notification_email ?? true,
        notification_sms: seller.notification_sms ?? true,
        notification_voice: seller.notification_voice ?? false,
        experience_years: seller.experience_years ?? '',
        script_level: seller.script_level === 'מהודר מאוד' ? 'מהודר מאד' : (seller.script_level || ''),
        script_types: Array.isArray(seller.script_types) ? seller.script_types : [],
        writing_samples: Array.isArray(seller.writing_samples) ? seller.writing_samples : [],
        torah_study_frequency: seller.torah_study_frequency || '',
        mikveh_frequency: seller.mikveh_frequency || '',
        has_scribe_certificate:
          seller.has_scribe_certificate === true
            ? 'valid'
            : seller.has_scribe_certificate === false
              ? 'none'
              : (seller.has_scribe_certificate || 'none'),
        certificate_url: seller.certificate_url || '',
        marital_status: seller.marital_status || '',
      });
    }
  }, [seller]);

  useEffect(() => {
    if (!sellerCityInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (cancelled || !sellerCityInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(sellerCityInputRef.current, {
          types: ['(cities)'],
          fields: ['name', 'formatted_address', 'address_components'],
          componentRestrictions: { country: 'il' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const city =
            getCityFromAddressComponents(place?.address_components) ||
            place?.name ||
            place?.formatted_address ||
            '';
          if (city) {
            setProfileData((prev) => ({ ...prev, city }));
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, []);

  useEffect(() => {
    if (!sellerAddressInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (cancelled || !sellerAddressInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(sellerAddressInputRef.current, {
          types: ['address'],
          fields: ['formatted_address', 'address_components'],
          componentRestrictions: { country: 'il' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            setProfileData((prev) => ({ ...prev, address: place.formatted_address }));
          }
          const city = getCityFromAddressComponents(place?.address_components);
          if (city) {
            setProfileData((prev) => ({ ...prev, city }));
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, []);

  // The pickup-address field only mounts inside the (dialog-gated, conditionally rendered)
  // product form, so re-attach whenever the dialog opens or the field becomes visible.
  useEffect(() => {
    if (!formPickupAddressInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (cancelled || !formPickupAddressInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(formPickupAddressInputRef.current, {
          types: ['address'],
          fields: ['formatted_address'],
          componentRestrictions: { country: 'il' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            setFormPickupAddress(place.formatted_address);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [isDialogOpen, formDeliveryType]);

  const sellerDefaultPickupAddress = useMemo(() => {
    const address = profileData.address || seller?.address || '';
    const city = profileData.city || seller?.city || '';
    return [address, city].filter(Boolean).join(', ');
  }, [profileData.address, profileData.city, seller?.address, seller?.city]);

  useEffect(() => {
    if ((formDeliveryType === 'pickup' || formDeliveryType === 'both') && !formPickupAddress) {
      setFormPickupAddress(sellerDefaultPickupAddress);
    }
  }, [formDeliveryType, formPickupAddress, sellerDefaultPickupAddress]);

  // Apply any pending seller profile that was saved in localStorage during onboarding
  // when email confirmation was required (the full profile couldn't be written to the
  // DB at registration time because no session existed yet).
  useEffect(() => {
    if (!canLoadData || !user || !seller || !db) return;
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem('pendingSellerProfile');
      if (!raw) return;
      console.info('[seller-dashboard] applying pendingSellerProfile cache');

      const { _pending_email, is_approved: _ignoredApproval, ...profileData } = JSON.parse(raw);

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
            console.info('[seller-dashboard] pendingSellerProfile cache applied');
            localStorage.removeItem('pendingSellerProfile');
            toast({ title: 'הפרופיל הושלם', description: 'כל הפרטים שהזנת בהרשמה נשמרו בהצלחה.' });
          }
        });
    } catch {
      localStorage.removeItem('pendingSellerProfile');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadData, user?.uid, seller?.email]);

  // Fallback: if the sellers row was never created (e.g. the DB trigger didn't fire,
  // or the app-provider flush failed), and the user has a pendingSellerProfile saved
  // in localStorage, call /api/register-seller now to create the row.
  useEffect(() => {
    if (!user || isUserLoading || isSellerLoading || seller) return;
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem('pendingSellerProfile');
    if (!raw) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem('pendingSellerProfile');
      return;
    }

    const pendingEmail = typeof parsed._pending_email === 'string'
      ? parsed._pending_email.trim().toLowerCase()
      : null;
    const userEmail = user.email?.trim().toLowerCase() ?? null;
    if (pendingEmail && userEmail && pendingEmail !== userEmail) {
      window.localStorage.removeItem('pendingSellerProfile');
      return;
    }

    (async () => {
      try {
        console.info('[seller-dashboard] running fallback seller recovery');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const { _pending_email: _ignored, is_approved: _ia, ...profileData } = parsed;
        const response = await fetch('/api/register-seller', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: user.uid, email: user.email, ...profileData }),
        });

        if (response.ok) {
          console.info('[seller-dashboard] fallback seller recovery succeeded');
          window.localStorage.removeItem('pendingSellerProfile');
          toast({ title: 'הפרופיל הושלם', description: 'כל הפרטים שהזנת בהרשמה נשמרו בהצלחה.' });
        }
      } catch (err) {
        console.error('[seller-dashboard] pendingSellerProfile fallback error:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isUserLoading, isSellerLoading, seller]);

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
    updateDocumentNonBlocking(doc(db, 'orders', order.id), {
      verified_by_seller: true,
      is_seen_by_seller: true
    });

    updateDocumentNonBlocking(doc(db, 'sellers', user!.uid), {
      sales_count: increment(1)
    });

    setTimeout(() => { setIsVerifying(null); toast({ title: "ההזמנה סומנה כמאומתת." }); }, 1000);
  };

  const [uploadProgress, setUploadProgress] = useState<{
    product: number | null;
    profile: number | null;
    certificate: number | null;
    samples: number | null;
  }>({ product: null, profile: null, certificate: null, samples: null });

  // Optimistic local previews (via URL.createObjectURL) so a picked photo renders instantly,
  // independent of upload/network timing — matches the pattern used in the onboarding wizard.
  const [productLocalPreviews, setProductLocalPreviews] = useState<string[]>([]);
  const [profileLocalPreview, setProfileLocalPreview] = useState<string | null>(null);
  const [certLocalPreview, setCertLocalPreview] = useState<string | null>(null);
  const [samplesLocalPreviews, setSamplesLocalPreviews] = useState<string[]>([]);

  const uploadImage = async (
    file: File,
    assetKind: 'product' | 'avatar' | 'certificate' | 'writing_sample',
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    return uploadImageViaApi(file, { client: db, assetKind, onProgress });
  };

  const cleanupImages = async (urls: string[]) => {
    await cleanupImageAssetsViaApi(urls, { client: db });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'profile') => {
    const files = e.target.files;
    if (!files) return;
    const allFiles = Array.from(files);

    if (target === 'product') {
      const remainingSlots = Math.max(0, 6 - formImages.length);
      const filesToUpload = allFiles.slice(0, remainingSlots);

      if (filesToUpload.length === 0) {
        toast({ variant: 'destructive', title: 'מקסימום תמונות', description: 'ניתן להעלות עד 6 תמונות.' });
        e.target.value = '';
        return;
      }

      const localUrls = filesToUpload.map((file) => URL.createObjectURL(file));
      setProductLocalPreviews(prev => [...prev, ...localUrls]);

      try {
        const fileProgresses = new Array(filesToUpload.length).fill(0);
        setUploadProgress(prev => ({ ...prev, product: 0 }));
        const uploadedUrls = await Promise.all(filesToUpload.map((file, idx) => uploadImage(file, 'product', (percent) => {
          fileProgresses[idx] = percent;
          const average = Math.round(fileProgresses.reduce((sum, p) => sum + p, 0) / fileProgresses.length);
          setUploadProgress(prev => ({ ...prev, product: average }));
        })));
        setFormImages(prev => [...prev, ...uploadedUrls]);

        if (allFiles.length > remainingSlots) {
          toast({ title: 'חלק מהקבצים לא הועלו', description: 'ניתן להעלות עד 6 תמונות לכל מוצר.' });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'העלאת התמונה נכשלה.';
        console.error('Product image upload error:', error);
        toast({ variant: 'destructive', title: 'שגיאת העלאה', description: message });
      } finally {
        e.target.value = '';
        setUploadProgress(prev => ({ ...prev, product: null }));
        localUrls.forEach((url) => URL.revokeObjectURL(url));
        setProductLocalPreviews(prev => prev.filter((url) => !localUrls.includes(url)));
      }
      return;
    }

    const firstFile = allFiles[0];
    if (!firstFile) {
      e.target.value = '';
      return;
    }

    const localUrl = URL.createObjectURL(firstFile);
    setProfileLocalPreview(localUrl);

    try {
      const previousProfileImage = profileData.profile_image;
      setUploadProgress(prev => ({ ...prev, profile: 0 }));
      const uploadedUrl = await uploadImage(firstFile, 'avatar', (percent) => {
        setUploadProgress(prev => ({ ...prev, profile: percent }));
      });
      setProfileData(prev => ({ ...prev, profile_image: uploadedUrl }));
      if (sellerRef) {
        updateDocumentNonBlocking(sellerRef, { profile_image: uploadedUrl });
        toast({ title: 'תמונת הפרופיל עודכנה', description: 'התמונה נשמרה בהצלחה.' });
      }
      if (previousProfileImage && previousProfileImage !== uploadedUrl) {
        void cleanupImages([previousProfileImage]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'העלאת תמונת הפרופיל נכשלה.';
      console.error('Profile image upload error:', error);
      toast({ variant: 'destructive', title: 'שגיאת העלאה', description: message });
    } finally {
      e.target.value = '';
      setUploadProgress(prev => ({ ...prev, profile: null }));
      URL.revokeObjectURL(localUrl);
      setProfileLocalPreview(null);
    }
  };

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setCertLocalPreview(localUrl);
    try {
      const previousCertificateUrl = profileData.certificate_url;
      setUploadProgress(prev => ({ ...prev, certificate: 0 }));
      const uploadedUrl = await uploadImage(file, 'certificate', (percent) => {
        setUploadProgress(prev => ({ ...prev, certificate: percent }));
      });
      setProfileData(prev => ({ ...prev, certificate_url: uploadedUrl }));
      toast({ title: 'התעודה הועלתה', description: 'צילום התעודה נשמר בהצלחה.' });
      if (previousCertificateUrl && previousCertificateUrl !== uploadedUrl) {
        void cleanupImages([previousCertificateUrl]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'העלאת התעודה נכשלה.';
      toast({ variant: 'destructive', title: 'שגיאת העלאה', description: message });
    } finally {
      e.target.value = '';
      setUploadProgress(prev => ({ ...prev, certificate: null }));
      URL.revokeObjectURL(localUrl);
      setCertLocalPreview(null);
    }
  };

  const handleWritingSamplesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const allFiles = Array.from(files);
    const remainingSlots = Math.max(0, 8 - profileData.writing_samples.length);
    const filesToUpload = allFiles.slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      toast({ variant: 'destructive', title: 'מקסימום דוגמאות', description: 'ניתן להעלות עד 8 דוגמאות כתיבה.' });
      e.target.value = '';
      return;
    }

    const localUrls = filesToUpload.map((file) => URL.createObjectURL(file));
    setSamplesLocalPreviews(prev => [...prev, ...localUrls]);

    try {
      const fileProgresses = new Array(filesToUpload.length).fill(0);
      setUploadProgress(prev => ({ ...prev, samples: 0 }));
      const uploadedUrls = await Promise.all(filesToUpload.map((file, idx) => uploadImage(file, 'writing_sample', (percent) => {
        fileProgresses[idx] = percent;
        const average = Math.round(fileProgresses.reduce((sum, p) => sum + p, 0) / fileProgresses.length);
        setUploadProgress(prev => ({ ...prev, samples: average }));
      })));
      setProfileData(prev => ({ ...prev, writing_samples: [...prev.writing_samples, ...uploadedUrls] }));
      if (allFiles.length > remainingSlots) {
        toast({ title: 'חלק מהקבצים לא הועלו', description: 'ניתן להעלות עד 8 דוגמאות כתיבה.' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'העלאת הדוגמאות נכשלה.';
      toast({ variant: 'destructive', title: 'שגיאת העלאה', description: message });
    } finally {
      e.target.value = '';
      setUploadProgress(prev => ({ ...prev, samples: null }));
      localUrls.forEach((url) => URL.revokeObjectURL(url));
      setSamplesLocalPreviews(prev => prev.filter((url) => !localUrls.includes(url)));
    }
  };

  const openEditDialog = (p: any) => {
    setProductPublishError(null);
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
    setFormPickupAddress(p.pickup_address || sellerDefaultPickupAddress);
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
    setProductPublishError(null);
    setEditingProduct(null);
    setFormType(''); setFormSubType(''); setFormDescription(''); setFormQuantity(1);
    setFormScript(''); setFormQuality(''); setFormPrice(''); setFormImages([]);
    setFormParchmentSize(''); setFormProofreading(''); setFormDeliveryTime('3');
    setFormDeliveryType('pickup'); setFormDeliveryFee(''); setFormDeliveryArea(['כל הארץ']);
    setFormPickupAddress(sellerDefaultPickupAddress);
    setCitySearch('');
    setMegRows(''); setMegHeight('');
    setFormStep(1);
  };

  useEffect(() => {
    if (!productPublishError) return;
    setProductPublishError(null);
  }, [
    formType,
    formSubType,
    formScript,
    formQuality,
    formProofreading,
    formParchmentSize,
    formPrice,
    formQuantity,
    formDeliveryTime,
    formDeliveryType,
    formPickupAddress,
    formDeliveryArea,
    formImages,
    megRows,
    megHeight,
    productPublishError,
  ]);

  const validateProductForm = (): ProductPublishValidationIssue | null => {
    if (!formType) return { title: "חסר סוג מוצר", description: "כדי לפרסם מוצר יש לבחור סוג מוצר.", step: 1 };
    if (formType !== 'תפילין' && !formSubType) return { title: "חסר תת-סוג", description: "כדי לפרסם מוצר יש לבחור תת-סוג או דגם.", step: 1 };
    if (!formScript) return { title: "חסר סוג כתב", description: "כדי לפרסם מוצר יש לבחור סוג כתב.", step: 2 };
    if (!formQuality) return { title: "חסרה רמת הידור", description: "כדי לפרסם מוצר יש לבחור רמת הידור.", step: 2 };
    if (!formProofreading) return { title: "חסרה רמת הגהה", description: "כדי לפרסם מוצר יש לבחור רמת הגהה שבוצעה.", step: 2 };
    if (formType === 'מגילה' && (!megRows || !megHeight)) return { title: "חסר גודל מגילה", description: "כדי לפרסם מגילה יש לבחור גם מספר שורות וגם גובה קלף.", step: 2 };
    if (formType !== 'מגילה' && !formParchmentSize.trim()) return { title: "חסר גודל קלף", description: "כדי לפרסם מוצר יש למלא גודל קלף או בתים.", step: 2 };
    if (formPrice === '' || Number(formPrice) <= 0) return { title: "מחיר לא תקין", description: "כדי לפרסם מוצר יש להזין מחיר גדול מ-0.", step: 3 };
    if (formQuantity < 1) return { title: "כמות לא תקינה", description: "כדי לפרסם מוצר יש להזין כמות של לפחות 1.", step: 3 };
    if (!formDeliveryTime) return { title: "חסר זמן אספקה", description: "כדי לפרסם מוצר יש לבחור זמן אספקה.", step: 3 };
    if (!formDeliveryType) return { title: "חסר סוג משלוח", description: "כדי לפרסם מוצר יש לבחור אפשרות איסוף/משלוח.", step: 3 };
    if ((formDeliveryType === 'pickup' || formDeliveryType === 'both') && !formPickupAddress.trim()) {
      return { title: "חסרה כתובת איסוף", description: "כדי לפרסם מוצר עם איסוף עצמי יש להזין כתובת לאיסוף.", step: 3 };
    }
    if (formDeliveryType !== 'pickup' && formDeliveryArea.length === 0) {
      return { title: "חסר אזור משלוח", description: "כדי לפרסם מוצר עם משלוח יש לבחור לפחות עיר אחת למשלוח.", step: 3 };
    }
    if (formImages.length === 0) return { title: "חסרה תמונה", description: "כדי לפרסם מוצר יש להעלות לפחות תמונה אחת.", step: 4 };
    return null;
  };

  const handleSubmitProduct = async () => {
    if (!user) return;
    if (!seller?.is_approved) {
      toast({
        variant: "destructive",
        title: "הפרופיל ממתין לאישור",
        description: "לא ניתן להעלות מוצרים לפני שהאדמין יאשר את הפרופיל שלך.",
      });
      return;
    }
    
    const validationIssue = validateProductForm();
    if (validationIssue) {
      setProductPublishError(validationIssue);
      setFormStep(validationIssue.step);
      toast({ variant: "destructive", title: validationIssue.title, description: validationIssue.description });
      return;
    }
    setProductPublishError(null);

    const finalSize = formType === 'מגילה' ? `${megRows} שורות, ${megHeight}` : formParchmentSize;

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
      pickup_address: formDeliveryType === 'shipping' ? '' : formPickupAddress.trim(),
      delivery_fee: formDeliveryType === 'pickup' ? 0 : Number(formDeliveryFee),
      delivery_area: formDeliveryArea,
    };

    if (editingProduct) {
      updateDocumentNonBlocking(doc(db, 'products', editingProduct.id), data);
      setProductsData(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
    } else {
      const { data: insertedProduct, error } = await supabase.from('products').insert([data]).select('*').single();
      if (error) {
        console.error("Supabase insert error:", error);
        toast({ variant: "destructive", title: "שגיאה בהוספת המוצר", description: error.message });
        return;
      }
      if (insertedProduct) {
        setProductsData(prev => [insertedProduct, ...prev]);
      }
    }
    
    setIsDialogOpen(false); 
    resetForm();
    toast({ title: "המוצר עודכן בהצלחה" });
  };

  const updateStock = (productId: string, diff: number) => {
    setProductsData(prev =>
      prev.map(p =>
        p.id === productId ? { ...p, quantity: Math.max(0, (p.quantity || 0) + diff) } : p
      )
    );
    updateDocumentNonBlocking(doc(db, 'products', productId), {
      quantity: increment(diff)
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user) return;
    if (!confirm('למחוק את המוצר לצמיתות?')) return;

    // Check for active orders before deleting
    const { count: activeOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .in('status', ['pending_payment', 'paid']);

    if (activeOrders && activeOrders > 0) {
      toast({
        variant: 'destructive',
        title: 'לא ניתן למחוק',
        description: `יש ${activeOrders} הזמנות פעילות על מוצר זה. סגור אותן קודם.`,
      });
      return;
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('seller_id', user.uid);

    if (error) {
      toast({ variant: 'destructive', title: 'מחיקת המוצר נכשלה', description: error.message });
      return;
    }

    const deletedProduct = productsData.find((item) => item.id === productId);
    setProductsData((prev) => prev.filter((item) => item.id !== productId));
    if (deletedProduct?.images?.length) {
      void cleanupImages(deletedProduct.images);
    }
    toast({ title: 'המוצר נמחק בהצלחה' });
  };

  const totalNetEarnings = useMemo(() => orders.filter(o => o.status === 'completed').reduce((acc: number, o: any) => acc + resolveSellerNet(o), 0), [orders]);

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

  // Show a waiting screen for sellers pending admin approval.
  // Do NOT redirect — they are legitimate sellers, just not yet approved.
  if (seller && seller.is_approved === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Navbar />
        <div className="mt-20 max-w-md">
          <div className="text-4xl mb-4">⏳</div>
          <h1 className="text-2xl font-black mb-2">הפרופיל שלך ממתין לאישור</h1>
          <p className="text-muted-foreground">
            קיבלנו את פרטיך והם נמצאים בבדיקה. נשלח אליך אימייל ברגע שהפרופיל יאושר.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            לשאלות: <a href="mailto:support@hotam.shop" className="underline">support@hotam.shop</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 md:gap-8">
      {/* ── Welcome Banner ────────────────────────────────────────────── */}
      <div className="rounded-[2rem] bg-gradient-to-l from-primary to-primary/80 text-white p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4 text-start">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20 overflow-hidden">
              {profileData.profile_image
                ? <Image src={profileData.profile_image} alt="profile" width={64} height={64} kind="avatar" sizes="64px" className="rounded-2xl object-cover w-full h-full" />
                : <UserRound className="w-8 h-8 text-white/70" />}
            </div>
            <div>
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-0.5">לוח בקרה</p>
              <h1 className="text-2xl md:text-3xl font-headline font-black tracking-tight">שלום, {seller?.first_name} 👋</h1>
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>סופר מאומת</span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            className="bg-accent text-primary hover:bg-accent/90 rounded-2xl px-6 h-12 font-black shadow-lg transition-all gap-2 shrink-0 w-full md:w-auto"
          >
            <Plus className="w-5 h-5" /> העלאת מוצר חדש
          </Button>
        </div>
      </div>

      {/* ── Quick Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <QuickStat label="יתרה למוכר" value={`₪${totalNetEarnings.toFixed(0)}`} icon={<Banknote className="w-4 h-4" />} color="bg-emerald-50 text-emerald-600" />
        <QuickStat label="מוצרים" value={String(products.length)} icon={<Package className="w-4 h-4" />} color="bg-blue-50 text-blue-600" />
        <QuickStat label="הודעות" value={String(unreadCount)} icon={<MessageSquare className="w-4 h-4" />} color="bg-purple-50 text-purple-600" highlight={unreadCount > 0} />
        <QuickStat label="סטטוס" value="פעיל" icon={<TrendingUp className="w-4 h-4" />} color="bg-orange-50 text-orange-600" />
      </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Desktop tab bar */}
          <TabsList className="hidden md:flex bg-white/60 backdrop-blur-md p-1.5 rounded-3xl shadow-premium h-16 border">
            {navItems.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="flex-1 rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-white gap-2 text-xs font-black uppercase transition-all">
                {item.icon}
                {item.label}
                {item.badge ? <Badge className="bg-destructive text-white border-none rounded-full px-1.5 py-0.5 text-[9px] ml-1">{item.badge}</Badge> : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile tab selector */}
          <div className="md:hidden">
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
              <SheetTrigger asChild>
                <button className="w-full flex items-center justify-between bg-white rounded-2xl shadow-premium border border-primary/5 px-5 h-14 font-black text-primary text-sm">
                  <div className="flex items-center gap-3">
                    {navItems.find(i => i.id === activeTab)?.icon}
                    <span>{navItems.find(i => i.id === activeTab)?.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && activeTab !== 'chats' && (
                      <Badge className="bg-destructive text-white border-none rounded-full px-2 py-0.5 text-[9px]">{unreadCount}</Badge>
                    )}
                    <ChevronDown className="w-4 h-4 text-primary/40" />
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0 border-none bg-white rounded-l-[2.5rem]">
                <SheetHeader className="sr-only">
                  <SheetTitle>תפריט ניהול סופר</SheetTitle>
                  <SheetDescription>מעבר בין מלאי, מכירות, הודעות והגדרות חשבון</SheetDescription>
                </SheetHeader>
                <div className="bg-gradient-to-b from-primary to-primary/80 p-8 text-white">
                  <h2 className="text-white font-headline font-black text-xl flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5 text-accent" /> ניהול סופר
                  </h2>
                  <p className="text-white/50 text-xs font-bold mt-1">{seller?.first_name} {seller?.last_name}</p>
                </div>
                <div className="p-4 space-y-2 mt-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setIsMobileNavOpen(false); }}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl transition-all font-black text-sm",
                        activeTab === item.id ? "bg-primary text-white shadow-lg" : "text-primary/60 hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-3">{item.icon}<span>{item.label}</span></div>
                      {item.badge
                        ? <Badge className="bg-destructive text-white border-none rounded-full px-2 py-0.5 text-[10px]">{item.badge}</Badge>
                        : <ChevronLeft className="w-4 h-4 opacity-30" />}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <TabsContent value="inventory" className="space-y-4">
             {products.length === 0 && <div className="py-24 text-center bg-white rounded-[2rem] border-2 border-dashed text-muted-foreground italic">אין מוצרים במלאי. לחץ על כפתור הפלוס להוספה.</div>}
             {paginatedProducts.map((p: any) => (
               <Card key={p.id} className="border-none shadow-premium rounded-[2rem] bg-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                 <div className="w-20 h-20 bg-muted rounded-2xl shrink-0 overflow-hidden relative border"><Image src={p.images?.[0] || logoImg} alt="product" fill className="object-cover" /></div>
                 <div className="flex-1 text-right w-full">
                    <p className="font-black text-lg text-primary">{p.product_type}</p>
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
                    <Button variant="outline" size="icon" onClick={() => handleDeleteProduct(p.id)} className="text-destructive rounded-full hover:bg-destructive hover:text-white transition-all"><Trash2 className="w-4 h-4" /></Button>
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
                   const orderProductName =
                     (typeof o.product_name === 'string' && o.product_name.trim()) ||
                     productTypeById.get(o.product_id) ||
                     'מוצר קודש';
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
                               <p className="font-black text-primary text-base leading-tight group-hover:text-accent transition-colors">{orderProductName}</p>
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
                                    <h3 className="text-2xl font-headline font-black text-primary">מתעניינים בספר תורה שלך!</h3>
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
                                       <h4 className="font-black text-xs uppercase text-primary/60 flex items-center justify-end gap-2">פרטי לקוח למשלוח <Truck className="w-4 h-4" /></h4>
                                       <div className="bg-white p-6 rounded-[2rem] border border-primary/5 space-y-3 shadow-sm">
                                          <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{o.buyer_name}</span><span className="text-[10px] text-muted-foreground font-black">שם מלא</span></div>
                                          <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{o.buyer_phone}</span><span className="text-[10px] text-muted-foreground font-black">טלפון</span></div>
                                          <div className="flex justify-between items-center"><span className="text-sm font-bold text-primary">{o.buyer_address}</span><span className="text-[10px] text-muted-foreground font-black">כתובת</span></div>
                                       </div>
                                    </div>
                                    <div className="space-y-4">
                                       <h4 className="font-black text-xs uppercase text-primary/60 flex items-center justify-end gap-2">אישור מסירה <ShieldCheck className="w-4 h-4" /></h4>
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
                                          <p className="text-xl font-black text-emerald-600">₪{resolveSellerNet(o).toFixed(0)}</p>
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
                <div className="flex items-center justify-between border-b pb-6 mb-10"><h2 className="text-2xl font-black text-primary">הגדרות ופרופיל אישי</h2><Settings className="w-6 h-6 text-accent" /></div>
                
                <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                   <div className="space-y-8">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-accent/20 bg-muted flex items-center justify-center">
                          {profileLocalPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profileLocalPreview} alt="profile" className="absolute inset-0 h-full w-full object-cover" />
                          ) : profileData.profile_image ? (
                            <Image src={profileData.profile_image} alt="profile" fill kind="avatar" sizes="128px" className="object-cover" />
                          ) : (
                            <UserRound className="w-12 h-12 text-primary/10" />
                          )}
                          {uploadProgress.profile !== null ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10 bg-black/45">
                              <Loader2 className="w-5 h-5 text-white animate-spin" />
                              <span className="text-[9px] font-black text-white">{uploadProgress.profile}%</span>
                            </div>
                          ) : (
                            <button onClick={() => document.getElementById('profile-img-up')?.click()} className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera className="w-6 h-6" /></button>
                          )}
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
                        <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Settings className="w-4 h-4 text-accent" /> התראות על הזמנות
                        </h3>
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <Mail className="w-3.5 h-3.5 text-primary/60" />
                                <span className="text-xs font-bold text-primary">התראות במייל</span>
                              </div>
                              <Switch 
                                checked={profileData.notification_email} 
                                onCheckedChange={v => setProfileData({...profileData, notification_email: v})} 
                              />
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <Smartphone className="w-3.5 h-3.5 text-primary/60" />
                                <span className="text-xs font-bold text-primary">התראות ב-SMS</span>
                              </div>
                              <Switch 
                                checked={profileData.notification_sms} 
                                onCheckedChange={v => setProfileData({...profileData, notification_sms: v})} 
                              />
                           </div>
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <Phone className="w-3.5 h-3.5 text-primary/60" />
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
                      <div className="space-y-8">
                        <h3 className="text-lg font-black text-primary flex items-center gap-2"><UserRound className="w-5 h-5 text-accent" /> פרטים אישיים</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>שם פרטי *</Label><Input value={profileData.first_name} onChange={e => setProfileData({...profileData, first_name: e.target.value})} className="text-slate-900 rounded-xl h-12" /></div>
                          <div className="space-y-2"><Label>שם משפחה *</Label><Input value={profileData.last_name} onChange={e => setProfileData({...profileData, last_name: e.target.value})} className="text-slate-900 rounded-xl h-12" /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>טלפון *</Label><Input type="tel" inputMode="tel" autoComplete="tel" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="text-slate-900 rounded-xl h-12" dir="ltr" /></div>
                          <div className="space-y-2"><Label>גיל *</Label><Input type="number" min={0} value={profileData.age === '' ? '' : String(profileData.age)} onChange={e => setProfileData({...profileData, age: e.target.value === '' ? '' : Number(e.target.value)})} className="text-slate-900 rounded-xl h-12" /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>עיר *</Label><Input ref={sellerCityInputRef} value={profileData.city} onChange={e => setProfileData({...profileData, city: e.target.value})} className="text-slate-900 rounded-xl h-12" /></div>
                          <div className="space-y-2"><Label>כתובת *</Label><Input ref={sellerAddressInputRef} value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} className="text-slate-900 rounded-xl h-12" /></div>
                        </div>
                      </div>

                      <div className="pt-8 border-t space-y-8">
                        <h3 className="text-lg font-black text-primary flex items-center gap-2"><Scroll className="w-5 h-5 text-accent" /> פרטי הסופר</h3>
                        <div className="space-y-4 text-right">
                          <Label className="font-bold block mb-2">הסמכת סופר סת''ם *</Label>
                          <RadioGroup value={profileData.has_scribe_certificate} onValueChange={v => setProfileData({...profileData, has_scribe_certificate: v})} className="grid gap-2">
                            {[
                              { value: 'valid', id: 'settings-v1', label: 'תעודה בתוקף' },
                              { value: 'expired', id: 'settings-v2', label: 'הייתה תעודה בעבר' },
                              { value: 'none', id: 'settings-v3', label: 'ללא תעודה' },
                            ].map((opt) => (
                              <div
                                key={opt.id}
                                className={cn(
                                  "flex min-h-[56px] items-center space-x-reverse space-x-3 p-4 border rounded-2xl transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                                  profileData.has_scribe_certificate === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60'
                                )}
                                onClick={() => setProfileData({...profileData, has_scribe_certificate: opt.value})}
                              >
                                <RadioGroupItem value={opt.value} id={opt.id} />
                                <Label htmlFor={opt.id} className="flex-1 cursor-pointer font-bold">{opt.label}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                          {(profileData.has_scribe_certificate === 'valid' || profileData.has_scribe_certificate === 'expired') && (
                            <div className="mt-4 p-6 bg-accent/5 rounded-2xl border-2 border-dashed border-accent/20 text-center space-y-4">
                              {(profileData.certificate_url || certLocalPreview) ? (
                                <div className="relative w-full h-40 rounded-xl overflow-hidden border bg-white shadow-sm">
                                  {profileData.certificate_url ? (
                                    <Image src={profileData.certificate_url} alt="Cert" fill kind="certificate" sizes="(max-width: 768px) 100vw, 720px" className="object-contain" />
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={certLocalPreview!} alt="Cert" className="absolute inset-0 h-full w-full object-contain" />
                                  )}
                                  {uploadProgress.certificate !== null ? (
                                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 px-8">
                                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                                      <Progress value={uploadProgress.certificate} className="h-1.5 w-full max-w-[180px]" />
                                      <span className="text-[10px] font-black text-white uppercase tracking-widest">מעלה תעודה... {uploadProgress.certificate}%</span>
                                    </div>
                                  ) : (
                                    <button onClick={() => { void cleanupImages(profileData.certificate_url ? [profileData.certificate_url] : []); setProfileData({...profileData, certificate_url: ''}); }} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X className="w-4 h-4" /></button>
                                  )}
                                </div>
                              ) : (
                                <div onClick={() => certInputRef.current?.click()} className="cursor-pointer py-10 flex flex-col items-center text-accent hover:opacity-80 transition-opacity">
                                  <div className="flex gap-4 mb-2">
                                    <ImageIcon className="w-10 h-10" />
                                    <Camera className="w-10 h-10" />
                                  </div>
                                  <span className="font-black text-xs uppercase tracking-widest">לחץ להעלאת צילום התעודה</span>
                                </div>
                              )}
                              <input type="file" ref={certInputRef} onChange={handleCertificateUpload} className="hidden" accept="image/*" />
                            </div>
                          )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <Label className="font-bold">לימוד תורה קבוע *</Label>
                            <RadioGroup value={profileData.torah_study_frequency} onValueChange={v => setProfileData({...profileData, torah_study_frequency: v})} className="flex flex-col gap-2">
                              {[
                                { value: 'fixed', id: 'settings-t1', label: 'קובע עיתים' },
                                { value: 'half-day', id: 'settings-t2', label: 'אברך חצי יום' },
                                { value: 'full-day', id: 'settings-t3', label: 'אברך יום שלם' },
                              ].map((opt) => (
                                <div
                                  key={opt.id}
                                  className={cn(
                                    "flex min-h-[48px] items-center space-x-reverse space-x-3 rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                                    profileData.torah_study_frequency === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60 bg-white'
                                  )}
                                  onClick={() => setProfileData({...profileData, torah_study_frequency: opt.value})}
                                >
                                  <RadioGroupItem value={opt.value} id={opt.id} />
                                  <Label htmlFor={opt.id} className="flex-1 text-xs cursor-pointer">{opt.label}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>

                          <div className="space-y-4">
                            <Label className="font-bold">מנהג טבילה *</Label>
                            <RadioGroup value={profileData.mikveh_frequency} onValueChange={v => setProfileData({...profileData, mikveh_frequency: v})} className="flex flex-col gap-2">
                              {[
                                { value: 'ezra', id: 'settings-m1', label: 'טבילת עזרא' },
                                { value: 'before', id: 'settings-m2', label: 'לפני כתיבה' },
                                { value: 'daily', id: 'settings-m3', label: 'כל יום' },
                                { value: 'never', id: 'settings-m4', label: 'לא טובל בכלל' },
                              ].map((opt) => (
                                <div
                                  key={opt.id}
                                  className={cn(
                                    "flex min-h-[48px] items-center space-x-reverse space-x-3 rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                                    profileData.mikveh_frequency === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60 bg-white'
                                  )}
                                  onClick={() => setProfileData({...profileData, mikveh_frequency: opt.value})}
                                >
                                  <RadioGroupItem value={opt.value} id={opt.id} />
                                  <Label htmlFor={opt.id} className="flex-1 text-xs cursor-pointer">{opt.label}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="font-bold">פרט על ההסמכה ואורח החיים הרוחני שלך *</Label>
                          <Textarea placeholder="למדתי אצל הרב..., אני נוהג לטבול ב..., סדר היום שלי כולל..." value={profileData.notes} onChange={e => setProfileData({...profileData, notes: e.target.value})} className="text-slate-900 rounded-2xl min-h-[120px]" />
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <Label className="font-bold">שנות ניסיון במלאכת הקודש *</Label>
                            <Input type="number" min={0} value={profileData.experience_years === '' ? '' : String(profileData.experience_years)} onChange={e => setProfileData({...profileData, experience_years: e.target.value === '' ? '' : Number(e.target.value)})} className="text-slate-900 rounded-xl h-11" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-bold">רמת הידור ממוצעת *</Label>
                            <RadioGroup value={profileData.script_level} onValueChange={v => setProfileData({...profileData, script_level: v})} className="grid grid-cols-2 gap-2 mt-2">
                              {SIGNUP_SCRIPT_LEVELS.map((level) => (
                                <div
                                  key={level}
                                  className={cn(
                                    "flex min-h-[48px] items-center space-x-reverse space-x-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                                    profileData.script_level === level ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60 bg-white'
                                  )}
                                  onClick={() => setProfileData({...profileData, script_level: level})}
                                >
                                  <RadioGroupItem value={level} id={`settings-level-${level}`} />
                                  <Label htmlFor={`settings-level-${level}`} className="flex-1 text-xs cursor-pointer">{level}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Label className="font-bold">סוגי כתב שהנך כותב (בחר את כולם) *</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {SIGNUP_SCRIPT_TYPES.map(type => {
                              const toggleThisType = () => {
                                const exists = profileData.script_types.includes(type);
                                const updated = exists
                                  ? profileData.script_types.filter(t => t !== type)
                                  : [...profileData.script_types, type];
                                setProfileData({...profileData, script_types: updated});
                              };
                              return (
                                <div
                                  key={type}
                                  className={cn(
                                    "flex min-h-[48px] items-center space-x-reverse space-x-2 p-3 border rounded-xl transition-all duration-200 cursor-pointer hover:border-primary/40 active:scale-[0.98]",
                                    profileData.script_types.includes(type) ? 'bg-primary/5 border-primary ring-2 ring-primary/5' : 'bg-white border-input/60 hover:bg-primary/5'
                                  )}
                                  onClick={toggleThisType}
                                >
                                  <Checkbox
                                    id={`settings-script-${type}`}
                                    checked={profileData.script_types.includes(type)}
                                    onCheckedChange={toggleThisType}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Label htmlFor={`settings-script-${type}`} className="flex-1 cursor-pointer text-xs font-bold" onClick={(e) => e.stopPropagation()}>{type}</Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="font-bold">דוגמאות כתיבה חיות (מינימום 2) *</Label>
                            <span className="text-[10px] text-muted-foreground font-bold">העלה צילומים ברורים של כתב ידך</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {profileData.writing_samples.map((img, idx) => (
                              <div key={`${img}-${idx}`} className="relative aspect-square rounded-2xl overflow-hidden border shadow-sm group">
                                <Image src={img} alt="Sample" fill kind="writing_sample" sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                                <button onClick={() => { const targetUrl = profileData.writing_samples[idx]; void cleanupImages(targetUrl ? [targetUrl] : []); setProfileData({...profileData, writing_samples: profileData.writing_samples.filter((_, i) => i !== idx)}); }} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                              </div>
                            ))}
                            {samplesLocalPreviews.map((localUrl, idx) => (
                              <div key={`local-${idx}`} className="relative aspect-square rounded-2xl overflow-hidden border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={localUrl} alt="מעלה דוגמה" className="absolute inset-0 h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2 px-3">
                                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                                  <Progress value={uploadProgress.samples ?? 0} className="h-1 w-full" />
                                  <span className="text-[9px] font-black text-white">{uploadProgress.samples ?? 0}%</span>
                                </div>
                              </div>
                            ))}
                            {profileData.writing_samples.length < 8 && samplesLocalPreviews.length === 0 && (
                              <button onClick={() => writingSamplesInputRef.current?.click()} className="aspect-square border-2 border-dashed border-primary/10 rounded-2xl flex flex-col items-center justify-center text-primary/30 hover:bg-primary/5 transition-all">
                                <ImageIcon className="w-6 h-6 mb-1" />
                                <span className="text-[9px] font-black uppercase">הוסף דוגמה</span>
                              </button>
                            )}
                          </div>
                          <input type="file" ref={writingSamplesInputRef} onChange={handleWritingSamplesUpload} className="hidden" multiple accept="image/*" />
                        </div>
                      </div>

                      <div className="pt-8 border-t space-y-8">
                         <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-primary flex items-center gap-2"><Building2 className="w-5 h-5 text-accent" /> פרטי עסק וחשבון (ללא אפשרות שינוי)</h3>
                            <Button asChild variant="link" className="text-accent font-black text-xs uppercase tracking-tighter gap-2">
                               <Link href="/contact">צור קשר לשינוי פרטים <ExternalLink className="w-3 h-3" /></Link>
                            </Button>
                         </div>

                         <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4 p-6 bg-muted/30 rounded-2xl border">
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">פרטי עסק רשמיים</p>
                               <div className="space-y-3">
                                   <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.business_name}</span><span className="text-[10px] font-black uppercase text-primary/60">שם עסק</span></div>
                                   <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.business_id}</span><span className="text-[10px] font-black uppercase text-primary/60">ח.פ / עוסק</span></div>
                                   <div className="flex justify-between"><span className="text-sm font-bold opacity-60">{seller?.business_type === 'osek_patur' ? 'עוסק פטור' : 'עוסק מורשה/חברה'}</span><span className="text-[10px] font-black uppercase text-primary/60">סוג</span></div>
                               </div>
                            </div>

                            <div className="space-y-4 p-6 bg-muted/30 rounded-2xl border">
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">פרטי חשבון בנק</p>
                               <div className="space-y-3">
                                   <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.bank_name}</span><span className="text-[10px] font-black uppercase text-primary/60">בנק</span></div>
                                   <div className="flex justify-between border-b pb-2"><span className="text-sm font-bold opacity-60">{seller?.bank_branch}</span><span className="text-[10px] font-black uppercase text-primary/60">סניף</span></div>
                                   <div className="flex justify-between"><span className="text-sm font-bold opacity-60">{seller?.bank_account_number}</span><span className="text-[10px] font-black uppercase text-primary/60">חשבון</span></div>
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
                <div className="pt-6 border-t mt-6">
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between gap-4">
                    <div className="text-right">
                      <p className="text-sm font-black text-red-700">מחיקת חשבון</p>
                      <p className="text-[11px] text-red-500 font-medium mt-0.5">פעולה זו בלתי הפיכה — כל הנתונים והמודעות שלך יימחקו לצמיתות</p>
                    </div>
                    <Button variant="destructive" onClick={() => setIsDeleteAccountDialogOpen(true)} className="rounded-full gap-2 shrink-0">
                      <Trash2 className="w-4 h-4" /> מחק חשבון
                    </Button>
                  </div>
                </div>
             </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDeleteAccountDialogOpen} onOpenChange={setIsDeleteAccountDialogOpen}>
          <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl max-w-md bg-white text-slate-900" dir="rtl">
            <div className="bg-red-600 p-8 text-white text-right">
              <DialogTitle className="text-2xl font-headline font-black">מחיקת חשבון</DialogTitle>
              <DialogDescription className="text-white/70 mt-1">פעולה זו בלתי הפיכה. כל הנתונים והמודעות שלך יימחקו לצמיתות.</DialogDescription>
            </div>
            <div className="p-8 space-y-5 text-right">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/50">למה אתה רוצה למחוק את החשבון? (אופציונלי)</Label>
                <Textarea
                  placeholder="ספר לנו את הסיבה..."
                  value={deleteAccountReason}
                  onChange={(e) => setDeleteAccountReason(e.target.value)}
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
              <Button variant="ghost" onClick={() => setIsDeleteAccountDialogOpen(false)} disabled={isDeletingAccount} className="h-12 font-bold">
                ביטול
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setProductPublishError(null); }}>
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
                           <Select value={formType} onValueChange={v => { setFormType(v); setFormSubType(''); setFormParchmentSize(''); setMegRows(''); setMegHeight(''); }}>
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
                        <Select value={formScript} onValueChange={v => { setFormScript(v); setFormParchmentSize(''); }}>
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
                        <Select value={formQuality} onValueChange={setFormQuality}>
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
                       <Select value={formProofreading} onValueChange={setFormProofreading}>
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
                            <Select value={megRows} onValueChange={setMegRows}>
                               <SelectTrigger className="h-14 rounded-2xl border-2 border-primary/5"><SelectValue placeholder="שורות..." /></SelectTrigger>
                               <SelectContent className="rounded-xl">
                                  {['11', '21', '28', '42'].map(r => <SelectItem key={r} value={r} className="font-bold">{r}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black text-primary/40">גובה קלף *</Label>
                            <Select value={megHeight} onValueChange={setMegHeight}>
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
                             <span className="text-[10px] font-bold">עמלת אתר ({(getCommissionRate(formType) * 100).toFixed(0)}%): ₪{formPrice !== '' ? (Number(formPrice) * getCommissionRate(formType)).toFixed(0) : '---'}</span>
                          </div>
                          <div className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">
                            הרווח שלך: ₪{formPrice !== '' ? (Number(formPrice) * getSellerPayoutRate(formType)).toFixed(0) : '---'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-1">
                          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-700">
                            המחיר שיוצג ללקוחות באתר כולל מע&quot;מ 18%:{' '}
                            <span className="text-amber-900">₪{formPrice !== '' ? (Number(formPrice) * 1.18).toFixed(0) : '---'}</span>
                          </span>
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
                         <Select value={formDeliveryTime} onValueChange={setFormDeliveryTime}>
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
                       <RadioGroup value={formDeliveryType} onValueChange={setFormDeliveryType} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                           <button 
                             type="button" 
                             onClick={() => setFormDeliveryType('both')} 
                             className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all", formDeliveryType === 'both' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white border-primary/5')}
                           >
                             <div className="flex items-center gap-1">
                               <MapPin className="w-4 h-4" />
                               <Truck className="w-4 h-4" />
                             </div>
                             <span className="text-[10px] font-black">איסוף + משלוח</span>
                           </button>
                        </RadioGroup>
                        
                        {(formDeliveryType === 'shipping' || formDeliveryType === 'both') && (
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
                        {(formDeliveryType === 'pickup' || formDeliveryType === 'both') && (
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black">כתובת לאיסוף עצמי *</Label>
                            <Input
                              ref={formPickupAddressInputRef}
                              value={formPickupAddress}
                              onChange={e => setFormPickupAddress(e.target.value)}
                              placeholder="ברירת מחדל: הכתובת שלך בפרופיל"
                              className="h-10 rounded-xl text-sm"
                            />
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
                             <Image src={img} alt="preview" fill kind="product" sizes="(max-width: 640px) 33vw, 20vw" className="object-cover" />
                             <button 
                               onClick={() => { const targetUrl = formImages[i]; void cleanupImages(targetUrl ? [targetUrl] : []); setFormImages(formImages.filter((_, idx) => idx !== i)); }} 
                               className="absolute inset-0 bg-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                             >
                               <Trash2 className="w-6 h-6" />
                             </button>
                           </div>
                         ))}
                         {productLocalPreviews.map((localUrl, idx) => (
                           <div key={`local-${idx}`} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white">
                             {/* eslint-disable-next-line @next/next/no-img-element */}
                             <img src={localUrl} alt="מעלה תמונה" className="absolute inset-0 h-full w-full object-cover" />
                             <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2 px-3">
                               <Loader2 className="w-5 h-5 text-white animate-spin" />
                               <Progress value={uploadProgress.product ?? 0} className="h-1 w-full" />
                               <span className="text-[9px] font-black text-white">{uploadProgress.product ?? 0}%</span>
                             </div>
                           </div>
                         ))}
                         {formImages.length < 6 && productLocalPreviews.length === 0 && (
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

            <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col gap-3 shrink-0 sm:flex-row">
              {productPublishError && (
                <div className="w-full rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-right flex items-start gap-2 sm:order-last">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-destructive">{productPublishError.title}</p>
                    <p className="text-[11px] font-medium text-destructive/90">{productPublishError.description}</p>
                  </div>
                </div>
              )}
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
    <Card className={cn("group border-none shadow-premium rounded-[2rem] p-4 bg-white flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl", highlight ? "ring-2 ring-primary/20" : "")}>
      <div className={cn("p-3 rounded-2xl shadow-sm mb-2 transition-transform duration-300 group-hover:scale-110", color)}>{icon}</div>
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
              <p className="font-black text-primary text-base truncate">{otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'טוען...'}</p>
              <span className="text-[9px] text-muted-foreground font-bold whitespace-nowrap bg-muted/30 px-2 py-0.5 rounded-full">{chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString('he-IL') : ''}</span>
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
