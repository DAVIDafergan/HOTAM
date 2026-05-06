"use client";

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

type PageState = 'loading' | 'ready' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageState, setPageState] = useState<PageState>('loading');

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Supabase sets the session from the URL hash automatically (detectSessionInUrl: true).
    // PASSWORD_RECOVERY fires when the user arrives via a valid reset link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (timer) clearTimeout(timer);
        setPageState('ready');
      } else if (event === 'SIGNED_IN') {
        if (timer) clearTimeout(timer);
        // Only transition to ready from loading; don't overwrite success state.
        setPageState((prev) => (prev === 'loading' ? 'ready' : prev));
      }
    });

    // Also check if a recovery session is already present on mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (timer) clearTimeout(timer);
        setPageState((prev) => (prev === 'loading' ? 'ready' : prev));
      } else {
        // No session yet — wait briefly for the PASSWORD_RECOVERY event before showing error.
        timer = setTimeout(() => {
          setPageState((prev) => (prev === 'loading' ? 'invalid' : prev));
        }, 3000);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'הסיסמאות אינן תואמות', description: 'וודא שהזנת את אותה סיסמה בשני השדות.' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'סיסמה קצרה מדי', description: 'הסיסמה חייבת להכיל לפחות 6 תווים.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPageState('success');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'שגיאה', description: error.message ?? 'לא ניתן היה לעדכן את הסיסמה. נסה שוב.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-4 pt-20 sm:pt-28 pb-8 sm:pb-12">
        <Card className="w-full max-w-5xl shadow-premium border-none rounded-[2.5rem] overflow-hidden bg-white">
          <div className="grid md:grid-cols-5 min-h-[500px]">
            {/* Left/Info Side */}
            <div className="order-1 md:col-span-2 bg-primary text-white px-5 py-5 sm:p-8 md:p-10 flex flex-col justify-center text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl hidden md:block" />
              <div className="relative z-10 space-y-3 md:space-y-6">
                <div className="space-y-2 md:space-y-4">
                  <h1 className="text-2xl md:text-5xl font-headline font-black tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-r from-accent via-white to-accent/80">
                    חותם
                  </h1>
                  <p className="text-white/70 font-black text-xs md:text-lg leading-relaxed">בחר סיסמה חדשה וחזק את אבטחת חשבונך.</p>
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

              {pageState === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-muted-foreground font-bold text-sm">מאמת את הקישור…</p>
                </div>
              )}

              {pageState === 'invalid' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-destructive" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-primary">קישור לא תקף</h2>
                    <p className="text-muted-foreground text-sm font-bold">הקישור לאיפוס הסיסמה פג תוקפו או שאינו תקין.<br />אנא בקש קישור חדש דרך דף ההתחברות.</p>
                  </div>
                  <Button onClick={() => router.push('/login')} className="mt-4 bg-primary text-white h-12 px-8 rounded-xl font-black">
                    חזרה להתחברות
                  </Button>
                </div>
              )}

              {pageState === 'ready' && (
                <>
                  <div className="space-y-2">
                    <h2 className="text-2xl md:text-3xl font-black text-primary">הגדרת סיסמה חדשה</h2>
                    <p className="text-muted-foreground text-sm font-black">הזן את הסיסמה החדשה שתרצה להשתמש בה</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">סיסמה חדשה</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="לפחות 6 תווים"
                          className="rounded-xl h-12 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="font-black text-[10px] uppercase text-primary/60 tracking-wider">אימות סיסמה</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="הזן שוב את הסיסמה"
                          className="rounded-xl h-12 text-right border-muted-foreground/20 focus:ring-primary/10 font-bold"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 h-16 text-base font-black uppercase tracking-widest rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeyRound size={18} /> עדכון סיסמה</>}
                    </Button>
                  </form>
                </>
              )}

              {pageState === 'success' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-primary">הסיסמה עודכנה בהצלחה!</h2>
                    <p className="text-muted-foreground text-sm font-bold">כעת תוכל להתחבר עם הסיסמה החדשה.</p>
                  </div>
                  <Button onClick={() => router.push('/login')} className="mt-4 bg-primary text-white h-12 px-8 rounded-xl font-black">
                    מעבר להתחברות
                  </Button>
                </div>
              )}

            </CardContent>
          </div>
        </Card>
      </main>
    </div>
  );
}
