import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startSumitSession } from '../../payments/sumit';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ORDER_ID_REGEX = /^[A-Z0-9]{8,12}$/;

function getSiteBaseUrl(req: Request) {
  const proto = req.headers.get('x-forwarded-proto');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (proto && host) {
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'invoice4u:generate', maxRequests: 5, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const orderId = body?.orderId;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    if (!UUID_REGEX.test(orderId) && !SHORT_ORDER_ID_REGEX.test(orderId)) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    const { data: orderRow, error: orderError } = await serviceClient
      .from('orders')
      .select('amount, status, buyer_id')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (orderRow.buyer_id && orderRow.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (orderRow.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Order already processed' }, { status: 400 });
    }

    const amount = Number(orderRow.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    const session = await startSumitSession({
      siteBaseUrl: getSiteBaseUrl(req),
      orderId,
      amount,
      productName: body?.productName || body?.name || 'מוצר קודש',
      currency: 'ILS',
      buyerName: body?.buyerName || body?.buyer_name,
      buyerEmail: body?.buyerEmail || body?.buyer_email,
      buyerPhone: body?.buyerPhone || body?.buyer_phone,
    });

    return NextResponse.json({ url: session.paymentUrl });
  } catch (error: any) {
    console.error('Legacy invoice4u/generate-link proxy error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create payment link' }, { status: 500 });
  }
}
