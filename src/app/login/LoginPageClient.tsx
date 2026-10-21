"use client";

import { Suspense, useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, LogIn as LogInIcon, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  useAuth, 
  useUser, 
  initiateEmailSignIn, 
  initiateGoogleSignIn, 
  initiatePasswordReset,
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

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  // Route by role stored in user_metadata — no DB lookups needed.
  useEffect(() => {
    if (user && !isUserLoading) {
      if (!user.emailVerified && user.role !== 'seller') {
        return;
      }
      // Validate redirect to prevent open redirect vulnerability (only allow relative paths)
      const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null;
      if (safeRedirect) {
        router.push(safeRedirect);
        return;
      }
      const isSuperAdmin = false;

      if (isSuperAdmin || user.role === 'admin') {
        router.push('/admin');
      } else if (user.role === 'seller') {
        router.push('/seller/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
    }
  }, [user, isUserLoading, redirectTo, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await initiateEmailSignIn(auth, email, password);
      // Sellers bypass email confirmation (admin verifies their profile manually).
      // Only enforce email confirmation for customers.
      const userRole = data.user?.user_metadata?.role;
      if (data.user?.email_confirmed_at == null && userRole !== 'seller') {
        await auth._client.auth.signOut();
        setLoading(false);
        toast({
          variant: "destructive",
          title: "האימייל לא אומת",
          description: "עליך לאמת את כתובת האימייל לפני הכניסה. בדוק את תיבת הדואר הנכנס שלך.",
        });
        return;
      }
    } catch (error: any) {
      setLoading(false);
      toast({
        variant: "destructive",
        title: "שגיאת התחברות",
        description: error.code === 'auth/invalid-credential' 
          ? "פרטי התחברות שגויים. בדוק את האימייל והסיסמה." 
          : "חלה שגיאה בהתחברות. נסה שוב מאוחר יותר.",
      });
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await initiateGoogleSignIn(auth);
    } catch (error: any) {
      setLoading(false);
      toast({
        variant: "destructive",
        title: "שגיאת התחברות",
        description: "לא ניתן היה להתחבר באמצעות חשבון Google.",
      });
    }
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
    } catch (error: any) {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח מייל לאיפוס. וודא שהכתובת נכונה." });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-start justify-center px-4 pt-[calc(6.5rem+env(safe-area-inset-top))] sm:items-center sm:pt-28 pb-10">
        <Card className="w-full max-w-4xl shadow-premium-lg border-border/70 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-card">
          <div className="grid md:grid-cols-5 md:min-h-[460px]">
            {/* Left/Info Side — top on mobile, left panel on desktop */}
            <div className="hidden md:flex md:col-span-2 bg-primary text-white p-10 flex-col justify-center text-right relative overflow-hidden">
              <div className="pointer-events-none absolute inset-y-10 left-0 w-px bg-gradient-to-b from-transparent via-[#E2B35B]/50 to-transparent" />
              <div className="relative z-10 space-y-6 text-right">
                <div className="space-y-2 md:space-y-3">
                  <p className="font-numbers text-[15px] font-normal uppercase tracking-[0.28em] text-[#E2B35B]">HOTAM</p>
                  <h1 className="text-[46px] font-headline font-semibold leading-[1.08] text-white">
                    ברוכים השבים לחותם
                  </h1>
                  <p className="text-white/85 text-base leading-relaxed">זירת מסחר מאובטחת ונוחה לכלי קודש וסת"ם מהודרים.</p>
                </div>
                <div className="flex flex-col items-start gap-3 pt-5 border-t border-white/15">
                  <div className="flex items-center gap-2.5 text-[15px] font-medium text-white/90">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#E2B35B]" />
                    <span>פיקוח הלכתי קפדני</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[15px] font-medium text-white/90">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#E2B35B]" />
                    <span>סופרים מאומתים בלבד</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[15px] font-medium text-white/90">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#E2B35B]" />
                    <span>תשלום מאובטח בנאמנות</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right/Form Side */}
            <CardContent className="order-2 md:col-span-3 p-6 sm:p-8 md:p-10 space-y-6 text-right flex flex-col justify-center">
              <div className="md:hidden text-center">
                <p className="font-numbers text-[15px] font-normal uppercase tracking-[0.28em] text-accent-strong">HOTAM</p>
                <h1 className="mt-2 text-[36px] font-headline font-semibold text-primary leading-tight">ברוכים השבים</h1>
              </div>
              <div className="space-y-1.5 text-center md:text-right">
                <h2 className="text-[22px] md:text-[30px] font-body font-semibold md:font-semibold text-primary">כניסה לחשבון</h2>
                <p className="text-muted-foreground text-[15px] font-light">הזינו אימייל וסיסמה, או המשיכו עם Google.</p>
              </div>

              <div className="space-y-3.5">
                <Button 
                  variant="outline" 
                  onClick={handleGoogleLogin}
                  disabled={loading || isUserLoading}
                  className="w-full h-12 gap-3"
                >
                  <GoogleIcon /> המשך עם חשבון Google
                </Button>
                
                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[13px] font-medium text-muted-foreground">או באמצעות אימייל</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">דואר אלקטרוני</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="your@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        dir="ltr"
                        className="text-left"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
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
                      <div className="relative">
                        <Input 
                          id="password" 
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="text-right pl-12" 
                          required 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute left-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors"
                          aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loading || isUserLoading}
                    size="lg" className="w-full gap-2.5"
                  >
                    {loading || isUserLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>התחברות <LogInIcon size={18} /></>}
                  </Button>
                </form>
              </div>

              <div className="pt-5 border-t border-border space-y-3 text-center md:text-right">
                <p className="text-[15px] text-primary/80">
                  אין לך חשבון עדיין?{' '}
                  <Link href="/register" className="font-bold text-accent-strong underline underline-offset-4 hover:text-primary">הירשם</Link>
                </p>
                <Button asChild variant="outline" className="w-full h-12">
                  <Link href="/onboarding/seller">הרשמה כמוכר</Link>
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </main>

      {/* Password Reset Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-card max-h-[90vh] flex flex-col" dir="rtl">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="bg-primary p-6 pl-16 sm:p-8 sm:pl-16 text-white text-right">
              <DialogHeader>
                <DialogTitle className="text-2xl font-body font-semibold flex items-center gap-3">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-accent" /> איפוס סיסמה
                </DialogTitle>
                <DialogDescription className="text-white/75 text-[15px] mt-1">
                  נשלח אליך קישור לאימייל שיאפשר לך לבחור סיסמה חדשה.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-5 sm:p-8 space-y-5 text-right">
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
          </div>
          <DialogFooter className="p-5 sm:p-6 bg-secondary/40 border-t border-border flex flex-col-reverse sm:flex-row gap-3 shrink-0">
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

export default function LoginPageClient() {
  return (
    <Suspense fallback={
      <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center gap-2 text-primary font-bold">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>טוען...</span>
      </div>
    }>
      <LoginContent />
    </Suspense>
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
