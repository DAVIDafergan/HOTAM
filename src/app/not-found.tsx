
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center" dir="rtl">
      <Navbar />
      <main className="space-y-8 pt-20">
        <div className="relative">
          <h1 className="text-[12rem] font-headline font-black text-primary/5 select-none">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="text-4xl font-headline font-black text-primary tracking-tight">הדף לא נמצא</h2>
          </div>
        </div>
        
        <div className="space-y-4 max-w-md mx-auto">
          <p className="text-muted-foreground text-lg font-medium">מצטערים, הדף שחיפשתם אינו קיים או שהוסר מהאתר. ייתכן והקישור אינו תקין.</p>
          <div className="w-16 h-1 bg-accent mx-auto rounded-full" />
        </div>

        <Button asChild className="rounded-full px-12 h-16 bg-primary text-white hover:bg-primary/90 font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-105 active:scale-95">
          <Link href="/">חזרה לדף הבית</Link>
        </Button>
      </main>
    </div>
  );
}
