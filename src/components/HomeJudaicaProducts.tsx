'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';

type Group = { key: string; label: string; types: string[] };

const TAB_LABELS: Record<string, string> = { tallit: 'טליתות', silver: 'כלי כסף', kippah: 'כיפות' };

/** Tabs + horizontal row of real Judaica products, ending with a "לכל המוצרים" card. */
export function HomeJudaicaProducts({ products, groups, heading }: { products: any[]; groups: Group[]; heading: ReactNode }) {
  const [tab, setTab] = useState('all');
  // Only offer a tab when that group actually has products to show.
  const tabs = useMemo(
    () => [{ key: 'all', label: 'הכל' }, ...groups
      .filter((group) => products.some((p) => group.types.includes(p.product_type)))
      .map((group) => ({ key: group.key, label: TAB_LABELS[group.key] || group.label }))],
    [groups, products],
  );
  const activeGroup = groups.find((group) => group.key === tab);
  const visible = activeGroup ? products.filter((p) => activeGroup.types.includes(p.product_type)) : products;
  const moreHref = activeGroup ? `/search?view=results&group=${activeGroup.key}` : '/search?view=all';

  return (
    <>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        {heading}
        {tabs.length > 2 && (
          <div className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0" role="tablist" aria-label="סינון לפי קטגוריה">
            <div className="flex w-max gap-1.5 rounded-full bg-white p-1.5 shadow-sm">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'h-11 whitespace-nowrap rounded-full px-5 text-sm transition-colors',
                    tab === t.key ? 'bg-primary font-black text-primary-foreground' : 'font-bold text-muted-foreground hover:text-primary',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide [-webkit-overflow-scrolling:touch] md:mx-0 md:px-0">
        {visible.map((product) => (
          <div key={product.id} className="w-[68%] shrink-0 snap-center sm:w-[46%] md:w-[31%] lg:w-[23%]">
            <ProductCard product={product} />
          </div>
        ))}
        <Link
          href={moreHref}
          className="flex w-[48%] shrink-0 snap-center flex-col items-center justify-center gap-4 rounded-[2rem] bg-primary p-6 text-center text-primary-foreground transition-transform hover:-translate-y-1 sm:w-[30%] md:w-[18%]"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E2B35B]/50 text-[#E2B35B]">
            <ArrowLeft className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="font-headline text-2xl font-bold leading-tight">לכל המוצרים</span>
          <span className="text-xs font-semibold text-primary-foreground/65">{activeGroup ? activeGroup.label : 'טליתות, כלי כסף וכיפות'}</span>
        </Link>
      </div>
    </>
  );
}
