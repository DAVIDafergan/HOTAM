import { Metadata } from 'next';
import SellerProfileClient from './SellerProfileClient';
import { getPublicSellerById, getPublicSellerPageData } from '@/lib/storefront-data';

const DEFAULT_OG_IMAGE = 'https://github.com/user-attachments/assets/c225c666-5c35-4add-86d2-ed2454e6f368';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id || id === 'favicon.ico') {
      return { title: 'פרופיל סופר סת"ם | חותם', robots: { index: false, follow: true } };
    }

    const seller = await getPublicSellerById(id);
    if (!seller) {
      return {
        title: 'סופר לא נמצא | חותם',
        description: 'מצטערים, פרופיל הסופר המבוקש אינו זמין כעת.',
        robots: { index: false, follow: true },
      };
    }

    const pageTitle = `${seller.first_name} ${seller.last_name} — סופר סת"ם | חותם`;
    const description = seller.notes || `סופר סת"ם מוסמך עם ${seller.experience_years} שנות ניסיון. צפו בפרופיל המלא וביצירות שלו באתר חותם.`;
    const imageUrl = seller.profile_image || DEFAULT_OG_IMAGE;
    const pageUrl = `https://www.hotam.shop/sellers/${id}`;

    return {
      title: pageTitle,
      description,
      alternates: {
        canonical: `/sellers/${id}`,
      },
      openGraph: {
        title: pageTitle,
        description,
        url: pageUrl,
        type: 'website',
        images: [
          {
            url: imageUrl,
            width: 800,
            height: 600,
            alt: pageTitle,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: pageTitle,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error('Seller metadata generation error:', error);
    return { title: 'פרופיל סופר סת"ם | חותם', robots: { index: false, follow: true } };
  }
}

export default async function SellerPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id || id === 'favicon.ico') return null;

  const { seller, products, reviews } = await getPublicSellerPageData(id);

  const ratedReviews = (reviews || []).filter((r: any) => Number(r?.rating) > 0);
  const avgRating = ratedReviews.length > 0
    ? ratedReviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / ratedReviews.length
    : null;

  const jsonLd = seller ? {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": `${seller.first_name} ${seller.last_name}`,
    "description": seller.notes || `סופר סת"ם מוסמך באתר חותם`,
    "image": seller.profile_image || undefined,
    "url": `https://www.hotam.shop/sellers/${id}`,
    "jobTitle": 'סופר סת"ם',
    ...(seller.city ? { "address": { "@type": "PostalAddress", "addressLocality": seller.city, "addressCountry": "IL" } } : {}),
    ...(avgRating !== null ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": Number(avgRating.toFixed(1)),
        "reviewCount": ratedReviews.length,
      },
    } : {}),
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SellerProfileClient
        sellerId={id}
        initialSeller={seller}
        initialProducts={products}
        initialReviews={reviews}
      />
    </>
  );
}
