import { Metadata } from 'next';
import { ProductDetailsClient } from './ProductDetailsClient';
import { firebaseConfig } from '@/firebase/config';

type Props = {
  params: Promise<{ id: string }>;
};

async function getProductData(id: string) {
  try {
    const projectId = firebaseConfig?.projectId;
    if (!projectId) return null;
    
    const encodedId = encodeURIComponent(id);
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${encodedId}`, {
      next: { revalidate: 3600 }
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    return data?.fields || null;
  } catch (error) {
    console.error("Error fetching product data:", error);
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    
    if (!id || id === 'favicon.ico') {
      return { title: 'מוצר קודש מהודר' };
    }

    const fields = await getProductData(id);
    
    if (!fields) {
      return {
        title: 'מוצר לא נמצא | חותם',
        description: 'מצטערים, המוצר המבוקש אינו זמין כעת.',
      };
    }

    const title = fields.productType?.stringValue || 'מוצר קודש';
    const subType = fields.subType?.stringValue && fields.subType?.stringValue !== 'all' ? ` ${fields.subType.stringValue}` : '';
    const scriptType = fields.scriptType?.stringValue || '';
    
    const pageTitle = `${title}${subType} - כתב ${scriptType} מהודר | חותם`;
    const description = fields.description?.stringValue || `רכישת ${title} מהודרת בכתב ${scriptType}, נכתב על ידי סופר סת"ם ירא שמיים בפיקוח הלכתי.`;
    
    let imageUrl = 'https://hotam.shop/opengraph-image.png';
    const imagesValues = fields.images?.arrayValue?.values;
    if (Array.isArray(imagesValues) && imagesValues.length > 0 && imagesValues[0]?.stringValue) {
      imageUrl = imagesValues[0].stringValue;
    }

    return {
      title: pageTitle,
      description: description,
      openGraph: {
        title: pageTitle,
        description: description,
        images: [{ url: imageUrl }],
        url: `https://hotam.shop/products/${id}`,
        type: 'website'
      },
    };
  } catch (error) {
    console.error("Metadata generation error:", error);
    return { title: 'חותם - כלי קודש מהודרים' };
  }
}

export default async function ProductPage({ params }: Props) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;
  if (!id || id === 'favicon.ico') return null;

  const fields = await getProductData(id);
  
  // Dynamic JSON-LD for Search Engine Rich Results
  const jsonLd = fields ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": fields.productType?.stringValue || 'מוצר קודש',
    "description": fields.description?.stringValue || 'מוצר קודש מהודר מחותם',
    "image": fields.images?.arrayValue?.values?.[0]?.stringValue || '',
    "offers": {
      "@type": "Offer",
      "price": Number(fields.price?.doubleValue || fields.price?.integerValue || 0),
      "priceCurrency": "ILS",
      "availability": Number(fields.quantity?.integerValue || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "url": `https://hotam.shop/products/${id}`
    }
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailsClient productId={id} />
    </>
  );
}
