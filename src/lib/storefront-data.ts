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

const normalizeReviewWithProfile = (review: any) => {
  const profile = Array.isArray(review?.profiles) ? review.profiles[0] : review?.profiles;
  return {
    ...review,
    buyer_name: profile?.full_name || review?.user_name || review?.buyer_name || 'משתמש',
    reviewer_image: profile?.avatar_url || null,
  };
};

export const getPublicProductById = cache(async (id: string) => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (error) {
    console.error('[storefront] product fetch error:', error);
    return null;
  }
});

export const getPublicSellerById = cache(async (id: string) => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from('sellers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (error) {
    console.error('[storefront] seller fetch error:', error);
    return null;
  }
});

export const getPublicSellerProducts = cache(async (sellerId: string) => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('seller_id', sellerId);

    if (error || !data) return [];
    return data;
  } catch (error) {
    console.error('[storefront] seller products fetch error:', error);
    return [];
  }
});

export const getPublicProductReviews = cache(async (productId: string) => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('product_id', productId);

    if (error || !data) return [];
    return data.map(normalizeReviewWithProfile);
  } catch (error) {
    console.error('[storefront] product reviews fetch error:', error);
    return [];
  }
});

export const getPublicSellerReviews = cache(async (sellerId: string) => {
  try {
    const client = getPublicSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('supermarket_reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('supermarket_id', sellerId);

    if (error || !data) return [];
    return data.map(normalizeReviewWithProfile);
  } catch (error) {
    console.error('[storefront] seller reviews fetch error:', error);
    return [];
  }
});

export async function getPublicSellerPageData(id: string) {
  const [seller, products, reviews] = await Promise.all([
    getPublicSellerById(id),
    getPublicSellerProducts(id),
    getPublicSellerReviews(id),
  ]);

  return { seller, products, reviews };
}

function getPublicSupabaseClient() {
  return publicSupabaseClient;
}
