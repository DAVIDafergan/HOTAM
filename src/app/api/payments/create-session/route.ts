import { NextResponse } from 'next/server';
import { startSumitSession, SumitApiError, FALLBACK_SUMIT_API_BASE_URL } from '../sumit';

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
    const orderId = body?.orderId;
    const amount = Number(body?.amount);
    const productName = body?.productName || body?.name || 'מוצר קודש';
    const currency = body?.currency || 'ILS';
    const rawItems = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.Items?.Item)
        ? body.Items.Item
        : [];
    const items = rawItems
      .map((item: any) => {
        const quantity = Number(item?.quantity ?? item?.Quantity ?? 1);
        const unitPrice = Number(
          item?.price ??
            item?.Price ??
            (item?.Total != null && quantity > 0 ? Number(item.Total) / quantity : undefined) ??
            amount
        );
        const name = item?.name ?? item?.Description ?? item?.Name ?? productName;
        return { name, quantity, price: unitPrice };
      })
      .filter(
        (item: { name: string; quantity: number; price: number }) =>
          !!item.name && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.price) && item.price >= 0
      );

    if (!orderId || !amount || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Missing required fields: orderId, amount' }, { status: 400 });
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
      buyerEmail: body?.buyerEmail || body?.buyer_email,
      buyerPhone: body?.buyerPhone || body?.buyer_phone,
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
