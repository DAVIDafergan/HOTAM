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
      return { title: 'פרופיל סופר סת"ם | חותם' };
    }

    const seller = await getPublicSellerById(id);
    if (!seller) {
      return {
        title: 'סופר לא נמצא | חותם',
        description: 'מצטערים, פרופיל הסופר המבוקש אינו זמין כעת.',
      };
    }

    const pageTitle = `${seller.first_name} ${seller.last_name} — סופר סת"ם | חותם`;
    const description = seller.notes || `סופר סת"ם מוסמך עם ${seller.experience_years} שנות ניסיון. צפו בפרופיל המלא וביצירות שלו באתר חותם.`;
    const imageUrl = seller.profile_image || DEFAULT_OG_IMAGE;
    const pageUrl = `https://hotam.shop/sellers/${id}`;

    return {
      title: pageTitle,
      description,
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
    return { title: 'פרופיל סופר סת"ם | חותם' };
  }
}

export default async function SellerPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id || id === 'favicon.ico') return null;

  const { seller, products, reviews } = await getPublicSellerPageData(id);

  return (
    <SellerProfileClient
      sellerId={id}
      initialSeller={seller}
      initialProducts={products}
      initialReviews={reviews}
    />
  );
}
