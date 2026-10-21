"use client";

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Loader2, Heart, Mail, CheckCircle2, ShoppingBag, PenTool, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  useAuth, 
  useUser, 
  initiateEmailSignUp, 
  initiateGoogleSignIn, 
  initiatePasswordReset,
  resendEmailConfirmation,
} from '@/lib/supabase-hooks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

type RegisterField = 'firstName' | 'lastName' | 'email' | 'password';
type RegisterErrors = Partial<Record<RegisterField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegisterField(name: RegisterField, value: string): string | undefined {
  switch (name) {
    case 'firstName':
      return value.trim().length < 2 ? 'שם פרטי חייב לכלול לפחות 2 תווים' : undefined;
    case 'lastName':
      return value.trim().length < 2 ? 'שם משפחה חייב לכלול לפחות 2 תווים' : undefined;
    case 'email':
      return !EMAIL_REGEX.test(value.trim()) ? 'כתובת אימייל אינה תקינה' : undefined;
    case 'password':
      return value.length < 6 ? 'הסיסמה חייבת לכלול לפחות 6 תווים' : undefined;
    default:
      return undefined;
  }
}

export default function RegisterPageClient() {
  const [selectedRole, setSelectedRole] = useState<'customer' | 'seller' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<RegisterField, boolean>>>({});

  const values: Record<RegisterField, string> = { firstName, lastName, email, password };

  const handleFieldBlur = (name: RegisterField) => {
    setTouchedFields(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({ ...prev, [name]: validateRegisterField(name, values[name]) }));
  };

  const handleFieldChange = (name: RegisterField, value: string) => {
    if (touchedFields[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: validateRegisterField(name, value) }));
    }
  };
  const [emailSent, setEmailSent] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  // If the user is already authenticated (e.g. returning from Google OAuth),
  // route them to the correct dashboard by role.
  useEffect(() => {
    if (user && !isUserLoading) {
      const role = user.role;
      if (role === 'seller') router.push('/seller/dashboard');
      else if (role === 'admin') router.push('/admin');
      else router.push('/customer/dashboard');
    }
  }, [user, isUserLoading]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: RegisterErrors = {
      firstName: validateRegisterField('firstName', firstName),
      lastName: validateRegisterField('lastName', lastName),
      email: validateRegisterField('email', email),
      password: validateRegisterField('password', password),
    };
    setFieldErrors(nextErrors);
    setTouchedFields({ firstName: true, lastName: true, email: true, password: true });
    if (Object.values(nextErrors).some(Boolean)) return;

    if (!termsAccepted) {
      toast({
        variant: "destructive",
        title: "נדרש אישור תנאי שימוש",
        description: "עליך לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך.",
      });
      return;
    }
    setLoading(true);
    try {
      // The DB trigger creates the customers row automatically.
      // We pass firstName/lastName and role so the trigger populates the profile correctly.
      const data = await initiateEmailSignUp(auth, email, password, {
        role: 'customer',
        first_name: firstName,
        last_name: lastName,
      });

      if (!data.session) {
        // Email confirmation is required — show the confirmation screen.
        setEmailSent(true);
        setLoading(false);
      }
      // If data.session is present, onAuthStateChange fires → useEffect above handles redirect.
    } catch (error: any) {
      setLoading(false);
      if (error.code === 'auth/email-already-in-use') {
          toast({
            variant: "destructive",
            title: "מייל כבר קיים",
            description: "נראה שיש לך כבר חשבון על המייל הזה. התחבר עם אותו מייל, ואם שכחת סיסמה בצע איפוס. לקוח קיים יכול להפוך לסופר עם אותו מייל מתוך תהליך הרשמת סופר.",
            action: (
              <Button variant="outline" size="sm" onClick={() => {
                setResetEmail(email);
                setIsResetDialogOpen(true);
            }}>איפוס סיסמה</Button>
          )
        });
      } else {
        toast({
          variant: "destructive",
          title: "שגיאת הרשמה",
          description: "חלה שגיאה בתהליך ההרשמה. וודא שהסיסמה מכילה לפחות 6 תווים.",
        });
      }
    }
  };

  const handleGoogleRegister = () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    if (!trimmedFirstName || !trimmedLastName) {
      toast({
        variant: "destructive",
        title: "חסר שם מלא",
        description: "בהרשמה כלקוח חובה להזין שם פרטי ושם משפחה גם בהרשמה עם Google.",
      });
      return;
    }
    if (!termsAccepted) {
      toast({
        variant: "destructive",
        title: "נדרש אישור תנאי שימוש",
        description: "עליך לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך.",
      });
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'hotam_pending_customer_name',
        JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          role: 'customer',
        }),
      );
    }

    setLoading(true);
    initiateGoogleSignIn(auth, '/customer/dashboard').catch(() => {
      setLoading(false);
      toast({
        variant: "destructive",
        title: "שגיאת הרשמה",
        description: "לא ניתן היה להירשם באמצעות חשבון Google.",
      });
    });
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({ variant: "destructive", title: "חסר מייל", description: "אנא הזן כתובת אימייל לאיפוס." });
      return;
    }
    setIsResetting(true);
    try {
      await initiatePasswordReset(auth, resetEmail);
      toast({ variant: "success", title: "נשלח מייל לאיפוס", description: "בדוק את תיבת הדואר הנכנס שלך להמשך התהליך." });
      setIsResetDialogOpen(false);
    } catch {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח מייל לאיפוס. וודא שהכתובת נכונה." });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast({ variant: "destructive", title: "חסר מייל", description: "לא נמצאה כתובת מייל לשליחה חוזרת." });
      return;
    }

    setIsResendingVerification(true);
    try {
      await resendEmailConfirmation(auth, email);
      toast({
        variant: "success",
        title: "מייל האימות נשלח מחדש",
        description: "בדוק את תיבת הדואר הנכנס שלך (וגם ספאם) להמשך האימות.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "שגיאה בשליחת אימות",
        description: "לא ניתן היה לשלוח שוב את מייל האימות כרגע. נסה שוב בעוד כמה דקות.",
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  // ── Role selection screen ───────────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-start justify-center px-4 pt-[calc(7rem+env(safe-area-inset-top))] pb-12 md:items-center md:pt-28">
          <div className="w-full max-w-3xl space-y-8 text-right" dir="rtl">
            <div className="text-center space-y-3">
              <p className="eyebrow eyebrow-center">הצטרפות</p>
              <h1 className="text-[40px] md:text-[60px] font-headline font-medium text-primary leading-[1.06]">הצטרפות לחותם</h1>
              <p className="text-muted-foreground text-[17px] font-light">בחר את סוג החשבון שברצונך לפתוח</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
              <button
                onClick={() => setSelectedRole('customer')}
                className="group relative flex flex-col items-center gap-5 p-7 md:p-9 bg-card rounded-[2rem] shadow-premium border border-border/70 hover:border-primary/40 hover:shadow-premium-lg transition-all text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <div className="w-16 h-16 bg-secondary/70 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-7 h-7 text-primary" strokeWidth={1.6} />
                </div>
                <div className="space-y-1">
                  <h2 className="font-body text-2xl font-semibold text-primary">לקוח</h2>
                  <p className="text-primary/85 text-base leading-relaxed">
                    רוצה לרכוש מזוזות, תפילין, ספרי תורה וכלי קודש מסופרים מוסמכים
                  </p>
                </div>
                <div className="mt-auto flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90">
                  הרשמה כלקוח
                </div>
              </button>

              <button
                onClick={() => router.push('/onboarding/seller')}
                className="group relative flex flex-col items-center gap-5 p-7 md:p-9 bg-card rounded-[2rem] shadow-premium border border-accent/30 hover:border-accent/60 hover:shadow-premium-lg transition-all text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                  <PenTool className="w-7 h-7 text-accent-strong" strokeWidth={1.6} />
                </div>
                <div className="space-y-1">
                  <h2 className="font-body text-2xl font-semibold text-accent-strong">סופר סת&quot;ם</h2>
                  <p className="text-primary/85 text-base leading-relaxed">
                    סופר מוסמך שרוצה למכור את יצירותיו ישירות ללקוחות דרך הפלטפורמה
                  </p>
                </div>
                <div className="mt-auto flex h-12 w-full items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-primary transition-colors group-hover:bg-[hsl(38_62%_42%)]">
                  הרשמה כסופר
                </div>
              </button>
            </div>
            <p className="text-center text-[15px] text-primary/85">
              כבר יש לך חשבון?{' '}
              <Link href="/login" className="font-bold text-primary underline underline-offset-4">
                התחברות
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── Email-sent confirmation screen ──────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-start justify-center px-4 pt-[calc(7rem+env(safe-area-inset-top))] pb-12 md:items-center md:pt-28">
          <Card className="w-full max-w-md shadow-premium-lg border-border/70 rounded-[2.5rem] overflow-hidden bg-card">
            <CardContent className="p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-secondary/70 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-[28px] font-headline font-medium text-primary">בדוק את תיבת הדואר שלך</h2>
                <p className="text-primary/85 text-base leading-relaxed">
                  שלחנו קישור אישור לכתובת <span className="font-bold text-primary" dir="ltr">{email}</span>.<br />
                  לחץ על הקישור כדי להשלים את ההרשמה ולהיכנס לאתר.
                </p>
              </div>
              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 flex items-start gap-3 text-right">
                <CheckCircle2 className="w-5 h-5 text-accent-strong shrink-0 mt-0.5" />
                <p className="text-sm text-primary/80">לא קיבלת? בדוק את תיקיית הספאם, או חזור לדף זה ונסה שנית.</p>
              </div>
              <Button variant="outline" asChild className="w-full h-12">
                <Link href="/login">חזרה לדף הכניסה</Link>
              </Button>
              <Button
                variant="secondary"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                className="w-full h-12"
              >
                {isResendingVerification ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שליחה חוזרת של מייל אימות'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-start justify-center px-4 pt-[calc(6.5rem+env(safe-area-inset-top))] sm:items-center sm:pt-28 pb-10">
        <Card className="w-full max-w-4xl shadow-premium-lg border-border/70 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-card">
          <div className="grid md:grid-cols-5 md:min-h-[500px]">
            {/* Left/Info Side */}
            <div className="hidden md:flex md:order-1 md:col-span-2 bg-primary text-white p-10 flex-col justify-center text-right relative overflow-hidden">
              <div className="pointer-events-none absolute inset-y-10 left-0 w-px bg-gradient-to-b from-transparent via-[#E2B35B]/50 to-transparent" />
              <div className="relative z-10 space-y-6">
                <div className="space-y-4">
                  <p className="font-headline text-sm font-medium uppercase tracking-[0.28em] text-[#E2B35B]">HOTAM</p>
                  <h1 className="text-[46px] font-headline font-medium leading-[1.08] text-white">
                    מצטרפים למשפחת חותם
                  </h1>
                  <p className="text-white/85 text-base leading-relaxed">גלו את הדרך הבטוחה והמהודרת ביותר לרכישת כלי קודש ישירות מהסופר.</p>
                </div>
                <div className="flex flex-col items-start gap-3 pt-5 border-t border-white/15">
                   <div className="flex items-center gap-2.5 text-[15px] font-medium text-white/90">
                    <Heart className="w-4 h-4 shrink-0 text-[#E2B35B] fill-current" />
                    <span>קנייה ישירה ללא פערי תיווך</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[15px] font-medium text-white/90">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-[#E2B35B]" />
                    <span>אחריות כשרות ושקיפות מלאה</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right/Form Side */}
            <CardContent className="order-1 md:order-2 md:col-span-3 p-6 sm:p-8 md:p-10 space-y-6 text-right flex flex-col justify-center">
              <div className="md:hidden text-center">
                <p className="font-headline text-sm font-medium uppercase tracking-[0.28em] text-accent-strong">HOTAM</p>
                <h1 className="mt-2 text-[36px] font-headline font-medium text-primary leading-tight">הצטרפות לחותם</h1>
              </div>
              <div className="space-y-1.5 text-center md:text-right">
                <h2 className="text-[22px] md:text-[30px] font-body font-semibold md:font-semibold text-primary">הרשמה כלקוח</h2>
                <p className="text-muted-foreground text-[15px] font-light">חשבון אחד לכל ההזמנות, ההודעות והמועדפים שלכם.</p>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={handleGoogleRegister}
                  disabled={loading}
                  className="w-full h-12 gap-3"
                >
                  <GoogleIcon /> הרשמה עם Google
                </Button>

                <div className="relative flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[13px] font-medium text-muted-foreground">או הרשמה ידנית</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName">שם פרטי</Label>
                      <Input
                        id="firstName"
                        placeholder="ישראל"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => { setFirstName(e.target.value); handleFieldChange('firstName', e.target.value); }}
                        onBlur={() => handleFieldBlur('firstName')}
                        aria-invalid={!!fieldErrors.firstName}
                        className={cn("text-right", fieldErrors.firstName && "border-destructive focus-visible:ring-destructive/30")}
                        required
                      />
                      {fieldErrors.firstName && (
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{fieldErrors.firstName}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName">שם משפחה</Label>
                      <Input
                        id="lastName"
                        placeholder="ישראלי"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => { setLastName(e.target.value); handleFieldChange('lastName', e.target.value); }}
                        onBlur={() => handleFieldBlur('lastName')}
                        aria-invalid={!!fieldErrors.lastName}
                        className={cn("text-right", fieldErrors.lastName && "border-destructive focus-visible:ring-destructive/30")}
                        required
                      />
                      {fieldErrors.lastName && (
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{fieldErrors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">דואר אלקטרוני</Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); handleFieldChange('email', e.target.value); }}
                      onBlur={() => handleFieldBlur('email')}
                      aria-invalid={!!fieldErrors.email}
                      className={cn("text-right", fieldErrors.email && "border-destructive focus-visible:ring-destructive/30")}
                      required
                    />
                    {fieldErrors.email && (
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{fieldErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password">סיסמה</Label>
                      <button 
                        type="button" 
                        onClick={() => {
                          setResetEmail(email);
                          setIsResetDialogOpen(true);
                        }}
                        className="min-h-[36px] text-[13px] font-medium text-primary/70 underline underline-offset-4 hover:text-primary"
                      >
                        שכחת סיסמה?
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="לפחות 6 תווים"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); handleFieldChange('password', e.target.value); }}
                      onBlur={() => handleFieldBlur('password')}
                      aria-invalid={!!fieldErrors.password}
                      className={cn("text-right", fieldErrors.password && "border-destructive focus-visible:ring-destructive/30")}
                      required
                    />
                    {fieldErrors.password && (
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{fieldErrors.password}</p>
                    )}
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-secondary/40 rounded-2xl border border-border">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted}
                      onCheckedChange={(v) => setTermsAccepted(!!v)}
                      className="mt-0.5 shrink-0"
                    />
                    <Label htmlFor="terms" className="text-sm font-medium leading-relaxed cursor-pointer">
                      קראתי ואני מאשר את{' '}
                      <Link href="/terms" target="_blank" className="underline underline-offset-4 font-bold text-primary hover:text-primary/80">
                        תנאי השימוש ומדיניות הפרטיות
                      </Link>{' '}
                      של האתר
                    </Label>
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      disabled={loading || isUserLoading}
                      size="lg" className="w-full gap-2.5"
                    >
                      {loading || isUserLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>צרו חשבון עכשיו <Heart size={18} fill="currentColor" /></>}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="pt-5 border-t border-border space-y-3 text-center md:text-right">
                <p className="text-[15px] text-primary/85">
                  כבר יש לכם חשבון?{' '}
                  <Link href="/login" className="font-bold text-primary underline underline-offset-4">
                    התחברות
                  </Link>
                </p>
                <Button variant="ghost" onClick={() => setSelectedRole(null)} className="w-full h-11 font-semibold text-primary/70 hover:text-primary gap-2">
                  <ArrowRight className="w-4 h-4" /> חזרה לבחירת סוג חשבון
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </main>

      {/* Password Reset Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-card" dir="rtl">
          <div className="bg-primary p-8 pl-16 text-white text-right">
            <DialogHeader>
              <DialogTitle className="text-2xl font-body font-semibold flex items-center gap-3">
                <Mail className="w-6 h-6 text-accent" /> איפוס סיסמה
              </DialogTitle>
              <DialogDescription className="text-white/75 text-[15px] mt-1">
                נשלח אליך קישור לאימייל שיאפשר לך לבחור סיסמה חדשה.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 sm:p-8 space-y-6 text-right">
            <p className="text-[15px] text-muted-foreground">
              הזן את כתובת האימייל של החשבון שלך ונשלח אליך קישור מאובטח לאיפוס סיסמה.
            </p>
            <div className="space-y-2">
              <Label>כתובת אימייל</Label>
              <Input 
                type="email"
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)} 
                placeholder="your@email.com" 
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>
          <DialogFooter className="p-5 sm:p-6 bg-secondary/40 border-t border-border flex flex-col-reverse sm:flex-row gap-3">
            <Button onClick={handlePasswordReset} disabled={isResetting} className="flex-1 h-12">
              {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח קישור לאיפוס'}
            </Button>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)} className="h-12">ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.25h2.91c1.7-1.56 2.68-3.86 2.68-6.6z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.25c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.95v2.33C2.43 16.07 5.48 18 9 18z"/>
      <path fill="#FBBC05" d="M3.96 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.96H.95C.35 6.17 0 7.55 0 9s.35 2.83.95 4.04l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.42 0 9 0 5.48 0 2.43 1.93.95 4.96L3.96 7.29c.71-2.13 2.7-3.71 5.04-3.71z"/>
    </svg>
  );
}
