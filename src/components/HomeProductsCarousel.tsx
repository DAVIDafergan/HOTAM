import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/SectionHeading';
import { getHomeProducts } from '@/lib/storefront-data';

const PRODUCTS_LIMIT = 10;

export async function HomeProductsCarousel() {
  const products = await getHomeProducts(PRODUCTS_LIMIT);
  if (!products || products.length === 0) return null;

  return (
    <section className="relative section-shell bg-background overflow-hidden" aria-labelledby="home-products-heading" dir="rtl">
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeading
          id="home-products-heading"
          eyebrow="נבחרת המוצרים"
          title="כלי קודש שנוספו לאחרונה"
          action={
            <Button variant="outline" asChild className="hidden md:inline-flex gap-2">
              <Link href="/search?view=all">
                לכל המוצרים
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
          }
        />

        <div className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 md:gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0 [-webkit-overflow-scrolling:touch] scroll-smooth">
          {products.map((product, i) => (
            <div key={product.id} className="w-[72%] sm:w-[46%] md:w-[31%] lg:w-[23%] shrink-0 snap-start">
              <ProductCard product={product} priority={i === 0} />
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-8 md:hidden">
          <Button variant="outline" size="lg" asChild className="gap-2">
            <Link href="/search?view=all">
              לכל המוצרים
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
