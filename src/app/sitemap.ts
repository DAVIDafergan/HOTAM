import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.hotam.shop';

  // Static routes
  const staticRoutes = [
    '',
    '/search',
    '/diagnosis',
    '/contact',
    '/login',
    '/register',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Dynamic product + seller-profile routes fetched from Supabase
  let productRoutes: any[] = [];
  let sellerRoutes: any[] = [];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { data: sellers } = await client
        .from('sellers').select('id, updated_at, created_at').eq('is_approved', true);
      const approvedSellers = sellers || [];
      const approvedIds = approvedSellers.map((s) => s.id);

      sellerRoutes = approvedSellers.map((s: any) => ({
        url: `${baseUrl}/sellers/${s.id}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : new Date(s.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));

      const { data } = approvedIds.length === 0
        ? { data: [] as { id: string; updated_at: string | null; created_at: string }[] }
        : await client
          .from('products').select('id, updated_at, created_at').in('seller_id', approvedIds);
      productRoutes = (data || []).map((row) => ({
        url: `${baseUrl}/products/${row.id}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error('Sitemap product/seller fetch failed:', e);
  }

  return [...staticRoutes, ...sellerRoutes, ...productRoutes];
}
