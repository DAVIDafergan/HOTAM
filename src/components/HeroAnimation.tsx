"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  ChevronDown, 
  Scroll, 
  Package, 
  Crown, 
  BookOpen, 
  Palette, 
  ChevronRight, 
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  MapPin,
  LocateFixed,
  Loader2,
  Waves,
  Settings2,
  Info,
  Sparkles,
  Shield,
  GraduationCap,
  ArrowLeft
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import unsplashLoader from '@/lib/unsplashLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ProductType = 'מזוזה' | 'תפילין' | 'מגילה' | 'ספר תורה' | 'מוצרי יודאיקה שונים' | '';

const ISRAEL_REGIONS = [
  "ירושלים והסביבה", "תל אביב וגוש דן", "חיפה והצפון", "באר שבע והדרום", "בני ברק והמרכז", "השרון", "יהודה ושומרון"
];

export function HeroAnimation() {
  const router = useRouter();
  const { toast } = useToast();
  const heroImg = PlaceHolderImages.find(img => img.id === 'hero-bg');

  // Wizard States
  const [step, setStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<ProductType>('');
  const [subType, setSubType] = useState('all');
  const [scriptType, setScriptType] = useState('all');
  const [qualityLevel, setQualityLevel] = useState('all');
  const [quantity, setQuantity] = useState(1);
  
  // Location States
  const [selectedLocation, setSelectedRegion] = useState('all');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

  // Advanced Scribe Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scrollSize, setScrollSize] = useState('all');
  const [marriedOnly, setMarriedOnly] = useState(false);
  const [mikvehFreq, setMikvehFreq] = useState('all');
  const [certStatus, setCertStatus] = useState('all');
  const [studyFreq, setStudyFreq] = useState('all');

  // Megillah specific size states
  const [megillahRows, setMegillahRows] = useState('all');
  const [megillahHeight, setMegillahHeight] = useState('all');

  const handleCategorySelect = (type: ProductType) => {
    setSelectedProduct(type);
    setStep(2);
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

        // Reverse-geocode to get city name using Nominatim (OpenStreetMap)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=he`,
            { headers: { 'Accept-Language': 'he' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || null;
            if (city) {
              setDetectedCity(city);
              // Map detected city to a region
              const cityToRegion: Record<string, string> = {
                'ירושלים': 'ירושלים והסביבה',
                'בית שמש': 'ירושלים והסביבה',
                'מעלה אדומים': 'יהודה ושומרון',
                'תל אביב': 'תל אביב וגוש דן',
                'תל אביב-יפו': 'תל אביב וגוש דן',
                'רמת גן': 'תל אביב וגוש דן',
                'גבעתיים': 'תל אביב וגוש דן',
                'חולון': 'תל אביב וגוש דן',
                'בת ים': 'תל אביב וגוש דן',
                'חיפה': 'חיפה והצפון',
                'קריית ביאליק': 'חיפה והצפון',
                'קריית מוצקין': 'חיפה והצפון',
                'נצרת': 'חיפה והצפון',
                'עכו': 'חיפה והצפון',
                'נהריה': 'חיפה והצפון',
                'טבריה': 'חיפה והצפון',
                'צפת': 'חיפה והצפון',
                'באר שבע': 'באר שבע והדרום',
                'אשדוד': 'באר שבע והדרום',
                'אשקלון': 'באר שבע והדרום',
                'קריית גת': 'באר שבע והדרום',
                'אילת': 'באר שבע והדרום',
                'דימונה': 'באר שבע והדרום',
                'בני ברק': 'בני ברק והמרכז',
                'פתח תקווה': 'בני ברק והמרכז',
                'ראשון לציון': 'בני ברק והמרכז',
                'רחובות': 'בני ברק והמרכז',
                'לוד': 'בני ברק והמרכז',
                'רמלה': 'בני ברק והמרכז',
                'מודיעין': 'בני ברק והמרכז',
                'נתניה': 'השרון',
                'הרצליה': 'השרון',
                'רעננה': 'השרון',
                'כפר סבא': 'השרון',
                'רא"ש העין': 'השרון',
                'הוד השרון': 'השרון',
                'אריאל': 'יהודה ושומרון',
                'מעלה אדומים': 'יהודה ושומרון',
              };
              const mappedRegion = cityToRegion[city];
              if (mappedRegion) setSelectedRegion(mappedRegion);
              toast({ title: `מיקום זוהה: ${city}` });
            } else {
              toast({ title: "מיקום זוהה" });
            }
          } else {
            toast({ title: "מיקום זוהה" });
          }
        } catch {
          // Reverse geocode failed silently, still use coords
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
    if (type === 'תפילין') return ['all', 'סטנדרט (32-34)', 'פיצפונים', 'קטן (28)', 'שימושא רבא (40)'];
    if (type === 'מזוזה') return ['all', '10', '12', '15'];
    if (type === 'ספר תורה') {
      if (script === 'ספרדי') return ['all', '17', '36', '48', '50', '56'];
      return ['all', '17', '30', '36', '42', '48'];
    }
    return ['all'];
  };

  const handleFinalSearch = () => {
    const params = new URLSearchParams();
    params.set('view', 'results');
    if (selectedProduct) params.set('product', selectedProduct);
    if (subType !== 'all') params.set('subtype', subType);
    if (scriptType !== 'all') params.set('script', scriptType);
    if (qualityLevel !== 'all') params.set('quality', qualityLevel);
    if (quantity > 1) params.set('quantity', String(quantity));
    if (selectedLocation !== 'all') params.set('region', selectedLocation);
    if (userCoords) {
      params.set('lat', String(userCoords.lat));
      params.set('lng', String(userCoords.lng));
      params.set('nearMe', 'true');
      if (detectedCity) params.set('city', detectedCity);
    }

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
    if (mikvehFreq !== 'all') params.set('mikveh', mikvehFreq);
    if (certStatus !== 'all') params.set('cert', certStatus);
    if (studyFreq !== 'all') params.set('study', studyFreq);

    router.push(`/search?${params.toString()}`);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'בוקר טוב';
    if (hour >= 12 && hour < 18) return 'צהריים טובים';
    if (hour >= 18 && hour < 22) return 'ערב טוב';
    return 'לילה טוב';
  };

  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#FDFCF0] pt-24 pb-6 md:pt-28 md:pb-12">
      <div className="absolute inset-0 z-0">
        {heroImg?.imageUrl && (
          <Image 
            loader={unsplashLoader}
            src={heroImg.imageUrl} 
            alt="Hebrew Script" 
            fill 
            priority
            className="object-cover opacity-10 pointer-events-none"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDFCF0]/10 via-[#FDFCF0]/75 to-[#FDFCF0]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FDFCF0]/50 via-transparent to-[#FDFCF0]/50" />
      </div>

      <div className="container mx-auto px-4 relative z-20 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full space-y-5 md:space-y-12 flex flex-col items-center text-center">
          
          <div className="space-y-2 md:space-y-4 animate-fade-in">
            <h1 className="text-3xl md:text-7xl font-headline font-black text-primary leading-tight tracking-tighter">
              קדושה <span className="text-accent underline decoration-accent/20 underline-offset-8">בכל תג</span>
            </h1>
          </div>
          
          <div className="w-full bg-white/75 backdrop-blur-3xl border border-white/80 rounded-[3rem] p-6 md:p-10 shadow-premium-lg relative ring-1 ring-primary/5">
            
            <div className="flex flex-col items-center mb-5 md:mb-8 gap-3">
              <div className="flex justify-center gap-3">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={cn("h-1.5 rounded-full transition-all duration-500", step === s ? "w-14 bg-primary shadow-md" : "w-4 bg-primary/15")} />
                ))}
              </div>
              <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">
                {step === 1 ? 'בחירת מוצר' : step === 2 ? 'מפרט הלכתי' : 'התאמה אישית'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5 md:space-y-8">
                  <div className="flex flex-col items-center gap-4">
                    <h3 className="text-xl md:text-2xl font-headline font-black text-primary">מה אתם מחפשים?</h3>
                    <div className="flex items-center gap-4 bg-white/90 p-2 rounded-full border shadow-sm ring-4 ring-primary/5">
                      <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="הפחת כמות" className="w-12 h-12 rounded-full border-2 border-primary/10 font-bold hover:bg-primary/5 active:scale-95 transition-all text-primary flex items-center justify-center text-xl">-</button>
                      <div className="flex flex-col items-center px-6 min-w-[80px]">
                        <span className="text-2xl font-black text-primary tabular-nums leading-none">{quantity}</span>
                        <span className="text-[10px] font-black opacity-40 uppercase tracking-tighter">יחידות</span>
                      </div>
                      <button type="button" onClick={() => setQuantity(quantity + 1)} aria-label="הוסף כמות" className="w-12 h-12 rounded-full border-2 border-primary/10 font-bold hover:bg-primary/5 active:scale-95 transition-all text-primary flex items-center justify-center text-xl">+</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
                    <CategoryCard icon={<Scroll />} label="מזוזה" onClick={() => handleCategorySelect('מזוזה')} />
                    <CategoryCard icon={<Package />} label="תפילין" onClick={() => handleCategorySelect('תפילין')} />
                    <CategoryCard icon={<Crown />} label="מגילה" onClick={() => handleCategorySelect('מגילה')} />
                    <CategoryCard icon={<BookOpen />} label="ספר תורה" onClick={() => handleCategorySelect('ספר תורה')} />
                    <CategoryCard icon={<Palette />} label="יודאיקה" onClick={() => handleCategorySelect('מוצרי יודאיקה שונים')} />
                  </div>

                  <div className="flex justify-center pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => router.push('/search?view=all')}
                      className="h-11 px-8 rounded-full text-[11px] font-black uppercase tracking-widest text-primary/40 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all gap-2"
                    >
                      <Search className="w-4 h-4" />
                      צפה בכל המוצרים ללא פילטר
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-right">
                  <div className="flex justify-between items-center border-b border-primary/5 pb-4">
                    <Button variant="ghost" onClick={() => setStep(1)} className="font-black text-[11px] uppercase tracking-widest h-10 px-4 rounded-xl hover:bg-primary/5"><ChevronRight className="w-4 h-4 ml-2" /> חזור לבחירה</Button>
                    <h3 className="text-2xl font-headline font-black text-primary">מפרט {selectedProduct}</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-4">
                      <Label className="font-black text-[10px] uppercase text-primary/40 mr-1 tracking-widest">תת-סוג המוצר</Label>
                      {getSubTypesForProduct(selectedProduct).length > 0 ? (
                        <RadioGroup value={subType} onValueChange={setSubType} className="grid grid-cols-2 gap-3">
                          {selectedProduct !== 'מזוזה' && <CustomTile value="all" label="כל הסוגים" active={subType === 'all'} />}
                          {getSubTypesForProduct(selectedProduct).map(opt => <CustomTile key={opt} value={opt} label={opt} active={subType === opt} />)}
                        </RadioGroup>
                      ) : <div className="p-10 bg-primary/5 rounded-[2rem] text-center flex flex-col items-center justify-center border-2 border-dashed border-primary/10"><Info className="w-6 h-6 mb-2 text-primary/20" /><span className="text-[11px] font-black text-primary/30 uppercase">אין תת-סוג נוסף לקטגוריה זו</span></div>}
                    </div>

                    <div className="space-y-4">
                      <Label className="font-black text-[10px] uppercase text-primary/40 mr-1 tracking-widest">סוג הכתב (מסורת)</Label>
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
                  </div>

                  <div className="flex justify-center pt-8">
                    <Button onClick={() => setStep(3)} className="bg-primary text-white hover:bg-primary/90 rounded-full px-16 h-14 font-black uppercase text-sm tracking-[0.2em] shadow-2xl transition-all hover:scale-105 active:scale-95 group">
                      המשך להתאמה אישית <ChevronLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-right">
                  <div className="flex justify-between items-center border-b border-primary/5 pb-4">
                    <Button variant="ghost" onClick={() => setStep(2)} className="font-black text-[11px] uppercase tracking-widest h-10 px-4 rounded-xl hover:bg-primary/5"><ChevronRight className="w-4 h-4 ml-2" /> חזור למפרט</Button>
                    <h3 className="text-2xl font-headline font-black text-primary">דיוק והתאמה</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-10 pt-4">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="font-black text-[10px] uppercase text-primary/40 mr-1 tracking-widest">רמת הידור מבוקשת</Label>
                        <RadioGroup value={qualityLevel} onValueChange={setQualityLevel} className="grid grid-cols-2 gap-3">
                          {getQualityLevels(selectedProduct).map(q => <CustomTile key={q.v} value={q.v} label={q.l} active={qualityLevel === q.v} compact />)}
                        </RadioGroup>
                      </div>
                      
                      <div className="space-y-4">
                        <Label className="font-black text-[10px] uppercase text-primary/40 mr-1 tracking-widest">מיקום וקרבה (אופציונלי)</Label>
                        <div className="flex flex-col gap-3">
                          <Button variant="outline" onClick={detectLocation} disabled={isDetectingLocation} className={cn("h-14 rounded-2xl gap-3 font-black text-xs uppercase border-2 transition-all", userCoords ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'hover:border-primary/20')}>
                            {isDetectingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
                            {userCoords ? (detectedCity ? `המיקום שלך: ${detectedCity}` : 'המיקום שלך זוהה בהצלחה') : 'זהה את המיקום הנוכחי שלי'}
                          </Button>
                          <div className="relative">
                            <Select value={selectedLocation} onValueChange={setSelectedRegion}>
                              <SelectTrigger className="h-14 rounded-2xl text-right font-bold text-sm bg-white/50 border-2 border-transparent focus:border-primary/20"><SelectValue placeholder="בחר אזור בארץ..." /></SelectTrigger>
                              <SelectContent className="rounded-2xl border-none shadow-2xl p-1">
                                <SelectItem value="all" className="font-bold py-3 rounded-xl">כל הארץ</SelectItem>
                                {ISRAEL_REGIONS.map(r => <SelectItem key={r} value={r} className="font-bold py-3 rounded-xl">{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {selectedProduct === 'מגילה' ? (
                        <div className="space-y-6">
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest">מספר שורות</Label>
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
                          <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-primary/40 tracking-widest">גובה קלף (ס"מ)</Label>
                            <Select value={megillahHeight} onValueChange={setMegillahHeight}>
                              <SelectTrigger className="h-14 rounded-2xl text-right font-bold text-sm bg-white/50 border-2 border-transparent">
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
                        <div className="space-y-4">
                          <Label className="font-black text-[10px] uppercase text-primary/40 mr-1 tracking-widest">גודל הקלף (ס"מ)</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {getSizesForProduct(selectedProduct, scriptType).map(sz => (
                              <button type="button" key={sz} onClick={() => setScrollSize(sz)} className={cn("h-12 rounded-xl border-2 font-black text-11px transition-all", scrollSize === sz ? "border-primary bg-primary text-white shadow-md" : "bg-white/40 border-primary/5 text-primary hover:border-accent/40")}>{sz === 'all' ? 'כל הגדלים' : sz}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                         <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)} className="w-full h-14 rounded-2xl border-2 border-dashed border-primary/10 gap-3 font-black text-[10px] uppercase tracking-widest text-primary/60 hover:bg-primary/5 hover:border-primary/20 transition-all">
                           <Settings2 className="w-5 h-5 text-accent" /> {showAdvanced ? 'הסתר הגדרות סופר מתקדמות' : 'מסנני קדושה והנהגת הסופר'}
                         </Button>
                         <AnimatePresence>
                           {showAdvanced && (
                             <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-5 pt-5 px-1">
                               <div className="space-y-3">
                                 <Label className="text-[9px] font-black uppercase text-primary/40 tracking-widest">הסמכת הסופר</Label>
                                 <RadioGroup value={certStatus} onValueChange={setCertStatus} className="grid grid-cols-2 gap-2">
                                   <CustomTile value="all" label="הכל" active={certStatus === 'all'} compact />
                                   <CustomTile value="valid" label="תעודה בתוקף" active={certStatus === 'valid'} compact />
                                   <CustomTile value="expired" label="תעודה בעבר" active={certStatus === 'expired'} compact />
                                 </RadioGroup>
                               </div>

                               <div className="space-y-3">
                                 <Label className="text-[9px] font-black uppercase text-primary/40 tracking-widest">לימוד תורה יומיומי</Label>
                                 <RadioGroup value={studyFreq} onValueChange={setStudyFreq} className="grid grid-cols-2 gap-2">
                                   <CustomTile value="all" label="הכל" active={studyFreq === 'all'} compact />
                                   <CustomTile value="fixed" label="קובע עיתים" active={studyFreq === 'fixed'} compact />
                                   <CustomTile value="half-day" label="אברך חצי יום" active={studyFreq === 'half-day'} compact />
                                   <CustomTile value="full-day" label="אברך יום שלם" active={studyFreq === 'full-day'} compact />
                                 </RadioGroup>
                               </div>

                               <div className="space-y-3">
                                 <Label className="text-[9px] font-black uppercase text-primary/40 tracking-widest">מנהג טבילה</Label>
                                 <RadioGroup value={mikvehFreq} onValueChange={setMikvehFreq} className="grid grid-cols-2 gap-2">
                                   {['all', 'daily', 'before', 'ezra'].map(mf => (
                                     <CustomTile key={mf} value={mf} label={mf === 'all' ? 'הכל' : mf === 'daily' ? 'כל יום' : mf === 'before' ? 'לפני כתיבה' : 'טבילת עזרא'} active={mikvehFreq === mf} compact />
                                   ))}
                                 </RadioGroup>
                               </div>

                               <Label className="flex items-center justify-between p-4 bg-white/80 border-2 border-primary/5 rounded-2xl cursor-pointer hover:bg-white hover:border-primary/10 transition-all shadow-sm">
                                 <div className="flex items-center gap-3"><UserCheck className="w-5 h-5 text-accent" /><span className="text-[11px] font-black uppercase text-primary tracking-tight">הצג סופרים נשואים בלבד</span></div>
                                 <Checkbox checked={marriedOnly} onCheckedChange={(v) => setMarriedOnly(!!v)} className="w-6 h-6 rounded-lg" />
                               </Label>
                             </motion.div>
                           )}
                         </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center pt-10">
                    <Button onClick={handleFinalSearch} className="w-full bg-accent text-primary hover:bg-accent/90 rounded-full px-20 h-16 font-black text-lg uppercase tracking-[0.2em] shadow-2xl gap-4 hover:scale-105 focus:ring-4 focus:ring-accent/30 transition-all duration-300 group active:scale-95">
                      <Search className="w-6 h-6 group-hover:rotate-12 transition-transform" /> הצג כלי קודש מתאימים
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ icon, label, onClick }: any) {
  return (
    <button 
      type="button"
      onClick={onClick}
      aria-label={label}
    className="group flex flex-col items-center gap-2 md:gap-3 p-3 md:p-5 rounded-[2.5rem] bg-white border-2 border-transparent shadow-sm hover:shadow-xl hover:border-accent/40 hover:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-all duration-300 w-full"
    >
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-primary group-hover:scale-110 transition-all duration-300">
        {React.cloneElement(icon, { className: "w-6 h-6 md:w-7 md:h-7" })}
      </div>
      <span className="font-black text-primary text-[11px] md:text-xs tracking-tight group-hover:text-accent transition-colors duration-300">{label}</span>
    </button>
  );
}

function CustomTile({ value, label, active, compact = false }: any) {
  return (
    <Label className={cn(
      "flex items-center justify-between rounded-2xl border-2 transition-all duration-200 cursor-pointer group px-5",
      compact ? "py-3" : "py-4",
      active ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-primary/5 bg-white/40 hover:bg-white hover:border-primary/15 hover:shadow-sm"
    )}>
      <RadioGroupItem value={value} className="hidden" />
      <span className={cn("font-bold text-primary transition-colors", compact ? "text-[10px]" : "text-sm", active ? "opacity-100" : "opacity-60 group-hover:opacity-80")}>{label}</span>
      <div className={cn("w-3.5 h-3.5 rounded-full border-2 transition-all duration-200", active ? "bg-primary border-primary scale-110 shadow-sm" : "border-primary/10 group-hover:border-primary/30")} />
    </Label>
  );
}
