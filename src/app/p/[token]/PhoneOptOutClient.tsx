'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, PhoneOff, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';

// Nothing happens on load (link scanners open every URL); only the button opts out.
export default function PhoneOptOutClient({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const optOut = async () => {
    setState('sending');
    try {
      const res = await fetch('/api/notifications/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
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
          {state === 'done' ? (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" />
              <h1 className="text-2xl font-headline font-normal text-primary">ההודעות לטלפון הופסקו</h1>
              <p className="text-muted-foreground font-medium leading-relaxed">
                לא נשלח עוד SMS ולא נתקשר אלייך. עדכונים חשובים על הזמנות והודעות ימשיכו להגיע במייל.
                אפשר להפעיל מחדש בכל רגע בהגדרות באזור האישי.
              </p>
              <Button asChild className="rounded-full font-black"><Link href="/">לדף הבית</Link></Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/15 flex items-center justify-center">
                <PhoneOff className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-headline font-normal text-primary">הפסקת הודעות SMS ושיחות</h1>
              <p className="text-muted-foreground font-medium leading-relaxed">
                להפסיק לשלוח לך הודעות SMS ושיחות קוליות מחותם? המיילים ימשיכו להגיע כרגיל.
              </p>
              {state === 'error' && <p className="text-sm font-bold text-destructive">{error}</p>}
              <Button onClick={optOut} disabled={state === 'sending'} className="w-full h-12 rounded-full font-black gap-2">
                {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
                הפסיקו את ההודעות לטלפון
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
