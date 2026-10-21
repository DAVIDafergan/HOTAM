"use client";

import React, { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Scroll, 
  Package, 
  Crown, 
  BookOpen, 
  Palette, 
  ChevronRight, 
  ChevronLeft,
  UserCheck,
  LocateFixed,
  Loader2,
  Settings2,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CitySelect } from '@/components/CitySelect';
import { COMMON_CITY_OPTIONS, NEARBY_RADIUS_KM } from '@/lib/location-utils';
import { AmbientBackdrop } from '@/components/motion/AmbientBackdrop';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';
type ShippingPreference = 'all' | 'shipping' | 'pickup';

const MotionButton = motion.create(Button);

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

// The desktop wizard card and the mobile Sheet share one `wizardSteps` JSX tree (same
// component-scoped state) so the two surfaces never drift — but that means the desktop
// copy used to always mount/hydrate even on mobile, just CSS-hidden (`hidden md:block`),
// wasting a non-trivial chunk of hydration cost on every mobile load.
// useLayoutEffect (not useEffect) resolves the real viewport synchronously before the
// browser paints anything, so SSR/first-paint always shows the placeholder, then swaps to
// the real content pre-paint — no visible flash, no hydration-mismatch warning (hydration
// reconciles against the placeholder first; the swap is a later, pre-paint update).
function useIsDesktopViewport(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function HeroAnimation() {
  const router = useRouter();
  const { toast } = useToast();
  const shouldReduceMotion = useReducedMotion();
  const isDesktop = useIsDesktopViewport();

  // Wizard States
  const [step, setStep] = useState(1);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductType>('');
  const [subType, setSubType] = useState('all');
  const [scriptType, setScriptType] = useState('all');
  const [qualityLevel, setQualityLevel] = useState('all');
  const [quantity, setQuantity] = useState(1);
  
  // Location States
  const [selectedCity, setSelectedCity] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [includeNearbyCities, setIncludeNearbyCities] = useState(false);
  const [shippingPreference, setShippingPreference] = useState<ShippingPreference>('all');

  // Advanced Scribe Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scrollSize, setScrollSize] = useState('all');
  const [marriedOnly, setMarriedOnly] = useState(false);
  const [mikvehFreq, setMikvehFreq] = useState('');
  const [certStatus, setCertStatus] = useState('');
  const [studyFreq, setStudyFreq] = useState('');

  // Megillah specific size states
  const [megillahRows, setMegillahRows] = useState('all');
  const [megillahHeight, setMegillahHeight] = useState('all');

  const handleCategorySelect = (type: ProductType) => {
    setSelectedProduct(type);
    // Reset subType when the new product has no subtypes to avoid stale filter
    if (getSubTypesForProduct(type).length === 0) setSubType('all');
  };

  const detectLocation = () => {
    setIsDetectingLocation(true);
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "שגיאה", description: "הדפדפן שלך אינו תומך בזיהוי מיקום" });
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });

        try {
          const { reverseGeocodeWithGoogle } = await import('@/lib/google-maps');
          const { city } = await reverseGeocodeWithGoogle(latitude, longitude);
          if (city) {
            setDetectedCity(city);
            setSelectedCity(city);
            // Cascade to nearby cities by default: exact-city matches show first, then
            // remaining results fill in sorted by proximity, instead of a strict match only.
            setIncludeNearbyCities(true);
            toast({ variant: "success", title: `מיקום זוהה: ${city}` });
          } else {
            setDetectedCity(null);
            setSelectedCity('');
            toast({ title: "המיקום זוהה", description: "לא הצלחנו לזהות עיר מדויקת. אפשר לבחור עיר ידנית מהרשימה." });
          }
        } catch {
          toast({ variant: "success", title: "מיקום זוהה" });
        }

        setIsDetectingLocation(false);
      },
      () => {
        setIsDetectingLocation(false);
        toast({ variant: "destructive", title: "גישה נדחתה", description: "לא ניתן היה לזהות מיקום." });
      }
    );
  };

  const getSubTypesForProduct = (type: ProductType) => {
    switch (type) {
      case 'מזוזה': return ['קלף', 'קלף + בית'];
      case 'מגילה': return ['אסתר', 'רות', 'איכה', 'שיר השירים', 'קהלת'];
      case 'מוצרי יודאיקה שונים': return ['פיטום הקטורת', 'אשת חיל', 'למנצח', 'ספר הפטרות'];
      default: return [];
    }
  };

  const getQualityLevels = (type: ProductType) => {
    if (type === 'תפילין') {
      return [
        { v: 'all', l: 'הכל' },
        { v: 'פשוט (בהמה דקה)', l: 'פשוט' },
        { v: 'כשר', l: 'כשר' },
        { v: 'מהודר', l: 'מהודר' },
        { v: 'מהודר מאד', l: 'מהודר מאד' }
      ];
    }
    return [
      { v: 'all', l: 'הכל' },
      { v: 'כשר', l: 'כשר' },
      { v: 'מהודר', l: 'מהודר' },
      { v: 'מהודר מאד', l: 'מהודר מאד' }
    ];
  };

  const getSizesForProduct = (type: ProductType, script: string) => {
    if (type === 'תפילין') return ['סטנדרט (32-34)', 'פיצפונים', 'קטן (28)', 'שימושא רבא (40)'];
    if (type === 'מזוזה') return ['10', '12', '15'];
    if (type === 'ספר תורה') {
      if (script === 'ספרדי') return ['17', '36', '48', '50', '56'];
      return ['17', '30', '36', '42', '48'];
    }
    return [];
  };
  const hasSubTypes = getSubTypesForProduct(selectedProduct).length > 0;
  const finalSearchButtonClass = "w-full max-w-3xl inline-flex items-center justify-center bg-accent text-primary hover:bg-[hsl(38_62%_42%)] rounded-full px-10 md:px-16 h-16 font-bold text-[17px] md:text-lg shadow-premium gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 transition-colors duration-300 group";

  const handleFinalSearch = () => {
    const params = new URLSearchParams();
    params.set('view', 'results');
    if (selectedProduct) params.set('product', selectedProduct);
    if (subType !== 'all') params.set('subtype', subType);
    if (scriptType !== 'all') params.set('script', scriptType);
    if (qualityLevel !== 'all') params.set('quality', qualityLevel);
    if (quantity > 1) params.set('quantity', String(quantity));
    if (selectedCity) params.set('city', selectedCity);
    if (shippingPreference !== 'all') params.set('shipping', shippingPreference);
    if (userCoords) {
      params.set('lat', String(userCoords.lat));
      params.set('lng', String(userCoords.lng));
      if (detectedCity) params.set('detectedCity', detectedCity);
    }
    if (includeNearbyCities) params.set('nearby', 'true');

    let finalSize = scrollSize;
    if (selectedProduct === 'מגילה') {
      if (megillahRows !== 'all' || megillahHeight !== 'all') {
        const rowsPart = megillahRows !== 'all' ? `${megillahRows} שורות` : '';
        const heightPart = megillahHeight !== 'all' ? megillahHeight : '';
        finalSize = [rowsPart, heightPart].filter(Boolean).join(', ');
      }
    }
    
    if (finalSize !== 'all' && finalSize !== '') params.set('size', finalSize);
    if (marriedOnly) params.set('married', 'true');
    if (mikvehFreq) params.set('mikveh', mikvehFreq);
    if (certStatus) params.set('cert', certStatus);
    if (studyFreq) params.set('study', studyFreq);

    router.push(`/search?${params.toString()}`);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'בוקר טוב';
    if (hour >= 12 && hour < 18) return 'צהריים טובים';
    if (hour >= 18 && hour < 22) return 'ערב טוב';
    return 'לילה טוב';
  };

  // Shared step content, reused by both the always-visible desktop card and the
  // on-demand mobile overlay (Sheet) so the two surfaces never drift out of sync.
  const wizardSteps = (
    <>
      {/* Step indicator */}
      <div className="flex flex-col items-center mb-3 md:mb-10 gap-4">
        <div className="flex items-center gap-0">
          {[
            { n: 1, label: 'בחירת מוצר' },
            { n: 2, label: 'מפרט הלכתי' },
            { n: 3, label: 'התאמה אישית' },
          ].map(({ n, label }, i) => (
            <React.Fragment key={n}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border transition-all duration-500 num",
                  step === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : step > n
                    ? "bg-accent/15 text-accent-strong border-accent/40"
                    : "bg-card text-primary/45 border-border"
                )}>
                {step > n ? <span aria-label="שלב הושלם" className="text-accent-strong text-base leading-none">✓</span> : n}
                </div>
                <span className={cn(
                  "text-[13px] font-semibold transition-colors hidden sm:block",
                  step === n ? "text-primary" : "text-primary/60"
                )}>{label}</span>
              </div>
              {i < 2 && (
                <div className={cn(
                  "w-12 md:w-20 h-0.5 mb-5 transition-all duration-500",
                  step > n ? "bg-accent/40" : "bg-primary/10"
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Persistent selection summary — stays visible across every step so the
          customer never loses track of what they've already chosen. */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center justify-center gap-2 mb-4 md:mb-8"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
              {selectedProduct}
            </span>
            {quantity > 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
                {quantity} יח'
              </span>
            )}
            {selectedCity && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
                {selectedCity}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="space-y-4 md:space-y-10">
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-2xl md:text-[2rem] font-body font-semibold text-primary">מה אתם מחפשים?</h2>
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
              <CategoryCard icon={<Scroll />} label="מזוזה" onClick={() => handleCategorySelect('מזוזה')} color="indigo" active={selectedProduct === 'מזוזה'} />
              <CategoryCard icon={<Package />} label="תפילין" onClick={() => handleCategorySelect('תפילין')} color="blue" active={selectedProduct === 'תפילין'} />
              <CategoryCard icon={<Crown />} label="מגילה" onClick={() => handleCategorySelect('מגילה')} color="amber" active={selectedProduct === 'מגילה'} />
              <CategoryCard icon={<BookOpen />} label="ספר תורה" onClick={() => handleCategorySelect('ספר תורה')} color="emerald" active={selectedProduct === 'ספר תורה'} />
              {/* Judaica isn't part of the scribal spec wizard — straight to all Judaica results. */}
              <CategoryCard icon={<Palette />} label="יודאיקה" onClick={() => router.push('/search?view=results&group=judaica')} color="purple" />
            </div>

            <AnimatePresence>
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                  className="flex flex-col items-center gap-4 pt-2"
                >
                  <div className="flex items-center gap-3 bg-card p-1.5 rounded-full border border-border">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="הפחת כמות" className="w-11 h-11 rounded-full border border-border font-bold hover:bg-secondary/60 active:scale-95 transition-all text-primary flex items-center justify-center text-lg bg-card">−</button>
                    <div className="flex items-center gap-2 px-4">
                      <span className="text-2xl font-black text-primary tabular-nums leading-none">{quantity}</span>
                      <span className="text-sm font-semibold text-primary/70">יח'</span>
                    </div>
                    <button type="button" onClick={() => setQuantity(quantity + 1)} aria-label="הוסף כמות" className="w-11 h-11 rounded-full border border-border font-bold hover:bg-secondary/60 active:scale-95 transition-all text-primary flex items-center justify-center text-lg bg-card">+</button>
                  </div>
                  <Button onClick={() => setStep(2)} variant="gold" className="px-10 group gap-2">
                    המשך למפרט <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => router.push('/search?view=all')}
                className="h-11 px-6 rounded-full text-sm font-semibold text-primary/75 hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/25 gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                צפה בכל המוצרים ללא פילטר
                <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="space-y-4 md:space-y-7 text-right">
            <div className="flex justify-between items-center border-b border-primary/5 pb-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="font-semibold text-sm h-11 px-4 rounded-full hover:bg-primary/5 gap-1"><ChevronRight className="w-4 h-4" /> חזור</Button>
              <div className="text-right">
                <h2 className="text-xl md:text-2xl font-body font-semibold text-primary">איזה סוג בדיוק?</h2>
                <p className="text-[13px] text-primary/65 font-medium mt-0.5">עבור {selectedProduct} · שלב 2 מתוך 3</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {hasSubTypes && (
                <div className="space-y-4 rounded-2xl md:rounded-3xl bg-secondary/40 md:bg-card border-0 md:border md:border-border/70 p-4 md:p-5 shadow-none md:shadow-sm">
                  <Label className="text-sm font-bold text-primary/85 mr-1">תת-סוג המוצר</Label>
                  <RadioGroup value={subType} onValueChange={setSubType} className="grid grid-cols-2 gap-3">
                    {selectedProduct !== 'מזוזה' && <CustomTile value="all" label="כל הסוגים" active={subType === 'all'} />}
                    {getSubTypesForProduct(selectedProduct).map(opt => <CustomTile key={opt} value={opt} label={opt} active={subType === opt} />)}
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-4 rounded-2xl md:rounded-3xl bg-secondary/40 md:bg-card border-0 md:border md:border-border/70 p-4 md:p-5 shadow-none md:shadow-sm">
                <Label className="text-sm font-bold text-primary/85 mr-1">סוג הכתב (מסורת)</Label>
                <RadioGroup value={scriptType} onValueChange={setScriptType} className="grid grid-cols-1 gap-2">
                  {[
                    {v: 'all', l: 'כל המסורות'},
                    {v: 'ספרדי', l: 'ספרדי (עדות המזרח)'},
                    {v: 'אשכנזי - בית יוסף', l: 'אשכנזי - בית יוסף'},
                    {v: 'אשכנזי - האר"י', l: 'אשכנזי - האר"י (חסידי)'},
                    {v: 'אשכנזי - אדמו"ר הזקן', l: 'אשכנזי - אדמו"ר הזקן (חב"ד)'}
                  ].map(s => (
                    <CustomTile key={s.v} value={s.v} label={s.l} active={scriptType === s.v} compact />
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-4 rounded-2xl md:rounded-3xl bg-secondary/40 md:bg-card border-0 md:border md:border-border/70 p-4 md:p-5 shadow-none md:shadow-sm">
                <Label className="text-sm font-bold text-primary/85 mr-1">רמת הידור מבוקשת</Label>
                <RadioGroup value={qualityLevel} onValueChange={setQualityLevel} className="grid grid-cols-2 gap-3">
                  {getQualityLevels(selectedProduct).map(q => <CustomTile key={q.v} value={q.v} label={q.l} active={qualityLevel === q.v} compact />)}
                </RadioGroup>
              </div>

              <div className="space-y-4 rounded-2xl md:rounded-3xl bg-secondary/40 md:bg-card border-0 md:border md:border-border/70 p-4 md:p-5 shadow-none md:shadow-sm">
                {selectedProduct === 'מגילה' ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-primary/85 mr-1">מספר שורות</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {['all', '11', '21', '28', '42'].map(r => (
                          <button
                            type="button"
                            key={r}
                            onClick={() => {
                              setMegillahRows(r);
                              setMegillahHeight('all');
                            }}
                            className={cn(
                              "h-14 rounded-2xl border font-bold text-sm transition-all",
                              megillahRows === r ? "border-primary bg-primary text-primary-foreground" : "bg-card border-border text-primary hover:border-primary/40"
                            )}
                          >
                            {r === 'all' ? 'הכל' : r === '42' ? '42 (האר"י)' : r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm font-bold text-primary/85 mr-1">גובה קלף (ס"מ)</Label>
                      <Select value={megillahHeight} onValueChange={setMegillahHeight}>
                        <SelectTrigger className="h-14 rounded-2xl text-right font-bold text-base sm:text-sm bg-white/50 border-2 border-transparent">
                          <SelectValue placeholder="בחר גובה..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-2xl p-1">
                          <SelectItem value="all" className="font-bold py-3 rounded-xl">כל הגבהים</SelectItem>
                          {megillahRows === '11' ? (
                            <>
                              <SelectItem value={"8-10 ס\"מ"} className="font-bold py-3 rounded-xl">{'8-10 ס"מ (סטנדרט)'}</SelectItem>
                              <SelectItem value={"15-20 ס\"מ (הרב עובדיה)"} className="font-bold py-3 rounded-xl">{'15-20 ס"מ (הרב עובדיה)'}</SelectItem>
                            </>
                          ) : (
                            ['12', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(h => (
                              <SelectItem key={h} value={`${h} ס"מ`} className="font-bold py-3 rounded-xl">{h} ס"מ</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-primary/85 mr-1">גודל הקלף (ס"מ)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[...getSizesForProduct(selectedProduct, scriptType), 'other'].map(sz => (
                        <button type="button" key={sz} onClick={() => setScrollSize(sz)} className={cn("h-12 rounded-xl border font-bold text-sm transition-all", scrollSize === sz ? "border-primary bg-primary text-primary-foreground" : "bg-card border-border text-primary hover:border-primary/40")}>{sz === 'other' ? 'שאר הגדלים' : sz}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center pt-4 md:pt-8">
               <Button onClick={() => setStep(3)} variant="gold" size="lg" className="px-14 group gap-2">
                 המשך למיקום וקבלה <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
               </Button>
             </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="space-y-4 md:space-y-7 text-right">
            <div className="flex justify-between items-center border-b border-primary/5 pb-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="font-semibold text-sm h-11 px-4 rounded-full hover:bg-primary/5 gap-1"><ChevronRight className="w-4 h-4" /> חזור</Button>
              <div className="text-right">
                <h2 className="text-xl md:text-2xl font-body font-semibold text-primary">איפה ואיך תרצו לקבל?</h2>
                <p className="text-[13px] text-primary/65 font-medium mt-0.5">שלב 3 מתוך 3</p>
              </div>
            </div>

            <div className="max-w-2xl mx-auto w-full space-y-6 rounded-2xl md:rounded-3xl bg-secondary/40 md:bg-card border-0 md:border md:border-border/70 p-4 md:p-6 shadow-none md:shadow-sm">
              <div className="space-y-4 pb-5 border-b border-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-bold text-primary/85 mr-1">באיזה אזור לחפש? (לא חובה)</Label>
                  <Button variant="ghost" onClick={handleFinalSearch} className="shrink-0 h-10 px-3 rounded-full font-semibold text-sm text-primary/70 hover:text-primary hover:bg-primary/5">
                    דלג, הצג הכל
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" onClick={detectLocation} disabled={isDetectingLocation} className={cn("h-12 md:h-14 rounded-2xl gap-3 font-semibold text-sm border transition-all", userCoords ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'hover:border-primary/30')}>
                    {isDetectingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
                    {userCoords ? (detectedCity ? `המיקום שלך: ${detectedCity}` : 'המיקום שלך זוהה בהצלחה') : 'זהה את המיקום הנוכחי שלי'}
                  </Button>
                  <CitySelect
                    value={selectedCity}
                    options={[...COMMON_CITY_OPTIONS]}
                    placeholder="בחר עיר"
                    onChange={(city) => { setSelectedCity(city); if (city) setIncludeNearbyCities(true); }}
                    triggerClassName="h-12 md:h-14 rounded-2xl text-base sm:text-sm border-2 border-transparent bg-white/50 focus:border-primary/20"
                  />
                  <Label className="flex items-center justify-between rounded-2xl border-2 border-primary/5 bg-white/80 px-4 py-4 shadow-sm transition-all hover:border-primary/10">
                    <div className="space-y-1 text-right">
                      <span className="block text-sm font-bold text-primary">חפש גם בערים קרובות</span>
                      <span className="block text-[13px] font-medium text-primary/65">עד {NEARBY_RADIUS_KM} ק״מ מהעיר שנבחרה</span>
                    </div>
                    <Checkbox checked={includeNearbyCities} onCheckedChange={(value) => setIncludeNearbyCities(!!value)} className="w-5 h-5 rounded-md" />
                  </Label>
                </div>
              </div>

              <div className="pt-2">
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-primary/85 mr-1">אופן קבלת המוצר</Label>
                  <RadioGroup value={shippingPreference} onValueChange={(v) => setShippingPreference(v as ShippingPreference)} className="grid grid-cols-3 gap-2">
                    <CustomTile value="all" label="הכל" active={shippingPreference === 'all'} compact />
                    <CustomTile value="shipping" label="משלוח בלבד" active={shippingPreference === 'shipping'} compact />
                    <CustomTile value="pickup" label="איסוף עצמי בלבד" active={shippingPreference === 'pickup'} compact />
                  </RadioGroup>
                </div>
                <div className="pt-5">
                  <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full h-12 md:h-14 rounded-2xl border border-dashed border-primary/20 gap-3 font-semibold text-sm text-primary/75 hover:bg-primary/5 hover:border-primary/30 transition-all">
                    <Settings2 className="w-5 h-5 text-accent" /> {showAdvanced ? 'הסתר הגדרות סופר מתקדמות' : 'מסנני קדושה והנהגת הסופר'}
                  </Button>
                </div>
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-5 px-1">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <Label className="text-sm font-bold text-primary/85 mr-1">הסמכת הסופר</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <CustomTile value="valid" label="תעודה בתוקף" active={certStatus === 'valid'} compact onClick={() => setCertStatus(certStatus === 'valid' ? '' : 'valid')} />
                              <CustomTile value="expired" label="תעודה בעבר" active={certStatus === 'expired'} compact onClick={() => setCertStatus(certStatus === 'expired' ? '' : 'expired')} />
                              <CustomTile value="none" label="ללא תעודה" active={certStatus === 'none'} compact onClick={() => setCertStatus(certStatus === 'none' ? '' : 'none')} />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-sm font-bold text-primary/85 mr-1">לימוד תורה יומיומי</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <CustomTile value="fixed" label="קובע עיתים" active={studyFreq === 'fixed'} compact onClick={() => setStudyFreq(studyFreq === 'fixed' ? '' : 'fixed')} />
                              <CustomTile value="half-day" label="אברך חצי יום" active={studyFreq === 'half-day'} compact onClick={() => setStudyFreq(studyFreq === 'half-day' ? '' : 'half-day')} />
                              <CustomTile value="full-day" label="אברך יום שלם" active={studyFreq === 'full-day'} compact onClick={() => setStudyFreq(studyFreq === 'full-day' ? '' : 'full-day')} />
                            </div>
                          </div>

                          <div className="space-y-3 md:col-span-2">
                            <Label className="text-sm font-bold text-primary/85 mr-1">מנהג טבילה</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <CustomTile value="daily" label="כל יום" active={mikvehFreq === 'daily'} compact onClick={() => setMikvehFreq(mikvehFreq === 'daily' ? '' : 'daily')} />
                              <CustomTile value="before" label="לפני כתיבה" active={mikvehFreq === 'before'} compact onClick={() => setMikvehFreq(mikvehFreq === 'before' ? '' : 'before')} />
                              <CustomTile value="ezra" label="טבילת עזרא" active={mikvehFreq === 'ezra'} compact onClick={() => setMikvehFreq(mikvehFreq === 'ezra' ? '' : 'ezra')} />
                              <CustomTile value="never" label="ללא טבילה" active={mikvehFreq === 'never'} compact onClick={() => setMikvehFreq(mikvehFreq === 'never' ? '' : 'never')} />
                            </div>
                          </div>

                          <Label className="md:col-span-2 flex items-center justify-between p-4 bg-white/80 border-2 border-primary/5 rounded-2xl cursor-pointer hover:bg-white hover:border-primary/10 transition-all shadow-sm">
                            <div className="flex items-center gap-3"><UserCheck className="w-5 h-5 text-accent" /><span className="text-sm font-bold text-primary">הצג סופרים נשואים בלבד</span></div>
                            <Checkbox checked={marriedOnly} onCheckedChange={(v) => setMarriedOnly(!!v)} className="w-6 h-6 rounded-lg" />
                          </Label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
            </div>

            <div className="flex justify-center pt-4 md:pt-8">
               <MotionButton
                 onClick={handleFinalSearch}
                 className={finalSearchButtonClass}
                 whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                 whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
               >
                 <Search className="w-6 h-6 group-hover:rotate-12 transition-transform" /> הצג כלי קודש מתאימים
               </MotionButton>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  // Product search CTA: on desktop the wizard is already on screen, so bring it into view and
  // move focus to its first choice; on phones the same wizard opens as a bottom sheet.
  const openFinder = () => {
    if (isDesktop) {
      const card = document.getElementById('hero-finder');
      card?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'center' });
      window.setTimeout(() => card?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }), shouldReduceMotion ? 0 : 450);
      return;
    }
    setIsMobileSearchOpen(true);
  };

  return (
    <section className="relative w-full overflow-hidden bg-background pt-[calc(8rem+env(safe-area-inset-top))] pb-6 md:pt-40 md:pb-24 lg:min-h-[92vh] lg:flex lg:items-center" aria-labelledby="hero-heading">
      {/* Ambient light: warm parchment/gold gradients drifting very slowly (transform-only,
          paused off-screen, static with reduced motion). No photo — the LCP element is text. */}
      <AmbientBackdrop />

      <div className="container mx-auto px-5 md:px-8 relative z-10 grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="text-right">
          <p className="eyebrow fade-up">ספרי תורה · תפילין · מזוזות · יודאיקה</p>
          {/* Set in Stam Ashkenaz CLM (scribal STaM letters with tagin). The face has Hebrew
              letters only — no gershayim, no Latin — so the abbreviation uses an ASCII quote
              and every glyph here is covered (nothing falls back mid-word). Its ink sits low in
              a tall line box, hence the slight negative top margin and the roomy mask. */}
          <h1 id="hero-heading" className="mt-4 md:mt-6 font-stam font-normal text-[clamp(38px,11.6vw,64px)] md:text-[84px] lg:text-[64px] xl:text-[80px] leading-[1.2] text-primary">
            <span className="hero-line"><span>סת"ם מהודר,</span></span>
            <span className="hero-line"><span>ישירות מיד הסופר</span></span>
          </h1>
          <p className="lead fade-up fade-up-1 mt-6 md:mt-8 max-w-xl">
            כל סופר עובר אימות והסמכה. לכל מוצר פירוט הלכתי מלא — סוג כתב, רמת הידור והגהה. תשלום מאובטח בנאמנות.
          </p>
          <div className="fade-up fade-up-2 mt-8 md:mt-10 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button variant="gold" size="lg" onClick={openFinder} className="h-14 w-full sm:w-auto px-8 gap-2.5 text-base group min-w-0">
              <Search className="!w-[18px] !h-[18px]" aria-hidden="true" />
              <span className="truncate">{selectedProduct ? `המשך חיפוש: ${selectedProduct}` : 'חיפוש מוצר מותאם אישית'}</span>
            </Button>
            <Button variant="outline" size="lg" asChild className="h-14 w-full sm:w-auto px-7 text-base shrink-0">
              <a href="#how-it-works">איך זה עובד</a>
            </Button>
          </div>
          <ul className="fade-up fade-up-3 mt-9 md:mt-12 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-primary/85">
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />סופרים מאומתים בלבד</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />ישירות מהסופר, בלי מתווכים</li>
            <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />תשלום מאובטח בנאמנות</li>
          </ul>
        </div>

        {/* Desktop: the spec wizard sits beside the headline. */}
        <div id="hero-finder" className="hidden md:block fade-up fade-up-2 w-full max-w-2xl justify-self-center lg:justify-self-start bg-card border border-border/80 rounded-[2rem] p-8 lg:p-10 shadow-premium-lg">
          {/* isDesktop resolves (useLayoutEffect, pre-paint) before this can ever be seen —
              on mobile it stays a cheap empty shell instead of mounting/hydrating the full
              wizard behind `hidden`. The `hidden md:block` above is what controls visibility. */}
          {isDesktop === true ? wizardSteps : <div className="min-h-[420px]" aria-hidden="true" />}
        </div>
      </div>

      <Sheet open={isMobileSearchOpen} onOpenChange={setIsMobileSearchOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 rounded-t-[2rem] border-0 bg-background p-0 shadow-2xl md:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>חיפוש כלי קודש</SheetTitle>
            <SheetDescription>בחרו קטגוריה, מפרט הלכתי והתאמה אישית כדי למצוא את המוצר המתאים</SheetDescription>
          </SheetHeader>
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-primary/15" aria-hidden="true" />
          <div className="flex-1 overflow-y-auto px-4 pb-10 pt-5" dir="rtl">
            {wizardSteps}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

interface CategoryCardProps {
  icon: React.ReactElement;
  label: string;
  onClick: () => void;
  color?: 'indigo' | 'blue' | 'amber' | 'emerald' | 'purple' | 'primary';
  active?: boolean;
}

function CategoryCard({ icon, label, onClick, active = false }: CategoryCardProps) {
  // One brand treatment for every category (was five unrelated pastel colours).
  return (
    <button 
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "group flex flex-col items-center gap-3 px-2 py-4 md:py-5 rounded-3xl bg-card border transition-[border-color,box-shadow,transform] duration-300 ease-lux active:scale-[0.97] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        active ? "border-primary shadow-premium" : "border-border/70 hover:border-primary/30 hover:shadow-premium"
      )}
    >
      <div className={cn(
        "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-colors duration-300",
        active ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
      )}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6 md:w-7 md:h-7", strokeWidth: 1.6 } as any)}
      </div>
      <span className="font-medium text-primary text-[14px] whitespace-nowrap">{label}</span>
    </button>
  );
}

function CustomTile({ value, label, active, compact = false, onClick }: any) {
  const className = cn(
    "flex items-center justify-between gap-2 rounded-2xl border transition-colors duration-200 cursor-pointer group px-4 min-h-[48px]",
    compact ? "py-2.5" : "py-3.5",
    active ? "border-primary bg-primary/[0.04] ring-1 ring-primary" : "border-border bg-card hover:border-primary/30"
  );
  const content = (
    <>
      {!onClick && <RadioGroupItem value={value} className="hidden" />}
      <span className={cn("text-right leading-snug transition-colors", compact ? "text-sm" : "text-[15px]", active ? "font-bold text-primary" : "font-semibold text-primary/80 group-hover:text-primary")}>{label}</span>
      <div className={cn("w-4 h-4 shrink-0 rounded-full border transition-all duration-200", active ? "border-[5px] border-primary" : "border-primary/30 group-hover:border-primary/50")} />
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
