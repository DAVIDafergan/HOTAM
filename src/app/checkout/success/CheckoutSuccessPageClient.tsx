"use client";

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

import { Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen bg-background pb-20 text-right" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-16 md:pt-36 max-w-xl">
        <Card className="border-border/70 shadow-premium-lg rounded-[2.5rem] bg-card p-8 md:p-12 text-center space-y-6">
          <div className="flex justify-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200"><CheckCircle2 className="w-12 h-12 text-emerald-700" strokeWidth={1.6} /></span>
          </div>
          <div className="space-y-2">
            <h1 className="text-[32px] md:text-[40px] font-headline font-light text-primary leading-tight">התשלום עבר בהצלחה!</h1>
            <p className="lead mx-auto">ההזמנה שלך אושרה ונרשמה במערכת.</p>
          </div>
          {orderId && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-4 text-center">
              <p className="text-sm font-semibold text-emerald-800 mb-1">מספר הזמנה</p>
              <p className="text-xl font-bold text-emerald-900 tracking-wider num break-all" dir="ltr">{orderId}</p>
            </div>
          )}
          <p className="text-[15px] text-muted-foreground mx-auto">
            תקבל/י אישור ופרטי קבלה בהמשך. תוכל/י לעקוב אחר ההזמנה באיזור האישי.
          </p>
          <Button
            onClick={() => router.push('/customer/dashboard')}
            size="lg" className="w-full"
          >
            עבור לאיזור האישי
          </Button>
        </Card>
      </main>
    </div>
  );
}

export default function CheckoutSuccessPageClient() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
