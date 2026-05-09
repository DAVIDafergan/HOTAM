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
    <div className="min-h-screen bg-[#F8F9FA] pb-20 text-right" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-xl">
        <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-10 text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle2 className="w-24 h-24 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-primary">התשלום עבר בהצלחה!</h1>
            <p className="text-muted-foreground font-bold text-lg">ההזמנה שלך אושרה ונרשמה במערכת.</p>
          </div>
          {orderId && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-6 py-4 text-center">
              <p className="text-sm font-bold text-emerald-700 mb-1">מספר הזמנה</p>
              <p className="text-xl font-black text-emerald-800 tracking-widest">{orderId}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground font-bold">
            תקבל/י אישור ופרטי קבלה בהמשך. תוכל/י לעקוב אחר ההזמנה באיזור האישי.
          </p>
          <Button
            onClick={() => router.push('/customer/dashboard')}
            className="w-full bg-primary text-white hover:bg-primary/90 h-14 rounded-2xl font-black text-lg"
          >
            עבור לאיזור האישי
          </Button>
        </Card>
      </main>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
