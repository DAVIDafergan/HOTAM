
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
  UserCheck,
  Truck,
  ChevronLeft,
  ChevronRight,
  MapPin,
  LocateFixed,
  ArrowUpNarrowWide,
  GraduationCap,
  CheckCircle2
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useSupabaseClient, useCollection, useMemoStable } from '@/lib/supabase-hooks';
import { collection, query, where, limit } from '@/lib/supabase-compat';
import { ProductCard } from '@/components/ProductCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TorahExpertBanner } from '@/components/TorahExpertBanner';
import { CitySelect } from '@/components/CitySelect';
import { geocodeAddressWithGoogle, reverseGeocodeWithGoogle } from '@/lib/google-maps';
import {
  buildAvailableCities,
  getCityCandidates,
  getProductCityTokens,
  haversineDistance,
  NEARBY_RADIUS_KM,
  normalizeCity,
  UNKNOWN_CITY_LABEL,
} from '@/lib/location-utils';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';
type ShippingPreference = 'all' | 'shipping' | 'pickup';

const PRICE_THRESHOLD_FOR_ROUNDING = 1000;
const SMALL_PRICE_ROUND_FACTOR = 100;
const LARGE_PRICE_ROUND_FACTOR = 500;
const SORT_OPTIONS = [
  { value: 'newest', label: 'מוצרים חדשים' },
  { value: 'price_asc', label: 'מחיר: מהזול ליקר' },
  { value: 'price_desc', label: 'מחיר: מהיקר לזול' },
  { value: 'rating', label: 'דירוג לקוחות' },
] as const;
const sanitizePriceInput = (value: string) => value.replace(/[^\d]/g, '');

function SearchContent() {
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();
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
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [marriedOnly, setMarriedOnly] = useState(false);
  const [mikvehFreq, setMikvehFreq] = useState('');
  const [certStatus, setCertStatus] = useState('');
  const [studyFreq, setStudyFreq] = useState('');

  // Location logic
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [includeNearbyCities, setIncludeNearbyCities] = useState(false);
  const [nearbyCityDistanceMap, setNearbyCityDistanceMap] = useState<Record<string, number>>({});
  const [nearbyDistanceMap, setNearbyDistanceMap] = useState<Record<string, number>>({});

  // Load more
  const PRODUCTS_PAGE_SIZE = 17;
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PAGE_SIZE);

  const productsQuery = useMemoStable(() => {
    return query(collection(db, 'products'), where('quantity', '>', 0), limit(50));
  }, [db]);

  const { data: allProducts, isLoading } = useCollection<any>(productsQuery);

  const sellersQuery = useMemoStable(() => query(collection(db, 'sellers'), where('is_approved', '==', true), limit(200)), [db]);
  const { data: allSellers } = useCollection<any>(sellersQuery);

  const reviewsQuery = useMemoStable(() => query(collection(db, 'reviews'), limit(200)), [db]);
  const { data: allReviews } = useCollection<any>(reviewsQuery);

  const sellerById = useMemo(
    () => new Map((allSellers || []).map((seller: any) => [seller.id, seller])),
    [allSellers],
  );

  const reviewTotalsByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    (allReviews || []).forEach((review: any) => {
      if (!review?.product_id) return;
      totals.set(review.product_id, (totals.get(review.product_id) || 0) + Number(review.rating || 5));
    });
    return totals;
  }, [allReviews]);

  const availableCities = useMemo(
    () => buildAvailableCities(allProducts || [], allSellers || []),
    [allProducts, allSellers],
  );

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
    setSelectedProduct(type || '');
    
    const sub = searchParams.get('subtype');
    setSubType(sub || 'all');

    const script = searchParams.get('script');
    setScriptType(script || 'all');

    const qual = searchParams.get('quality');
    setQualityLevel(qual || 'all');

    const qty = searchParams.get('quantity');
    setQuantity(qty ? Number(qty) : 1);

    const size = searchParams.get('size');
    setScrollSize(size || 'all');

    const shipping = searchParams.get('shipping');
    setShippingPreference(shipping === 'shipping' || shipping === 'pickup' || shipping === 'all' ? shipping : 'all');

    const city = searchParams.get('city');
    const detectedCityFromParams = searchParams.get('detectedCity');
    setSelectedCity(city || '');
    setDetectedCity(
      detectedCityFromParams && detectedCityFromParams !== UNKNOWN_CITY_LABEL
        ? detectedCityFromParams
        : city || null,
    );
    setIncludeNearbyCities(searchParams.get('nearby') === 'true' || searchParams.get('nearMe') === 'true');

    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    setUserCoords(lat && lng ? { lat: Number(lat), lng: Number(lng) } : null);

    const mar = searchParams.get('married');
    setMarriedOnly(mar === 'true');
    const mkv = searchParams.get('mikveh');
    setMikvehFreq(mkv && mkv !== 'all' ? mkv : '');
    const cert = searchParams.get('cert');
    setCertStatus(cert && cert !== 'all' ? cert : '');
    const study = searchParams.get('study');
    setStudyFreq(study && study !== 'all' ? study : '');

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
        
        try {
          const { city } = await reverseGeocodeWithGoogle(latitude, longitude);
          if (city) {
            setDetectedCity(city);
            setSelectedCity(city);
            toast({ title: "המיקום זוהה", description: `זוהית ב: ${city}` });
          } else {
            setDetectedCity(null);
            setSelectedCity('');
            toast({ title: "המיקום זוהה", description: "לא הצלחנו לזהות עיר מדויקת. אפשר לבחור עיר מהרשימה." });
          }
          setIsDetecting(false);
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
      const knownSizesForSelection =
        selectedProduct === 'מזוזה'
          ? ['10', '12', '15']
          : selectedProduct === 'תפילין'
            ? ['סטנדרט (32-34)', 'פיצפונים', 'קטן (28)', 'שימושא רבא (40)']
            : selectedProduct === 'ספר תורה'
              ? scriptType === 'ספרדי'
                ? ['17', '36', '48', '50', '56']
                : ['17', '30', '36', '42', '48']
              : [];
      const normalizedKnownSizes = new Set(
        knownSizesForSelection.map((size) => String(size).trim()),
      );
      const normalizedProductSize = String(p.parchment_size ?? '').trim();
      const matchSize =
        scrollSize === 'all' ||
        (scrollSize === 'other'
          ? (knownSizesForSelection.length === 0 ||
            (Boolean(normalizedProductSize) && !normalizedKnownSizes.has(normalizedProductSize)))
          : p.parchment_size === scrollSize);
      const numericPrice = Number(p.price) || 0;
      const matchPrice = numericPrice >= activePriceRange[0] && numericPrice <= activePriceRange[1];

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
      
      const seller = sellerById.get(p.seller_id);
      const matchMarried = !marriedOnly || (seller && seller.marital_status === 'married');
      const matchMikveh = !mikvehFreq || mikvehFreq === 'all' || (seller && seller.mikveh_frequency === mikvehFreq);
      const matchCert = !certStatus || certStatus === 'all' || (seller && seller.has_scribe_certificate === certStatus);
      const matchStudy = !studyFreq || studyFreq === 'all' || (seller && seller.torah_study_frequency === studyFreq);
      const matchApproved = seller?.is_approved === true;
      
      return matchType && matchSub && matchScript && matchQuality && matchQty && matchSize && matchPrice &&
             matchShipping && matchMarried && matchMikveh && matchCert && matchStudy && matchApproved;
    });

    if (sortOrder === 'price_asc') results = [...results].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sortOrder === 'price_desc') results = [...results].sort((a, b) => Number(b.price) - Number(a.price));
    else if (sortOrder === 'rating') {
      results = [...results].sort((a, b) => {
        const ratingA = reviewTotalsByProduct.get(a.id) || 0;
        const ratingB = reviewTotalsByProduct.get(b.id) || 0;
        return ratingB - ratingA;
      });
    }

    return results;
  }, [activePriceRange, allProducts, certStatus, marriedOnly, mikvehFreq, qualityLevel, quantity, reviewTotalsByProduct, scriptType, scrollSize, selectedProduct, sellerById, shippingPreference, sortOrder, studyFreq, subType]);

  useEffect(() => {
    let cancelled = false;
    const exactCityMap = Object.fromEntries(getCityCandidates(selectedCity).map((city) => [city, 0]));

    if (!selectedCity || !includeNearbyCities) {
      setNearbyCityDistanceMap({});
      return () => {
        cancelled = true;
      };
    }

    setNearbyCityDistanceMap(exactCityMap);

    const loadNearbyCities = async () => {
      try {
        const referenceCoords = userCoords || await (async () => {
          const { lat, lng } = await geocodeAddressWithGoogle(selectedCity);
          return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
        })();

        if (!referenceCoords) {
          if (!cancelled) setNearbyCityDistanceMap(exactCityMap);
          return;
        }

        const cityEntries = await Promise.all(
          availableCities.map(async (city) => {
            try {
              const { lat, lng } = await geocodeAddressWithGoogle(city);
              if (typeof lat === 'number' && typeof lng === 'number') {
                return [normalizeCity(city), Math.round(haversineDistance(referenceCoords.lat, referenceCoords.lng, lat, lng))] as const;
              }
            } catch {
              return null;
            }
            return null;
          }),
        );

        if (cancelled) return;

        setNearbyCityDistanceMap(
          {
            ...exactCityMap,
            ...Object.fromEntries(
              cityEntries.filter(Boolean).filter((entry) => entry![1] <= NEARBY_RADIUS_KM) as ReadonlyArray<readonly [string, number]>,
            ),
          },
        );
      } catch {
        if (!cancelled) setNearbyCityDistanceMap(exactCityMap);
      }
    };

    loadNearbyCities();

    return () => {
      cancelled = true;
    };
  }, [availableCities, includeNearbyCities, selectedCity, userCoords]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedCity) {
      setNearbyDistanceMap({});
      return () => {
        cancelled = true;
      };
    }

    const nextDistanceMap = Object.fromEntries(
      baseFilteredProducts.map((product) => {
        const seller = sellerById.get(product.seller_id);
        const productCityTokens = getProductCityTokens(product, seller);
        const matchedDistances = productCityTokens
          .map((city) => nearbyCityDistanceMap[city])
          .filter((distance): distance is number => typeof distance === 'number');
        return [product.id, matchedDistances.length > 0 ? Math.min(...matchedDistances) : 0];
      }),
    );

    if (!cancelled) {
      setNearbyDistanceMap(nextDistanceMap);
    }

    return () => {
      cancelled = true;
    };
  }, [baseFilteredProducts, includeNearbyCities, nearbyCityDistanceMap, selectedCity, sellerById]);

  const filteredProducts = useMemo(() => {
    if (!selectedCity) return baseFilteredProducts;

    const exactCityCandidates = new Set(getCityCandidates(selectedCity));
    const allowedCities = includeNearbyCities
      ? new Set(Object.keys(nearbyCityDistanceMap))
      : exactCityCandidates;

    const results = baseFilteredProducts.filter((product) => {
      const seller = sellerById.get(product.seller_id);
      const productCityTokens = getProductCityTokens(product, seller);
      return productCityTokens.some((city) => allowedCities.has(city));
    });

    if (includeNearbyCities) {
      return [...results].sort((a, b) => (nearbyDistanceMap[a.id] || 0) - (nearbyDistanceMap[b.id] || 0));
    }

    return results;
  }, [baseFilteredProducts, includeNearbyCities, nearbyCityDistanceMap, nearbyDistanceMap, selectedCity, sellerById]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedProduct) count += 1;
    if (scriptType !== 'all') count += 1;
    if (scrollSize !== 'all') count += 1;
    if (selectedCity) count += 1;
    if (shippingPreference !== 'all') count += 1;
    if (certStatus) count += 1;
    if (studyFreq) count += 1;
    if (mikvehFreq) count += 1;
    if (marriedOnly) count += 1;
    if (includeNearbyCities) count += 1;
    if (sortOrder !== 'newest') count += 1;
    if (priceRange !== null) count += 1;
    return count;
  }, [
    certStatus,
    includeNearbyCities,
    marriedOnly,
    mikvehFreq,
    priceRange,
    scriptType,
    scrollSize,
    selectedProduct,
    selectedCity,
    shippingPreference,
    sortOrder,
    studyFreq,
  ]);

  useEffect(() => {
    setVisibleCount(PRODUCTS_PAGE_SIZE);
  }, [selectedProduct, subType, scriptType, qualityLevel, quantity, scrollSize,
      selectedCity, shippingPreference, sortOrder, certStatus, studyFreq, marriedOnly,
      mikvehFreq, includeNearbyCities, detectedCity, priceRange]);

  const nearbyCityLabels = useMemo(
    () => availableCities.filter((city) => Object.prototype.hasOwnProperty.call(nearbyCityDistanceMap, normalizeCity(city))),
    [availableCities, nearbyCityDistanceMap],
  );

  const resetFilters = () => {
    setSelectedProduct(''); setSubType('all'); setScriptType('all'); setQualityLevel('all');
    setQuantity(1); setScrollSize('all'); setSelectedCity(''); setUserCoords(null); setDetectedCity(null);
    setMarriedOnly(false); setMikvehFreq(''); setCertStatus(''); setStudyFreq('');
    setShippingPreference('all'); setSortOrder('newest');
    resetPriceRange();
    setNearbyCityDistanceMap({}); setNearbyDistanceMap({});
    setIncludeNearbyCities(false);
    setVisibleCount(PRODUCTS_PAGE_SIZE);
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
                <CustomFilterTile value="other" label="שאר הגדלים" active={scrollSize === 'other'} />
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
          <CitySelect
            value={selectedCity}
            options={availableCities}
            placeholder="בחר עיר לסינון"
            onChange={setSelectedCity}
            layout="inline"
          />
          <Label className="flex items-center justify-between rounded-2xl border border-primary/10 bg-white px-4 py-4 transition-all cursor-pointer hover:border-primary/20">
            <div className="space-y-1 text-right">
              <span className="block text-sm font-bold text-primary">חפש גם בערים קרובות</span>
              <span className="block text-[11px] font-medium text-primary/45">מוצרים מערים עד {NEARBY_RADIUS_KM} ק״מ</span>
            </div>
            <Checkbox checked={includeNearbyCities} onCheckedChange={(value) => setIncludeNearbyCities(!!value)} />
          </Label>
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
            <div className="grid gap-1.5">
              <CustomFilterTile value="valid" label="תעודה בתוקף" active={certStatus === 'valid'} onClick={() => setCertStatus(certStatus === 'valid' ? '' : 'valid')} />
              <CustomFilterTile value="expired" label="תעודה בעבר" active={certStatus === 'expired'} onClick={() => setCertStatus(certStatus === 'expired' ? '' : 'expired')} />
              <CustomFilterTile value="none" label="ללא תעודה" active={certStatus === 'none'} onClick={() => setCertStatus(certStatus === 'none' ? '' : 'none')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] font-black text-primary/30">לימוד תורה</Label>
            <div className="grid gap-1.5">
              <CustomFilterTile value="fixed" label="קובע עיתים" active={studyFreq === 'fixed'} onClick={() => setStudyFreq(studyFreq === 'fixed' ? '' : 'fixed')} />
              <CustomFilterTile value="half-day" label="אברך חצי יום" active={studyFreq === 'half-day'} onClick={() => setStudyFreq(studyFreq === 'half-day' ? '' : 'half-day')} />
              <CustomFilterTile value="full-day" label="אברך יום שלם" active={studyFreq === 'full-day'} onClick={() => setStudyFreq(studyFreq === 'full-day' ? '' : 'full-day')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] font-black text-primary/30">מנהג טבילה</Label>
            <div className="grid gap-1.5">
              <CustomFilterTile value="daily" label="טובל יומיום" active={mikvehFreq === 'daily'} onClick={() => setMikvehFreq(mikvehFreq === 'daily' ? '' : 'daily')} />
              <CustomFilterTile value="never" label="ללא טבילה" active={mikvehFreq === 'never'} onClick={() => setMikvehFreq(mikvehFreq === 'never' ? '' : 'never')} />
            </div>
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
            <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[95vw] overflow-hidden rounded-[2rem] border-none bg-white p-0 shadow-2xl ring-1 ring-primary/5 sm:max-w-[560px] flex flex-col" dir="rtl">
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
              <div className="flex flex-col justify-between gap-4 border-b border-primary/5 pb-5 md:flex-row md:items-end md:gap-6 md:pb-8">
                <div className="relative w-full">
                  <div className="no-scrollbar -mb-2 w-full overflow-x-auto pb-2 touch-pan-x">
                    <div className="flex min-w-max snap-x snap-mandatory items-center gap-2 px-1 md:gap-3">
                    <div className="flex snap-start items-center rounded-full border border-primary/10 bg-white p-1 shadow-sm">
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
                        <SelectTrigger className="h-11 w-[196px] shrink-0 snap-start rounded-full border border-primary/10 bg-white px-3 text-[11px] font-black text-primary shadow-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/[0.03] hover:shadow-md focus:ring-0 focus:ring-offset-0 data-[state=open]:border-accent/30 data-[state=open]:bg-accent/5 data-[state=open]:shadow-lg md:h-10">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                              <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                            </span>
                            <div className="flex min-w-0 flex-col items-start leading-none">
                              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-primary/40">מיון</span>
                              <span className="min-w-0 truncate text-[11px] text-primary">
                                <SelectValue placeholder="מוצרים חדשים" />
                              </span>
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-[1.5rem] border border-primary/10 bg-white/97 p-2 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                          {SORT_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="rounded-2xl py-3 pr-4 pl-9 text-right text-xs font-black text-primary transition-colors focus:bg-accent/10 focus:text-primary data-[state=checked]:bg-primary/5 data-[state=checked]:text-primary md:text-sm"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button variant="ghost" onClick={resetFilters} className="h-11 shrink-0 snap-start rounded-full px-4 text-[11px] font-black text-primary/40 transition-all hover:bg-destructive/5 hover:text-destructive md:h-10">
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
                <div className="w-full shrink-0 px-1 text-right md:w-auto">
                  <h2 className="text-2xl md:text-4xl font-headline font-black text-primary tracking-tighter">מוצרים שנמצאו ({filteredProducts.length})</h2>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={() => setIsFilterPanelOpen(true)} className="group h-10 rounded-full border border-primary/10 bg-white px-4 text-[11px] font-black text-primary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/[0.03] hover:text-primary hover:shadow-md active:scale-95">
                  <SlidersHorizontal className="ml-1.5 h-3 w-3 text-accent transition-transform duration-300 group-hover:rotate-6" />
                  <span>סינון</span>
                  {activeFiltersCount > 0 && (
                    <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
                {detectedCity && (
                  <div className="animate-in fade-in flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-black text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> זיהינו: {detectedCity}
                  </div>
                )}
                {selectedCity && (
                  <div className="flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2 text-[11px] font-black text-primary">
                    <MapPin className="h-3.5 w-3.5 text-accent" />
                    מחפש ב{selectedCity}
                  </div>
                )}
                {includeNearbyCities && selectedCity && (
                  <div className="rounded-full bg-amber-50 px-4 py-2 text-[11px] font-black text-amber-700">
                    כולל ערים קרובות עד {NEARBY_RADIUS_KM} ק״מ
                  </div>
                )}
              </div>

              {includeNearbyCities && nearbyCityLabels.length > 1 && (
                <div className="mt-3 text-right text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  מציג גם ערים קרובות: {nearbyCityLabels.join(' • ')}
                </div>
              )}
            </div>

            {/* Torah Banner placement: Truly full width, below search filters */}
            {selectedProduct === 'ספר תורה' && <TorahExpertBanner />}

            <div className="container mx-auto px-4 pb-20 pt-6 md:pt-8">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-5 xl:grid-cols-3 xl:gap-7">
                {filteredProducts.slice(0, visibleCount).map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: shouldReduceMotion ? 0 : Math.min(i, 6) * 0.04, duration: shouldReduceMotion ? 0.1 : 0.25 }}
                  >
                    <ProductCard product={p} distanceKm={includeNearbyCities && selectedCity ? nearbyDistanceMap[p.id] : undefined} priority={i === 0} />
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

              {visibleCount < filteredProducts.length && (
                <div className="flex justify-center mt-10">
                  <Button
                    onClick={() => setVisibleCount(prev => prev + PRODUCTS_PAGE_SIZE)}
                    variant="outline"
                    className="rounded-full px-12 h-14 border-2 border-primary/10 text-primary font-black text-sm hover:bg-primary hover:text-white transition-all shadow-lg gap-3"
                  >
                    <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
                    טען עוד ({filteredProducts.length - visibleCount} נוספים)
                  </Button>
                </div>
              )}
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
      "group flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 p-4 transition-all duration-200",
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

function CustomFilterTile({ value, label, active, onClick }: any) {
  const className = cn(
    "group flex min-h-11 cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 transition-all duration-200",
    active ? "border-primary bg-primary/5 shadow-sm scale-[1.01]" : "border-primary/5 bg-white hover:bg-slate-50 hover:border-primary/15"
  );
  const content = (
    <>
      {!onClick && <RadioGroupItem value={value} className="hidden" />}
      <span className={cn("font-bold text-[10px] transition-colors", active ? "text-primary" : "text-primary/50 group-hover:text-primary/70")}>{label}</span>
      <div className={cn(
        "w-3 h-3 rounded-full border-2 transition-all duration-200",
        active ? "bg-primary border-primary scale-110 shadow-sm" : "border-primary/10 group-hover:border-primary/30"
      )} />
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} aria-pressed={active}>
        {content}
      </button>
    );
  }

  return (
    <Label className={className}>
      {content}
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
        "flex h-9 min-w-[74px] touch-manipulation items-center justify-center rounded-full px-3 text-[11px] font-black transition-all md:h-8 md:min-w-0 md:text-[10px]",
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
    <div className="overflow-hidden rounded-2xl border-2 border-primary/5 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex min-h-12 w-full touch-manipulation items-center justify-between px-4 py-3 text-right transition-colors hover:bg-slate-50"
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
