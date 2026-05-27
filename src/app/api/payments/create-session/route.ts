import { NextResponse } from 'next/server';
import { startSumitSession, SumitApiError, FALLBACK_SUMIT_API_BASE_URL } from '../sumit';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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
    if (!checkRateLimit(ip, { key: 'payments:create-session', maxRequests: 5, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
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
    const productName: string = body?.productName || body?.name || 'רכישת מוצר';
    const unitPrice = Number(body?.price || body?.amount) || 0;
    const amount = unitPrice;
    const currency = body?.currency || 'ILS';

    // Single item always wrapped in an array as required by the SUMIT API
    const items = [{ name: productName, quantity: 1, price: unitPrice }];

    if (!orderId || !unitPrice || Number.isNaN(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: 'Missing required fields: orderId, price/amount' }, { status: 400 });
    }

    const session = await startSumitSession({
      siteBaseUrl: getSiteBaseUrl(req),
      sumitBaseUrl: FALLBACK_SUMIT_API_BASE_URL,
      orderId,
      amount,
      productName,
      currency,
      items,
      buyerName: body?.buyerName || body?.buyer_name,
      buyerEmail: body?.customerEmail || body?.email || body?.buyerEmail || body?.buyer_email,
      buyerPhone: body?.customerPhone || body?.phone || body?.buyerPhone || body?.buyer_phone,
    });

    return NextResponse.json({
      paymentUrl: session.paymentUrl,
      PaymentURL: session.paymentUrl,
    });
  } catch (error: any) {
    console.error('SUMIT create-session error:', error);
    if (error instanceof SumitApiError) {
      return NextResponse.json(
        { error: error.payload?.ErrorMessage || JSON.stringify(error.payload) || error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: error?.message || 'Failed to create SUMIT payment session' }, { status: 500 });
  }
}
