import { Navbar } from '@/components/Navbar';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCardSkeletonGrid } from '@/components/ProductCardSkeleton';

// Mirrors SellerProfileClient's layout (12-col grid: profile card + avatar on the right,
// tabs/product grid on the left) so the route-level loading.tsx doesn't drop straight to a
// blank page + spinner while the seller/products data is fetched.
export function SellerProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-20 md:py-28 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-[2.5rem] bg-white p-8 md:p-10 shadow-premium text-center">
              <Skeleton className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 rounded-full" />
              <Skeleton className="h-7 w-40 mx-auto mb-3 rounded" />
              <Skeleton className="h-3 w-24 mx-auto mb-6 rounded" />
              <Skeleton className="h-3 w-32 mx-auto mb-8 rounded" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-6">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <ProductCardSkeletonGrid count={6} />
          </div>
        </div>
      </main>
    </div>
  );
}
