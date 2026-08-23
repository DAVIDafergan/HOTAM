"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShoppingBag, PenTool } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useUser } from '@/lib/supabase-hooks';

// Landing spot for a brand-new account (almost always a first Google/OAuth sign-in) that
// has no declared role yet — see the gate in app-provider.tsx. The DB trigger already
// created a `customers` row by default, so "לקוח" here is a no-op confirmation; "סופר"
// routes into the existing seller-onboarding form, which already knows how to upgrade an
// existing customer row (see `isExistingCustomer` there) — same path a customer uses if
// they decide to become a seller later from their dashboard.
export default function ChooseRolePageClient() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-start justify-center p-4 pt-[calc(7.5rem+env(safe-area-inset-top))] md:items-center md:pt-24">
        <div className="w-full max-w-2xl space-y-6 text-right" dir="rtl">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-primary">כמעט סיימנו</h1>
            <p className="text-muted-foreground font-bold text-sm">
              איך תרצה להשתמש בחותם? תוכל לשנות זאת מאוחר יותר.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/customer/dashboard')}
              className="group relative flex flex-col items-center gap-4 p-8 bg-white rounded-[2rem] shadow-premium border-2 border-transparent hover:border-primary/30 transition-all text-center cursor-pointer"
            >
              <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <ShoppingBag className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-primary">לקוח</h2>
                <p className="text-muted-foreground text-sm font-bold leading-relaxed">
                  רוצה לרכוש מזוזות, תפילין, ספרי תורה וכלי קודש מסופרים מוסמכים
                </p>
              </div>
              <div className="mt-auto w-full bg-primary/5 hover:bg-primary/10 text-primary font-black text-sm py-3 px-6 rounded-full group-hover:bg-accent group-hover:text-primary transition-all">
                המשך כלקוח
              </div>
            </button>

            <button
              onClick={() => router.push('/onboarding/seller')}
              className="group relative flex flex-col items-center gap-4 p-8 bg-white rounded-[2rem] shadow-premium border-2 border-transparent hover:border-accent/40 transition-all text-center cursor-pointer"
            >
              <div className="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                <PenTool className="w-8 h-8 text-accent" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-accent">סופר סת&quot;ם</h2>
                <p className="text-muted-foreground text-sm font-bold leading-relaxed">
                  סופר מוסמך שרוצה למכור את יצירותיו ישירות ללקוחות דרך הפלטפורמה
                </p>
              </div>
              <div className="mt-auto w-full bg-accent/5 hover:bg-accent/10 text-accent font-black text-sm py-3 px-6 rounded-full group-hover:bg-accent group-hover:text-primary transition-all">
                המשך כסופר
              </div>
            </button>
          </div>
          <p className="text-center text-sm text-muted-foreground font-bold">
            <Link href="/contact" className="text-primary font-black hover:underline">
              צריך עזרה?
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
