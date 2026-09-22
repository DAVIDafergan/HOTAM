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

// Neither the reviews nor supermarket_reviews table has user_name/updated_at
// columns (confirmed against docs/supabase-schema.sql and a live PostgREST
// 400 error) — selecting them made every review fetch fail outright.
const PUBLIC_PRODUCT_REVIEW_FIELDS = [
  'id',
  'product_id',
  'buyer_id',
  'buyer_name',
  'rating',
  'product_rating',
  'comment',
  'is_anonymous',
  'created_at',
  'profiles(full_name, avatar_url)',
].join(', ');

// Post-purchase reviews (reviews.order_id set) rate the scribe in `rating` and the
// product in `product_rating`; product-page reviews set both to the product rating.
const ORDER_SCRIBE_REVIEW_FIELDS = [
  'id',
  'order_id',
  'seller_id',
  'buyer_id',
  'buyer_name',
  'rating',
  'comment',
  'is_anonymous',
  'created_at',
  'profiles(full_name, avatar_url)',
].join(', ');

const PUBLIC_SELLER_REVIEW_FIELDS = [
  'id',
  'supermarket_id',
  'buyer_id',
  'buyer_name',
  'rating',
  'comment',
  'is_anonymous',
  'created_at',
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
    // Show the product rating, not the scribe rating a post-purchase review also carries.
    return data.map((review: any) => ({
      ...normalizeReviewWithProfile(review),
      rating: Number(review.product_rating) || review.rating,
    }));
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

    // A scribe's rating = ratings given on their profile page + scribe ratings given
    // after a completed purchase. Product-page ratings rate the product, not the scribe.
    const [profileReviews, orderReviews] = await Promise.all([
      client
        .from('supermarket_reviews')
        .select(PUBLIC_SELLER_REVIEW_FIELDS as any)
        .eq('supermarket_id', sellerId),
      client
        .from('reviews')
        .select(ORDER_SCRIBE_REVIEW_FIELDS as any)
        .eq('seller_id', sellerId)
        .not('order_id', 'is', null),
    ]);

    if (profileReviews.error) console.error('[storefront] seller profile reviews fetch error:', profileReviews.error.message);
    if (orderReviews.error) console.error('[storefront] seller order reviews fetch error:', orderReviews.error.message);

    return [
      ...(profileReviews.data || []).map((review: any) => ({ ...normalizeReviewWithProfile(review), source: 'profile' })),
      ...(orderReviews.data || []).map((review: any) => ({ ...normalizeReviewWithProfile(review), source: 'order' })),
    ];
  } catch (error) {
    console.error('[storefront] seller reviews fetch error:', error);
    return [];
  }
});

/** Fetch the newest in-stock products for the homepage carousel — public, no per-user data. */
export const getHomeProducts = cache(async (limit: number): Promise<any[]> => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('products')
      .select('*')
      .gt('quantity', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as any[];
  } catch (error) {
    console.error('[storefront] home products fetch error:', error);
    return [];
  }
});

// Server-only client for the homepage scribes list: the live DB restricts anon reads of
// some seller columns (sales_count etc.), so a direct anon query came back empty. Only
// public-safe columns are ever selected with it.
const serviceSupabaseClient =
  supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const TOP_SCRIBES_RPC_FALLBACK_LIMIT = 200;

/**
 * Fetch every approved scribe for the homepage, best sellers first (then rating,
 * then experience), including their city. Falls back to the get_top_scribes RPC
 * if the direct query fails, so the section never silently disappears.
 */
export const getTopScribes = cache(async (): Promise<any[]> => {
  try {
    const client = serviceSupabaseClient ?? getPublicSupabaseClient();
    if (!client) return [];

    const { data: sellers, error } = await client
      .from('sellers')
      .select('id, first_name, last_name, profile_image, city, address, experience_years, sales_count, script_level, writing_samples')
      .eq('is_approved', true);
    if (error) throw error;
    if (!sellers || sellers.length === 0) return getTopScribesViaRpc();

    // Same definition as the scribe's profile page: profile ratings + post-purchase scribe
    // ratings (reviews with an order_id). Product-page reviews rate the product, so skip them.
    const sellerIds = sellers.map((s: any) => s.id);
    const [orderReviews, profileReviews] = await Promise.all([
      client.from('reviews').select('seller_id, rating').in('seller_id', sellerIds).not('order_id', 'is', null),
      client.from('supermarket_reviews').select('supermarket_id, rating').in('supermarket_id', sellerIds),
    ]);
    if (orderReviews.error) console.error('[storefront] top scribes reviews fetch error:', orderReviews.error.message);
    if (profileReviews.error) console.error('[storefront] top scribes supermarket_reviews fetch error:', profileReviews.error.message);

    const ratingBySeller = new Map<string, { sum: number; count: number }>();
    const addRating = (sellerId: string, rating: unknown) => {
      const value = Number(rating);
      if (!sellerId || !Number.isFinite(value) || value <= 0) return;
      const agg = ratingBySeller.get(sellerId) || { sum: 0, count: 0 };
      agg.sum += value;
      agg.count += 1;
      ratingBySeller.set(sellerId, agg);
    };
    for (const r of orderReviews.data || []) addRating(r.seller_id, r.rating);
    for (const r of profileReviews.data || []) addRating(r.supermarket_id, r.rating);

    return sortScribes(
      sellers.map((s: any) => {
        const agg = ratingBySeller.get(s.id);
        return {
          ...s,
          sales_count: Number(s.sales_count || 0),
          avg_rating: agg ? agg.sum / agg.count : 0,
          review_count: agg?.count || 0,
        };
      })
    );
  } catch (error: any) {
    console.error('[storefront] top scribes fetch error, falling back to RPC:', error?.message ?? error);
    return getTopScribesViaRpc();
  }
});

async function getTopScribesViaRpc(): Promise<any[]> {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.rpc('get_top_scribes', { limit_count: TOP_SCRIBES_RPC_FALLBACK_LIMIT });
    if (error || !data) {
      if (error) console.error('[storefront] get_top_scribes RPC error:', error.message);
      return [];
    }
    return sortScribes(data as any[]);
  } catch (error) {
    console.error('[storefront] get_top_scribes RPC error:', error);
    return [];
  }
}

function sortScribes(scribes: any[]): any[] {
  return [...scribes].sort((a, b) =>
    Number(b.sales_count || 0) - Number(a.sales_count || 0) ||
    Number(b.avg_rating || 0) - Number(a.avg_rating || 0) ||
    Number(b.experience_years || 0) - Number(a.experience_years || 0)
  );
}

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
