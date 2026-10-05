import { createClient } from '@supabase/supabase-js';
import { feedExclusionReason, renderFeed, toFeedItem, type FeedSeller } from '@/lib/merchant-feed';

// Google Merchant Center data source: Merchant Center fetches this URL on a schedule
// (Products → Data sources → Add product source → "Add products from a file" → this link).
// Regenerated at most once an hour.
export const revalidate = 3600;

const PRODUCT_COLUMNS = 'id, seller_id, product_type, sub_type, description, quantity, script_type, script_level, price, images, parchment_size, delivery_time, delivery_type, delivery_fee, attributes';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Server-only: seller approval/names are read with the service key when it's set (only the
  // columns below), so the feed doesn't depend on what anonymous visitors may read.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Never answer with an empty feed on a failure: Merchant Center would read it as "every
  // product removed". A 503 makes it keep the last successfully fetched version instead.
  const unavailable = () => new Response('Feed temporarily unavailable', { status: 503, headers: { 'Retry-After': '3600' } });
  if (!supabaseUrl || !key) return unavailable();
  let body: string;

  try {
    const client = createClient(supabaseUrl, key, { auth: { persistSession: false } });
    const { data: products, error } = await client
      .from('products')
      .select(PRODUCT_COLUMNS)
      .gt('quantity', 0)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;
    const sellerIds = Array.from(new Set((products || []).map((p: any) => p.seller_id).filter(Boolean)));
    const { data: sellers, error: sellersError } = sellerIds.length
      ? await client.from('sellers').select('id, first_name, last_name, is_approved').in('id', sellerIds)
      : { data: [] as FeedSeller[], error: null };
    if (sellersError) throw sellersError;
    const sellerById = new Map((sellers || []).map((s: any) => [String(s.id), s as FeedSeller]));
    const items = (products || [])
      .filter((p: any) => !feedExclusionReason(p, sellerById.get(String(p.seller_id))))
      .map((p: any) => toFeedItem(p, sellerById.get(String(p.seller_id))!));
    body = renderFeed(items);
  } catch (error: any) {
    console.error('[google-merchant feed] failed:', error?.message ?? error);
    return unavailable();
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
