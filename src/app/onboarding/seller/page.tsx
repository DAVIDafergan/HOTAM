
"use client";

import { useState, useRef, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  User, 
  Shield, 
  PenTool, 
  Loader2, 
  Eye, 
  EyeOff, 
  X, 
  Camera, 
  Building2, 
  AlertCircle, 
  Image as ImageIcon,
  Landmark,
  ExternalLink,
  BookOpen,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, initiateEmailSignUp, useSupabaseClient } from '@/lib/supabase-hooks';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { cn } from "@/lib/utils";
import { loadGoogleMapsPlacesScript } from '@/lib/google-maps';
import { uploadImageViaApi } from '@/lib/image-upload';

export default function SellerOnboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const totalSteps = 3;
  const router = useRouter();
  const auth = useAuth();
  const db = useSupabaseClient();
  const { user } = useUser();
  const { toast } = useToast();

  const certInputRef = useRef<HTMLInputElement>(null);
  const samplesInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const isExistingCustomer = !!user?.uid && user.role === 'customer';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    age: '',
    maritalStatus: 'married',
    // Business info
    businessType: 'osek_patur', // osek_patur, business (mandatory)
    businessId: '', // HP or Osek number
    businessName: '',
    // Bank info
    bankName: '',
    bankBranch: '',
    bankAccountNumber: '',
    // Professional info
    hasScribeCertificate: 'valid',
    certificateUrl: '',
    torahStudyFrequency: 'fixed',
    mikvehFrequency: 'before',
    notes: '',
    experienceYears: '',
    scriptLevel: 'מהודר',
    scriptTypes: [] as string[],
    writingSamples: [] as string[],
  });

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Pre-fill email when an existing customer opens the form
  useEffect(() => {
    if (user?.email && isExistingCustomer) {
      setFormData(prev => ({ ...prev, email: user.email! }));
    }
  }, [user?.email, isExistingCustomer]);

  useEffect(() => {
    if (!addressInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let isCancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (isCancelled || !addressInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ['address'],
          fields: ['formatted_address'],
          componentRestrictions: { country: 'il' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            updateField('address', place.formatted_address);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
      if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, []);

  const toggleScriptType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      scriptTypes: prev.scriptTypes.includes(type) 
        ? prev.scriptTypes.filter(t => t !== type) 
        : [...prev.scriptTypes, type]
    }));
  };

  const uploadImage = async (file: File): Promise<string> => {
    return uploadImageViaApi(file, { client: db, uploadContext: 'onboarding' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cert' | 'samples') => {
    const files = e.target.files;
    if (!files) return;
    const allFiles = Array.from(files);
    e.target.value = '';

    try {
      if (target === 'cert') {
        const firstFile = allFiles[0];
        if (!firstFile) return;
        const uploadedUrl = await uploadImage(firstFile);
        updateField('certificateUrl', uploadedUrl);
        return;
      }

      const uploadedUrls = await Promise.all(allFiles.map(uploadImage));
      setFormData(prev => ({
        ...prev,
        writingSamples: [...prev.writingSamples, ...uploadedUrls]
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'העלאת התמונה נכשלה.';
      console.error('Onboarding image upload error:', error);
      toast({ variant: 'destructive', title: 'שגיאת העלאה', description: message });
    }
  };

  const removeSample = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      writingSamples: prev.writingSamples.filter((_, i) => i !== idx)
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.address || !formData.age) {
        toast({ variant: "destructive", title: "פרטים חסרים", description: "כל השדות האישיים הם חובה." });
        return false;
      }
      // Password is only required for new registrations (not existing logged-in customers)
      if (!isExistingCustomer && (!formData.password || formData.password.length < 6)) {
        toast({ variant: "destructive", title: "סיסמה חלשה", description: "לפחות 6 תווים." });
        return false;
      }
      if (!formData.businessId || !formData.businessName) {
        toast({ variant: "destructive", title: "פרטי עסק חסרים", description: "חובה להזין מספר עוסק ושם עסק רשום." });
        return false;
      }
      if (!formData.bankName || !formData.bankBranch || !formData.bankAccountNumber) {
        toast({ variant: "destructive", title: "פרטי בנק חסרים", description: "חובה להזין פרטי חשבון בנק לקבלת תשלומים." });
        return false;
      }
    }
    if (step === 2) {
      if ((formData.hasScribeCertificate === 'valid' || formData.hasScribeCertificate === 'expired') && !formData.certificateUrl) {
        toast({ variant: "destructive", title: "חסר צילום תעודה", description: "עליך להעלות צילום או קובץ של תעודת הסופר שלך." });
        return false;
      }
      if (!formData.notes) {
        toast({ variant: "destructive", title: "פרטים חסרים", description: "אנא פרט על ההסמכה וההנהגה האישית שלך." });
        return false;
      }
    }
    if (step === 3) {
      if (!formData.experienceYears || formData.scriptTypes.length === 0) {
        toast({ variant: "destructive", title: "פרטים חסרים", description: "אנא מלא את שנות הניסיון וסוגי הכתב." });
        return false;
      }
      if (formData.writingSamples.length < 2) {
        toast({ variant: "destructive", title: "חסרות דוגמאות", description: "עליך להעלות לפחות 2 דוגמאות כתיבה ברורות." });
        return false;
      }
      if (!termsAccepted) {
        toast({ variant: "destructive", title: "נדרש אישור תנאי שימוש", description: "עליך לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך." });
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(s => Math.min(s + 1, totalSteps));
  };

  const handleFinalSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);

    try {
      // Build the full seller profile payload up-front so it can be persisted
      // regardless of whether email confirmation is required.
      const profilePayload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        address: formData.address,
        age: Number(formData.age),
        marital_status: formData.maritalStatus,
        business_type: formData.businessType,
        business_id: formData.businessId,
        business_name: formData.businessName,
        bank_name: formData.bankName,
        bank_branch: formData.bankBranch,
        bank_account_number: formData.bankAccountNumber,
        has_scribe_certificate: formData.hasScribeCertificate,
        certificate_url: formData.certificateUrl,
        torah_study_frequency: formData.torahStudyFrequency,
        mikveh_frequency: formData.mikvehFrequency,
        notes: formData.notes,
        experience_years: Number(formData.experienceYears),
        script_level: formData.scriptLevel,
        script_types: formData.scriptTypes,
        writing_samples: formData.writingSamples,
        is_approved: false,
        favorite_product_ids: [],
        updated_at: new Date().toISOString(),
      };

      // If user is already logged in as a customer, upgrade them to seller
      if (isExistingCustomer && user?.uid) {
        // Update auth metadata role to 'seller'
        const { error: authUpdateError } = await db.auth.updateUser({
          data: { role: 'seller' },
        });
        if (authUpdateError) throw authUpdateError;

        // Upsert the sellers row with the full profile
        const { error: dbError } = await db
          .from('sellers')
          .upsert({ id: user.uid, ...profilePayload });
        if (dbError) throw dbError;

        if (typeof window !== 'undefined') {
          localStorage.removeItem('pendingSellerProfile');
        }

        toast({ title: 'ההרשמה הסתיימה', description: 'הפרופיל שלך הועבר לאישור מנהל.' });
        router.push('/seller/dashboard');
        return;
      }

      // Persist the full profile to localStorage so that when email confirmation
      // is required the seller dashboard can apply it automatically after login.
      // We tag it with the email so the dashboard can verify ownership.
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'pendingSellerProfile',
            JSON.stringify({ ...profilePayload, _pending_email: formData.email }),
          );
        } catch {
          // localStorage quota exceeded (very unlikely) — ignore and continue.
        }
      }

      // Sign up with role='seller' so the DB trigger creates the sellers row.
      const signUpData = await initiateEmailSignUp(
        auth,
        formData.email,
        formData.password,
        { role: 'seller', first_name: formData.firstName, last_name: formData.lastName },
      );

      const userId: string | undefined =
        (signUpData as any)?.user?.id ?? (signUpData as any)?.session?.user?.id;

      if (!userId) {
        // Should not happen, but guard anyway.
        toast({
          variant: 'destructive',
          title: 'שגיאת הרשמה',
          description: 'לא ניתן היה לאמת את החשבון.',
        });
        setLoading(false);
        return;
      }

      if ((signUpData as any)?.session) {
        // Session is immediately available (email confirmation disabled).
        // The trigger already created the sellers row; update it with full profile.
        const { error: dbError } = await db
          .from('sellers')
          .update(profilePayload)
          .eq('id', userId);

        if (dbError) throw dbError;

        // Profile saved — no need for the localStorage copy.
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pendingSellerProfile');
        }

        toast({ title: 'ההרשמה הסתיימה', description: 'הפרופיל שלך הועבר לאישור מנהל.' });
        router.push('/seller/dashboard');
      } else {
        // Email confirmation is required.
        // The DB trigger created the sellers row with only first/last name.
        // The full profile is saved in localStorage and will be applied by the
        // seller dashboard on the first login after email confirmation.
        setLoading(false);
        toast({
          title: 'הרשמה הצליחה — בדוק את תיבת הדואר שלך',
          description:
            'שלחנו קישור אישור לכתובת המייל שלך. לאחר האישור תוכל להתחבר ולהשלים את הפרופיל.',
        });
        router.push('/login');
      }
    } catch (error: any) {
      setLoading(false);
      toast({
        variant: 'destructive',
        title: 'שגיאת הרשמה',
        description:
          error.code === 'auth/email-already-in-use'
            ? 'האימייל כבר קיים במערכת.'
            : 'חלה שגיאה בתהליך ההרשמה.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <div className="container mx-auto px-4 py-12 max-w-3xl pt-28">
        <div className="mb-12 text-center space-y-4">
          <h1 className="text-4xl font-headline font-black text-primary">הרשמה כסופר מוסמך</h1>
          <Progress value={(step / totalSteps) * 100} className="h-1.5 w-48 mx-auto" />
        </div>

        <Card className="shadow-premium border-none rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary text-white text-right p-8 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <CardTitle className="text-2xl font-headline font-black flex items-center justify-end gap-3 relative z-10">
              {step === 1 && "פרטי עסק ותשלום"}
              {step === 2 && "הסמכה ואורח חיים"}
              {step === 3 && "מיומנות ודוגמאות"}
              {step === 1 ? <Building2 className="w-8 h-8 text-accent" /> : step === 2 ? <Shield className="w-8 h-8 text-accent" /> : <PenTool className="w-8 h-8 text-accent" />}
            </CardTitle>
            <CardDescription className="text-white/60 font-medium italic relative z-10">הצטרף לקהילת הסופרים המובחרת של חותם</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 space-y-8 text-right">
            {step === 1 && (
              <div className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>שם פרטי *</Label><Input value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} required className="text-slate-900 rounded-xl" /></div>
                  <div className="space-y-2"><Label>שם משפחה *</Label><Input value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} required className="text-slate-900 rounded-xl" /></div>
                </div>

                <div className="space-y-4 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-black text-primary text-[10px] uppercase tracking-widest">סטטוס עסק *</Label>
                    <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                      <DialogTrigger asChild>
                        <Button variant="link" className="p-0 h-auto text-accent font-black text-[10px] uppercase tracking-tighter">אין לך עדיין עוסק? לחץ כאן ←</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white text-slate-900" dir="rtl">
                        <div className="bg-primary p-6 text-white text-right">
                          <DialogTitle className="text-xl font-headline font-black flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-accent" /> מדריך לפתיחת עוסק פטור
                          </DialogTitle>
                          <DialogDescription className="text-white/60 text-xs mt-1">תהליך פשוט שניתן לבצע אונליין תוך דקות</DialogDescription>
                        </div>
                        <div className="p-6 space-y-6 text-right">
                          <div className="space-y-4">
                            <GuideStep number="1" title="פתיחת תיק במע''מ" desc="ניתן לפתוח תיק עוסק פטור אונליין באתר רשות המיסים. זהו השלב הראשון והחשוב ביותר." link="https://www.gov.il/he/service/opening-a-vat-file" />
                            <GuideStep number="2" title="פתיחת תיק במס הכנסה" desc="לאחר קבלת אישור ממע''מ, יש לפתוח תיק במס הכנסה (תיק 0). ניתן לבצע זאת במקביל או מיד לאחר מכן." link="https://www.gov.il/he/service/opening-a-tax-file" />
                            <GuideStep number="3" title="רישום בביטוח לאומי" desc="חובה לדווח לביטוח לאומי על פתיחת העסק ולהגדיר את המעמד שלך כעצמאי." link="https://www.btl.gov.il/Insurance/Self_Employed/Pages/ptichatTik.aspx" />
                          </div>
                          <div className="bg-accent/5 p-4 rounded-xl flex items-start gap-3 border border-accent/20">
                            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-primary/70 leading-relaxed">שימו לב: פתיחת עוסק פטור אינה כרוכה בתשלום אגרה והיא מיועדת למי שהכנסותיו אינן עולות על התקרה השנתית (כ-120,000 ש"ח נכון ל-2024).</p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <RadioGroup value={formData.businessType} onValueChange={(v) => updateField('businessType', v)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={cn("flex items-center space-x-reverse space-x-2 p-3 border rounded-xl bg-white transition-all cursor-pointer", formData.businessType === 'osek_patur' ? 'border-primary ring-2 ring-primary/5' : '')} onClick={() => updateField('businessType', 'osek_patur')}>
                      <RadioGroupItem value="osek_patur" id="bp1" />
                      <Label htmlFor="bp1" className="text-xs font-bold cursor-pointer">עוסק פטור</Label>
                    </div>
                    <div className={cn("flex items-center space-x-reverse space-x-2 p-3 border rounded-xl bg-white transition-all cursor-pointer", formData.businessType === 'business' ? 'border-primary ring-2 ring-primary/5' : '')} onClick={() => updateField('businessType', 'business')}>
                      <RadioGroupItem value="business" id="bp2" />
                      <Label htmlFor="bp2" className="text-xs font-bold cursor-pointer">עוסק מורשה / חברה</Label>
                    </div>
                  </RadioGroup>

                  <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">מספר עוסק / ח.פ *</Label>
                      <Input value={formData.businessId} onChange={(e) => updateField('businessId', e.target.value)} placeholder="מספר זיהוי עסק..." className="text-slate-900 rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">שם העסק הרשום *</Label>
                      <Input value={formData.businessName} onChange={(e) => updateField('businessName', e.target.value)} placeholder="שם העסק..." className="text-slate-900 rounded-xl h-11" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                  <Label className="font-black text-emerald-700 text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <Landmark className="w-4 h-4" /> פרטי חשבון בנק לקבלת תשלומים *
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold">שם הבנק</Label>
                      <Input value={formData.bankName} onChange={(e) => updateField('bankName', e.target.value)} placeholder="למשל: לאומי" className="text-slate-900 rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold">מספר סניף</Label>
                      <Input value={formData.bankBranch} onChange={(e) => updateField('bankBranch', e.target.value)} placeholder="3 ספרות" className="text-slate-900 rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold">מספר חשבון</Label>
                      <Input value={formData.bankAccountNumber} onChange={(e) => updateField('bankAccountNumber', e.target.value)} placeholder="מספר חשבון" className="text-slate-900 rounded-xl h-11" />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>אימייל *</Label>
                    <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} readOnly={isExistingCustomer} required className={cn("text-slate-900 rounded-xl h-11", isExistingCustomer && "bg-muted/50")} />
                  </div>
                  {!isExistingCustomer && (
                    <div className="space-y-2">
                      <Label>סיסמה (לפחות 6 תווים) *</Label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => updateField('password', e.target.value)} required className="text-slate-900 rounded-xl h-11" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>טלפון *</Label><Input value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} required className="text-slate-900 rounded-xl h-11" /></div>
                  <div className="space-y-2"><Label>גיל *</Label><Input type="number" value={formData.age} onChange={(e) => updateField('age', e.target.value)} required className="text-slate-900 rounded-xl h-11" /></div>
                </div>
                <div className="space-y-2"><Label>כתובת מלאה *</Label><Input ref={addressInputRef} value={formData.address} onChange={(e) => updateField('address', e.target.value)} required className="text-slate-900 rounded-xl h-11" /></div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="space-y-4 text-right">
                  <Label className="font-bold block mb-2">הסמכת סופר סת''ם *</Label>
                  <RadioGroup value={formData.hasScribeCertificate} onValueChange={(v) => updateField('hasScribeCertificate', v)} className="grid gap-2">
                    <div className="flex items-center space-x-reverse space-x-3 p-4 border rounded-2xl cursor-pointer" onClick={() => updateField('hasScribeCertificate', 'valid')}><RadioGroupItem value="valid" id="v1" /><Label htmlFor="v1" className="flex-1 cursor-pointer font-bold">תעודה בתוקף</Label></div>
                    <div className="flex items-center space-x-reverse space-x-3 p-4 border rounded-2xl cursor-pointer" onClick={() => updateField('hasScribeCertificate', 'expired')}><RadioGroupItem value="expired" id="v2" /><Label htmlFor="v2" className="flex-1 cursor-pointer font-bold">הייתה תעודה בעבר</Label></div>
                    <div className="flex items-center space-x-reverse space-x-3 p-4 border rounded-2xl cursor-pointer" onClick={() => updateField('hasScribeCertificate', 'none')}><RadioGroupItem value="none" id="v3" /><Label htmlFor="v3" className="flex-1 cursor-pointer font-bold">ללא תעודה</Label></div>
                  </RadioGroup>

                  {(formData.hasScribeCertificate === 'valid' || formData.hasScribeCertificate === 'expired') && (
                    <div className="mt-4 p-6 bg-accent/5 rounded-2xl border-2 border-dashed border-accent/20 text-center space-y-4">
                      {formData.certificateUrl ? (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden border bg-white shadow-sm">
                          <Image src={formData.certificateUrl} alt="Cert" fill className="object-contain" />
                          <button onClick={() => updateField('certificateUrl', '')} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X className="w-4 h-4" /></button>
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
                      <input type="file" ref={certInputRef} onChange={(e) => handleFileUpload(e, 'cert')} className="hidden" accept="image/*" />
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="font-bold">לימוד תורה קבוע *</Label>
                    <RadioGroup value={formData.torahStudyFrequency} onValueChange={(v) => updateField('torahStudyFrequency', v)} className="flex flex-col gap-2">
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('torahStudyFrequency', 'fixed')}><RadioGroupItem value="fixed" id="t1" /><Label htmlFor="t1" className="text-xs cursor-pointer">קובע עיתים</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('torahStudyFrequency', 'half-day')}><RadioGroupItem value="half-day" id="t2" /><Label htmlFor="t2" className="text-xs cursor-pointer">אברך חצי יום</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('torahStudyFrequency', 'full-day')}><RadioGroupItem value="full-day" id="t3" /><Label htmlFor="t3" className="text-xs cursor-pointer">אברך יום שלם</Label></div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <Label className="font-bold">מנהג טבילה *</Label>
                    <RadioGroup value={formData.mikvehFrequency} onValueChange={(v) => updateField('mikvehFrequency', v)} className="flex flex-col gap-2">
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('mikvehFrequency', 'ezra')}><RadioGroupItem value="ezra" id="m1" /><Label htmlFor="m1" className="text-xs cursor-pointer">טבילת עזרא</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('mikvehFrequency', 'before')}><RadioGroupItem value="before" id="m2" /><Label htmlFor="m2" className="text-xs cursor-pointer">לפני כתיבה</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('mikvehFrequency', 'daily')}><RadioGroupItem value="daily" id="m3" /><Label htmlFor="m3" className="text-xs cursor-pointer">כל יום</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('mikvehFrequency', 'never')}><RadioGroupItem value="never" id="m4" /><Label htmlFor="m4" className="text-xs cursor-pointer">לא טובל בכלל</Label></div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">פרט על ההסמכה ואורח החיים הרוחני שלך *</Label>
                  <Textarea placeholder="למדתי אצל הרב..., אני נוהג לטבול ב..., סדר היום שלי כולל..." value={formData.notes} onChange={(e) => updateField('notes', e.target.value)} required className="text-slate-900 rounded-2xl min-h-[120px]" />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label className="font-bold">שנות ניסיון במלאכת הקודש *</Label>
                    <Input type="number" value={formData.experienceYears} onChange={(e) => updateField('experienceYears', e.target.value)} required className="text-slate-900 rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">רמת הידור ממוצעת *</Label>
                    <RadioGroup value={formData.scriptLevel} onValueChange={(v) => updateField('scriptLevel', v)} className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('scriptLevel', 'כשר')}><RadioGroupItem value="כשר" id="ls" /><Label htmlFor="ls" className="text-xs cursor-pointer">כשר</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('scriptLevel', 'מהודר')}><RadioGroupItem value="מהודר" id="lm" /><Label htmlFor="lm" className="text-xs font-black text-accent cursor-pointer">מהודר</Label></div>
                      <div className="flex items-center space-x-reverse space-x-2 cursor-pointer" onClick={() => updateField('scriptLevel', 'מהודר מאד')}><RadioGroupItem value="מהודר מאד" id="lx" /><Label htmlFor="lx" className="text-xs font-black text-primary cursor-pointer">מהודר מאד</Label></div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold">סוגי כתב שהנך כותב (בחר את כולם) *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['ספרדי', 'בית יוסף', 'האר"י', 'אדמו"ר הזקן'].map(type => (
                      <div key={type} className={cn("flex items-center space-x-reverse space-x-2 p-3 border rounded-xl transition-all cursor-pointer", formData.scriptTypes.includes(type) ? 'bg-primary/5 border-primary' : 'bg-white')}>
                        <Checkbox id={type} checked={formData.scriptTypes.includes(type)} onCheckedChange={() => toggleScriptType(type)} />
                        <Label htmlFor={type} className="cursor-pointer text-xs font-bold">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">דוגמאות כתיבה חיות (מינימום 2) *</Label>
                    <span className="text-[10px] text-muted-foreground font-bold">העלה צילומים ברורים של כתב ידך</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {formData.writingSamples.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border shadow-sm group">
                        <Image src={img} alt="Sample" fill className="object-cover" />
                        <button onClick={() => removeSample(idx)} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {formData.writingSamples.length < 8 && (
                      <button onClick={() => samplesInputRef.current?.click()} className="aspect-square border-2 border-dashed border-primary/10 rounded-2xl flex flex-col items-center justify-center text-primary/30 hover:bg-primary/5 transition-all">
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-[9px] font-black uppercase">הוסף דוגמה</span>
                      </button>
                    )}
                  </div>
                  <input type="file" ref={samplesInputRef} onChange={(e) => handleFileUpload(e, 'samples')} className="hidden" multiple accept="image/*" />
                </div>

                <div className="flex items-start space-x-reverse space-x-3 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                  <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(!!v)} className="mt-1" />
                  <Label htmlFor="terms" className="text-[11px] font-bold leading-relaxed cursor-pointer">אני מצהיר כי כל הפרטים שהזנתי נכונים, ומתחייב לעסוק במלאכת הקודש בקדושה, טהרה ויראת שמיים. אני מאשר את <Link href="/terms" target="_blank" className="underline font-black text-primary hover:text-primary/70">תנאי השימוש ומדיניות הפרטיות</Link> של הפלטפורמה.</Label>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-8 border-t">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={loading} className="rounded-xl px-8 h-12 font-black text-xs uppercase tracking-widest">חזור</Button>
              ) : <div />}
              <Button onClick={step === totalSteps ? handleFinalSubmit : nextStep} className="bg-primary hover:bg-primary/90 px-12 h-14 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (step === totalSteps ? "שלח הרשמה לאישור" : "המשך לשלב הבא")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuideStep({ number, title, desc, link }: { number: string, title: string, desc: string, link: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black shrink-0 text-sm">{number}</div>
      <div className="space-y-1 text-right">
        <p className="font-black text-sm text-primary">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent font-black text-[10px] uppercase tracking-tighter hover:underline mt-1">
          לכניסה לשירות הממשלתי <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
