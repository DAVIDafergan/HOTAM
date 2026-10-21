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
      <main className="flex-1 flex items-start justify-center px-4 pt-[calc(7rem+env(safe-area-inset-top))] pb-12 md:items-center md:pt-28">
        <div className="w-full max-w-3xl space-y-8 text-right" dir="rtl">
          <div className="text-center space-y-3">
            <h1 className="text-[36px] md:text-[48px] font-headline font-medium text-primary leading-tight">כמעט סיימנו</h1>
            <p className="text-muted-foreground text-base">
              איך תרצה להשתמש בחותם? תוכל לשנות זאת מאוחר יותר.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
            <button
              onClick={() => router.push('/customer/dashboard')}
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
                המשך כלקוח
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
                המשך כסופר
              </div>
            </button>
          </div>
          <p className="text-center text-[15px] text-primary/85">
            <Link href="/contact" className="font-bold text-primary underline underline-offset-4">
              צריך עזרה?
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
