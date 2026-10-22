"use client";

import React, { useLayoutEffect, useRef, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CitySelect } from '@/components/CitySelect';
import { COMMON_CITY_OPTIONS, NEARBY_RADIUS_KM } from '@/lib/location-utils';
import { AmbientBackdrop } from '@/components/motion/AmbientBackdrop';
import { FinderProgress, FinderQuestion, FinderStepFrame, OptionTile } from '@/components/finder/FinderParts';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';
type ShippingPreference = 'all' | 'shipping' | 'pickup';

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

  // ── Product finder: 4 short steps, one question each ─────────────────────────────────
  // The state and the URL built by handleFinalSearch are unchanged; only the presentation
  // is split differently (product → type & script → hiddur & size → where & how).
  const TOTAL_STEPS = 4;
  const [direction, setDirection] = useState(1);
  // Options only stagger in after the visitor starts using the finder — never on first paint.
  const [hasInteracted, setHasInteracted] = useState(false);
  const goToStep = (next: number) => {
    setHasInteracted(true);
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  const isLastStep = step === TOTAL_STEPS;
  const canContinue = step !== 1 || Boolean(selectedProduct);

  const STEP_TITLES: Record<number, { title: string; lead: string }> = {
    1: { title: 'מה אתם מחפשים?', lead: 'בחרו סוג מוצר. יודאיקה מובילה ישר לכל הפריטים.' },
    2: { title: 'סוג וכתב', lead: 'אפשר לדלג — נציג את כל המסורות.' },
    3: { title: 'רמת הידור וגודל', lead: 'אפשר לדלג — נציג את כל הרמות והגדלים.' },
    4: { title: 'איפה ואיך לקבל?', lead: 'לא חובה. אפשר לדלג ולראות את כל התוצאות.' },
  };

  const summary = [
    selectedProduct,
    quantity > 1 ? `${quantity} יח׳` : '',
    subType !== 'all' ? subType : '',
    scriptType !== 'all' ? scriptType : '',
    qualityLevel !== 'all' ? qualityLevel : '',
    selectedCity,
  ].filter(Boolean).join(' · ');

  const SCRIPT_OPTIONS = [
    { v: 'all', l: 'כל המסורות', d: 'ללא סינון לפי כתב' },
    { v: 'ספרדי', l: 'ספרדי', d: 'עדות המזרח' },
    { v: 'אשכנזי - בית יוסף', l: 'בית יוסף', d: 'אשכנזי' },
    { v: 'אשכנזי - האר"י', l: 'האר"י', d: 'אשכנזי · חסידי' },
    { v: 'אשכנזי - אדמו"ר הזקן', l: 'אדמו"ר הזקן', d: 'אשכנזי · חב"ד' },
  ];

  const stepBody = (n: number, compact: boolean) => {
    const animateIn = hasInteracted;
    const twoCol = 'grid-cols-2';
    switch (n) {
      case 1:
        return (
          <div className="space-y-6">
            <FinderQuestion animateIn={animateIn} gridClassName={compact ? 'grid-cols-2' : 'grid-cols-3'}>
              {([
                ['מזוזה', <Scroll key="i" />],
                ['תפילין', <Package key="i" />],
                ['מגילה', <Crown key="i" />],
                ['ספר תורה', <BookOpen key="i" />],
              ] as const).map(([type, icon]) => (
                <OptionTile
                  key={type}
                  size="lg"
                  icon={React.cloneElement(icon, { className: 'h-6 w-6', strokeWidth: 1.6 } as any)}
                  label={type}
                  active={selectedProduct === type}
                  onSelect={() => { setHasInteracted(true); handleCategorySelect(type as ProductType); }}
                />
              ))}
              {/* Judaica isn't part of the scribal spec wizard — straight to all Judaica results. */}
              <OptionTile
                size="lg"
                cellClassName={compact ? 'col-span-2' : undefined}
                icon={<Palette className="h-6 w-6" strokeWidth={1.6} />}
                label="יודאיקה"
                description={compact ? 'מעבר ישיר לכל הפריטים' : undefined}
                active={false}
                onSelect={() => router.push('/search?view=results&group=judaica')}
              />
            </FinderQuestion>

            {/* Always rendered (dimmed until a product is chosen) so nothing jumps in. */}
            <div className={cn('flex items-center gap-5 rounded-2xl border border-border/80 bg-card px-4 py-3 transition-opacity duration-300', !selectedProduct && 'opacity-45')}>
              <span className="text-[15px] font-semibold text-primary">כמות</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={!selectedProduct} onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="הפחת כמות" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-lg font-semibold text-primary transition-colors hover:bg-secondary/60 active:scale-95 disabled:cursor-not-allowed">−</button>
                <span className="w-12 text-center font-numbers text-[26px] leading-none text-primary num" aria-live="polite">{quantity}</span>
                <button type="button" disabled={!selectedProduct} onClick={() => setQuantity(quantity + 1)} aria-label="הוסף כמות" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-lg font-semibold text-primary transition-colors hover:bg-secondary/60 active:scale-95 disabled:cursor-not-allowed">+</button>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-7">
            {hasSubTypes && (
              <FinderQuestion label="סוג המוצר" animateIn={animateIn} gridClassName={twoCol}>
                {selectedProduct !== 'מזוזה' && <OptionTile label="כל הסוגים" active={subType === 'all'} onSelect={() => setSubType('all')} />}
                {getSubTypesForProduct(selectedProduct).map((opt) => (
                  <OptionTile key={opt} label={opt} active={subType === opt} onSelect={() => setSubType(opt)} />
                ))}
              </FinderQuestion>
            )}
            <FinderQuestion label="סוג הכתב (מסורת)" animateIn={animateIn} gridClassName={twoCol}>
              {SCRIPT_OPTIONS.map((o) => (
                <OptionTile key={o.v} label={o.l} description={o.d} active={scriptType === o.v} onSelect={() => setScriptType(o.v)} cellClassName={o.v === 'all' ? 'col-span-2' : undefined} />
              ))}
            </FinderQuestion>
          </div>
        );
      case 3:
        return (
          <div className="space-y-7">
            <FinderQuestion label="רמת הידור" animateIn={animateIn} gridClassName={twoCol}>
              {getQualityLevels(selectedProduct).map((q) => (
                <OptionTile key={q.v} label={q.l} active={qualityLevel === q.v} onSelect={() => setQualityLevel(q.v)} />
              ))}
            </FinderQuestion>
            {selectedProduct === 'מגילה' ? (
              <>
                <FinderQuestion label="מספר שורות" animateIn={animateIn} gridClassName="grid-cols-3">
                  {['all', '11', '21', '28', '42'].map((r) => (
                    <OptionTile
                      key={r}
                      size="sm"
                      label={r === 'all' ? 'הכל' : r === '42' ? '42 (האר"י)' : r}
                      active={megillahRows === r}
                      onSelect={() => { setMegillahRows(r); setMegillahHeight('all'); }}
                    />
                  ))}
                </FinderQuestion>
                <div className="space-y-3">
                  <p className="text-[15px] font-semibold text-primary">גובה קלף (ס"מ)</p>
                  <Select value={megillahHeight} onValueChange={setMegillahHeight}>
                    <SelectTrigger className="h-14 rounded-2xl border-border/80 bg-card text-right text-base font-semibold">
                      <SelectValue placeholder="בחר גובה..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl p-1 shadow-2xl">
                      <SelectItem value="all" className="rounded-xl py-3 font-semibold">כל הגבהים</SelectItem>
                      {megillahRows === '11' ? (
                        <>
                          <SelectItem value={"8-10 ס\"מ"} className="rounded-xl py-3 font-semibold">{'8-10 ס"מ (סטנדרט)'}</SelectItem>
                          <SelectItem value={"15-20 ס\"מ (הרב עובדיה)"} className="rounded-xl py-3 font-semibold">{'15-20 ס"מ (הרב עובדיה)'}</SelectItem>
                        </>
                      ) : (
                        ['12', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((h) => (
                          <SelectItem key={h} value={`${h} ס"מ`} className="rounded-xl py-3 font-semibold">{h} ס"מ</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : getSizesForProduct(selectedProduct, scriptType).length > 0 ? (
              <FinderQuestion label='גודל הקלף (ס"מ)' animateIn={animateIn} gridClassName={twoCol}>
                {['all', ...getSizesForProduct(selectedProduct, scriptType), 'other'].map((sz) => (
                  <OptionTile key={sz} label={sz === 'all' ? 'כל הגדלים' : sz === 'other' ? 'שאר הגדלים' : sz} active={scrollSize === sz} onSelect={() => setScrollSize(sz)} />
                ))}
              </FinderQuestion>
            ) : null}
          </div>
        );
      default:
        return (
          <div className="space-y-7">
            <fieldset className="space-y-3">
              <legend className="mb-3 text-[15px] font-semibold text-primary">באיזה אזור לחפש?</legend>
              <Button variant="outline" onClick={detectLocation} disabled={isDetectingLocation} className={cn('h-14 w-full gap-3 rounded-2xl text-[15px] font-semibold', userCoords ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : '')}>
                {isDetectingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
                {userCoords ? (detectedCity ? `המיקום שלך: ${detectedCity}` : 'המיקום שלך זוהה בהצלחה') : 'זהה את המיקום הנוכחי שלי'}
              </Button>
              <CitySelect
                value={selectedCity}
                options={[...COMMON_CITY_OPTIONS]}
                placeholder="או בחרו עיר"
                onChange={(city) => { setSelectedCity(city); if (city) setIncludeNearbyCities(true); }}
                triggerClassName="h-14 rounded-2xl border border-border/80 bg-card text-base"
              />
              <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3">
                <span className="text-right">
                  <span className="block text-[15px] font-semibold text-primary">חפש גם בערים קרובות</span>
                  <span className="block text-[13px] text-muted-foreground">עד {NEARBY_RADIUS_KM} ק״מ מהעיר שנבחרה</span>
                </span>
                <Checkbox checked={includeNearbyCities} onCheckedChange={(value) => setIncludeNearbyCities(!!value)} className="h-5 w-5 rounded-md" />
              </label>
            </fieldset>

            <FinderQuestion label="אופן קבלת המוצר" animateIn={animateIn} gridClassName="grid-cols-3">
              <OptionTile size="sm" label="הכל" active={shippingPreference === 'all'} onSelect={() => setShippingPreference('all')} />
              <OptionTile size="sm" label="משלוח" active={shippingPreference === 'shipping'} onSelect={() => setShippingPreference('shipping')} />
              <OptionTile size="sm" label="איסוף עצמי" active={shippingPreference === 'pickup'} onSelect={() => setShippingPreference('pickup')} />
            </FinderQuestion>

            <div className="rounded-2xl border border-dashed border-primary/20">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl px-4 text-[15px] font-semibold text-primary transition-colors hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex items-center gap-2.5"><Settings2 className="h-5 w-5 text-accent-strong" /> מסנני קדושה והנהגת הסופר</span>
                <ChevronLeft className={cn('h-4 w-4 text-primary/60 transition-transform duration-300 ease-lux', showAdvanced && '-rotate-90')} />
              </button>
              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-6 px-4 pb-5 pt-2">
                      <FinderQuestion label="הסמכת הסופר" gridClassName={twoCol}>
                        <OptionTile label="תעודה בתוקף" active={certStatus === 'valid'} onSelect={() => setCertStatus(certStatus === 'valid' ? '' : 'valid')} />
                        <OptionTile label="תעודה בעבר" active={certStatus === 'expired'} onSelect={() => setCertStatus(certStatus === 'expired' ? '' : 'expired')} />
                        <OptionTile label="ללא תעודה" active={certStatus === 'none'} onSelect={() => setCertStatus(certStatus === 'none' ? '' : 'none')} />
                      </FinderQuestion>
                      <FinderQuestion label="לימוד תורה יומיומי" gridClassName={twoCol}>
                        <OptionTile label="קובע עיתים" active={studyFreq === 'fixed'} onSelect={() => setStudyFreq(studyFreq === 'fixed' ? '' : 'fixed')} />
                        <OptionTile label="אברך חצי יום" active={studyFreq === 'half-day'} onSelect={() => setStudyFreq(studyFreq === 'half-day' ? '' : 'half-day')} />
                        <OptionTile label="אברך יום שלם" active={studyFreq === 'full-day'} onSelect={() => setStudyFreq(studyFreq === 'full-day' ? '' : 'full-day')} />
                      </FinderQuestion>
                      <FinderQuestion label="מנהג טבילה" gridClassName={twoCol}>
                        <OptionTile label="כל יום" active={mikvehFreq === 'daily'} onSelect={() => setMikvehFreq(mikvehFreq === 'daily' ? '' : 'daily')} />
                        <OptionTile label="לפני כתיבה" active={mikvehFreq === 'before'} onSelect={() => setMikvehFreq(mikvehFreq === 'before' ? '' : 'before')} />
                        <OptionTile label="טבילת עזרא" active={mikvehFreq === 'ezra'} onSelect={() => setMikvehFreq(mikvehFreq === 'ezra' ? '' : 'ezra')} />
                        <OptionTile label="ללא טבילה" active={mikvehFreq === 'never'} onSelect={() => setMikvehFreq(mikvehFreq === 'never' ? '' : 'never')} />
                      </FinderQuestion>
                      <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3">
                        <span className="flex items-center gap-2.5 text-[15px] font-semibold text-primary"><UserCheck className="h-5 w-5 text-accent-strong" /> הצג סופרים נשואים בלבד</span>
                        <Checkbox checked={marriedOnly} onCheckedChange={(v) => setMarriedOnly(!!v)} className="h-5 w-5 rounded-md" />
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );
    }
  };

  const skipAction = step > 1 ? (
    <button
      type="button"
      onClick={() => (isLastStep ? handleFinalSearch() : goToStep(step + 1))}
      className="-my-2 inline-flex min-h-[44px] items-center rounded-full px-3 text-[14px] font-semibold text-primary/70 underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {isLastStep ? 'דלג והצג תוצאות' : 'דלג'}
    </button>
  ) : null;

  const viewAllLink = (
    <button
      type="button"
      onClick={() => router.push('/search?view=all')}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full text-[14px] font-semibold text-accent-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      צפה בכל המוצרים
      <ArrowLeft className="h-3.5 w-3.5" />
    </button>
  );

  const finderNav = (
    <div className="flex items-center gap-3">
      {step > 1 && (
        <Button variant="outline" size="lg" onClick={() => goToStep(step - 1)} className="h-14 shrink-0 gap-1.5 px-5">
          <ChevronRight className="h-4 w-4" /> הקודם
        </Button>
      )}
      <Button
        variant="gold"
        size="lg"
        disabled={!canContinue}
        onClick={() => (isLastStep ? handleFinalSearch() : goToStep(step + 1))}
        className="h-14 flex-1 gap-2 text-base"
      >
        {isLastStep ? (<><Search className="h-[18px] w-[18px]" /> הצג כלי קודש מתאימים</>) : (<>{step === 1 && !selectedProduct ? 'בחרו מוצר כדי להמשיך' : 'המשך'} {canContinue && <ChevronLeft className="h-4 w-4" />}</>)}
      </Button>
    </div>
  );

  const stepHeading = (
    <div className="mb-5 space-y-1 text-right">
      <h2 className="font-body text-[24px] font-semibold leading-tight text-primary md:text-[26px]">{STEP_TITLES[step].title}</h2>
      <p className="text-[14px] text-muted-foreground">{STEP_TITLES[step].lead}</p>
    </div>
  );

  // Desktop card: progress → animated step (height eases between steps) → nav.
  const desktopFinder = (
    <div className="text-right">
      <FinderProgress step={step} total={TOTAL_STEPS} summary={summary} action={skipAction} />
      <FinderStepFrame stepKey={step} direction={direction} animateHeight className="-mx-1 mt-4">
        {stepHeading}
        {stepBody(step, false)}
      </FinderStepFrame>
      <div className="mt-6 space-y-3 border-t border-border/70 pt-5">
        {finderNav}
        <div className="flex justify-center">{viewAllLink}</div>
      </div>
    </div>
  );

  // Mobile sheet: swipe the header down to close (pointer events; X / Esc / overlay still work).
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{ y: number; dy: number } | null>(null);
  const onSheetDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, [role="combobox"]')) return;
    sheetDragRef.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const onSheetDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    if (sheetRef.current) sheetRef.current.style.transform = `translate3d(0, ${drag.dy}px, 0)`;
  };
  const onSheetDragEnd = () => {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    const el = sheetRef.current;
    if (!drag || !el) return;
    if (drag.dy > 110) {
      setIsMobileSearchOpen(false);
      return;
    }
    el.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = '';
  };

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
        <div id="hero-finder" className="hidden md:block fade-up fade-up-2 w-full max-w-2xl justify-self-center lg:justify-self-start bg-card border border-border/80 rounded-[2rem] p-7 lg:p-9 shadow-premium-lg">
          {/* isDesktop resolves (useLayoutEffect, pre-paint) before this can ever be seen —
              on mobile it stays a cheap empty shell instead of mounting/hydrating the full
              wizard behind `hidden`. The `hidden md:block` above is what controls visibility. */}
          {isDesktop === true ? desktopFinder : <div className="min-h-[520px]" aria-hidden="true" />}
        </div>
      </div>

      <Sheet open={isMobileSearchOpen} onOpenChange={setIsMobileSearchOpen}>
        <SheetContent
          ref={sheetRef}
          side="bottom"
          className="flex h-[94dvh] max-h-[94dvh] flex-col gap-0 rounded-t-[2rem] border-0 bg-background p-0 shadow-2xl md:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>חיפוש מוצר מותאם אישית</SheetTitle>
            <SheetDescription>ארבעה שלבים קצרים: סוג מוצר, כתב, רמת הידור וגודל, ואופן הקבלה</SheetDescription>
          </SheetHeader>
          {/* Drag handle + header: swipe down to close (the X stays for everyone else). */}
          <div
            className="shrink-0 touch-none select-none px-5 pb-3 pt-3"
            onPointerDown={onSheetDragStart}
            onPointerMove={onSheetDragMove}
            onPointerUp={onSheetDragEnd}
            onPointerCancel={onSheetDragEnd}
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-primary/15" aria-hidden="true" />
            <div className="pl-14">
              <FinderProgress step={step} total={TOTAL_STEPS} summary={summary} action={skipAction} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-16 pt-2" data-lenis-prevent>
            <FinderStepFrame stepKey={step} direction={direction}>
              {stepHeading}
              {stepBody(step, true)}
              <div className="mt-6 flex justify-center">{viewAllLink}</div>
            </FinderStepFrame>
          </div>
          <div data-sticky-footer className="shrink-0 border-t border-border/70 bg-background/95 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
            {finderNav}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
