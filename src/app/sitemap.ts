import { MetadataRoute } from 'next';
import { firebaseConfig } from '@/firebase/config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hotam.shop';
  const projectId = firebaseConfig?.projectId;

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

  // Dynamic product routes
  let productRoutes: any[] = [];
  try {
    if (projectId) {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=100`, {
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        productRoutes = (data.documents || []).map((doc: any) => {
          const id = doc.name.split('/').pop();
          return {
            url: `${baseUrl}/products/${id}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
          };
        });
      }
    }
  } catch (e) {
    console.error('Sitemap product fetch failed:', e);
  }

  return [...staticRoutes, ...productRoutes];
}
