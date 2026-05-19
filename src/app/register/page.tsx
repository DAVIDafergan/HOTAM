"use client";

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Loader2, Heart, Mail, CheckCircle2 } from 'lucide-react';
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [registerAsSeller, setRegisterAsSeller] = useState(false);
  
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
    if (!firstName || !lastName || !email || !password) return;
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
        role: registerAsSeller ? 'seller' : 'customer',
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
          role: registerAsSeller ? 'seller' : 'customer',
        }),
      );
    }

    setLoading(true);
    initiateGoogleSignIn(auth).catch(() => {
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
      toast({ title: "נשלח מייל לאיפוס", description: "בדוק את תיבת הדואר הנכנס שלך להמשך התהליך." });
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

  // ── Email-sent confirmation screen ──────────────────────────────────────────
  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-premium border-none rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-primary">בדוק את תיבת הדואר שלך</h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                  שלחנו קישור אישור לכתובת <span className="font-black text-primary">{email}</span>.<br />
                  לחץ על הקישור כדי להשלים את ההרשמה ולהיכנס לאתר.
                </p>
              </div>
              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 flex items-start gap-3 text-right">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-primary/70">לא קיבלת? בדוק את תיקיית הספאם, או חזור לדף זה ונסה שנית.</p>
              </div>
              <Button variant="outline" asChild className="w-full h-12 rounded-full font-black border-primary/10">
                <Link href="/login">חזרה לדף הכניסה</Link>
              </Button>
              <Button
                variant="secondary"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                className="w-full h-12 rounded-full font-black"
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
      <main className="flex-1 flex items-center justify-center p-4 pt-20 sm:pt-28 pb-8 sm:pb-12">
        <Card className="w-full max-w-5xl shadow-premium border-none rounded-[2.5rem] overflow-hidden bg-white">
          <div className="grid md:grid-cols-5 min-h-[550px]">
            {/* Left/Info Side */}
            <div className="order-2 md:order-1 md:col-span-2 bg-primary text-white p-5 sm:p-8 md:p-10 flex flex-col justify-center text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="relative z-10 space-y-6">
                <div className="space-y-4">
                  <h1 className="text-3xl md:text-5xl font-headline font-black tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-accent via-white to-accent/80">
                    מצטרפים למשפחת חותם
                  </h1>
                  <p className="text-white/70 font-black text-base md:text-lg leading-relaxed">גלו את הדרך הבטוחה והמהודרת ביותר לרכישת כלי קודש ישירות מהסופר.</p>
                </div>
                <div className="flex flex-wrap justify-end gap-x-6 gap-y-3 pt-4 border-t border-white/10">
                   <div className="flex items-center gap-2 text-[10px] md:text-xs font-black">
                    <span>קנייה ישירה ללא פערי תיווך</span>
                    <Heart className="w-4 h-4 text-accent fill-current" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-black">
                    <span>אחריות כשרות ושקיפות מלאה</span>
                    <ShieldCheck className="w-4 h-4 text-accent" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right/Form Side */}
            <CardContent className="order-1 md:order-2 md:col-span-3 p-6 sm:p-8 md:p-14 space-y-6 text-right flex flex-col justify-center">
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-black text-primary">יצירת חשבון חדש</h2>
                <p className="text-muted-foreground text-sm font-black">הצטרפו לקהילת חותם עוד היום</p>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={handleGoogleRegister}
                  disabled={loading}
                  className="w-full rounded-xl h-12 border-muted-foreground/20 font-black gap-3 text-sm uppercase tracking-tight hover:bg-muted/50 transition-all shadow-sm"
                >
                  <GoogleIcon /> הרשמה עם Google
                </Button>

                <div className="relative flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-muted" />
                  <span className="text-[10px] font-black text-primary/30 uppercase tracking-widest">או הרשמה ידנית</span>
                  <div className="flex-1 h-px bg-muted" />
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">שם פרטי</Label>
                      <Input 
                        id="firstName" 
                        placeholder="ישראל" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="rounded-xl h-11 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">שם משפחה</Label>
                      <Input 
                        id="lastName" 
                        placeholder="ישראלי" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="rounded-xl h-11 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold"
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">דואר אלקטרוני</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="name@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl h-11 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <button 
                        type="button" 
                        onClick={() => {
                          setResetEmail(email);
                          setIsResetDialogOpen(true);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-primary underline font-black"
                      >
                        שכחת סיסמה?
                      </button>
                      <Label htmlFor="password" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">סיסמה</Label>
                    </div>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="לפחות 6 תווים"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl h-11 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold" 
                      required 
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Label htmlFor="registerAsSeller" className="text-sm font-bold cursor-pointer">
                      הרשמה כמוכר / סופר סת"ם
                    </Label>
                    <Checkbox
                      id="registerAsSeller"
                      checked={registerAsSeller}
                      onCheckedChange={(v) => setRegisterAsSeller(!!v)}
                    />
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted}
                      onCheckedChange={(v) => setTermsAccepted(!!v)}
                      className="mt-0.5 shrink-0"
                    />
                    <Label htmlFor="terms" className="text-[11px] font-bold leading-relaxed cursor-pointer">
                      קראתי ואני מאשר את{' '}
                      <Link href="/terms" target="_blank" className="underline font-black text-primary hover:text-primary/70">
                        תנאי השימוש ומדיניות הפרטיות
                      </Link>{' '}
                      של האתר
                    </Label>
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      disabled={loading || isUserLoading}
                      className="w-full bg-primary hover:bg-primary/90 h-16 text-base font-black uppercase tracking-widest rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      {loading || isUserLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>צרו חשבון עכשיו <Heart size={18} fill="currentColor" /></>}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="text-center text-[11px] text-muted-foreground pt-4 border-t border-muted">
                <p className="font-bold">כבר יש לכם חשבון? <Link href="/login" className="text-primary font-black hover:underline uppercase tracking-tight">התחברו כאן</Link></p>
              </div>
            </CardContent>
          </div>
        </Card>
      </main>

      {/* Password Reset Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white" dir="rtl">
          <div className="bg-primary p-8 text-white text-right">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-black flex items-center gap-3">
                <Mail className="w-6 h-6 text-accent" /> איפוס סיסמה
              </DialogTitle>
              <DialogDescription className="text-white/60 text-sm mt-1 font-bold">
                נשלח אליך קישור לאימייל שיאפשר לך לבחור סיסמה חדשה.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6 text-right">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">כתובת אימייל</Label>
              <Input 
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)} 
                placeholder="your@email.com" 
                className="h-12 rounded-xl text-right font-bold"
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-muted/30 border-t flex gap-3">
            <Button onClick={handlePasswordReset} disabled={isResetting} className="flex-1 bg-primary text-white h-12 rounded-xl font-black uppercase shadow-lg">
              {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח קישור לאיפוס'}
            </Button>
            <Button variant="ghost" onClick={() => setIsResetDialogOpen(false)} className="h-12 rounded-xl font-black">ביטול</Button>
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
