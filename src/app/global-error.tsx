'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] font-sans p-8 text-right">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 space-y-6 text-right">
          <h2 className="text-2xl font-black text-primary">אירעה שגיאה</h2>
          <p className="text-muted-foreground text-sm">
            משהו השתבש. אנא נסה שנית.
          </p>
          <button
            onClick={reset}
            className="w-full bg-primary text-white rounded-full h-12 font-black text-sm uppercase tracking-widest"
          >
            נסה שנית
          </button>
        </div>
      </body>
    </html>
  );
}
