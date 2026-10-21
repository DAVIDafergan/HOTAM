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

export default function ResetPasswordPageClient() {
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
      <main className="flex-1 flex items-start justify-center px-4 pt-[calc(6.5rem+env(safe-area-inset-top))] sm:items-center sm:pt-28 pb-10">
        <Card className="w-full max-w-4xl shadow-premium-lg border-border/70 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-card">
          <div className="grid md:grid-cols-5 md:min-h-[460px]">
            {/* Left/Info Side */}
            <div className="order-1 md:col-span-2 bg-primary text-white px-6 py-7 md:p-10 flex flex-col justify-center text-right relative overflow-hidden">
              <div className="pointer-events-none absolute inset-y-10 left-0 hidden w-px bg-gradient-to-b from-transparent via-[#E2B35B]/50 to-transparent md:block" />
              <div className="relative z-10 space-y-4 md:space-y-6">
                <div className="space-y-2 md:space-y-3">
                  <h1 className="text-[30px] md:text-[38px] font-headline font-semibold leading-tight text-white">
                    חותם
                  </h1>
                  <p className="text-white/85 text-base md:text-base leading-relaxed">בחר סיסמה חדשה וחזק את אבטחת חשבונך.</p>
                </div>
                <div className="flex flex-col items-start gap-2.5 pt-4 border-t border-white/15 md:pt-5">
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
            <CardContent className="order-2 md:col-span-3 p-6 sm:p-8 md:p-12 space-y-7 text-right flex flex-col justify-center">

              {pageState === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-muted-foreground text-[15px]">מאמת את הקישור…</p>
                </div>
              )}

              {pageState === 'invalid' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-destructive" />
                  <div className="space-y-2">
                    <h2 className="font-body text-2xl font-semibold text-primary">קישור לא תקף</h2>
                    <p className="text-primary/85 text-base leading-relaxed">הקישור לאיפוס הסיסמה פג תוקפו או שאינו תקין.<br />אנא בקש קישור חדש דרך דף ההתחברות.</p>
                  </div>
                  <Button onClick={() => router.push('/login')} className="mt-4 h-12 px-8">
                    חזרה להתחברות
                  </Button>
                </div>
              )}

              {pageState === 'ready' && (
                <>
                  <div className="space-y-2">
                    <h2 className="text-[26px] md:text-[32px] font-body font-semibold text-primary">הגדרת סיסמה חדשה</h2>
                    <p className="text-muted-foreground text-[15px]">הזן את הסיסמה החדשה שתרצה להשתמש בה</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="password">סיסמה חדשה</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="לפחות 6 תווים"
                          className="text-right"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">אימות סיסמה</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="הזן שוב את הסיסמה"
                          className="text-right"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      size="lg" className="w-full gap-2.5"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><KeyRound size={18} /> עדכון סיסמה</>}
                    </Button>
                  </form>
                </>
              )}

              {pageState === 'success' && (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-700" strokeWidth={1.6} />
                  <div className="space-y-2">
                    <h2 className="font-body text-2xl font-semibold text-primary">הסיסמה עודכנה בהצלחה!</h2>
                    <p className="text-primary/85 text-[15px]">כעת תוכל להתחבר עם הסיסמה החדשה.</p>
                  </div>
                  <Button onClick={() => router.push('/login')} className="mt-4 h-12 px-8">
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
