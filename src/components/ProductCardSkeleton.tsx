import { Skeleton } from '@/components/ui/skeleton';

// Mirrors ProductCard's grid-mode shape exactly (aspect-[4/5] image, two text lines, price
// line) so swapping skeleton -> real cards never shifts layout.
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-white flex h-full flex-col">
      <Skeleton className="aspect-[4/5] w-full rounded-[1.5rem]" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
        <div className="mt-auto space-y-1.5">
          <Skeleton className="h-6 w-1/3 rounded" />
          <Skeleton className="h-2.5 w-1/2 rounded" />
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
