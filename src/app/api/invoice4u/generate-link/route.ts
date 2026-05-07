
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
