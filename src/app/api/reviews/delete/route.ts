import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type DeleteReviewRequest = {
  reviewId?: string;
  reviewType?: 'product' | 'seller';
};

const REVIEW_TABLES = {
  product: 'reviews',
  seller: 'supermarket_reviews',
} as const;

function jsonWithCookies(
  body: object,
  init: ResponseInit,
  cookies: Array<{ name: string; value: string; options: CookieOptions }>,
): NextResponse {
  const res = NextResponse.json(body, init);
  for (const { name, value, options } of cookies) {
    res.cookies.set(name, value, options);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const cookie of cookiesToSet) {
              pendingCookies.push(cookie);
            }
          },
        },
      },
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return jsonWithCookies({ error: 'Unauthorized' }, { status: 401 }, pendingCookies);
    }

    const body = (await req.json().catch(() => ({}))) as DeleteReviewRequest;
    const reviewId = body.reviewId?.trim();
    const reviewType = body.reviewType;

    if (!reviewId || !reviewType || !(reviewType in REVIEW_TABLES)) {
      return jsonWithCookies({ error: 'Invalid request' }, { status: 400 }, pendingCookies);
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const table = REVIEW_TABLES[reviewType];

    // Delete the review only if it belongs to the authenticated user.
    // buyer_user_id is a generated UUID column derived from buyer_id and
    // matches session.user.id when the review was created by an authenticated user.
    const { error: deleteError, count } = await serviceClient
      .from(table)
      .delete({ count: 'exact' })
      .eq('id', reviewId)
      .eq('buyer_user_id', session.user.id);

    if (deleteError) {
      console.error('[reviews/delete] delete error:', deleteError);
      return jsonWithCookies({ error: 'Failed to delete review' }, { status: 500 }, pendingCookies);
    }

    if (count === 0) {
      return jsonWithCookies({ error: 'Review not found or access denied' }, { status: 403 }, pendingCookies);
    }

    return jsonWithCookies({ success: true }, {}, pendingCookies);
  } catch (error) {
    console.error('[reviews/delete] error:', error);
    return jsonWithCookies({ error: 'Internal server error' }, { status: 500 }, pendingCookies);
  }
}
