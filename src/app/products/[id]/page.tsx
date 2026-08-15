import { Metadata } from 'next';
import { ProductDetailsClient } from './ProductDetailsClient';
import { getPublicProductById, getPublicProductReviews, getPublicSellerById } from '@/lib/storefront-data';

const VAT_MULTIPLIER = 1.18;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    
    if (!id || id === 'favicon.ico') {
      return { title: 'מוצר קודש מהודר', robots: { index: false, follow: true } };
    }

    const fields = await getPublicProductById(id);

    if (!fields) {
      return {
        title: 'מוצר לא נמצא | חותם',
        description: 'מצטערים, המוצר המבוקש אינו זמין כעת.',
        robots: { index: false, follow: true },
      };
    }

    const title = fields.product_type || 'מוצר קודש';
    const subType = fields.sub_type && fields.sub_type !== 'all' ? ` ${fields.sub_type}` : '';
    const scriptType = fields.script_type || '';
    const displayPrice = Number(fields.price ?? 0) > 0 ? Math.round(Number(fields.price) * VAT_MULTIPLIER) : 0;

    const pageTitle = `${title}${subType} • ₪${displayPrice.toLocaleString('he-IL')} | חותם`;
    const description = fields.description || `רכישת ${title}${subType} מהודר בכתב ${scriptType}, במחיר ₪${displayPrice.toLocaleString('he-IL')} כולל מע"מ, ישירות מסופר סת"ם ירא שמיים.`;

    let imageUrl = 'https://github.com/user-attachments/assets/c225c666-5c35-4add-86d2-ed2454e6f368';
    if (Array.isArray(fields.images) && fields.images.length > 0) {
      imageUrl = fields.images[0];
    }

    return {
      title: pageTitle,
      description: description,
      alternates: {
        canonical: `/products/${id}`,
      },
      openGraph: {
        title: pageTitle,
        description: description,
        images: [{ url: imageUrl, width: 800, height: 600, alt: pageTitle }],
        url: `https://www.hotam.shop/products/${id}`,
        type: 'website'
      },
      twitter: {
        card: 'summary_large_image',
        title: pageTitle,
        description: description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("Metadata generation error:", error);
    return { title: 'חותם - כלי קודש מהודרים', robots: { index: false, follow: true } };
  }
}

export default async function ProductPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id || id === 'favicon.ico') return null;

  const fieldsPromise = getPublicProductById(id);
  const reviewsPromise = getPublicProductReviews(id);
  const fields = await fieldsPromise;
  const sellerPromise = fields?.seller_id ? getPublicSellerById(fields.seller_id) : Promise.resolve(null);
  const [seller, reviews] = await Promise.all([sellerPromise, reviewsPromise]);
  
  // Dynamic JSON-LD for Search Engine Rich Results
  const productName = fields
    ? `${fields.product_type || 'מוצר קודש'}${fields.sub_type && fields.sub_type !== 'all' ? ` ${fields.sub_type}` : ''}`
    : '';
  const jsonLd = fields ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": productName,
    "description": fields.description || 'מוצר קודש מהודר מחותם',
    "image": Array.isArray(fields.images) ? (fields.images[0] || '') : '',
    ...(seller ? { "brand": { "@type": "Brand", "name": `${seller.first_name} ${seller.last_name}` } } : {}),
    "offers": {
      "@type": "Offer",
      "price": Number(fields.price ?? 0),
      "priceCurrency": "ILS",
      "availability": Number(fields.quantity ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "url": `https://www.hotam.shop/products/${id}`,
      ...(seller ? { "seller": { "@type": "Person", "name": `${seller.first_name} ${seller.last_name}` } } : {}),
    }
  } : null;

  const breadcrumbJsonLd = fields ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "חותם", "item": "https://www.hotam.shop" },
      { "@type": "ListItem", "position": 2, "name": "חיפוש כלי קודש", "item": "https://www.hotam.shop/search" },
      { "@type": "ListItem", "position": 3, "name": productName, "item": `https://www.hotam.shop/products/${id}` },
    ],
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <ProductDetailsClient
        productId={id}
        initialProduct={fields}
        initialSeller={seller}
        initialReviews={reviews}
      />
    </>
  );
}
