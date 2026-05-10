import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type DeleteReviewRequest = {
  reviewId?: string;
  reviewType?: 'product' | 'seller';
};

const REVIEW_TABLES = {
  product: 'reviews',
  seller: 'supermarket_reviews',
} as const;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as DeleteReviewRequest;
    const reviewId = body.reviewId?.trim();
    const reviewType = body.reviewType;

    if (!reviewId || !reviewType || !(reviewType in REVIEW_TABLES)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const table = REVIEW_TABLES[reviewType];
    const { data: review, error: reviewError } = await serviceClient
      .from(table)
      .select('id, buyer_id, buyer_user_id')
      .eq('id', reviewId)
      .maybeSingle();

    if (reviewError) {
      console.error('[reviews/delete] fetch error:', reviewError);
      return NextResponse.json({ error: 'Failed to load review' }, { status: 500 });
    }

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.buyer_id !== user.id && review.buyer_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await serviceClient
      .from(table)
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      console.error('[reviews/delete] delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[reviews/delete] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
