
"use client";

import React, { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
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
  ChevronLeft,
  ChevronRight,
  MapPin,
  LocateFixed,
  ArrowUpNarrowWide,
  Star,
  GraduationCap,
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
import { geocodeAddressWithGoogle, reverseGeocodeWithGoogle } from '@/lib/google-maps';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';
type ShippingPreference = 'all' | 'shipping' | 'pickup';

const ISRAEL_REGIONS = [
  "ירושלים והסביבה", "תל אביב וגוש דן", "חיפה והצפון", "באר שבע והדרום", "בני ברק והמרכז", "השרון", "יהודה ושומרון"
];
const HEBREW_ARTICLE_PREFIX = /^ה/;
const HEBREW_CITY_PREFIX = /^עיר\s+/;
const CITY_MATCH_SEPARATORS = [' ', '-'];
const UNKNOWN_CITY_LABEL = 'עיר לא ידועה';
const PRICE_THRESHOLD_FOR_ROUNDING = 1000;
const SMALL_PRICE_ROUND_FACTOR = 100;
const LARGE_PRICE_ROUND_FACTOR = 500;
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
const sanitizePriceInput = (value: string) => value.replace(/[^\d]/g, '');
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

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const getDeliveryAreaValues = (product: any): string[] =>
  Array.isArray(product?.delivery_area) ? product.delivery_area : product?.delivery_area ? [product.delivery_area] : [];

function SearchContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isDesktopFilters, setIsDesktopFilters] = useState(false);
  const [showResults, setShowResults] = useState(false);
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
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [marriedOnly, setMarriedOnly] = useState(false);
  const [mikvehFreq, setMikvehFreq] = useState('all');
  const [certStatus, setCertStatus] = useState('all');
  const [studyFreq, setStudyFreq] = useState('all');

  // Location logic
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [preferNearMe, setPreferNearMe] = useState(false);
  const [nearbyDistanceMap, setNearbyDistanceMap] = useState<Record<string, number>>({});
  const [nearbySortedProducts, setNearbySortedProducts] = useState<any[]>([]);

  const productsQuery = useMemoStable(() => {
    return query(collection(db, 'products'), where('quantity', '>', 0));
  }, [db]);

  const { data: allProducts, isLoading } = useCollection<any>(productsQuery);

  const sellersQuery = useMemoStable(() => query(collection(db, 'sellers')), [db]);
  const { data: allSellers } = useCollection<any>(sellersQuery);

  const reviewsQuery = useMemoStable(() => query(collection(db, 'reviews')), [db]);
  const { data: allReviews } = useCollection<any>(reviewsQuery);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => setIsDesktopFilters(window.innerWidth >= 768);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const priceBounds = useMemo(() => {
    const prices = (allProducts || [])
      .map((product) => Number(product?.price))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (prices.length === 0) {
      return { min: 0, max: 10000 };
    }

    const min = Math.floor(Math.min(...prices));
    const rawMax = Math.ceil(Math.max(...prices));
    const roundedMax = rawMax <= PRICE_THRESHOLD_FOR_ROUNDING
      ? Math.ceil(rawMax / SMALL_PRICE_ROUND_FACTOR) * SMALL_PRICE_ROUND_FACTOR
      : Math.ceil(rawMax / LARGE_PRICE_ROUND_FACTOR) * LARGE_PRICE_ROUND_FACTOR;

    return {
      min,
      max: Math.max(min + 100, roundedMax),
    };
  }, [allProducts]);

  const activePriceRange = priceRange ?? [priceBounds.min, priceBounds.max];
  const resetPriceRange = useCallback(() => setPriceRange([priceBounds.min, priceBounds.max]), [priceBounds.max, priceBounds.min]);

  useEffect(() => {
    if (!priceRange) {
      resetPriceRange();
      return;
    }

    const [currentMin, currentMax] = priceRange;
    if (currentMin < priceBounds.min || currentMax > priceBounds.max) {
      resetPriceRange();
    }
  }, [priceBounds.max, priceBounds.min, priceRange, resetPriceRange]);

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

  const baseFilteredProducts = useMemo(() => {
    if (!allProducts) return [];
    
    let results = allProducts.filter(p => {
      const matchType = !selectedProduct || p.product_type === selectedProduct;
      const matchSub = subType === 'all' || p.sub_type === subType;
      const matchScript = scriptType === 'all' || p.script_type === scriptType;
      const matchQuality = qualityLevel === 'all' || p.script_level === qualityLevel;
      const matchQty = p.quantity >= quantity;
      const matchSize = scrollSize === 'all' || p.parchment_size === scrollSize;
      const numericPrice = Number(p.price) || 0;
      const matchPrice = numericPrice >= activePriceRange[0] && numericPrice <= activePriceRange[1];
      
      const normalizedAreaValues = getDeliveryAreaValues(p)
        .flatMap((area: string) => area.split(','))
        .map(normalizeCity)
        .filter(Boolean);

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
      
      return matchType && matchSub && matchScript && matchQuality && matchQty && matchSize && matchPrice &&
             matchShipping && matchRegion && matchMarried && matchMikveh && matchCert && matchStudy;
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
  }, [activePriceRange, allProducts, allSellers, allReviews, selectedProduct, subType, scriptType, qualityLevel, quantity, shippingPreference, sortOrder, scrollSize, selectedRegion, certStatus, studyFreq, marriedOnly, mikvehFreq]);

  const exactCityProducts = useMemo(() => {
    if (!preferNearMe || !detectedCity) return [];

    const normalizedDetectedCity = normalizeCity(detectedCity);
    const cityCandidates = Array.from(
      new Set([
        normalizedDetectedCity,
        normalizedDetectedCity.replace(HEBREW_ARTICLE_PREFIX, '').replace(HEBREW_CITY_PREFIX, '').trim(),
        ...(CITY_ALIASES[normalizedDetectedCity] || []).map(normalizeCity),
      ].filter(Boolean)),
    );

    return baseFilteredProducts.filter((product) => {
      const normalizedAreaValues = getDeliveryAreaValues(product)
        .flatMap((area: string) => area.split(','))
        .map(normalizeCity)
        .filter(Boolean);

      if (normalizedAreaValues.includes(normalizeCity('כל הארץ'))) return true;

      return cityCandidates.some((candidate) =>
        normalizedAreaValues.some((area: string) =>
          area === candidate || CITY_MATCH_SEPARATORS.some((separator) => area.startsWith(`${candidate}${separator}`)),
        ),
      );
    });
  }, [baseFilteredProducts, detectedCity, preferNearMe]);

  useEffect(() => {
    let cancelled = false;

    if (!preferNearMe || !detectedCity || !userCoords || exactCityProducts.length > 0) {
      setNearbyDistanceMap({});
      setNearbySortedProducts([]);
      return () => {
        cancelled = true;
      };
    }

    const geocodeAndSort = async () => {
      const sellerById = new Map((allSellers || []).map((seller: any) => [seller.id, seller]));
      const geocodeTargets = Array.from(
        new Set(
          baseFilteredProducts
            .map((product) => {
              const seller = sellerById.get(product.seller_id);
              if (seller?.address) return seller.address;
              return getDeliveryAreaValues(product).find((area: string) => area && area !== 'כל הארץ') || '';
            })
            .filter(Boolean),
        ),
      );

      const geoEntries = await Promise.all(
        geocodeTargets.map(async (target) => {
          try {
            const { lat, lng } = await geocodeAddressWithGoogle(target);
            if (typeof lat === 'number' && typeof lng === 'number') {
              return [target, { lat, lng }] as const;
            }
          } catch {
            return null;
          }
          return null;
        }),
      );

      const geoMap = new Map(geoEntries.filter(Boolean) as ReadonlyArray<readonly [string, { lat: number; lng: number }]>);
      const mapped = baseFilteredProducts
        .map((product) => {
          const seller = sellerById.get(product.seller_id);
          const target = seller?.address || getDeliveryAreaValues(product).find((area: string) => area && area !== 'כל הארץ') || '';
          const coords = geoMap.get(target);
          if (!coords) return null;
          const distanceKm = haversineDistance(userCoords.lat, userCoords.lng, coords.lat, coords.lng);
          return { product, distanceKm };
        })
        .filter((item): item is { product: any; distanceKm: number } => Boolean(item))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (cancelled) return;

      setNearbySortedProducts(mapped.map((entry) => entry.product));
      setNearbyDistanceMap(
        Object.fromEntries(
          mapped.map((entry) => [entry.product.id, Math.round(entry.distanceKm)]),
        ),
      );
    };

    geocodeAndSort();

    return () => {
      cancelled = true;
    };
  }, [allSellers, baseFilteredProducts, detectedCity, exactCityProducts.length, preferNearMe, userCoords]);

  const isNearbyFallbackActive = preferNearMe && Boolean(detectedCity) && exactCityProducts.length === 0;

  const filteredProducts = useMemo(() => {
    if (!preferNearMe || !detectedCity) return baseFilteredProducts;
    if (exactCityProducts.length > 0) return exactCityProducts;
    if (nearbySortedProducts.length > 0) return nearbySortedProducts;
    return baseFilteredProducts;
  }, [baseFilteredProducts, detectedCity, exactCityProducts, nearbySortedProducts, preferNearMe]);

  const resetFilters = () => {
    setSelectedProduct(''); setSubType('all'); setScriptType('all'); setQualityLevel('all');
    setQuantity(1); setScrollSize('all'); setSelectedRegion('all'); setUserCoords(null); setDetectedCity(null);
    setMarriedOnly(false); setMikvehFreq('all'); setCertStatus('all'); setStudyFreq('all');
    setShippingPreference('all'); setSortOrder('newest');
    resetPriceRange();
    setNearbyDistanceMap({}); setNearbySortedProducts([]);
    setPreferNearMe(false);
    setShowResults(isViewingAll);
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

  const renderFilterContent = () => (
    <div className="space-y-4 text-right">
      <div className="rounded-[1.75rem] border border-primary/10 bg-primary/5 p-4">
        <p className="text-sm font-black text-primary">סינון חכם ומהיר</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-primary/60">
          בחרו קטגוריה, טווח מחירים, משלוח או איסוף עצמי, וסננו לפי מאפייני הסופר.
        </p>
      </div>

      <FilterSection title="סוג מוצר" icon={<BookOpen className="w-3.5 h-3.5 text-accent" />} defaultOpen>
        <RadioGroup value={selectedProduct} onValueChange={(value) => { setSelectedProduct(value as ProductType); setSubType('all'); }}>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <WizardSmallCard value="מזוזה" selected={selectedProduct === 'מזוזה'} icon={<Scroll className="w-5 h-5" />} label="מזוזה" />
            <WizardSmallCard value="תפילין" selected={selectedProduct === 'תפילין'} icon={<Package className="w-5 h-5" />} label="תפילין" />
            <WizardSmallCard value="מגילה" selected={selectedProduct === 'מגילה'} icon={<Crown className="w-5 h-5" />} label="מגילה" />
            <WizardSmallCard value="ספר תורה" selected={selectedProduct === 'ספר תורה'} icon={<BookOpen className="w-5 h-5" />} label="ספר תורה" />
            <WizardSmallCard value="מוצרי יודאיקה שונים" selected={selectedProduct === 'מוצרי יודאיקה שונים'} icon={<Palette className="w-5 h-5" />} label="יודאיקה" />
          </div>
        </RadioGroup>
      </FilterSection>

      <FilterSection title="מאפייני כתיבה" icon={<Scroll className="w-3.5 h-3.5 text-accent" />} defaultOpen>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="font-black text-primary text-[10px] uppercase tracking-widest opacity-40">סוג כתב ומסורת</Label>
            <RadioGroup value={scriptType} onValueChange={setScriptType} className="grid grid-cols-1 gap-1.5">
              {[
                { v: 'all', l: 'כל המסורות' },
                { v: 'ספרדי', l: 'ספרדי' },
                { v: 'אשכנזי - בית יוסף', l: 'בית יוסף' },
                { v: 'אשכנזי - האר"י', l: 'האר"י' },
                { v: 'אשכנזי - אדמו"ר הזקן', l: 'חב"ד' },
              ].map((script) => (
                <CustomFilterTile key={script.v} value={script.v} label={script.l} active={scriptType === script.v} />
              ))}
            </RadioGroup>
          </div>

          {getParchmentSizes(selectedProduct, scriptType).length > 0 && (
            <div className="space-y-2 animate-in fade-in">
              <Label className="font-black text-primary text-[10px] uppercase tracking-widest opacity-40">גודל (ס"מ)</Label>
              <RadioGroup value={scrollSize} onValueChange={setScrollSize} className="grid grid-cols-2 gap-1.5">
                <CustomFilterTile value="all" label="כל הגדלים" active={scrollSize === 'all'} />
                {getParchmentSizes(selectedProduct, scriptType).map((size) => (
                  <CustomFilterTile key={size} value={size} label={size} active={scrollSize === size} />
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
      </FilterSection>

      <FilterSection title="טווח מחירים" icon={<ArrowUpNarrowWide className="w-3.5 h-3.5 text-accent" />} defaultOpen>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/30">מחיר מינימום</Label>
              <Input
                inputMode="numeric"
                value={String(activePriceRange[0])}
                onChange={(event) => {
                  const nextMin = Number(sanitizePriceInput(event.target.value)) || priceBounds.min;
                  setPriceRange([Math.min(nextMin, activePriceRange[1]), activePriceRange[1]]);
                }}
                className="h-11 rounded-2xl border-primary/10 bg-white text-right font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/30">מחיר מקסימום</Label>
              <Input
                inputMode="numeric"
                value={String(activePriceRange[1])}
                onChange={(event) => {
                  const nextMax = Number(sanitizePriceInput(event.target.value)) || priceBounds.max;
                  setPriceRange([activePriceRange[0], Math.max(nextMax, activePriceRange[0])]);
                }}
                className="h-11 rounded-2xl border-primary/10 bg-white text-right font-bold"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-primary/10 bg-white px-4 py-5">
            <Slider
              min={priceBounds.min}
              max={priceBounds.max}
              step={50}
              value={activePriceRange}
              onValueChange={(value) => {
                if (!Array.isArray(value) || value.length < 2) {
                  console.warn('Unexpected price slider value:', value);
                  return;
                }
                const [userSelectedMin = priceBounds.min, userSelectedMax = priceBounds.max] = value;
                setPriceRange([Math.min(userSelectedMin, userSelectedMax), Math.max(userSelectedMin, userSelectedMax)]);
              }}
              className="w-full"
            />
            <div className="mt-4 flex items-center justify-between text-xs font-black text-primary/60">
              <span>₪{activePriceRange[1].toLocaleString('he-IL')}</span>
              <span>₪{activePriceRange[0].toLocaleString('he-IL')}</span>
            </div>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="מיקום, משלוח ואיסוף" icon={<MapPin className="w-3.5 h-3.5 text-accent" />} defaultOpen>
        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={detectLocation} disabled={isDetecting} variant="outline" className={cn("h-11 w-full gap-3 rounded-2xl text-[11px] font-bold border-2 transition-all", userCoords ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'hover:border-primary/20')}>
            {isDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
            {detectedCity ? `זוהית ב: ${detectedCity}` : 'זהה מיקום נוכחי'}
          </Button>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="h-11 w-full rounded-2xl text-right font-bold text-xs bg-white/50 border border-primary/10">
              <SelectValue placeholder="בחר אזור..." />
            </SelectTrigger>
            <SelectContent className="rounded-2xl shadow-2xl p-1">
              <SelectItem value="all" className="font-bold py-2 rounded-lg">כל הארץ</SelectItem>
              {ISRAEL_REGIONS.map((region) => <SelectItem key={region} value={region} className="font-bold py-2 rounded-lg">{region}</SelectItem>)}
            </SelectContent>
          </Select>
          <RadioGroup value={shippingPreference} onValueChange={(value) => setShippingPreference(value as ShippingPreference)} className="grid gap-1.5">
            <CustomFilterTile value="all" label="משלוח ואיסוף עצמי" active={shippingPreference === 'all'} />
            <CustomFilterTile value="shipping" label="משלוח בלבד" active={shippingPreference === 'shipping'} />
            <CustomFilterTile value="pickup" label="איסוף עצמי בלבד" active={shippingPreference === 'pickup'} />
          </RadioGroup>
        </div>
      </FilterSection>

      <FilterSection title="מסנני סופר" icon={<GraduationCap className="w-3.5 h-3.5 text-accent" />}>
        <div className="grid grid-cols-1 gap-4 pt-2">
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
              <CustomFilterTile value="never" label="לא טובל בכלל" active={mikvehFreq === 'never'} />
            </RadioGroup>
          </div>
          <Label className="flex items-center justify-between rounded-2xl border border-primary/10 bg-white px-4 py-4 transition-all cursor-pointer hover:border-primary/20">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold text-primary">סופר נשוי</span>
            </div>
            <Checkbox checked={marriedOnly} onCheckedChange={(value) => setMarriedOnly(!!value)} />
          </Label>
        </div>
      </FilterSection>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button variant="outline" onClick={resetFilters} className="h-12 rounded-2xl border-primary/10 font-black">
          <RotateCcw className="ml-2 h-4 w-4" />
          אפס
        </Button>
        <Button onClick={() => setIsFilterPanelOpen(false)} className="h-12 rounded-2xl bg-primary text-white font-black shadow-lg">
          הצג {filteredProducts.length} מוצרים
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="w-full pt-20">
        {isDesktopFilters ? (
          <Sheet open={isFilterPanelOpen} onOpenChange={setIsFilterPanelOpen}>
            <SheetContent side="right" className="w-full border-l border-primary/10 bg-[#FCFBF7] p-0 sm:max-w-[430px]" dir="rtl">
              <div className="flex h-full flex-col">
                <SheetHeader className="border-b border-primary/10 bg-white px-6 py-5 text-right">
                  <SheetTitle className="font-headline text-2xl font-black text-primary">סינון מותאם</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {renderFilterContent()}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={isFilterPanelOpen} onOpenChange={setIsFilterPanelOpen}>
            <DialogContent className="max-w-[95vw] rounded-[2rem] border-none bg-white p-0 shadow-2xl max-h-[92vh] flex flex-col ring-1 ring-primary/5" dir="rtl">
              <div className="border-b border-primary/10 bg-primary px-5 py-5 text-right text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-headline font-black">סינון מתקדם</DialogTitle>
                  <p className="text-xs font-medium text-white/70">מסך מסודר ונוח לנייד עם כל המסננים במקום אחד.</p>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {renderFilterContent()}
              </div>
            </DialogContent>
          </Dialog>
        )}

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
                <Button onClick={() => setIsFilterPanelOpen(true)} size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 rounded-full px-10 sm:px-16 h-16 sm:h-20 font-black text-base sm:text-lg uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 focus:ring-4 focus:ring-primary/30 transition-all duration-300 group">
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
                <div className="relative w-full">
                  <div className="w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
                    <div className="flex items-center gap-2 md:gap-3 min-w-max px-1">
                      <Button onClick={() => setIsFilterPanelOpen(true)} className="rounded-full h-10 px-4 text-[11px] font-black border border-primary/10 bg-white text-primary hover:bg-primary hover:text-white active:scale-95 transition-all duration-200 shadow-sm group">
                        <SlidersHorizontal className="ml-2 h-4 w-4 text-accent transition-colors group-hover:text-white" />
                        סינון מותאם
                      </Button>
                      <div className="flex items-center rounded-full border border-primary/10 bg-white p-1 shadow-sm">
                        <ToolbarChoiceButton active={shippingPreference === 'all'} onClick={() => setShippingPreference('all')}>
                          הכל
                        </ToolbarChoiceButton>
                        <ToolbarChoiceButton active={shippingPreference === 'shipping'} onClick={() => setShippingPreference('shipping')}>
                          <Truck className="ml-1.5 h-3.5 w-3.5" />
                          משלוח
                        </ToolbarChoiceButton>
                        <ToolbarChoiceButton active={shippingPreference === 'pickup'} onClick={() => setShippingPreference('pickup')}>
                          <MapPin className="ml-1.5 h-3.5 w-3.5" />
                          איסוף עצמי
                        </ToolbarChoiceButton>
                      </div>
                      <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="h-10 w-[168px] shrink-0 rounded-full border border-primary/10 bg-white px-4 text-[11px] font-black shadow-sm focus:ring-0">
                          <div className="flex items-center gap-2">
                            <ArrowUpNarrowWide className="h-4 w-4 text-accent" />
                            <span className="text-primary/50">מיון לפי</span>
                            <SelectValue placeholder="חדש" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-[1.5rem] md:rounded-[2rem] shadow-2xl border-none p-2 bg-white/95 backdrop-blur-xl">
                          <SelectItem value="newest" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">מוצרים חדשים</SelectItem>
                          <SelectItem value="price_asc" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">מחיר: מהזול ליקר</SelectItem>
                          <SelectItem value="price_desc" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">מחיר: מהיקר לזול</SelectItem>
                          <SelectItem value="rating" className="font-bold py-2 md:py-3 px-3 md:px-4 rounded-xl cursor-pointer text-xs md:text-sm">דירוג לקוחות</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button variant="ghost" onClick={resetFilters} className="h-10 rounded-full px-4 text-[11px] font-black text-primary/40 hover:bg-destructive/5 hover:text-destructive shrink-0 transition-all">
                        <RotateCcw className="ml-2 h-4 w-4" /> איפוס
                      </Button>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent md:hidden" />
                  <div className="pointer-events-none absolute inset-y-0 left-2 z-20 flex items-center text-primary/35 md:hidden">
                    <span className="flex animate-pulse items-center">
                      <ChevronLeft className="h-4 w-4" />
                      <ChevronLeft className="-mr-2 h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 w-full md:w-auto px-1">
                  <h2 className="text-2xl md:text-4xl font-headline font-black text-primary tracking-tighter">מוצרים שנמצאו ({filteredProducts.length})</h2>
                </div>
              </div>

              {detectedCity && (
                <div className="flex items-center justify-end gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-4 py-1.5 rounded-full mr-1 mt-4 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" /> זיהינו: {detectedCity}
                </div>
              )}
              {isNearbyFallbackActive && detectedCity && (
                <div className="text-right text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mt-3">
                  לא נמצאו מוצרים ב{detectedCity}. מציג מוצרים מערים קרובות:
                </div>
              )}
            </div>

            {/* Torah Banner placement: Truly full width, below search filters */}
            {selectedProduct === 'ספר תורה' && <TorahExpertBanner />}

            <div className="container mx-auto px-4 pt-8 pb-20">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 xl:gap-7">
                {filteredProducts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ProductCard product={p} distanceKm={isNearbyFallbackActive ? nearbyDistanceMap[p.id] : undefined} />
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
                       <p className="text-primary/60 max-w-sm mx-auto font-medium text-base md:text-lg leading-relaxed">נסו להסיר חלק מהמסננים או לאפס את החיפוש כדי לראות עוד אפשרויות קודש.</p>
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
        <p className={cn("font-black text-[10px] tracking-tight transition-colors", selected ? "text-primary" : "text-primary/60 group-hover:text-primary/80")}>
          {label}
        </p>
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

function ToolbarChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center rounded-full px-3 text-[10px] font-black transition-all",
        active ? "bg-primary text-white shadow-sm" : "text-primary/55 hover:text-primary",
      )}
    >
      {children}
    </button>
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
