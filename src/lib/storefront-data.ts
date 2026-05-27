import 'server-only';

import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const publicSupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const PUBLIC_PRODUCT_FIELDS = [
  'id',
  'product_type',
  'sub_type',
  'script_type',
  'script_level',
  'description',
  'price',
  'images',
  'quantity',
  'delivery_type',
  'delivery_area',
  'delivery_fee',
  'delivery_time',
  'pickup_address',
  'seller_id',
  'seller_city',
  'parchment_size',
  'proofreading_level',
  'created_at',
].join(', ');

const PUBLIC_SELLER_FIELDS = [
  'id',
  'first_name',
  'last_name',
  'city',
  'address',
  'notes',
  'profile_image',
  'is_approved',
  'created_at',
].join(', ');

const PUBLIC_PRODUCT_REVIEW_FIELDS = [
  'id',
  'product_id',
  'buyer_id',
  'buyer_name',
  'user_name',
  'rating',
  'comment',
  'is_anonymous',
  'created_at',
  'updated_at',
  'profiles(full_name, avatar_url)',
].join(', ');

const PUBLIC_SELLER_REVIEW_FIELDS = [
  'id',
  'supermarket_id',
  'buyer_id',
  'buyer_name',
  'user_name',
  'rating',
  'comment',
  'is_anonymous',
  'created_at',
  'updated_at',
  'profiles(full_name, avatar_url)',
].join(', ');

const normalizeReviewWithProfile = (review: any) => {
  const profile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
  return {
    ...review,
    buyer_name: profile?.full_name || review?.user_name || review?.buyer_name || 'משתמש',
    reviewer_image: profile?.avatar_url || null,
  };
};

/** Fetch a public product by id for product page rendering and metadata. */
export const getPublicProductById = cache(async (id: string): Promise<any | null> => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from('products')
      .select(PUBLIC_PRODUCT_FIELDS as any)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as any;
  } catch (error) {
    console.error('[storefront] product fetch error:', error);
    return null;
  }
});

/** Fetch a public seller profile by id for storefront rendering. */
export const getPublicSellerById = cache(async (id: string): Promise<any | null> => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from('sellers')
      .select(PUBLIC_SELLER_FIELDS as any)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as any;
  } catch (error) {
    console.error('[storefront] seller fetch error:', error);
    return null;
  }
});

/** Fetch all public products that belong to a seller for storefront rendering. */
export const getPublicSellerProducts = cache(async (sellerId: string): Promise<any[]> => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('products')
      .select(PUBLIC_PRODUCT_FIELDS as any)
      .eq('seller_id', sellerId);

    if (error || !data) return [];
    return (data ?? []) as any[];
  } catch (error) {
    console.error('[storefront] seller products fetch error:', error);
    return [];
  }
});

/** Fetch normalized public reviews for a product page. */
export const getPublicProductReviews = cache(async (productId: string): Promise<any[]> => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('reviews')
      .select(PUBLIC_PRODUCT_REVIEW_FIELDS as any)
      .eq('product_id', productId);

    if (error || !data) return [];
    return data.map(normalizeReviewWithProfile);
  } catch (error) {
    console.error('[storefront] product reviews fetch error:', error);
    return [];
  }
});

/** Fetch normalized public reviews for a seller profile page. */
export const getPublicSellerReviews = cache(async (sellerId: string): Promise<any[]> => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('supermarket_reviews')
      .select(PUBLIC_SELLER_REVIEW_FIELDS as any)
      .eq('supermarket_id', sellerId);

    if (error || !data) return [];
    return data.map(normalizeReviewWithProfile);
  } catch (error) {
    console.error('[storefront] seller reviews fetch error:', error);
    return [];
  }
});

/** Fetch the seller page payload in parallel so the route can render from the server. */
export async function getPublicSellerPageData(id: string) {
  const [seller, products, reviews] = await Promise.all([
    getPublicSellerById(id),
    getPublicSellerProducts(id),
    getPublicSellerReviews(id),
  ]);

  return { seller, products, reviews };
}

function getPublicSupabaseClient() {
  if (!publicSupabaseClient) {
    console.error(
      '[storefront] CRITICAL: Supabase client is null — NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!',
    );
  }
  return publicSupabaseClient;
}
