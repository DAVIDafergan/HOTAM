import { Metadata } from 'next';
import SearchPageClient from './SearchPageClient';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// This page's content is entirely search-param-driven (useSearchParams), which
// forces the results subtree to bail out to client-side-only rendering unless
// the route itself is dynamically rendered per-request. Without this, Google's
// raw HTML fetch of /search sees only a loading spinner — no product content
// or links at all.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'חיפוש כלי קודש - ספרי תורה, תפילין, מזוזות וסת"ם',
  description: 'חפשו וסננו כלי קודש מהודרים — ספרי תורה, תפילין, מזוזות ויודאיקה — לפי סוג כתב, רמת הידור, גודל ומיקום, ישירות מסופרי סת"ם מוסמכים.',
  alternates: {
    canonical: '/search',
  },
};

const PRODUCTS_LIMIT = 50;

export default async function SearchPage() {
  let initialProducts: any[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .gt('quantity', 0)
        .order('created_at', { ascending: false })
        .limit(PRODUCTS_LIMIT);
      initialProducts = data || [];
    }
  } catch (e) {
    console.error('Search page initial product fetch failed:', e);
  }

  return <SearchPageClient initialProducts={initialProducts} />;
}
