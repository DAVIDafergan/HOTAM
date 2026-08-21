import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetailsClient } from './ProductDetailsClient';
import { getPublicProductById, getPublicProductReviews, getPublicSellerById } from '@/lib/storefront-data';

const VAT_MULTIPLIER = 1.18;

// Without this, notFound() renders the correct not-found content but Vercel
// keeps serving it with a 200 status (confirmed live) — this route isn't a
// good static-optimization candidate anyway (per-id, no generateStaticParams).
export const dynamic = 'force-dynamic';

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
        title: 'מוצר לא נמצא',
        description: 'מצטערים, המוצר המבוקש אינו זמין כעת.',
        robots: { index: false, follow: true },
      };
    }

    const title = fields.product_type || 'מוצר קודש';
    const subType = fields.sub_type && fields.sub_type !== 'all' ? ` ${fields.sub_type}` : '';
    const scriptType = fields.script_type || '';
    const displayPrice = Number(fields.price ?? 0) > 0 ? Math.round(Number(fields.price) * VAT_MULTIPLIER) : 0;

    // Descriptive title (product + key specs) instead of a price-led one, so
    // it reads well for category/attribute searches, not just exact matches.
    const qualityLabel = fields.script_level ? ` ${fields.script_level}` : '';
    const scriptLabel = scriptType ? ` בכתב ${scriptType}` : '';
    const sizeLabel = fields.parchment_size ? ` ${fields.parchment_size} ס"מ` : '';
    const titleBase = `${title}${subType}${sizeLabel}${scriptLabel}${qualityLabel}`;
    // pageTitle (with the explicit "| חותם" suffix) is only for surfaces that don't
    // apply the root layout's title template (OG/Twitter cards) — the <title> tag
    // itself uses titleBase alone so the template doesn't double up the brand suffix.
    const pageTitle = `${titleBase} | חותם`;

    // Meta description: always deterministic from real fields (name, specs,
    // price) so every product page hits the ~150-160 char target regardless
    // of whether the seller wrote their own free-text description — that
    // real text is appended when there's room, never invented.
    const MAX_DESCRIPTION_LENGTH = 160;
    const priceLabel = displayPrice > 0 ? `₪${displayPrice.toLocaleString('he-IL')} כולל מע"מ` : 'מחיר משתלם';
    const descriptionBase = `${title}${subType}${qualityLabel}${scriptLabel}${sizeLabel ? ` בגודל${sizeLabel}` : ''} במחיר ${priceLabel}, ישירות מסופר סת"ם מוסמך - חותם.`;
    let description = descriptionBase;
    if (fields.description) {
      const available = MAX_DESCRIPTION_LENGTH - descriptionBase.length - 1;
      if (available > 20) {
        const sellerText = fields.description.trim();
        description = `${descriptionBase} ${sellerText.length > available ? `${sellerText.slice(0, available - 1).trimEnd()}…` : sellerText}`;
      }
    } else {
      const closing = ' שקיפות מלאה וכשרות ללא פשרות, ישירות מהסופר.';
      if ((descriptionBase + closing).length <= MAX_DESCRIPTION_LENGTH) description = descriptionBase + closing;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      description = `${description.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
    }

    let imageUrl = 'https://github.com/user-attachments/assets/c225c666-5c35-4add-86d2-ed2454e6f368';
    if (Array.isArray(fields.images) && fields.images.length > 0) {
      imageUrl = fields.images[0];
    }

    return {
      title: titleBase,
      description: description,
      alternates: {
        canonical: `/products/${id}`,
      },
      openGraph: {
        title: pageTitle,
        description: description,
        images: [{ url: imageUrl, width: 800, height: 600, alt: pageTitle }],
        url: `https://www.hotam.shop/products/${id}`,
        // og:type "product" + product:price:* are rendered as raw <meta
        // property="..."> tags directly in the page body (Next.js hoists
        // them into <head> automatically) instead of here — the `other`
        // metadata field only emits <meta name="..."> attributes, which
        // Open Graph/Facebook parsers require to be property="..." and
        // would otherwise silently ignore.
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
    return { title: 'מוצר קודש', robots: { index: false, follow: true } };
  }
}

export default async function ProductPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id || id === 'favicon.ico') return null;

  const fieldsPromise = getPublicProductById(id);
  const reviewsPromise = getPublicProductReviews(id);
  const fields = await fieldsPromise;
  if (!fields) notFound();
  const sellerPromise = fields?.seller_id ? getPublicSellerById(fields.seller_id) : Promise.resolve(null);
  const [seller, reviews] = await Promise.all([sellerPromise, reviewsPromise]);
  
  // Dynamic JSON-LD for Search Engine Rich Results
  const productName = fields
    ? `${fields.product_type || 'מוצר קודש'}${fields.sub_type && fields.sub_type !== 'all' ? ` ${fields.sub_type}` : ''}`
    : '';
  const displayPrice = Number(fields?.price ?? 0) > 0 ? Math.round(Number(fields.price) * VAT_MULTIPLIER) : 0;
  const ratedReviews = (reviews || []).filter((r: any) => Number(r?.rating) > 0);
  const avgRating = ratedReviews.length > 0
    ? ratedReviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / ratedReviews.length
    : null;

  const additionalProperty = fields ? [
    fields.script_type && { "@type": "PropertyValue", "name": "סוג כתב", "value": fields.script_type },
    fields.script_level && { "@type": "PropertyValue", "name": "רמת הידור", "value": fields.script_level },
    fields.parchment_size && { "@type": "PropertyValue", "name": "גודל קלף", "value": fields.parchment_size },
    fields.proofreading_level && { "@type": "PropertyValue", "name": "רמת הגהה", "value": fields.proofreading_level },
  ].filter(Boolean) : [];

  const jsonLd = fields ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": productName,
    "description": fields.description || 'מוצר קודש מהודר מחותם',
    "image": Array.isArray(fields.images) && fields.images.length > 0 ? fields.images : undefined,
    "sku": id,
    "productID": id,
    "itemCondition": "https://schema.org/NewCondition",
    ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
    ...(seller ? { "brand": { "@type": "Brand", "name": `${seller.first_name} ${seller.last_name}` } } : {}),
    ...(avgRating !== null ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": Number(avgRating.toFixed(1)),
        "reviewCount": ratedReviews.length,
      },
    } : {}),
    ...(ratedReviews.length > 0 ? {
      "review": ratedReviews.slice(0, 20).map((r: any) => ({
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": Number(r.rating) },
        "author": { "@type": "Person", "name": r.is_anonymous ? 'אנונימי' : (r.buyer_name || 'משתמש') },
        ...(r.comment ? { "reviewBody": r.comment } : {}),
        ...(r.created_at ? { "datePublished": new Date(r.created_at).toISOString() } : {}),
      })),
    } : {}),
    "offers": {
      "@type": "Offer",
      // Pre-existing bug, unrelated to this session's other changes: this
      // used the raw pre-VAT fields.price (confirmed live — JSON-LD said
      // ₪270 while the actual page, title, description, and og:price all
      // correctly showed ₪319, the VAT-inclusive price the customer
      // actually pays). Rich results showing a price the checkout doesn't
      // honor is exactly the kind of mismatch Google's structured data
      // guidelines flag.
      "price": displayPrice,
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
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={String(displayPrice)} />
      <meta property="product:price:currency" content="ILS" />
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
