"use client";

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, UserPlus, Heart, Mail, CheckCircle2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  useAuth, 
  useUser, 
  initiateEmailSignUp, 
  initiateGoogleSignIn, 
  setDocumentNonBlocking,
  initiatePasswordReset
} from '@/lib/supabase-hooks';
import { useFirestore } from '@/lib/supabase-hooks';
import { doc, getDoc } from '@/lib/supabase-compat';
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
  
  const [resetEmail, setResetEmail] = useState('');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !isUserLoading && loading) {
      handlePostRegistration(user);
    }
  }, [user, isUserLoading, loading]);

  const handlePostRegistration = async (authUser: any) => {
    const sellerRef = doc(db, 'sellers', authUser.uid);
    const sellDoc = await getDoc(sellerRef);
    
    if (sellDoc.exists()) {
      router.push('/seller/dashboard');
      return;
    }

    const customerRef = doc(db, 'customers', authUser.uid);
    const custDoc = await getDoc(customerRef);

    if (!custDoc.exists()) {
      const names = authUser.displayName?.split(' ') || [];
      setDocumentNonBlocking(customerRef, {
        id: authUser.uid,
        firstName: firstName || names[0] || 'משתמש',
        lastName: lastName || names.slice(1).join(' ') || 'חדש',
        email: authUser.email || email,
        createdAt: new Date().toISOString(),
        favoriteProductIds: []
      }, { merge: true });
    }
    
    router.push('/customer/dashboard');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) return;
    setLoading(true);
    initiateEmailSignUp(auth, email, password).catch((error: any) => {
      setLoading(false);
      if (error.code === 'auth/email-already-in-use') {
        toast({
          variant: "destructive",
          title: "מייל כבר קיים",
          description: "נראה שיש לך כבר חשבון. נסה להתחבר או לאפס סיסמה.",
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
    });
  };

  const handleGoogleRegister = () => {
    setLoading(true);
    initiateGoogleSignIn(auth).catch((error: any) => {
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
    } catch (error: any) {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח מייל לאיפוס. וודא שהכתובת נכונה." });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 pt-32 pb-12">
        <Card className="w-full max-w-5xl shadow-premium border-none rounded-[2.5rem] overflow-hidden bg-white">
          <div className="grid md:grid-cols-5 min-h-[550px]">
            {/* Left/Info Side */}
            <div className="md:col-span-2 bg-primary text-white p-8 md:p-10 flex flex-col justify-center text-right relative overflow-hidden">
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
            <CardContent className="md:col-span-3 p-8 md:p-14 space-y-6 text-right flex flex-col justify-center">
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
                      <Label htmlFor="password" stroke="bold" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">סיסמה</Label>
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
