import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FDFCF0]" dir="rtl">
      <div className="h-16 bg-white border-b" />

      <main className="container mx-auto px-4 py-20 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
          <Skeleton className="aspect-square w-full rounded-[2rem] md:rounded-[3rem]" />

          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-12 w-3/4 rounded-xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-[2.5rem]" />
            <Skeleton className="h-32 w-full rounded-[2.5rem]" />
            <Skeleton className="h-24 w-full rounded-[2rem]" />
          </div>
        </div>

        <div className="mt-10">
          <Skeleton className="h-14 w-full rounded-3xl mb-8" />
          <Skeleton className="h-48 w-full rounded-[3rem]" />
        </div>
      </main>
    </div>
  );
}
