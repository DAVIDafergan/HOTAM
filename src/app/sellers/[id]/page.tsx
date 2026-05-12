import SellerProfileClient from './SellerProfileClient';
import { getPublicSellerPageData } from '@/lib/storefront-data';

type Props = {
  params: Promise<{ id: string }>;
};

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
