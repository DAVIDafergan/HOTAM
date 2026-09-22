import { Skeleton } from '@/components/ui/skeleton';

// Mirrors ProductCard's grid-mode shape (seller header, aspect-[4/5] image, title + spec
// chips, price row) so swapping skeleton -> real cards doesn't shift layout.
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-premium">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-2.5 w-1/3 rounded" />
        </div>
      </div>
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-4/5 rounded" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between border-t border-primary/5 pt-3">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-20 rounded" />
            <Skeleton className="h-2.5 w-14 rounded" />
          </div>
          <Skeleton className="h-10 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-5 xl:grid-cols-3 xl:gap-7">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
