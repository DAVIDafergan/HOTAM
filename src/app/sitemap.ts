import { MetadataRoute } from 'next';
import { supabaseConfig } from '@/firebase/config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hotam.shop';

  // Static routes
  const staticRoutes = [
    '',
    '/search',
    '/diagnosis',
    '/login',
    '/register',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // Dynamic product routes fetched from Supabase REST API
  let productRoutes: any[] = [];
  try {
    if (supabaseConfig.url && supabaseConfig.anonKey) {
      const res = await fetch(
        `${supabaseConfig.url}/rest/v1/products?select=id`,
        {
          headers: {
            apikey: supabaseConfig.anonKey,
            Authorization: `Bearer ${supabaseConfig.anonKey}`,
          },
          next: { revalidate: 3600 },
        },
      );
      if (res.ok) {
        const data: { id: string }[] = await res.json();
        productRoutes = (data || []).map((row) => ({
          url: `${baseUrl}/products/${row.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
      }
    }
  } catch (e) {
    console.error('Sitemap product fetch failed:', e);
  }

  return [...staticRoutes, ...productRoutes];
}
