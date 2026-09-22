import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { calculateCommissionAmount, getSellerPayoutRate } from '@/lib/commission';

// Completes a paid order once the seller enters the buyer's delivery code.
// Runs server-side with the service role because the completion fields (status,
// completed_at, seller_net, platform_fee) and sellers.sales_count are frozen for
// sellers by RLS — a client-side write silently leaves the order stuck on 'paid'.
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'verify-delivery', maxRequests: 10, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { orderId?: unknown; code?: unknown } = {};
    try {
      body = await req.json();
    } catch {}

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!orderId || !code) {
      return NextResponse.json({ error: 'Missing orderId or code' }, { status: 400 });
    }

    const { data: order, error: fetchError } = await serviceClient
      .from('orders')
      .select('id, seller_id, status, verification_code, amount, product_name')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (order.status === 'completed') {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }
    if (order.status !== 'paid') {
      return NextResponse.json({ error: 'Order is not awaiting delivery' }, { status: 409 });
    }
    if (!order.verification_code || order.verification_code !== code) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const amount = Number(order.amount || 0);
    const completedAt = new Date().toISOString();

    // The status guard makes this idempotent: a double-submit can't complete twice
    // or bump sales_count twice.
    const { data: updated, error: updateError } = await serviceClient
      .from('orders')
      .update({
        status: 'completed',
        verified_by_seller: true,
        is_seen_by_seller: true,
        completed_at: completedAt,
        seller_net: amount * getSellerPayoutRate(order.product_name),
        platform_fee: calculateCommissionAmount(amount, order.product_name),
        updated_at: completedAt,
      })
      .eq('id', orderId)
      .eq('status', 'paid')
      .select('id');

    if (updateError) {
      console.error('[verify-delivery] order update failed:', updateError.message);
      return NextResponse.json({ error: 'Failed to complete order' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const { data: seller } = await serviceClient
      .from('sellers')
      .select('sales_count')
      .eq('id', user.id)
      .maybeSingle();
    if (seller) {
      const { error: countError } = await serviceClient
        .from('sellers')
        .update({ sales_count: Number(seller.sales_count || 0) + 1 })
        .eq('id', user.id);
      if (countError) {
        console.error('[verify-delivery] sales_count update failed:', countError.message);
      }
    }

    return NextResponse.json({ ok: true, completedAt });
  } catch (error: any) {
    console.error('[verify-delivery] unexpected error:', error?.message ?? error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
