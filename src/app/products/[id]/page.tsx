import { Metadata } from 'next';
import { ProductDetailsClient } from './ProductDetailsClient';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: Promise<{ id: string }>;
};

async function getProductData(id: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data;
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

    const title = fields.product_type || 'מוצר קודש';
    const subType = fields.sub_type && fields.sub_type !== 'all' ? ` ${fields.sub_type}` : '';
    const scriptType = fields.script_type || '';

    const pageTitle = `${title}${subType} - כתב ${scriptType} מהודר | חותם`;
    const description = fields.description || `רכישת ${title} מהודרת בכתב ${scriptType}, נכתב על ידי סופר סת"ם ירא שמיים בפיקוח הלכתי.`;

    let imageUrl = 'https://hotam.shop/opengraph-image.png';
    if (Array.isArray(fields.images) && fields.images.length > 0) {
      imageUrl = fields.images[0];
    }

    return {
      title: pageTitle,
      description: description,
      openGraph: {
        title: pageTitle,
        description: description,
        images: [{ url: imageUrl, width: 1200, height: 630 }],
        url: `https://hotam.shop/products/${id}`,
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
    "name": fields.product_type || 'מוצר קודש',
    "description": fields.description || 'מוצר קודש מהודר מחותם',
    "image": Array.isArray(fields.images) ? (fields.images[0] || '') : '',
    "offers": {
      "@type": "Offer",
      "price": Number(fields.price ?? 0),
      "priceCurrency": "ILS",
      "availability": Number(fields.quantity ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
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
      <ProductDetailsClient productId={id} initialProduct={fields} />
    </>
  );
}
