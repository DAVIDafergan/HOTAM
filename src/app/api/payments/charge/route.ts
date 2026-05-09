import { NextResponse } from 'next/server';
import { markOrderAsPaidAndNotify } from '../process-order-payment';

const SUMIT_CHARGE_URL = 'https://api.sumit.co.il/billing/payments/charge/';
const PAYMENT_PROVIDER = 'sumit';

function getSumitCredentials() {
  const businessId = process.env.SUMMIT_BUSINESS_ID || process.env.SUMIT_BUSINESS_ID;
  const privateKey = process.env.SUMMIT_PRIVATE_KEY || process.env.SUMIT_PRIVATE_KEY;

  if (!businessId || !privateKey) {
    throw new Error('Missing SUMIT credentials for charge request');
  }

  return { businessId, privateKey };
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
    const body = await req.json();
    const token = body?.token || body?.['og-token'];
    const orderId = body?.orderId;
    const price = Number(body?.price);
    const { businessId, privateKey } = getSumitCredentials();

    if (!token || !orderId || Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: 'Missing required fields: token, orderId, price' }, { status: 400 });
    }

    const sumitPayload = {
      Credentials: {
        CompanyID: businessId,
        APIKey: privateKey,
      },
      SingleUseToken: token,
      Items: [
        {
          Description: body?.productName || 'רכישת מוצר',
          Quantity: 1,
          UnitAmount: price || 0,
        },
      ],
      Amount: price || 0,
      Customer: {
        PhoneNumber: body?.customerPhone || '',
        EmailAddress: body?.customerEmail || '',
      },
    };

    const response = await fetch(SUMIT_CHARGE_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Hotam-Marketplace/1.0',
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
      alreadyProcessed: result.alreadyProcessed,
      data,
    });
  } catch (error: any) {
    console.error('SUMIT charge error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to charge payment' }, { status: 500 });
  }
}
