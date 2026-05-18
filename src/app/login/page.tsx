"use client";

import { Suspense, useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, LogIn as LogInIcon, Mail, CheckCircle2 } from 'lucide-react';
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
      if (!user.emailVerified) {
        return;
      }
      // Validate redirect to prevent open redirect vulnerability (only allow relative paths)
      const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null;
      if (safeRedirect) {
        router.push(safeRedirect);
        return;
      }
      const adminEmails = ["admin@hotam.co.il", "davidafergan999@gmail.com", "davidafergan@gmail.com", "da@101.org.il"];
      const adminUids  = ["f9hcxiHpzKYMzw7UNpi5II2F13l1", "aMqKTe1Y4NSQdupLPupviiyrdyj2"];

      const isSuperAdmin =
        adminUids.includes(user.uid) ||
        (user.email != null && adminEmails.includes(user.email.toLowerCase()));

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
      if (data.user?.email_confirmed_at == null) {
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
      toast({ title: "נשלח מייל לאיפוס", description: "בדוק את תיבת הדואר הנכנס שלך להמשך התהליך." });
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
      <main className="flex-1 flex items-center justify-center p-4 pt-20 sm:pt-28 pb-8 sm:pb-12">
        <Card className="w-full max-w-5xl shadow-premium border-none rounded-[2.5rem] overflow-hidden bg-white">
          <div className="grid md:grid-cols-5 min-h-[500px]">
            {/* Left/Info Side — top on mobile, left panel on desktop */}
            <div className="order-1 md:col-span-2 bg-primary text-white px-5 py-5 sm:p-8 md:p-10 flex flex-col justify-center text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl hidden md:block" />
              <div className="relative z-10 space-y-3 md:space-y-6">
                <div className="space-y-2 md:space-y-4">
                  <h1 className="text-2xl md:text-5xl font-headline font-black tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-accent via-white to-accent/80">
                    ברוכים השבים לחותם
                  </h1>
                  <p className="text-white/70 font-black text-xs md:text-lg leading-relaxed">זירת המסחר המאובטחת והאיכותית ביותר לכלי קודש וסת"ם מהודרים.</p>
                </div>
                <div className="flex flex-wrap justify-end gap-x-3 gap-y-1.5 pt-2 border-t border-white/10 md:gap-x-6 md:gap-y-3 md:pt-4">
                  <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-black">
                    <span>פיקוח הלכתי קפדני</span>
                    <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" />
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-black">
                    <span>סופרים מאומתים בלבד</span>
                    <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" />
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-black">
                    <span>תשלום מאובטח בנאמנות</span>
                    <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right/Form Side */}
            <CardContent className="order-2 md:col-span-3 p-6 sm:p-8 md:p-14 space-y-8 text-right flex flex-col justify-center">
              <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-black text-primary">כניסה למערכת</h2>
                <p className="text-muted-foreground text-sm font-black">הזינו את הפרטים כדי להמשיך למלאכת הקודש</p>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={handleGoogleLogin}
                  disabled={loading || isUserLoading}
                  className="w-full rounded-xl h-14 border-muted-foreground/20 font-black gap-3 text-sm uppercase tracking-tight hover:bg-muted/50 transition-all shadow-sm"
                >
                  <GoogleIcon /> המשך עם חשבון Google
                </Button>
                
                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-muted" />
                  <span className="text-[10px] font-black text-primary/30 uppercase tracking-widest">או באמצעות אימייל</span>
                  <div className="flex-1 h-px bg-muted" />
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">דואר אלקטרוני</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="your@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="rounded-xl h-12 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold"
                        required 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <button 
                          type="button" 
                          onClick={() => setIsResetDialogOpen(true)}
                          className="text-[10px] text-muted-foreground hover:text-primary underline font-black"
                        >
                          שכחת סיסמה?
                        </button>
                        <Label htmlFor="password" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">סיסמה</Label>
                      </div>
                      <Input 
                        id="password" 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rounded-xl h-12 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold" 
                        required 
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={loading || isUserLoading}
                    className="w-full bg-primary hover:bg-primary/90 h-16 text-base font-black uppercase tracking-widest rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {loading || isUserLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>התחברות <LogInIcon size={18} /></>}
                  </Button>
                </form>
              </div>

              <div className="text-center text-[11px] text-muted-foreground pt-4 space-y-4 border-t border-muted">
                <p className="font-bold">עדיין לא חברים בקהילה? <Link href="/register" className="text-primary font-black hover:underline uppercase tracking-tight">הצטרפו עכשיו כקונים</Link></p>
                <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 flex items-center justify-between">
                  <Link href="/onboarding/seller" className="text-accent font-black hover:underline uppercase tracking-tight text-[10px]">הגש מועמדות למכירה באתר ←</Link>
                  <p className="font-black text-primary">הנך סופר סת"ם מוסמך?</p>
                </div>
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

export default function LoginPage() {
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
