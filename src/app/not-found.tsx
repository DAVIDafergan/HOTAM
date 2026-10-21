import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-4 pt-28 pb-16 text-center">
        <p className="font-headline text-[96px] md:text-[140px] font-medium leading-none text-accent-strong/25 select-none num" aria-hidden="true">404</p>
        <h1 className="mt-2 font-headline text-[34px] md:text-[48px] font-medium text-primary leading-tight">הדף לא נמצא</h1>
        <div className="rule-gold my-5" />
        <p className="lead max-w-md">מצטערים, הדף שחיפשתם אינו קיים או שהוסר מהאתר. ייתכן והקישור אינו תקין.</p>

        <div className="mt-9 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="gap-2 px-10">
            <Link href="/">חזרה לדף הבית <ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 px-8">
            <Link href="/search?view=all"><Search className="h-4 w-4" /> לכל המוצרים</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
