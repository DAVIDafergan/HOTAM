import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/SectionHeading';
import { StaggerGrid, StaggerItem } from '@/components/StaggerGrid';
import { getHomeProducts } from '@/lib/storefront-data';

const PRODUCTS_LIMIT = 10;

export async function HomeProductsCarousel() {
  const products = await getHomeProducts(PRODUCTS_LIMIT);
  if (!products || products.length === 0) return null;

  return (
    <section className="relative section-shell bg-background overflow-hidden" aria-labelledby="home-products-heading" dir="rtl">
      <div className="container mx-auto px-5 md:px-8">
        <SectionHeading
          id="home-products-heading"
          eyebrow="חדש באתר"
          title="נכתבו לאחרונה"
          action={
            <Button variant="outline" asChild className="hidden md:inline-flex gap-2">
              <Link href="/search?view=all">
                לכל כלי הקודש
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
          }
        />

        {/* Phones: two compact cards side by side plus a peek of the third, so the newest
            products are visible within one screen instead of one tall card per screen. */}
        <StaggerGrid className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3 md:gap-6 pb-4 -mx-5 px-5 scroll-px-5 md:mx-0 md:px-0 md:scroll-px-0 [-webkit-overflow-scrolling:touch] scroll-smooth">
          {products.map((product, i) => (
            <StaggerItem key={product.id} className="w-[44%] sm:w-[31%] md:w-[31%] lg:w-[23%] shrink-0 snap-start">
              <ProductCard product={product} priority={i === 0} density="compact" />
            </StaggerItem>
          ))}
        </StaggerGrid>

        <div className="flex justify-center mt-8 md:hidden">
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link href="/search?view=all">
              לכל כלי הקודש
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
