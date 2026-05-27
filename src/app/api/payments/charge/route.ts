import { NextResponse } from 'next/server';
import { markOrderAsPaidAndNotify } from '../process-order-payment';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const SUMIT_CHARGE_URL = 'https://api.sumit.co.il/billing/payments/charge/';
const PAYMENT_PROVIDER = 'sumit';
const SUMIT_USER_AGENT = 'Hotam-Marketplace/1.0';
const FALLBACK_ITEM_DESCRIPTION = 'רכישת מוצר';

type CartItem = {
  Name?: string;
  Description?: string;
  Quantity?: number;
  UnitPrice?: number;
  UnitAmount?: number;
};

type SumitChargeItem = {
  Item: {
    Name: string;
  };
  Quantity: number;
  UnitPrice: number;
};

type ChargeCartData = {
  orderId?: string;
  price?: number;
  productName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  items?: CartItem[];
};

type ChargeRequestBody = {
  token?: string;
  ['og-token']?: string;
  orderId?: string;
  price?: number;
  productName?: string;
  customerEmail?: string;
  customerPhone?: string;
  cartData?: ChargeCartData;
};

function buildItemsFromCartData(cartData: ChargeCartData, price: number): SumitChargeItem[] {
  const itemName =
    cartData?.productName ||
    (Array.isArray(cartData?.items) && cartData.items[0]?.Name) ||
    FALLBACK_ITEM_DESCRIPTION;

  return [{
    Item: { Name: itemName },
    Quantity: 1,
    UnitPrice: price,
  }];
}

function getSumitCredentials() {
  const rawCompanyId =
    process.env.SUMIT_COMPANY_ID ||
    process.env.SUMIT_BUSINESS_ID ||
    process.env.SUMMIT_BUSINESS_ID;
  const apiKey =
    process.env.SUMIT_API_KEY ||
    process.env.SUMIT_PRIVATE_API_KEY ||
    process.env.SUMMIT_PRIVATE_API_KEY ||
    process.env.SUMIT_PRIVATE_KEY ||
    process.env.SUMMIT_PRIVATE_KEY;

  const companyId = Number(rawCompanyId);

  if (!rawCompanyId || !apiKey) {
    throw new Error('Missing SUMIT credentials for charge request');
  }

  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error('Invalid SUMIT CompanyID configuration');
  }

  return { companyId, apiKey };
}

function parseJsonResponse(rawText: string) {
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: rawText };
  }
}

function getErrorMessage(payload: any) {
  return (
    payload?.ErrorMessage ||
    payload?.Message ||
    payload?.error ||
    payload?.Data?.ErrorMessage ||
    payload?.Data?.Message ||
    null
  );
}

function isSuccessfulCharge(payload: any) {
  // Sumit: Code "000" = אושר בבנק
  const code = payload?.Code ?? payload?.Data?.Code;
  if (code === '000' || code === 0 || code === '0') return true;

  // Sumit: Status 0 = הצלחה (לא מחרוזת)
  if (payload?.Status === 0 || payload?.Data?.Status === 0) return true;

  const statuses = [
    payload?.Status, payload?.status, payload?.PaymentStatus,
    payload?.Data?.Status, payload?.Data?.status, payload?.Data?.PaymentStatus,
  ];
  const successFlags = [
    payload?.Success, payload?.success, payload?.IsSuccess,
    payload?.Data?.Success, payload?.Data?.success, payload?.Data?.IsSuccess,
  ];

  return (
    successFlags.some((flag) => flag === true) ||
    statuses.some((status) =>
      ['success', 'succeeded', 'approved', 'paid', 'completed']
        .includes(String(status || '').trim().toLowerCase())
    )
  );
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, { key: 'payments:charge', maxRequests: 5, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.replace('Bearer ', '');
    if (!bearerToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as ChargeRequestBody;
    const token = body?.token || body?.['og-token'];
    const cartData = body?.cartData || {};
    const orderId = body?.orderId || cartData?.orderId;
    const { companyId, apiKey } = getSumitCredentials();

    if (!token) {
      return NextResponse.json({ error: 'Missing required field: token' }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Missing required field: orderId' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: { user: authUser }, error: authError } = await serviceClient.auth.getUser(bearerToken);
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: orderRow, error: orderFetchError } = await serviceClient
      .from('orders')
      .select('amount, status, buyer_id')
      .eq('id', orderId)
      .single();

    if (orderFetchError || !orderRow) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (orderRow.buyer_id && orderRow.buyer_id !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (orderRow.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Order already processed' }, { status: 400 });
    }

    const price = Number(orderRow.amount);

    if (Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    const items = buildItemsFromCartData(cartData, price);

    const hasInvalidItems = items.some((item) => {
      const quantity = Number(item.Quantity);
      const unitPrice = Number(item.UnitPrice);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0;
    });

    if (hasInvalidItems) {
      return NextResponse.json({ error: 'Items must have positive quantity and unit amount' }, { status: 400 });
    }

    const sumitPayload = {
      Credentials: {
        CompanyID: companyId,
        APIKey: apiKey,
      },
      SingleUseToken: token,
      VATIncluded: true,
      Items: items,
      Amount: price,
      Customer: {
        Name: cartData?.customerName || '',
        Phone: cartData?.customerPhone || '',
        EmailAddress: cartData?.customerEmail || '',
      },
    };

    const response = await fetch(SUMIT_CHARGE_URL, {
      method: 'POST',
      headers: {
        'User-Agent': SUMIT_USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sumitPayload),
    });

    const rawText = await response.text();
    const data = parseJsonResponse(rawText);

    if (!response.ok || !isSuccessfulCharge(data)) {
      console.error('[charge] Sumit error details:', data);
      return NextResponse.json(
        {
          error: getErrorMessage(data) || 'החיוב נכשל. אנא נסה שוב.',
        },
        { status: response.ok ? 400 : response.status }
      );
    }

    const result = await markOrderAsPaidAndNotify(orderId, PAYMENT_PROVIDER);

    return NextResponse.json({
      success: true,
      orderId,
      alreadyProcessed: result.alreadyProcessed,
      data,
    });
  } catch (error: any) {
    console.error('SUMIT charge error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to charge payment' }, { status: 500 });
  }
}
