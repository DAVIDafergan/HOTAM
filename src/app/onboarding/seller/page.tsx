
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAuth, useUser, useSupabaseClient } from '@/lib/supabase-hooks';
import { useToast } from '@/hooks/use-toast';
import Image from '@/components/SmartImage';
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
import { getCityFromAddressComponents, loadGoogleMapsPlacesScript } from '@/lib/google-maps';
import { cleanupImageAssetsViaApi, uploadImageViaApi } from '@/lib/image-upload';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateOnboardingField(
  field: string,
  value: string,
  context?: { isExistingCustomer?: boolean }
): string | undefined {
  switch (field) {
    case 'firstName':
      return value.trim().length < 2 ? 'שם פרטי חייב לכלול לפחות 2 תווים' : undefined;
    case 'lastName':
      return value.trim().length < 2 ? 'שם משפחה חייב לכלול לפחות 2 תווים' : undefined;
    case 'businessId':
      return value.trim().length < 2 ? 'יש להזין מספר עוסק / ח.פ תקין' : undefined;
    case 'businessName':
      return value.trim().length < 2 ? 'יש להזין שם עסק' : undefined;
    case 'bankName':
      return !value.trim() ? 'יש להזין שם בנק' : undefined;
    case 'bankBranch':
      return !/^\d{2,4}$/.test(value.trim()) ? 'מספר סניף אינו תקין' : undefined;
    case 'bankAccountNumber':
      return value.trim().length < 4 ? 'מספר חשבון אינו תקין' : undefined;
    case 'email':
      return !EMAIL_REGEX.test(value.trim()) ? 'כתובת אימייל אינה תקינה' : undefined;
    case 'password':
      return !context?.isExistingCustomer && value.length < 6 ? 'הסיסמה חייבת לכלול לפחות 6 תווים' : undefined;
    case 'phone':
      return !/^0\d{8,9}$/.test(value.replace(/[\s-]/g, '')) ? 'מספר טלפון אינו תקין (למשל 0501234567)' : undefined;
    case 'age': {
      const n = Number(value);
      return (!value || Number.isNaN(n) || n < 16 || n > 120) ? 'יש להזין גיל תקין (16–120)' : undefined;
    }
    case 'city':
      return !value.trim() ? 'יש להזין עיר' : undefined;
    case 'address':
      return !value.trim() ? 'יש להזין כתובת' : undefined;
    default:
      return undefined;
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] font-bold text-destructive">
      <AlertCircle className="w-3 h-3 shrink-0" />{message}
    </p>
  );
}

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
  const cityInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const isExistingCustomer = !!user?.uid && user.role === 'customer';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
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

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const updateFieldWithValidation = (field: string, value: any) => {
    updateField(field, value);
    if (touchedFields[field]) {
      setFieldErrors(prev => ({
        ...prev,
        [field]: validateOnboardingField(field, String(value ?? ''), { isExistingCustomer }),
      }));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    setFieldErrors(prev => ({
      ...prev,
      [field]: validateOnboardingField(field, String((formData as any)[field] ?? ''), { isExistingCustomer }),
    }));
  };

  // Pre-fill email when an existing customer opens the form
  useEffect(() => {
    if (user?.email && isExistingCustomer) {
      setFormData(prev => ({ ...prev, email: user.email! }));
    }
  }, [user?.email, isExistingCustomer]);

  useEffect(() => {
    if (!cityInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let isCancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (isCancelled || !cityInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(cityInputRef.current, {
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
            updateField('city', city);
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
          fields: ['formatted_address', 'address_components'],
          componentRestrictions: { country: 'il' },
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            updateField('address', place.formatted_address);
          }
          const city = getCityFromAddressComponents(place?.address_components);
          if (city) {
            updateField('city', city);
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

  const [uploadProgress, setUploadProgress] = useState<{ cert: number | null; samples: number | null }>({
    cert: null,
    samples: null,
  });

  const uploadImage = async (
    file: File,
    assetKind: 'certificate' | 'writing_sample',
    onProgress?: (percent: number) => void
  ): Promise<string> => {
    return uploadImageViaApi(file, { client: db, uploadContext: 'onboarding', assetKind, onProgress });
  };

  const cleanupImages = async (urls: string[]) => {
    await cleanupImageAssetsViaApi(urls, { client: db, uploadContext: 'onboarding' });
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
        const previousCertificateUrl = formData.certificateUrl;
        setUploadProgress(prev => ({ ...prev, cert: 0 }));
        const uploadedUrl = await uploadImage(firstFile, 'certificate', (percent) => {
          setUploadProgress(prev => ({ ...prev, cert: percent }));
        });
        updateField('certificateUrl', uploadedUrl);
        if (previousCertificateUrl && previousCertificateUrl !== uploadedUrl) {
          void cleanupImages([previousCertificateUrl]);
        }
        return;
      }

      const fileProgresses = new Array(allFiles.length).fill(0);
      setUploadProgress(prev => ({ ...prev, samples: 0 }));
      const uploadedUrls = await Promise.all(allFiles.map((file, idx) => uploadImage(file, 'writing_sample', (percent) => {
        fileProgresses[idx] = percent;
        const average = Math.round(fileProgresses.reduce((sum, p) => sum + p, 0) / fileProgresses.length);
        setUploadProgress(prev => ({ ...prev, samples: average }));
      })));
      setFormData(prev => ({
        ...prev,
        writingSamples: [...prev.writingSamples, ...uploadedUrls]
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'העלאת התמונה נכשלה.';
      console.error('Onboarding image upload error:', error);
      toast({ variant: 'destructive', title: 'שגיאת העלאה', description: message });
    } finally {
      setUploadProgress({ cert: null, samples: null });
    }
  };

  const removeSample = (idx: number) => {
    const targetUrl = formData.writingSamples[idx];
    if (targetUrl) {
      void cleanupImages([targetUrl]);
    }
    setFormData(prev => ({
      ...prev,
      writingSamples: prev.writingSamples.filter((_, i) => i !== idx)
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      const stepFields = [
        'firstName', 'lastName', 'businessId', 'businessName',
        'bankName', 'bankBranch', 'bankAccountNumber',
        'email', 'phone', 'age', 'city', 'address',
        ...(!isExistingCustomer ? ['password'] : []),
      ];
      const nextErrors: Record<string, string | undefined> = {};
      stepFields.forEach((field) => {
        nextErrors[field] = validateOnboardingField(field, String((formData as any)[field] ?? ''), { isExistingCustomer });
      });
      setFieldErrors(prev => ({ ...prev, ...nextErrors }));
      setTouchedFields(prev => ({ ...prev, ...Object.fromEntries(stepFields.map((field) => [field, true])) }));
      if (Object.values(nextErrors).some(Boolean)) {
        toast({ variant: "destructive", title: "פרטים חסרים או שגויים", description: "אנא תקן/י את השדות המסומנים באדום." });
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
      // Build the full seller profile payload up-front.
      const profilePayload = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        city: formData.city,
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
        is_email_verified: false,
        updated_at: new Date().toISOString(),
      };

      const registerSellerWithSession = async (userId: string, source: string, emailOverride?: string | null) => {
        const { data: { session } } = await db.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error('Missing auth session for seller registration');
        }
        const response = await fetch('/api/register-seller', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({
            id: userId,
            email: emailOverride ?? formData.email,
            recovery_source: source,
            ...profilePayload,
          }),
        });
        if (!response.ok) {
          throw new Error(`register-seller failed (${response.status})`);
        }
      };

      // If user is already logged in as a customer, upgrade them to seller
      if (isExistingCustomer && user?.uid) {
        console.info('[seller-onboarding] upgrading existing customer to seller', { userId: user.uid });
        await registerSellerWithSession(user.uid, 'existing-customer-upgrade', user.email);

        toast({ title: 'ההרשמה הסתיימה', description: 'הפרופיל שלך הועבר לאישור מנהל.' });
        router.push('/seller/dashboard');
        return;
      }

      console.info('[seller-onboarding] signup start', { email: formData.email.trim().toLowerCase() });

      // Create the seller via Admin API (email_confirm=true) so they can sign in immediately.
      const registerResponse = await fetch('/api/register-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          ...profilePayload,
        }),
      });

      if (!registerResponse.ok) {
        const registerBody = await registerResponse.json().catch(() => ({}));
        if (registerBody.error === 'email-already-in-use' || registerResponse.status === 409) {
          toast({
            variant: 'destructive',
            title: 'האימייל כבר קיים במערכת',
            description: 'אם שכחת סיסמה, בצע איפוס סיסמה והתחבר. אם זה חשבון לקוח קיים, התחבר עם אותו מייל ואז השלם הרשמה כסופר.',
          });
          setLoading(false);
          return;
        }
        console.error('[seller-onboarding] register-seller failed', registerBody);
        throw new Error(`register-seller failed (${registerResponse.status})`);
      }

      // User is now created and email-confirmed server-side — sign them in.
      const { data: signInData, error: signInError } = await db.auth.signInWithPassword({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (signInError || !signInData.session) {
        console.error('[seller-onboarding] signInWithPassword failed after registration', signInError);
        toast({
          title: 'ההרשמה הסתיימה',
          description: 'הפרופיל שלך הועבר לאישור מנהל. התחבר כדי להמשיך.',
        });
        router.push('/login');
        return;
      }

      toast({ title: 'ההרשמה הסתיימה', description: 'הפרופיל שלך הועבר לאישור מנהל.' });
      router.push('/seller/dashboard');
    } catch (error: any) {
      setLoading(false);
      console.error('[seller-onboarding] unexpected error', error);
      toast({
        variant: 'destructive',
        title: 'שגיאת הרשמה',
        description: 'חלה שגיאה בתהליך ההרשמה.',
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
                  <div className="space-y-2">
                    <Label>שם פרטי *</Label>
                    <Input value={formData.firstName} onChange={(e) => updateFieldWithValidation('firstName', e.target.value)} onBlur={() => handleFieldBlur('firstName')} autoComplete="given-name" required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.firstName && "border-destructive")} />
                    <FieldError message={fieldErrors.firstName} />
                  </div>
                  <div className="space-y-2">
                    <Label>שם משפחה *</Label>
                    <Input value={formData.lastName} onChange={(e) => updateFieldWithValidation('lastName', e.target.value)} onBlur={() => handleFieldBlur('lastName')} autoComplete="family-name" required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.lastName && "border-destructive")} />
                    <FieldError message={fieldErrors.lastName} />
                  </div>
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
                    <div className={cn("flex min-h-[48px] items-center space-x-reverse space-x-2 p-3 border rounded-xl bg-white transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]", formData.businessType === 'osek_patur' ? 'border-primary ring-2 ring-primary/5' : 'border-input/60')} onClick={() => updateField('businessType', 'osek_patur')}>
                      <RadioGroupItem value="osek_patur" id="bp1" />
                      <Label htmlFor="bp1" className="text-xs font-bold cursor-pointer">עוסק פטור</Label>
                    </div>
                    <div className={cn("flex min-h-[48px] items-center space-x-reverse space-x-2 p-3 border rounded-xl bg-white transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]", formData.businessType === 'business' ? 'border-primary ring-2 ring-primary/5' : 'border-input/60')} onClick={() => updateField('businessType', 'business')}>
                      <RadioGroupItem value="business" id="bp2" />
                      <Label htmlFor="bp2" className="text-xs font-bold cursor-pointer">עוסק מורשה / חברה</Label>
                    </div>
                  </RadioGroup>

                  <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">מספר עוסק / ח.פ *</Label>
                      <Input value={formData.businessId} onChange={(e) => updateFieldWithValidation('businessId', e.target.value)} onBlur={() => handleFieldBlur('businessId')} placeholder="מספר זיהוי עסק..." inputMode="numeric" className={cn("text-slate-900 rounded-xl h-12", fieldErrors.businessId && "border-destructive")} />
                      <FieldError message={fieldErrors.businessId} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">שם העסק הרשום *</Label>
                      <Input value={formData.businessName} onChange={(e) => updateFieldWithValidation('businessName', e.target.value)} onBlur={() => handleFieldBlur('businessName')} placeholder="שם העסק..." className={cn("text-slate-900 rounded-xl h-12", fieldErrors.businessName && "border-destructive")} />
                      <FieldError message={fieldErrors.businessName} />
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
                      <Input value={formData.bankName} onChange={(e) => updateFieldWithValidation('bankName', e.target.value)} onBlur={() => handleFieldBlur('bankName')} placeholder="למשל: לאומי" className={cn("text-slate-900 rounded-xl h-12", fieldErrors.bankName && "border-destructive")} />
                      <FieldError message={fieldErrors.bankName} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold">מספר סניף</Label>
                      <Input value={formData.bankBranch} onChange={(e) => updateFieldWithValidation('bankBranch', e.target.value)} onBlur={() => handleFieldBlur('bankBranch')} placeholder="3 ספרות" inputMode="numeric" className={cn("text-slate-900 rounded-xl h-12", fieldErrors.bankBranch && "border-destructive")} />
                      <FieldError message={fieldErrors.bankBranch} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold">מספר חשבון</Label>
                      <Input value={formData.bankAccountNumber} onChange={(e) => updateFieldWithValidation('bankAccountNumber', e.target.value)} onBlur={() => handleFieldBlur('bankAccountNumber')} placeholder="מספר חשבון" inputMode="numeric" className={cn("text-slate-900 rounded-xl h-12", fieldErrors.bankAccountNumber && "border-destructive")} />
                      <FieldError message={fieldErrors.bankAccountNumber} />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>אימייל *</Label>
                    <Input type="email" inputMode="email" autoComplete="email" value={formData.email} onChange={(e) => updateFieldWithValidation('email', e.target.value)} onBlur={() => handleFieldBlur('email')} readOnly={isExistingCustomer} required className={cn("text-slate-900 rounded-xl h-12", isExistingCustomer && "bg-muted/50", fieldErrors.email && "border-destructive")} />
                    <FieldError message={fieldErrors.email} />
                  </div>
                  {!isExistingCustomer && (
                    <div className="space-y-2">
                      <Label>סיסמה (לפחות 6 תווים) *</Label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} autoComplete="new-password" value={formData.password} onChange={(e) => updateFieldWithValidation('password', e.target.value)} onBlur={() => handleFieldBlur('password')} required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.password && "border-destructive")} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                      <FieldError message={fieldErrors.password} />
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>טלפון *</Label>
                    <Input type="tel" inputMode="tel" autoComplete="tel" value={formData.phone} onChange={(e) => updateFieldWithValidation('phone', e.target.value)} onBlur={() => handleFieldBlur('phone')} placeholder="05X-XXXXXXX" required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.phone && "border-destructive")} />
                    <FieldError message={fieldErrors.phone} />
                  </div>
                  <div className="space-y-2">
                    <Label>גיל *</Label>
                    <Input type="number" inputMode="numeric" value={formData.age} onChange={(e) => updateFieldWithValidation('age', e.target.value)} onBlur={() => handleFieldBlur('age')} required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.age && "border-destructive")} />
                    <FieldError message={fieldErrors.age} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>עיר *</Label>
                    <Input ref={cityInputRef} value={formData.city} onChange={(e) => updateFieldWithValidation('city', e.target.value)} onBlur={() => handleFieldBlur('city')} required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.city && "border-destructive")} />
                    <FieldError message={fieldErrors.city} />
                  </div>
                  <div className="space-y-2">
                    <Label>כתובת *</Label>
                    <Input ref={addressInputRef} value={formData.address} onChange={(e) => updateFieldWithValidation('address', e.target.value)} onBlur={() => handleFieldBlur('address')} required className={cn("text-slate-900 rounded-xl h-12", fieldErrors.address && "border-destructive")} />
                    <FieldError message={fieldErrors.address} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <div className="space-y-4 text-right">
                  <Label className="font-bold block mb-2">הסמכת סופר סת''ם *</Label>
                  <RadioGroup value={formData.hasScribeCertificate} onValueChange={(v) => updateField('hasScribeCertificate', v)} className="grid gap-2">
                    {[
                      { value: 'valid', id: 'v1', label: 'תעודה בתוקף' },
                      { value: 'expired', id: 'v2', label: 'הייתה תעודה בעבר' },
                      { value: 'none', id: 'v3', label: 'ללא תעודה' },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        className={cn(
                          "flex min-h-[56px] items-center space-x-reverse space-x-3 p-4 border rounded-2xl transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                          formData.hasScribeCertificate === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60'
                        )}
                        onClick={() => updateField('hasScribeCertificate', opt.value)}
                      >
                        <RadioGroupItem value={opt.value} id={opt.id} />
                        <Label htmlFor={opt.id} className="flex-1 cursor-pointer font-bold">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {(formData.hasScribeCertificate === 'valid' || formData.hasScribeCertificate === 'expired') && (
                    <div className="mt-4 p-6 bg-accent/5 rounded-2xl border-2 border-dashed border-accent/20 text-center space-y-4">
                      {uploadProgress.cert !== null ? (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden border bg-white shadow-sm">
                          <Skeleton className="absolute inset-0" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8">
                            <Loader2 className="w-6 h-6 text-accent animate-spin" />
                            <Progress value={uploadProgress.cert} className="h-1.5 w-full max-w-[180px]" />
                            <span className="text-[10px] font-black text-primary/50 uppercase tracking-widest">מעלה תעודה... {uploadProgress.cert}%</span>
                          </div>
                        </div>
                      ) : formData.certificateUrl ? (
                        <div className="relative w-full h-40 rounded-xl overflow-hidden border bg-white shadow-sm">
                          <Image src={formData.certificateUrl} alt="Cert" fill kind="certificate" sizes="(max-width: 768px) 100vw, 720px" className="object-contain" />
                          <button onClick={() => { if (formData.certificateUrl) void cleanupImages([formData.certificateUrl]); updateField('certificateUrl', ''); }} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X className="w-4 h-4" /></button>
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
                      {[
                        { value: 'fixed', id: 't1', label: 'קובע עיתים' },
                        { value: 'half-day', id: 't2', label: 'אברך חצי יום' },
                        { value: 'full-day', id: 't3', label: 'אברך יום שלם' },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          className={cn(
                            "flex min-h-[48px] items-center space-x-reverse space-x-3 rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                            formData.torahStudyFrequency === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60 bg-white'
                          )}
                          onClick={() => updateField('torahStudyFrequency', opt.value)}
                        >
                          <RadioGroupItem value={opt.value} id={opt.id} />
                          <Label htmlFor={opt.id} className="flex-1 text-xs cursor-pointer">{opt.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <Label className="font-bold">מנהג טבילה *</Label>
                    <RadioGroup value={formData.mikvehFrequency} onValueChange={(v) => updateField('mikvehFrequency', v)} className="flex flex-col gap-2">
                      {[
                        { value: 'ezra', id: 'm1', label: 'טבילת עזרא' },
                        { value: 'before', id: 'm2', label: 'לפני כתיבה' },
                        { value: 'daily', id: 'm3', label: 'כל יום' },
                        { value: 'never', id: 'm4', label: 'לא טובל בכלל' },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          className={cn(
                            "flex min-h-[48px] items-center space-x-reverse space-x-3 rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                            formData.mikvehFrequency === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60 bg-white'
                          )}
                          onClick={() => updateField('mikvehFrequency', opt.value)}
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
                      {[
                        { value: 'כשר', id: 'ls', label: 'כשר', labelClass: '' },
                        { value: 'מהודר', id: 'lm', label: 'מהודר', labelClass: 'font-black text-accent' },
                        { value: 'מהודר מאד', id: 'lx', label: 'מהודר מאד', labelClass: 'font-black text-primary' },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          className={cn(
                            "flex min-h-[48px] items-center space-x-reverse space-x-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
                            formData.scriptLevel === opt.value ? 'border-primary bg-primary/5 ring-2 ring-primary/5' : 'border-input/60 bg-white'
                          )}
                          onClick={() => updateField('scriptLevel', opt.value)}
                        >
                          <RadioGroupItem value={opt.value} id={opt.id} />
                          <Label htmlFor={opt.id} className={cn("flex-1 text-xs cursor-pointer", opt.labelClass)}>{opt.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold">סוגי כתב שהנך כותב (בחר את כולם) *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['ספרדי', 'בית יוסף', 'האר"י', 'אדמו"ר הזקן'].map(type => (
                      <div
                        key={type}
                        className={cn(
                          "flex min-h-[48px] items-center space-x-reverse space-x-2 p-3 border rounded-xl transition-all duration-200 cursor-pointer hover:border-primary/40 active:scale-[0.98]",
                          formData.scriptTypes.includes(type) ? 'bg-primary/5 border-primary ring-2 ring-primary/5' : 'bg-white border-input/60 hover:bg-primary/5'
                        )}
                        onClick={() => toggleScriptType(type)}
                      >
                        <Checkbox id={type} checked={formData.scriptTypes.includes(type)} onCheckedChange={() => toggleScriptType(type)} onClick={(e) => e.stopPropagation()} />
                        <Label htmlFor={type} className="flex-1 cursor-pointer text-xs font-bold">{type}</Label>
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
                        <Image src={img} alt="Sample" fill kind="writing_sample" sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                        <button onClick={() => removeSample(idx)} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {uploadProgress.samples !== null && (
                      <div className="relative aspect-square rounded-2xl overflow-hidden border">
                        <Skeleton className="absolute inset-0" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                          <Loader2 className="w-5 h-5 text-accent animate-spin" />
                          <Progress value={uploadProgress.samples} className="h-1 w-full" />
                          <span className="text-[9px] font-black text-primary/50">{uploadProgress.samples}%</span>
                        </div>
                      </div>
                    )}
                    {formData.writingSamples.length < 8 && uploadProgress.samples === null && (
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
