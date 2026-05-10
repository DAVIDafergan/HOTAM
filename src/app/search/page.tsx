
"use client";

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Search as SearchIcon, 
  RotateCcw,
  SlidersHorizontal,
  BookOpen,
  Palette,
  Scroll,
  Package,
  Crown,
  Loader2,
  Waves,
  ShieldCheck,
  UserCheck,
  Truck,
  ChevronRight,
  ChevronLeft,
  ArrowDownNarrowWide,
  Settings2,
  MapPin,
  LocateFixed,
  ArrowUpNarrowWide,
  Star,
  Shield,
  GraduationCap,
  Info,
  CheckCircle2
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSupabaseClient, useCollection, useMemoStable } from '@/lib/supabase-hooks';
import { collection, query, where } from '@/lib/supabase-compat';
import { ProductCard } from '@/components/ProductCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';
import { reverseGeocodeWithGoogle } from '@/lib/google-maps';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';
type ShippingPreference = 'all' | 'shipping' | 'pickup';

const ISRAEL_REGIONS = [
  "ירושלים והסביבה", "תל אביב וגוש דן", "חיפה והצפון", "באר שבע והדרום", "בני ברק והמרכז", "השרון", "יהודה ושומרון"
];
const HEBREW_ARTICLE_PREFIX = /^ה/;
const HEBREW_CITY_PREFIX = /^עיר\s+/;
const CITY_MATCH_SEPARATORS = [' ', '-'];
const UNKNOWN_CITY_LABEL = 'עיר לא ידועה';
const CITY_ALIAS_PAIRS = [
  ['raanana', 'רעננה'],
  ['tel aviv', 'תל אביב'],
  ['tel aviv', 'תל אביב-יפו'],
  ['jerusalem', 'ירושלים'],
  ['haifa', 'חיפה'],
] as const;
const normalizeCity = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const REGION_CITY_MAP: Record<string, string[]> = {
  'השרון': ['נתניה', 'הרצליה', 'רעננה', 'כפר סבא', 'הוד השרון', 'רמת השרון', 'פרדסיה', 'קדימה', 'אבן יהודה'],
  'תל אביב וגוש דן': ['תל אביב', 'תל אביב-יפו', 'רמת גן', 'גבעתיים', 'חולון', 'בת ים', 'בני ברק', 'פתח תקווה'],
  'ירושלים והסביבה': ['ירושלים', 'בית שמש', 'מעלה אדומים'],
  'חיפה והצפון': ['חיפה', 'נהריה', 'עכו', 'קריות', 'טבריה', 'צפת', 'כרמיאל'],
  'באר שבע והדרום': ['באר שבע', 'אשקלון', 'אשדוד', 'אילת', 'דימונה', 'אופקים', 'ירוחם'],
  'בני ברק והמרכז': ['בני ברק', 'ראשון לציון', 'רחובות', 'רמלה', 'לוד', 'מודיעין'],
  'יהודה ושומרון': ['אריאל', 'מעלה אדומים', 'ביתר עילית', 'מודיעין עילית'],
};
const NORMALIZED_REGION_CITY_MAP: Record<string, string[]> = Object.fromEntries(
  Object.entries(REGION_CITY_MAP).map(([region, cities]) => [region, cities.map(normalizeCity)]),
);
const CITY_ALIASES: Record<string, string[]> = CITY_ALIAS_PAIRS.reduce((acc, [a, b]) => {
  const left = normalizeCity(a);
  const right = normalizeCity(b);
  acc[left] = Array.from(new Set([...(acc[left] || []), right]));
  acc[right] = Array.from(new Set([...(acc[right] || []), left]));
  return acc;
}, {} as Record<string, string[]>);

function SearchContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [step, setStep] = useState(1);
  const [shippingPreference, setShippingPreference] = useState<ShippingPreference>('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const searchParams = useSearchParams();
  const db = useSupabaseClient();
  
  const isViewingAll = searchParams.get('view') === 'all';

  // Filter States
  const [selectedProduct, setSelectedProduct] = useState<ProductType>('');
  const [subType, setSubType] = useState('all');
  const [scriptType, setScriptType] = useState('all');
  const [qualityLevel, setQualityLevel] = useState('all');
  const [quantity, setQuantity] = useState(1);
  
  // Advanced Filter States
  const [scrollSize, setScrollSize] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [marriedOnly, setMarriedOnly] = useState(false);
  const [mikvehFreq, setMikvehFreq] = useState('all');
  const [certStatus, setCertStatus] = useState('all');
  const [studyFreq, setStudyFreq] = useState('all');

  // Location logic
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [preferNearMe, setPreferNearMe] = useState(false);

  const productsQuery = useMemoStable(() => {
    return query(collection(db, 'products'), where('quantity', '>', 0));
  }, [db]);

  const { data: allProducts, isLoading } = useCollection<any>(productsQuery);

  const sellersQuery = useMemoStable(() => query(collection(db, 'sellers')), [db]);
  const { data: allSellers } = useCollection<any>(sellersQuery);

  const reviewsQuery = useMemoStable(() => query(collection(db, 'reviews')), [db]);
  const { data: allReviews } = useCollection<any>(reviewsQuery);

  useEffect(() => {
    const type = searchParams.get('product') as ProductType;
    if (type) setSelectedProduct(type);
    
    const sub = searchParams.get('subtype');
    if (sub) setSubType(sub);

    const script = searchParams.get('script');
    if (script) setScriptType(script);

    const qual = searchParams.get('quality');
    if (qual) setQualityLevel(qual);

    const qty = searchParams.get('quantity');
    if (qty) setQuantity(Number(qty));

    const size = searchParams.get('size');
    if (size) setScrollSize(size);

    const reg = searchParams.get('region');
    if (reg) setSelectedRegion(reg);

    const shipping = searchParams.get('shipping');
    if (shipping === 'all' || shipping === 'shipping' || shipping === 'pickup') {
      setShippingPreference(shipping);
    }

    const city = searchParams.get('city');
    if (city) setDetectedCity(city);
    setPreferNearMe(searchParams.get('nearMe') === 'true');

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng) setUserCoords({ lat: Number(lat), lng: Number(lng) });

    const mar = searchParams.get('married');
    if (mar === 'true') setMarriedOnly(true);
    const mkv = searchParams.get('mikveh');
    if (mkv) setMikvehFreq(mkv);
    const cert = searchParams.get('cert');
    if (cert) setCertStatus(cert);
    const study = searchParams.get('study');
    if (study) setStudyFreq(study);

    if (isViewingAll || searchParams.get('view') === 'results') setShowResults(true);
  }, [searchParams, isViewingAll]);

  const detectLocation = () => {
    setIsDetecting(true);
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "שגיאה", description: "הדפדפן אינו תומך" });
      setIsDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setPreferNearMe(true);
        
        try {
          const { city } = await reverseGeocodeWithGoogle(latitude, longitude);
          setDetectedCity(city || UNKNOWN_CITY_LABEL);
          setIsDetecting(false);
          toast({ title: "המיקום זוהה", description: `זוהית ב: ${city || UNKNOWN_CITY_LABEL}` });
        } catch (error: any) {
          setIsDetecting(false);
          toast({
            variant: "destructive",
            title: "לא הצלחנו לזהות מיקום",
            description: error?.message || "בדוק הרשאות מיקום וחיבור אינטרנט ונסה שוב.",
          });
        }
      },
      () => { setIsDetecting(false); }
    );
  };

  const detectedRegionCities = useMemo(() => {
    if (!preferNearMe || !detectedCity) return [];
    const normalizedDetectedCity = normalizeCity(detectedCity);
    const regionMatch = Object.values(NORMALIZED_REGION_CITY_MAP).find((cities) =>
      cities.includes(normalizedDetectedCity),
    );
    return regionMatch || [];
  }, [preferNearMe, detectedCity]);

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    
    let results = allProducts.filter(p => {
      const matchType = !selectedProduct || p.product_type === selectedProduct;
      const matchSub = subType === 'all' || p.sub_type === subType;
      const matchScript = scriptType === 'all' || p.script_type === scriptType;
      const matchQuality = qualityLevel === 'all' || p.script_level === qualityLevel;
      const matchQty = p.quantity >= quantity;
      const matchSize = scrollSize === 'all' || p.parchment_size === scrollSize;
      
      const normalizedDetectedCity = detectedCity ? normalizeCity(detectedCity) : '';
      const cityCandidates = normalizedDetectedCity
        ? Array.from(
            new Set([
              normalizedDetectedCity,
              normalizedDetectedCity.replace(HEBREW_ARTICLE_PREFIX, '').replace(HEBREW_CITY_PREFIX, '').trim(),
              ...(CITY_ALIASES[normalizedDetectedCity] || []).map(normalizeCity),
            ].filter(Boolean))
          )
        : [];

      const deliveryAreaValues = Array.isArray(p.delivery_area)
        ? p.delivery_area
        : p.delivery_area
          ? [p.delivery_area]
          : [];
      const normalizedAreaValues = deliveryAreaValues
        .flatMap((area: string) => area.split(','))
        .map(normalizeCity)
        .filter(Boolean);

      const deliversToCity =
        !detectedCity ||
        normalizedAreaValues.includes(normalizeCity('כל הארץ')) ||
        cityCandidates.some((candidate) =>
          normalizedAreaValues.some((area: string) =>
            area === candidate || CITY_MATCH_SEPARATORS.some((separator) => area.startsWith(`${candidate}${separator}`))
          )
        );
      const deliversNearCity =
        preferNearMe &&
        !deliversToCity &&
        detectedRegionCities.some((city) =>
          normalizedAreaValues.some((area: string) =>
            area === city || CITY_MATCH_SEPARATORS.some((separator) => area.startsWith(`${city}${separator}`)),
          ),
        );

      const productDeliveryType =
        p.delivery_type === 'pickup_only' || p.delivery_type === 'pickup'
          ? 'pickup'
          : p.delivery_type === 'shipping_only' || p.delivery_type === 'shipping'
            ? 'shipping'
            : 'both';
      const matchShipping =
        shippingPreference === 'all' ||
        (shippingPreference === 'shipping' && (productDeliveryType === 'shipping' || productDeliveryType === 'both')) ||
        (shippingPreference === 'pickup' && (productDeliveryType === 'pickup' || productDeliveryType === 'both'));
      
      const seller = allSellers?.find(s => s.id === p.seller_id);
      const selectedRegionCities = REGION_CITY_MAP[selectedRegion] || [];
      const sellerAddressNormalized = normalizeCity(seller?.address || '');
      const normalizedRegionCities = NORMALIZED_REGION_CITY_MAP[selectedRegion] || [];
      const matchRegion =
        selectedRegion === 'all' ||
        (
          seller &&
          (
            (seller.address || '').includes(selectedRegion.split(' ')[0]) ||
            normalizedRegionCities.some((city) => sellerAddressNormalized.includes(city)) ||
            normalizedRegionCities.some((city) => normalizedAreaValues.some((area: string) => area.includes(city)))
          )
        );
      const matchMarried = !marriedOnly || (seller && seller.marital_status === 'married');
      const matchMikveh = mikvehFreq === 'all' || (seller && seller.mikveh_frequency === mikvehFreq);
      const matchCert = certStatus === 'all' || (seller && seller.has_scribe_certificate === certStatus);
      const matchStudy = studyFreq === 'all' || (seller && seller.torah_study_frequency === studyFreq);
      
      return matchType && matchSub && matchScript && matchQuality && matchQty && matchSize && 
             matchShipping && matchRegion && matchMarried && matchMikveh && matchCert && matchStudy && (deliversToCity || deliversNearCity);
    });

    if (sortOrder === 'price_asc') results = [...results].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sortOrder === 'price_desc') results = [...results].sort((a, b) => Number(b.price) - Number(a.price));
    else if (sortOrder === 'rating') {
      results = [...results].sort((a, b) => {
        const ratingA = allReviews?.filter(r => r.product_id === a.id).reduce((acc, r) => acc + (r.rating || 5), 0) || 0;
        const ratingB = allReviews?.filter(r => r.product_id === b.id).reduce((acc, r) => acc + (r.rating || 5), 0) || 0;
        return ratingB - ratingA;
      });
    }

    return results;
  }, [allProducts, allSellers, allReviews, selectedProduct, subType, scriptType, qualityLevel, quantity, shippingPreference, sortOrder, scrollSize, selectedRegion, certStatus, studyFreq, marriedOnly, mikvehFreq, detectedCity, preferNearMe, detectedRegionCities]);

  const resetFilters = () => {
    setSelectedProduct(''); setSubType('all'); setScriptType('all'); setQualityLevel('all');
    setQuantity(1); setScrollSize('all'); setSelectedRegion('all'); setUserCoords(null); setDetectedCity(null);
    setMarriedOnly(false); setMikvehFreq('all'); setCertStatus('all'); setStudyFreq('all');
    setShippingPreference('all'); setSortOrder('newest');
    setPreferNearMe(false);
    setShowResults(isViewingAll); setStep(1);
  };

  const getParchmentSizes = (type: string, script: string) => {
    if (type === 'מזוזה') return ['10', '12', '15'];
    if (type === 'תפילין') return ['סטנדרט (32-34)', 'פיצפונים', 'קטן (28)', 'שימושא רבא (40)'];
    if (type === 'ספר תורה') {
      if (script === 'ספרדי') return ['17', '36', '48', '50', '56'];
      return ['17', '30', '36', '42', '48'];
    }
    return [];
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 text-right">
            <RadioGroup value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v as ProductType); setSubType('all'); }}>
              <div className="grid grid-cols-2 gap-3">
                <WizardSmallCard value="מזוזה" selected={selectedProduct === 'מזוזה'} icon={<Scroll className="w-5 h-5" />} label="מזוזה" />
                <WizardSmallCard value="תפילין" selected={selectedProduct === 'תפילין'} icon={<Package className="w-5 h-5" />} label="תפילין" />
                <WizardSmallCard value="מגילה" selected={selectedProduct === 'מגילה'} icon={<Crown className="w-5 h-5" />} label="מגילה" />
                <WizardSmallCard value="ספר תורה" selected={selectedProduct === 'ספר תורה'} icon={<BookOpen className="w-5 h-5" />} label="ספר תורה" />
                <WizardSmallCard value="מוצרי יודאיקה שונים" selected={selectedProduct === 'מוצרי יודאיקה שונים'} icon={<Palette className="w-5 h-5" />} label="יודאיקה" />
              </div>
            </RadioGroup>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 text-right">
            <div className="space-y-2">
              <Label className="font-black text-primary text-[10px] uppercase tracking-widest opacity-40">סוג כתב ומסורת</Label>
              <RadioGroup value={scriptType} onValueChange={setScriptType} className="grid grid-cols-1 gap-1.5">
                {[
                  {v: 'all', l: 'כל המסורות'},
                  {v: 'ספרדי', l: 'ספרדי'},
                  {v: 'אשכנזי - בית יוסף', l: 'בית יוסף'},
                  {v: 'אשכנזי - האר"י', l: 'האר"י'},
                  {v: 'אשכנזי - אדמו"ר הזקן', l: 'חב"ד'}
                ].map(s => (
                  <CustomFilterTile key={s.v} value={s.v} label={s.l} active={scriptType === s.v} />
                ))}
              </RadioGroup>
            </div>
            {getParchmentSizes(selectedProduct, scriptType).length > 0 && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <Label className="font-black text-primary text-[10px] uppercase tracking-widest opacity-40">גודל (ס"מ)</Label>
                <RadioGroup value={scrollSize} onValueChange={setScrollSize} className="grid grid-cols-2 gap-1.5">
                  <CustomFilterTile value="all" label="כל הגדלים" active={scrollSize === 'all'} />
                  {getParchmentSizes(selectedProduct, scriptType).map(sz => (
                    <CustomFilterTile key={sz} value={sz} label={sz} active={scrollSize === sz} />
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-3 text-right">
            {/* Location section */}
            <FilterSection title="מיקום ומשלוחים" icon={<MapPin className="w-3.5 h-3.5 text-accent" />} defaultOpen>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={detectLocation} disabled={isDetecting} variant="outline" className={cn("h-11 w-full gap-3 rounded-xl text-[10px] font-bold border-2 transition-all", userCoords ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'hover:border-primary/20')}>
                  {isDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />} 
                  {detectedCity ? `זוהית ב: ${detectedCity}` : 'זהה מיקום נוכחי'}
                </Button>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="h-11 w-full rounded-xl text-right font-bold text-xs bg-white/50 border-2 border-transparent">
                    <SelectValue placeholder="בחר אזור..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-2xl p-1">
                    <SelectItem value="all" className="font-bold py-2 rounded-lg">כל הארץ</SelectItem>
                    {ISRAEL_REGIONS.map(r => <SelectItem key={r} value={r} className="font-bold py-2 rounded-lg">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="pt-2 space-y-2">
                  <Label className="text-[9px] font-black text-primary/30">אופן קבלת המוצר</Label>
                  <RadioGroup value={shippingPreference} onValueChange={(v) => setShippingPreference(v as ShippingPreference)} className="grid gap-1.5">
                    <CustomFilterTile value="all" label="משלוח + איסוף עצמי" active={shippingPreference === 'all'} />
                    <CustomFilterTile value="shipping" label="משלוח בלבד" active={shippingPreference === 'shipping'} />
                    <CustomFilterTile value="pickup" label="איסוף עצמי בלבד" active={shippingPreference === 'pickup'} />
                  </RadioGroup>
                </div>
              </div>
            </FilterSection>

            {/* Advanced scribe filters */}
            <FilterSection title="מסנני סופר (הנהגה וקדושה)" icon={<GraduationCap className="w-3.5 h-3.5 text-accent" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black text-primary/30">הסמכת הסופר</Label>
                  <RadioGroup value={certStatus} onValueChange={setCertStatus} className="grid gap-1.5">
                    <CustomFilterTile value="all" label="הכל" active={certStatus === 'all'} />
                    <CustomFilterTile value="valid" label="תעודה בתוקף" active={certStatus === 'valid'} />
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black text-primary/30">לימוד תורה</Label>
                  <RadioGroup value={studyFreq} onValueChange={setStudyFreq} className="grid gap-1.5">
                    <CustomFilterTile value="all" label="הכל" active={studyFreq === 'all'} />
                    <CustomFilterTile value="full-day" label="אברך יום שלם" active={studyFreq === 'full-day'} />
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black text-primary/30">מנהג טבילה</Label>
                  <RadioGroup value={mikvehFreq} onValueChange={setMikvehFreq} className="grid gap-1.5">
                    <CustomFilterTile value="all" label="הכל" active={mikvehFreq === 'all'} />
                    <CustomFilterTile value="daily" label="טובל יומיום" active={mikvehFreq === 'daily'} />
                  </RadioGroup>
                </div>
                <div className="flex flex-col justify-end sm:col-span-2 xl:col-span-3">
                  <Label className="flex items-center justify-between p-3 rounded-xl border-2 border-primary/5 hover:bg-slate-50 transition-all cursor-pointer h-full">
                    <div className="flex items-center gap-2"><UserCheck className="w-3.5 h-3.5 text-accent" /><span className="text-[9px] font-bold">סופר נשוי</span></div>
                    <Checkbox checked={marriedOnly} onCheckedChange={(v) => setMarriedOnly(!!v)} />
                  </Label>
                </div>
              </div>
            </FilterSection>

            <div className="pt-2">
              <Button onClick={() => setIsWizardOpen(false)} className="w-full h-12 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all">
                עדכן תוצאות חיפוש
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="w-full pt-20">
        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogContent className="max-w-[550px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-h-[90vh] flex flex-col ring-1 ring-primary/5" dir="rtl">
            <div className="bg-primary p-5 text-white text-right relative shrink-0">
              <div className="absolute top-4 left-6 flex gap-1">
                {[1, 2, 3].map(s => (
                  <div key={s} className={cn("h-1.5 rounded-full transition-all duration-500", step === s ? "w-7 bg-accent shadow-sm" : "w-2.5 bg-white/25")} />
                ))}
              </div>
              <DialogHeader>
                <DialogTitle className="text-lg font-headline font-black text-white tracking-tight">סינון כלי קודש מתקדם</DialogTitle>
                <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest mt-0.5">שלב {step} מתוך 3</p>
              </DialogHeader>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">{renderStepContent()}</div>
            <DialogFooter className="p-4 bg-muted/20 border-t flex justify-between gap-3 shrink-0">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-xl h-10 px-4 font-black text-[10px] border-primary/10 bg-white">
                  <ChevronRight className="w-3 h-3 ml-2" /> חזור
                </Button>
              )}
              <div className="flex-1" />
              {step < 3 && (
                <Button onClick={() => setStep(s => s + 1)} className="bg-primary text-white rounded-xl px-8 h-10 text-[10px] font-black uppercase tracking-widest shadow-lg">
                  המשך <ChevronLeft className="w-3 h-3 mr-2" />
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-16 h-16">
              <Loader2 className="w-16 h-16 animate-spin text-primary/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <Scroll className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="font-headline font-black text-primary/40 text-lg">טוען כלי קודש...</p>
          </div>
        ) : !showResults ? (
          <div className="container mx-auto px-4 pt-12 pb-12">
            <section className="bg-white/60 backdrop-blur-2xl p-6 sm:p-10 md:p-20 rounded-[2.5rem] md:rounded-[4rem] shadow-premium-lg text-center relative overflow-hidden max-w-5xl mx-auto border border-white/70 ring-1 ring-primary/5">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
              
              <h1 className="text-4xl md:text-7xl font-headline font-black text-primary mb-6 tracking-tighter leading-tight">חיפוש קדושה <span className="text-accent underline decoration-accent/20 underline-offset-[12px]">מדויק</span></h1>
              <p className="text-primary/60 text-lg md:text-xl mb-12 font-medium max-w-2xl mx-auto leading-relaxed">הגדירו את המפרט המדויק וקבלו את כלי הקודש המושלם עבורכם ישירות מהסופר המאומת.</p>
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                <Button onClick={() => setIsWizardOpen(true)} size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 rounded-full px-10 sm:px-16 h-16 sm:h-20 font-black text-base sm:text-lg uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary/30 transition-all duration-300 group">
                  <SearchIcon className="ml-4 w-6 h-6 group-hover:rotate-12 transition-transform" /> התחל חיפוש מותאם
                </Button>
                <Button onClick={() => setShowResults(true)} variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 sm:px-12 h-14 sm:h-20 font-black uppercase text-sm tracking-widest border-primary/10 bg-white shadow-premium hover:border-primary/20 hover:shadow-lg active:scale-95 transition-all duration-300">צפה בכל הקטלוג</Button>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-0">
            <div className="container mx-auto px-4 pt-8 pb-6 md:pb-8">
              <div className="flex flex-col md:flex-row justify-between items-end gap-4 md:gap-6 border-b border-primary/5 pb-6 md:pb-8">
                <div className="w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
                  <div className="flex items-center gap-2 md:gap-4 min-w-max px-1">
                    <Button onClick={() => setIsWizardOpen(true)} className="rounded-xl md:rounded-2xl h-10 md:h-14 px-4 md:px-8 text-[10px] md:text-xs font-black uppercase tracking-widest border-2 border-primary/5 bg-white text-primary hover:bg-primary hover:text-white active:scale-95 transition-all duration-200 shadow-sm group">
                      <SlidersHorizontal className="w-4 h-4 md:w-5 md:h-5 ml-2 md:ml-3 text-accent group-hover:text-white transition-colors" /> סינון מותאם
                    </Button>
                    <Button variant={shippingPreference === "shipping" ? "default" : "outline"} onClick={() => setShippingPreference(prev => prev === 'shipping' ? 'all' : 'shipping')} className={cn("rounded-xl md:rounded-2xl h-10 md:h-14 px-4 md:px-8 text-[10px] md:text-xs font-black uppercase tracking-widest shrink-0 shadow-sm transition-all duration-200 active:scale-95", shippingPreference === 'shipping' ? 'bg-primary text-white border-none' : 'bg-white border-2 border-primary/5 text-primary/60 hover:border-primary/15 hover:text-primary/80')}>
                      <Truck className="w-4 h-4 md:w-5 md:h-5 ml-2 md:ml-3" /> משלוח
                    </Button>
                    
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                      <SelectTrigger className="rounded-xl md:rounded-2xl h-10 md:h-14 px-4 md:px-8 text-[10px] md:text-xs font-black uppercase tracking-widest border-2 border-primary/5 bg-white w-44 md:w-64 shrink-0 shadow-sm focus:ring-0">
                        <div className="flex items-center gap-2 md:gap-3">
                          <ArrowUpNarrowWide className="w-4 h-4 md:w-5 md:h-5 text-accent" />
                          <SelectValue placeholder="מיון" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-[1.5rem] md:rounded-[2rem] shadow-2xl border-none p-2 bg-white/95 backdrop-blur-xl">
                        <SelectItem value="newest" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">מוצרים חדשים</SelectItem>
                        <SelectItem value="price_asc" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">מחיר: מהזול ליקר</SelectItem>
                        <SelectItem value="price_desc" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">מחיר: מהיקר לזול</SelectItem>
                        <SelectItem value="rating" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">דירוג לקוחות</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={resetFilters} className="rounded-xl md:rounded-2xl h-10 md:h-14 px-4 md:px-8 text-[10px] md:text-xs font-black uppercase tracking-widest text-primary/30 hover:text-destructive hover:bg-destructive/5 shrink-0 transition-all">
                      <RotateCcw className="w-4 h-4 md:w-5 md:h-5 ml-2 md:ml-3" /> איפוס
                    </Button>
                  </div>
                </div>
                <div className="text-right shrink-0 w-full md:w-auto px-1">
                  <h2 className="text-2xl md:text-4xl font-headline font-black text-primary tracking-tighter">כלי קודש שנמצאו ({filteredProducts.length})</h2>
                </div>
              </div>

              {detectedCity && (
                <div className="flex items-center justify-end gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-4 py-1.5 rounded-full mr-1 mt-4 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> מוצגות תוצאות עם משלוח ל{detectedCity}
                </div>
              )}
            </div>

            {/* Torah Banner placement: Truly full width, below search filters */}
            {selectedProduct === 'ספר תורה' && <TorahExpertBanner />}

            <div className="container mx-auto px-4 pt-8 pb-20">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                {filteredProducts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ProductCard product={p} />
                  </motion.div>
                ))}
                
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-20 md:py-40 text-center space-y-6 md:space-y-8 bg-white/40 rounded-[2.5rem] md:rounded-[4rem] border-4 border-dashed border-primary/5 shadow-inner">
                    <div className="relative w-20 h-20 md:w-28 md:h-28 mx-auto">
                      <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping" />
                      <div className="relative bg-white rounded-full w-20 h-20 md:w-28 md:h-28 flex items-center justify-center shadow-xl">
                        <SearchIcon className="w-8 h-8 md:w-12 md:h-12 text-primary/10" />
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3 px-4">
                      <p className="text-2xl md:text-3xl font-headline font-black text-primary tracking-tight">לא נמצאה התאמה מדויקת</p>
                      <p className="text-primary/40 max-w-sm mx-auto font-medium text-base md:text-lg leading-relaxed">נסו להסיר חלק מהמסננים או לאפס את החיפוש כדי לראות עוד אפשרויות קודש.</p>
                    </div>
                    <Button variant="outline" onClick={resetFilters} className="rounded-full px-8 md:px-12 h-14 md:h-16 border-2 border-primary/10 text-primary font-black uppercase tracking-widest text-xs md:text-sm hover:bg-primary hover:text-white transition-all shadow-lg">
                      הצג את כל כלי הקודש באתר
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /></div>}>
      <SearchContent />
    </Suspense>
  );
}

function WizardSmallCard({ value, selected, icon, label }: any) {
  return (
    <Label className={cn(
      "group p-4 rounded-[1.5rem] border-2 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2",
      selected 
        ? "border-primary bg-primary/5 shadow-xl scale-105 z-10" 
        : "border-primary/5 hover:border-accent/30 hover:shadow-md bg-white shadow-sm"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
        selected ? "bg-primary text-white shadow-lg" : "bg-primary/5 text-primary group-hover:bg-accent/10 group-hover:scale-110"
      )}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
      </div>
      <div className="text-center">
        <h4 className={cn("font-black text-[10px] tracking-tight transition-colors", selected ? "text-primary" : "text-primary/60 group-hover:text-primary/80")}>
          {label}
        </h4>
      </div>
      <RadioGroupItem value={value} className="hidden" />
    </Label>
  );
}

function CustomFilterTile({ value, label, active }: any) {
  return (
    <Label className={cn(
      "flex items-center justify-between rounded-xl border-2 transition-all duration-200 cursor-pointer group px-4 py-3",
      active ? "border-primary bg-primary/5 shadow-sm scale-[1.01]" : "border-primary/5 bg-white hover:bg-slate-50 hover:border-primary/15"
    )}>
      <RadioGroupItem value={value} className="hidden" />
      <span className={cn("font-bold text-[10px] transition-colors", active ? "text-primary" : "text-primary/50 group-hover:text-primary/70")}>{label}</span>
      <div className={cn(
        "w-3 h-3 rounded-full border-2 transition-all duration-200",
        active ? "bg-primary border-primary scale-110 shadow-sm" : "border-primary/10 group-hover:border-primary/30"
      )} />
    </Label>
  );
}

function FilterSection({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-2xl border-2 border-primary/5 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-black text-[10px] uppercase tracking-widest text-primary/70">{title}</span>
        </div>
        <ChevronRight className={cn("w-3.5 h-3.5 text-primary/30 transition-transform duration-200", open ? "rotate-90" : "rotate-0")} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
