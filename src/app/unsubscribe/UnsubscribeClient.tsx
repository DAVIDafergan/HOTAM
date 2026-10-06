'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailX, CheckCircle2, AlertCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';

// The page never unsubscribes on load — only the button does — so mail scanners that open
// every link can't opt anyone out by accident.
export default function UnsubscribeClient({ email, token }: { email: string | null; token: string | null }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const unsubscribe = async () => {
    if (!email || !token) return;
    setState('sending');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e: email, t: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'ההסרה נכשלה');
      setState('done');
    } catch (err: any) {
      setError(err?.message || 'ההסרה נכשלה');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-premium border border-accent/20 p-8 sm:p-10 text-center space-y-6">
          {!email ? (
            <>
              <AlertCircle className="w-12 h-12 mx-auto text-destructive/70" />
              <h1 className="text-2xl font-headline font-black text-primary">הקישור אינו תקין</h1>
              <p className="text-muted-foreground font-medium leading-relaxed">ייתכן שהקישור נקטע בהעתקה. אפשר ללחוץ שוב על הקישור שבתחתית המייל, או לפנות אלינו בעמוד יצירת הקשר.</p>
              <Button asChild variant="outline" className="rounded-full font-black"><Link href="/contact">יצירת קשר</Link></Button>
            </>
          ) : state === 'done' ? (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
              <h1 className="text-2xl font-headline font-black text-primary">הוסרת מרשימת התפוצה</h1>
              <p className="text-muted-foreground font-medium leading-relaxed">
                לא נשלח עוד עדכונים כלליים לכתובת <span dir="ltr" className="font-bold text-primary">{email}</span>.
                הודעות על הזמנות, הודעות בצ׳אט ועדכוני חשבון ימשיכו להגיע כרגיל.
              </p>
              <Button asChild className="rounded-full font-black"><Link href="/">לדף הבית</Link></Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/15 flex items-center justify-center">
                <MailX className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-headline font-black text-primary">הסרה מרשימת התפוצה</h1>
              <p className="text-muted-foreground font-medium leading-relaxed">
                להפסיק לשלוח עדכונים ומבצעים מ-HOTAM לכתובת <span dir="ltr" className="font-bold text-primary">{email}</span>?
              </p>
              {state === 'error' && <p className="text-sm font-bold text-destructive">{error}</p>}
              <Button onClick={unsubscribe} disabled={state === 'sending'} className="w-full h-12 rounded-full font-black gap-2">
                {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                הסירו אותי מרשימת התפוצה
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
