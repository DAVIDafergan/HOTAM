"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from '@/components/SmartImage';
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
import { PlaceHolderImages } from '@/lib/placeholder-images';
import unsplashLoader from '@/lib/unsplashLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CitySelect } from '@/components/CitySelect';
import { COMMON_CITY_OPTIONS, NEARBY_RADIUS_KM } from '@/lib/location-utils';
import homeAnimations from '@/components/home-animations.module.css';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';
type ShippingPreference = 'all' | 'shipping' | 'pickup';

export function HeroAnimation() {
  const router = useRouter();
  const { toast } = useToast();
  const heroImg = PlaceHolderImages.find(img => img.id === 'hero-bg');

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
            toast({ title: `מיקום זוהה: ${city}` });
          } else {
            setDetectedCity(null);
            setSelectedCity('');
            toast({ title: "המיקום זוהה", description: "לא הצלחנו לזהות עיר מדויקת. אפשר לבחור עיר ידנית מהרשימה." });
          }
        } catch {
          toast({ title: "מיקום זוהה" });
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
  const finalSearchButtonClass = "w-full max-w-3xl bg-accent text-primary hover:bg-accent/92 rounded-full px-12 md:px-20 h-[4.4rem] font-black text-base md:text-lg uppercase tracking-[0.16em] md:tracking-[0.2em] shadow-premium-lg gap-4 hover:scale-[1.02] focus:ring-4 focus:ring-accent/30 transition-all duration-500 group active:scale-95";

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
                  "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-500",
                  step === n
                    ? "bg-primary text-white border-primary shadow-lg scale-110"
                    : step > n
                    ? "bg-accent/20 text-accent border-accent/30"
                    : "bg-white text-primary/30 border-primary/10"
                )}>
                {step > n ? <span aria-label="שלב הושלם" className="text-accent text-lg leading-none">✓</span> : n}
                </div>
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest transition-colors hidden sm:block",
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-black text-primary">
              {selectedProduct}
            </span>
            {quantity > 1 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-black text-primary">
                {quantity} יח'
              </span>
            )}
            {selectedCity && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-black text-primary">
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
              <h2 className="text-2xl md:text-[2rem] font-headline font-black text-primary">מה אתם מחפשים?</h2>
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
              <CategoryCard icon={<Scroll />} label="מזוזה" onClick={() => handleCategorySelect('מזוזה')} color="indigo" active={selectedProduct === 'מזוזה'} />
              <CategoryCard icon={<Package />} label="תפילין" onClick={() => handleCategorySelect('תפילין')} color="blue" active={selectedProduct === 'תפילין'} />
              <CategoryCard icon={<Crown />} label="מגילה" onClick={() => handleCategorySelect('מגילה')} color="amber" active={selectedProduct === 'מגילה'} />
              <CategoryCard icon={<BookOpen />} label="ספר תורה" onClick={() => handleCategorySelect('ספר תורה')} color="emerald" active={selectedProduct === 'ספר תורה'} />
              <CategoryCard icon={<Palette />} label="יודאיקה" onClick={() => handleCategorySelect('מוצרי יודאיקה שונים')} color="purple" active={selectedProduct === 'מוצרי יודאיקה שונים'} />
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
                  <div className="flex items-center gap-3 bg-primary/5 p-2 rounded-2xl border border-primary/10 shadow-sm">
                    <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="הפחת כמות" className="w-10 h-10 rounded-xl border-2 border-primary/15 font-bold hover:bg-white active:scale-90 transition-all text-primary flex items-center justify-center text-lg bg-white shadow-sm">−</button>
                    <div className="flex items-center gap-2 px-4">
                      <span className="text-2xl font-black text-primary tabular-nums leading-none">{quantity}</span>
                      <span className="text-xs font-black text-primary/60 uppercase tracking-tight">יח'</span>
                    </div>
                    <button type="button" onClick={() => setQuantity(quantity + 1)} aria-label="הוסף כמות" className="w-10 h-10 rounded-xl border-2 border-primary/15 font-bold hover:bg-white active:scale-90 transition-all text-primary flex items-center justify-center text-lg bg-white shadow-sm">+</button>
                  </div>
                  <Button onClick={() => setStep(2)} className="bg-primary text-white hover:bg-primary/95 rounded-full px-10 h-12 font-black uppercase text-xs tracking-[0.2em] shadow-premium transition-all hover:scale-105 active:scale-95 group gap-2">
                    המשך למפרט <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => router.push('/search?view=all')}
                className="h-10 px-6 rounded-full text-[11px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 border border-primary/10 hover:border-primary/20 transition-all gap-2"
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
              <Button variant="ghost" onClick={() => setStep(1)} className="font-black text-xs uppercase tracking-widest h-10 px-4 rounded-xl hover:bg-primary/5 gap-1"><ChevronRight className="w-4 h-4" /> חזור</Button>
              <div className="text-right">
                <h2 className="text-xl md:text-2xl font-headline font-black text-primary">איזה סוג בדיוק?</h2>
                <p className="text-xs text-primary/60 font-black uppercase tracking-widest mt-0.5">עבור {selectedProduct} · שלב 2 מתוך 3</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {hasSubTypes && (
                <div className="space-y-4 rounded-2xl md:rounded-3xl bg-primary/[0.03] md:bg-white/60 border-0 md:border md:border-primary/5 p-4 md:p-5 shadow-none md:shadow-sm">
                  <Label className="font-black text-xs uppercase text-primary/60 mr-1 tracking-widest">תת-סוג המוצר</Label>
                  <RadioGroup value={subType} onValueChange={setSubType} className="grid grid-cols-2 gap-3">
                    {selectedProduct !== 'מזוזה' && <CustomTile value="all" label="כל הסוגים" active={subType === 'all'} />}
                    {getSubTypesForProduct(selectedProduct).map(opt => <CustomTile key={opt} value={opt} label={opt} active={subType === opt} />)}
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-4 rounded-2xl md:rounded-3xl bg-primary/[0.03] md:bg-white/60 border-0 md:border md:border-primary/5 p-4 md:p-5 shadow-none md:shadow-sm">
                <Label className="font-black text-xs uppercase text-primary/60 mr-1 tracking-widest">סוג הכתב (מסורת)</Label>
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

              <div className="space-y-4 rounded-2xl md:rounded-3xl bg-primary/[0.03] md:bg-white/60 border-0 md:border md:border-primary/5 p-4 md:p-5 shadow-none md:shadow-sm">
                <Label className="font-black text-xs uppercase text-primary/60 mr-1 tracking-widest">רמת הידור מבוקשת</Label>
                <RadioGroup value={qualityLevel} onValueChange={setQualityLevel} className="grid grid-cols-2 gap-3">
                  {getQualityLevels(selectedProduct).map(q => <CustomTile key={q.v} value={q.v} label={q.l} active={qualityLevel === q.v} compact />)}
                </RadioGroup>
              </div>

              <div className="space-y-4 rounded-2xl md:rounded-3xl bg-primary/[0.03] md:bg-white/60 border-0 md:border md:border-primary/5 p-4 md:p-5 shadow-none md:shadow-sm">
                {selectedProduct === 'מגילה' ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-primary/60 tracking-widest">מספר שורות</Label>
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
                              "h-14 rounded-2xl border-2 font-black text-xs transition-all",
                              megillahRows === r ? "border-primary bg-primary text-white shadow-lg scale-105" : "bg-white/40 border-primary/5 text-primary hover:border-accent/40"
                            )}
                          >
                            {r === 'all' ? 'הכל' : r === '42' ? '42 (האר"י)' : r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-primary/60 tracking-widest">גובה קלף (ס"מ)</Label>
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
                    <Label className="font-black text-xs uppercase text-primary/60 tracking-widest">גודל הקלף (ס"מ)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[...getSizesForProduct(selectedProduct, scriptType), 'other'].map(sz => (
                        <button type="button" key={sz} onClick={() => setScrollSize(sz)} className={cn("h-12 rounded-xl border-2 font-black text-[11px] transition-all", scrollSize === sz ? "border-primary bg-primary text-white shadow-md" : "bg-white/40 border-primary/5 text-primary hover:border-accent/40")}>{sz === 'other' ? 'שאר הגדלים' : sz}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center pt-4 md:pt-8">
               <Button onClick={() => setStep(3)} className="bg-primary text-white hover:bg-primary/95 rounded-full px-16 h-12 md:h-14 font-black uppercase text-sm tracking-[0.2em] shadow-premium transition-all hover:scale-105 active:scale-95 group gap-2">
                 המשך למיקום וקבלה <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
               </Button>
             </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} className="space-y-4 md:space-y-7 text-right">
            <div className="flex justify-between items-center border-b border-primary/5 pb-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="font-black text-xs uppercase tracking-widest h-10 px-4 rounded-xl hover:bg-primary/5 gap-1"><ChevronRight className="w-4 h-4" /> חזור</Button>
              <div className="text-right">
                <h2 className="text-xl md:text-2xl font-headline font-black text-primary">איפה ואיך תרצו לקבל?</h2>
                <p className="text-xs text-primary/60 font-black uppercase tracking-widest mt-0.5">שלב 3 מתוך 3</p>
              </div>
            </div>

            <div className="max-w-2xl mx-auto w-full space-y-6 rounded-2xl md:rounded-3xl bg-primary/[0.03] md:bg-white/60 border-0 md:border md:border-primary/5 p-4 md:p-6 shadow-none md:shadow-sm">
              <div className="space-y-4 pb-5 border-b border-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="font-black text-xs uppercase text-primary/60 mr-1 tracking-widest">איפה תרצו למצוא סופר? (לא חובה)</Label>
                  <Button variant="ghost" onClick={handleFinalSearch} className="shrink-0 h-8 px-3 rounded-full font-black text-[11px] uppercase tracking-widest text-primary/50 hover:text-primary hover:bg-primary/5">
                    דלג, הצג הכל
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" onClick={detectLocation} disabled={isDetectingLocation} className={cn("h-12 md:h-14 rounded-2xl gap-3 font-black text-xs uppercase border-2 transition-all", userCoords ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'hover:border-primary/20')}>
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
                      <span className="block text-xs font-black uppercase tracking-tight text-primary">חפש גם בערים קרובות</span>
                      <span className="block text-xs font-medium text-primary/50">עד {NEARBY_RADIUS_KM} ק״מ מהעיר שנבחרה</span>
                    </div>
                    <Checkbox checked={includeNearbyCities} onCheckedChange={(value) => setIncludeNearbyCities(!!value)} className="w-5 h-5 rounded-md" />
                  </Label>
                </div>
              </div>

              <div className="pt-2">
                <div className="space-y-3">
                  <Label className="font-black text-xs uppercase text-primary/60 mr-1 tracking-widest">אופן קבלת המוצר</Label>
                  <RadioGroup value={shippingPreference} onValueChange={(v) => setShippingPreference(v as ShippingPreference)} className="grid grid-cols-3 gap-2">
                    <CustomTile value="all" label="הכל" active={shippingPreference === 'all'} compact />
                    <CustomTile value="shipping" label="משלוח בלבד" active={shippingPreference === 'shipping'} compact />
                    <CustomTile value="pickup" label="איסוף עצמי בלבד" active={shippingPreference === 'pickup'} compact />
                  </RadioGroup>
                </div>
                <div className="pt-5">
                  <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full h-12 md:h-14 rounded-2xl border-2 border-dashed border-primary/10 gap-3 font-black text-xs uppercase tracking-widest text-primary/60 hover:bg-primary/5 hover:border-primary/20 transition-all">
                    <Settings2 className="w-5 h-5 text-accent" /> {showAdvanced ? 'הסתר הגדרות סופר מתקדמות' : 'מסנני קדושה והנהגת הסופר'}
                  </Button>
                </div>
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-5 px-1">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-primary/40 tracking-widest">הסמכת הסופר</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <CustomTile value="valid" label="תעודה בתוקף" active={certStatus === 'valid'} compact onClick={() => setCertStatus(certStatus === 'valid' ? '' : 'valid')} />
                              <CustomTile value="expired" label="תעודה בעבר" active={certStatus === 'expired'} compact onClick={() => setCertStatus(certStatus === 'expired' ? '' : 'expired')} />
                              <CustomTile value="none" label="ללא תעודה" active={certStatus === 'none'} compact onClick={() => setCertStatus(certStatus === 'none' ? '' : 'none')} />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-primary/40 tracking-widest">לימוד תורה יומיומי</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <CustomTile value="fixed" label="קובע עיתים" active={studyFreq === 'fixed'} compact onClick={() => setStudyFreq(studyFreq === 'fixed' ? '' : 'fixed')} />
                              <CustomTile value="half-day" label="אברך חצי יום" active={studyFreq === 'half-day'} compact onClick={() => setStudyFreq(studyFreq === 'half-day' ? '' : 'half-day')} />
                              <CustomTile value="full-day" label="אברך יום שלם" active={studyFreq === 'full-day'} compact onClick={() => setStudyFreq(studyFreq === 'full-day' ? '' : 'full-day')} />
                            </div>
                          </div>

                          <div className="space-y-3 md:col-span-2">
                            <Label className="text-xs font-black uppercase text-primary/40 tracking-widest">מנהג טבילה</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <CustomTile value="daily" label="כל יום" active={mikvehFreq === 'daily'} compact onClick={() => setMikvehFreq(mikvehFreq === 'daily' ? '' : 'daily')} />
                              <CustomTile value="before" label="לפני כתיבה" active={mikvehFreq === 'before'} compact onClick={() => setMikvehFreq(mikvehFreq === 'before' ? '' : 'before')} />
                              <CustomTile value="ezra" label="טבילת עזרא" active={mikvehFreq === 'ezra'} compact onClick={() => setMikvehFreq(mikvehFreq === 'ezra' ? '' : 'ezra')} />
                              <CustomTile value="never" label="ללא טבילה" active={mikvehFreq === 'never'} compact onClick={() => setMikvehFreq(mikvehFreq === 'never' ? '' : 'never')} />
                            </div>
                          </div>

                          <Label className="md:col-span-2 flex items-center justify-between p-4 bg-white/80 border-2 border-primary/5 rounded-2xl cursor-pointer hover:bg-white hover:border-primary/10 transition-all shadow-sm">
                            <div className="flex items-center gap-3"><UserCheck className="w-5 h-5 text-accent" /><span className="text-xs font-black uppercase text-primary tracking-tight">הצג סופרים נשואים בלבד</span></div>
                            <Checkbox checked={marriedOnly} onCheckedChange={(v) => setMarriedOnly(!!v)} className="w-6 h-6 rounded-lg" />
                          </Label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
            </div>

            <div className="flex justify-center pt-4 md:pt-8">
               <Button onClick={handleFinalSearch} className={finalSearchButtonClass}>
                 <Search className="w-6 h-6 group-hover:rotate-12 transition-transform" /> הצג כלי קודש מתאימים
               </Button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <section className="relative min-h-0 md:min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#FDFCF0] pt-[calc(7.75rem+env(safe-area-inset-top))] pb-16 md:pt-32 md:pb-20">
      <div className="absolute inset-0 z-0">
        {heroImg?.imageUrl && (
          <Image
            loader={unsplashLoader}
            src={heroImg.imageUrl}
            alt="Hebrew Script"
            fill
            priority
            kind="hero"
            sizes="100vw"
            className="object-cover object-center opacity-10 pointer-events-none w-full h-full"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCF0]/10 via-[#FDFCF0]/75 to-[#FDFCF0]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FDFCF0]/50 via-transparent to-[#FDFCF0]/50" />
        {/* Mobile-only: soft depth accent behind the heading/CTA, absent on desktop */}
        <div className="absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b from-accent/20 to-transparent blur-3xl md:hidden" />
      </div>

      <div className="container mx-auto px-4 md:px-5 relative z-20 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full space-y-6 md:space-y-14 flex flex-col items-center text-center">

          <div className={`space-y-3 md:space-y-5 ${homeAnimations.animateFadeIn}`}>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-headline font-black text-primary leading-[1.08] tracking-tighter">
              קדושה <span className="text-accent underline decoration-accent/20 underline-offset-8">בכל תג</span>
            </h1>
            <p className="text-base font-bold text-primary/70 md:hidden">
              מצאו את הסופר המושלם עבורכם – בכמה קליקים בלבד
            </p>
          </div>

          <div className="hidden md:block w-full max-w-3xl bg-white/78 backdrop-blur-xl border border-white/90 rounded-2xl sm:rounded-3xl md:rounded-[3.2rem] p-4 sm:p-6 md:p-8 lg:p-12 shadow-premium-lg relative ring-1 ring-primary/10">
            {wizardSteps}
          </div>

          {/* Mobile: a single high-converting CTA replaces the full wizard by default */}
          <div className="w-full max-w-3xl md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className="group flex w-full items-center gap-4 rounded-full bg-primary px-5 py-5 text-right shadow-lg transition-all active:scale-[0.97]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-transform group-active:scale-90">
                <Search className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-black text-white tracking-tight">
                  {selectedProduct ? `המשך חיפוש: ${selectedProduct}` : 'חפש מוצרי יודאיקה וסת״ם'}
                </span>
                <span className="block truncate text-xs font-bold text-white/70 mt-0.5">
                  {selectedCity ? `לפי עיר: ${selectedCity}` : 'התחל חיפוש מותאם אישית'}
                </span>
              </span>
              <ChevronLeft className="h-6 w-6 shrink-0 text-white/70 transition-transform group-hover:-translate-x-1" />
            </button>
          </div>

          <Sheet open={isMobileSearchOpen} onOpenChange={setIsMobileSearchOpen}>
            <SheetContent
              side="bottom"
              className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 rounded-t-[2rem] border-0 p-0 shadow-2xl md:hidden"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>חיפוש כלי קודש</SheetTitle>
                <SheetDescription>בחרו קטגוריה, מפרט הלכתי והתאמה אישית כדי למצוא את המוצר המתאים</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-10 pt-6" dir="rtl">
                {wizardSteps}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
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

function CategoryCard({ icon, label, onClick, color = 'primary', active = false }: CategoryCardProps) {
  const colorMap: Record<string, { bg: string; hover: string; text: string }> = {
    indigo:  { bg: 'bg-indigo-50',  hover: 'group-hover:bg-indigo-500',  text: 'group-hover:text-indigo-600' },
    blue:    { bg: 'bg-blue-50',    hover: 'group-hover:bg-blue-500',    text: 'group-hover:text-blue-600' },
    amber:   { bg: 'bg-amber-50',   hover: 'group-hover:bg-amber-400',   text: 'group-hover:text-amber-600' },
    emerald: { bg: 'bg-emerald-50', hover: 'group-hover:bg-emerald-500', text: 'group-hover:text-emerald-600' },
    purple:  { bg: 'bg-purple-50',  hover: 'group-hover:bg-purple-500',  text: 'group-hover:text-purple-600' },
    primary: { bg: 'bg-primary/5',  hover: 'group-hover:bg-accent',      text: 'group-hover:text-accent' },
  };
  const c = colorMap[color] ?? colorMap.primary;
  return (
    <button 
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group flex flex-col items-center gap-2.5 md:gap-3 p-4 md:p-5 rounded-3xl bg-white border-2 shadow-sm hover:shadow-xl hover:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-all duration-300 w-full",
        active ? "border-primary/35 ring-2 ring-accent/25 shadow-lg" : "border-transparent hover:border-primary/10"
      )}
    >
      <div className={cn(
        "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-primary transition-all duration-300 group-hover:text-white group-hover:scale-110",
        c.bg, c.hover
      )}>
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-6 h-6 md:w-7 md:h-7" })}
      </div>
      <span className={cn("font-black text-primary text-[11px] md:text-xs tracking-tight transition-colors duration-300", c.text)}>{label}</span>
    </button>
  );
}

function CustomTile({ value, label, active, compact = false, onClick }: any) {
  const className = cn(
    "flex items-center justify-between rounded-2xl border-2 transition-all duration-200 cursor-pointer group px-5",
    compact ? "py-3" : "py-4",
    active ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-primary/5 bg-white/40 hover:bg-white hover:border-primary/15 hover:shadow-sm"
  );
  const content = (
    <>
      {!onClick && <RadioGroupItem value={value} className="hidden" />}
      <span className={cn("font-bold text-primary transition-colors", compact ? "text-xs" : "text-sm", active ? "opacity-100" : "opacity-60 group-hover:opacity-80")}>{label}</span>
      <div className={cn("w-3.5 h-3.5 rounded-full border-2 transition-all duration-200", active ? "bg-primary border-primary scale-110 shadow-sm" : "border-primary/10 group-hover:border-primary/30")} />
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
