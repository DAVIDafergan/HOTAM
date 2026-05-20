
import { NextResponse } from 'next/server';
import { startSumitSession } from '../../payments/sumit';

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
    const session = await startSumitSession({
      siteBaseUrl: getSiteBaseUrl(req),
      orderId: body?.orderId,
      amount: Number(body?.amount),
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
