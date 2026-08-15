import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://www.hotam.shop';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type UrlEntry = {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  images?: string[];
};

function renderUrlEntry(entry: UrlEntry): string {
  const imageTags = (entry.images || [])
    .filter(Boolean)
    .slice(0, 20) // Google's image sitemap guidance: keep it reasonable per URL
    .map((img) => `<image:image><image:loc>${escapeXml(img)}</image:loc></image:image>`)
    .join('');

  return `<url><loc>${escapeXml(entry.loc)}</loc><lastmod>${entry.lastmod}</lastmod><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority>${imageTags}</url>`;
}

export async function GET() {
  const now = new Date().toISOString();

  const staticRoutes: UrlEntry[] = [
    '',
    '/search',
    '/diagnosis',
    '/contact',
    '/login',
    '/register',
    '/terms',
  ].map((route) => ({
    loc: `${BASE_URL}${route}`,
    lastmod: now,
    changefreq: 'daily',
    priority: route === '' ? '1' : '0.8',
  }));

  let sellerRoutes: UrlEntry[] = [];
  let productRoutes: UrlEntry[] = [];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const client = createClient(supabaseUrl, supabaseAnonKey);

      const { data: sellers } = await client
        .from('sellers')
        .select('id, profile_image, updated_at, created_at')
        .eq('is_approved', true);
      const approvedSellers = sellers || [];
      const approvedIds = approvedSellers.map((s: any) => s.id);

      sellerRoutes = approvedSellers.map((s: any) => ({
        loc: `${BASE_URL}/sellers/${s.id}`,
        lastmod: new Date(s.updated_at || s.created_at).toISOString(),
        changefreq: 'weekly',
        priority: '0.6',
        images: s.profile_image ? [s.profile_image] : [],
      }));

      const { data: products } = approvedIds.length === 0
        ? { data: [] as { id: string; images: string[] | null; updated_at: string | null; created_at: string }[] }
        : await client
          .from('products')
          .select('id, images, updated_at, created_at')
          .in('seller_id', approvedIds);

      productRoutes = (products || []).map((row: any) => ({
        loc: `${BASE_URL}/products/${row.id}`,
        lastmod: new Date(row.updated_at || row.created_at).toISOString(),
        changefreq: 'weekly',
        priority: '0.7',
        images: Array.isArray(row.images) ? row.images : [],
      }));
    }
  } catch (e) {
    console.error('Sitemap product/seller fetch failed:', e);
  }

  const allEntries = [...staticRoutes, ...sellerRoutes, ...productRoutes];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${allEntries.map(renderUrlEntry).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
