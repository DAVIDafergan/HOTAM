import { NextResponse } from 'next/server';
import { verifySumitPayment } from '../sumit';
import { markOrderAsPaidAndNotify } from '../process-order-payment';

const PAYMENT_PROVIDER = 'sumit';

async function readWebhookPayload(req: Request) {
  const url = new URL(req.url);
  let body: any = {};

  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch (error) {
      console.error('Failed to parse SUMIT webhook JSON payload:', error);
      body = {};
    }
  }

  const orderId =
    body?.ApiIdentifier ||
    body?.OrderId ||
    body?.orderId ||
    body?.Reference ||
    url.searchParams.get('ApiIdentifier') ||
    url.searchParams.get('OrderId') ||
    url.searchParams.get('orderId') ||
    url.searchParams.get('Reference');

  const sessionId =
    body?.SessionId ||
    body?.SessionID ||
    body?.sessionId ||
    url.searchParams.get('SessionId') ||
    url.searchParams.get('SessionID') ||
    url.searchParams.get('sessionId');

  const transactionId =
    body?.TransactionId ||
    body?.transactionId ||
    url.searchParams.get('TransactionId') ||
    url.searchParams.get('transactionId');

  return { orderId, sessionId, transactionId, body };
}

async function handleWebhook(req: Request) {
  try {
    const payload = await readWebhookPayload(req);

    if (!payload.orderId) {
      return NextResponse.json({ error: 'Missing order reference in webhook payload' }, { status: 400 });
    }

    const verification = await verifySumitPayment({
      orderId: payload.orderId,
      sessionId: payload.sessionId,
      transactionId: payload.transactionId,
    });

    if (!verification.success) {
      return NextResponse.json({ message: 'Payment not verified as successful', verification: verification.data }, { status: 400 });
    }

    const result = await markOrderAsPaidAndNotify(payload.orderId, PAYMENT_PROVIDER);
    return NextResponse.json({ message: 'OK', verified: true, alreadyProcessed: result.alreadyProcessed });
  } catch (error: any) {
    console.error('SUMIT webhook error:', error);
    return NextResponse.json({ error: error?.message || 'Webhook processing failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleWebhook(req);
}

export async function GET(req: Request) {
  return handleWebhook(req);
}
