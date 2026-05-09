import { NextResponse } from 'next/server';
import { markOrderAsPaidAndNotify } from '../process-order-payment';

const SUMIT_CHARGE_URL = 'https://api.sumit.co.il/billing/payments/charge/';
const PAYMENT_PROVIDER = 'sumit';
const SUMIT_USER_AGENT = 'Hotam-Marketplace/1.0';
const FALLBACK_ITEM_DESCRIPTION = 'רכישת מוצר';

type CartItem = {
  Description?: string;
  Quantity?: number;
  UnitAmount?: number;
};

type ChargeCartData = {
  orderId?: string;
  price?: number;
  productName?: string;
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

function buildItemsFromCartData(cartData: ChargeCartData, body: ChargeRequestBody, price: number): CartItem[] {
  if (Array.isArray(cartData?.items) && cartData.items.length > 0) {
    return (cartData.items as CartItem[]).map((item) => ({
      Description: item?.Description || FALLBACK_ITEM_DESCRIPTION,
      Quantity: Number(item?.Quantity ?? 1),
      UnitAmount: Number(item?.UnitAmount ?? price),
    }));
  }

  return [
    {
      Description: body?.productName || cartData?.productName || FALLBACK_ITEM_DESCRIPTION,
      Quantity: 1,
      UnitAmount: price,
    },
  ];
}

function getSumitCredentials() {
  const companyId =
    process.env.SUMIT_COMPANY_ID ||
    process.env.SUMIT_BUSINESS_ID ||
    process.env.SUMMIT_BUSINESS_ID;
  const apiKey =
    process.env.SUMIT_API_KEY ||
    process.env.SUMIT_PRIVATE_KEY ||
    process.env.SUMMIT_PRIVATE_KEY;

  if (!companyId || !apiKey) {
    throw new Error('Missing SUMIT credentials for charge request');
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

function normalizeStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function isSuccessfulCharge(payload: any) {
  const statuses = [
    payload?.Status,
    payload?.status,
    payload?.PaymentStatus,
    payload?.Data?.Status,
    payload?.Data?.status,
    payload?.Data?.PaymentStatus,
  ];

  const successFlags = [
    payload?.Success,
    payload?.success,
    payload?.IsSuccess,
    payload?.Data?.Success,
    payload?.Data?.success,
    payload?.Data?.IsSuccess,
  ];

  return (
    successFlags.some((flag) => flag === true) ||
    statuses.some((status) => ['success', 'succeeded', 'approved', 'paid', 'completed'].includes(normalizeStatus(status)))
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChargeRequestBody;
    const token = body?.token || body?.['og-token'];
    const cartData = body?.cartData || {};
    const orderId = body?.orderId || cartData?.orderId;
    const price = Number(body?.price ?? cartData?.price);
    const { companyId, apiKey } = getSumitCredentials();

    if (!token) {
      return NextResponse.json({ error: 'Missing required field: token' }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Missing required field: orderId' }, { status: 400 });
    }

    if (Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
    }

    const items = buildItemsFromCartData(cartData, body, price);

    const hasInvalidItems = items.some((item) => {
      const quantity = Number(item.Quantity);
      const unitAmount = Number(item.UnitAmount);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitAmount) || unitAmount <= 0;
    });

    if (hasInvalidItems) {
      return NextResponse.json({ error: 'Invalid items payload' }, { status: 400 });
    }

    const sumitPayload = {
      Credentials: {
        CompanyID: companyId,
        APIKey: apiKey,
      },
      SingleUseToken: token,
      Items: items,
      Amount: price,
      Customer: {
        PhoneNumber: body?.customerPhone || cartData?.customerPhone || '',
        EmailAddress: body?.customerEmail || cartData?.customerEmail || '',
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
      return NextResponse.json(
        {
          error: getErrorMessage(data) || 'SUMIT charge failed',
          details: data,
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
