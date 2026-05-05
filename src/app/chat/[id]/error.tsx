'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[ChatError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-8" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 space-y-6 text-right">
        <h2 className="text-2xl font-black text-primary">לא ניתן לפתוח את הצ'אט</h2>
        <p className="text-muted-foreground text-sm">
          אירעה שגיאה בטעינת השיחה. ייתכן שמשתמש זה אינו קיים במערכת.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full bg-primary text-white rounded-full h-12 font-black text-sm uppercase tracking-widest"
          >
            נסה שנית
          </button>
          <button
            onClick={() => router.back()}
            className="w-full border border-primary/20 text-primary rounded-full h-12 font-bold text-sm"
          >
            חזרה
          </button>
        </div>
      </div>
    </div>
  );
}
