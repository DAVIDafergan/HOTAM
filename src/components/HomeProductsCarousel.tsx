import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { MotionTap } from '@/components/MotionTap';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const PRODUCTS_LIMIT = 10;

export async function HomeProductsCarousel() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .gt('quantity', 0)
    .order('created_at', { ascending: false })
    .limit(PRODUCTS_LIMIT);

  if (!products || products.length === 0) return null;

  return (
    <section className="relative py-10 md:py-16 bg-background overflow-hidden" aria-labelledby="home-products-heading" dir="rtl">
      <div className="container mx-auto px-4 md:px-5">
        <div className="text-center md:text-right mb-6 md:mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full text-accent font-semibold text-[10px] uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> נבחרת המוצרים
          </div>
          <h2 id="home-products-heading" className="text-2xl md:text-[2.2rem] font-headline font-black text-primary tracking-tight">
            כלי קודש שנוספו לאחרונה
          </h2>
        </div>

        <div className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 [-webkit-overflow-scrolling:touch] scroll-smooth">
          {products.map((product, i) => (
            <div key={product.id} className="w-[68%] sm:w-[46%] md:w-[31%] lg:w-[23%] shrink-0 snap-center">
              <ProductCard product={product} priority={i === 0} />
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-8 md:mt-12">
          <MotionTap className="inline-block">
            <Button size="lg" asChild className="rounded-full gap-3 font-bold text-white bg-primary hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 transition-all duration-300 px-12 h-16 shadow-xl">
              <Link href="/search?view=all">
                לכל המוצרים
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </MotionTap>
        </div>
      </div>
    </section>
  );
}
