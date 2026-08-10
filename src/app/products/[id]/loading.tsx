import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-24 sm:pb-28 md:pb-32" dir="rtl">
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
          <Skeleton className="aspect-[4/5] w-full rounded-[1.75rem]" />

          <div className="space-y-6 md:space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-12 w-3/4 rounded-xl" />
            </div>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        </div>

        <div className="mt-16 md:mt-28">
          <div className="flex gap-8 border-b border-primary/8 mb-10 pb-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-40 w-full max-w-3xl rounded-2xl" />
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-2xl border-t border-primary/8 h-20 sm:h-24 md:h-28 shadow-[0_-8px_30px_rgba(15,23,42,0.06)]">
        <div className="container mx-auto px-3 sm:px-4 h-full flex items-center gap-3 md:gap-4 max-w-6xl">
          <div className="flex-1 flex gap-2.5 md:gap-4">
            <Skeleton className="flex-1 h-14 md:h-16 rounded-2xl" />
            <Skeleton className="flex-1 h-14 md:h-16 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
