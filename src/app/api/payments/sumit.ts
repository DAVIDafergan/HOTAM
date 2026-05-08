const SUMIT_BASE_URL = (process.env.SUMIT_BASE_URL || 'https://api.sumit.co.il').replace(/\/+$/, '');

function buildSumitUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${SUMIT_BASE_URL}${normalizedPath}`;
}

export interface StartSessionInput {
  siteBaseUrl: string;
  orderId: string;
  amount: number;
  productName: string;
  currency?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

export interface VerifySessionInput {
  orderId?: string | null;
  sessionId?: string | null;
  transactionId?: string | null;
}

function getSumitCredentials() {
  const businessId = process.env.SUMMIT_BUSINESS_ID || process.env.SUMIT_BUSINESS_ID;
  const privateKey = process.env.SUMMIT_PRIVATE_KEY || process.env.SUMIT_PRIVATE_KEY;
  const publicKey = process.env.SUMMIT_PUBLIC_KEY || process.env.SUMIT_PUBLIC_KEY;

  if (!businessId || !privateKey || !publicKey) {
    throw new Error(
      'Missing SUMIT credentials: SUMMIT_* (or SUMIT_*) BUSINESS_ID/PRIVATE_KEY/PUBLIC_KEY environment variables are required'
    );
  }

  return { businessId, privateKey, publicKey };
}

function extractPaymentUrl(payload: any): string | null {
  return (
    payload?.PaymentURL ||
    payload?.PaymentUrl ||
    payload?.paymentUrl ||
    payload?.url ||
    payload?.Data?.PaymentURL ||
    payload?.data?.PaymentURL ||
    null
  );
}

function normalizeStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function isSuccessStatus(status: unknown) {
  const normalized = normalizeStatus(status);
  return ['success', 'succeeded', 'paid', 'approved', 'completed'].includes(normalized);
}

export async function startSumitSession(input: StartSessionInput) {
  const { businessId, privateKey, publicKey } = getSumitCredentials();
  const currency = input.currency || 'ILS';
  const redirectURL = new URL(
    `/customer/dashboard?payment=success&orderId=${encodeURIComponent(input.orderId)}`,
    input.siteBaseUrl
  ).toString();
  const webhookURL = new URL('/api/payments/webhook', input.siteBaseUrl).toString();

  const payload = {
    BusinessId: businessId,
    PrivateKey: privateKey,
    PublicKey: publicKey,
    Sum: Number(input.amount),
    Currency: currency,
    ApiIdentifier: input.orderId,
    Description: input.productName,
    RedirectURL: redirectURL,
    WebhookURL: webhookURL,
    ClientName: input.buyerName || '',
    ClientEmail: input.buyerEmail || '',
    ClientPhone: input.buyerPhone || '',
    Items: [
      {
        Name: input.productName,
        Quantity: 1,
        Price: Number(input.amount),
        Currency: currency,
      },
    ],
  };

  const response = await fetch(buildSumitUrl('/Payment/StartSession'), {
    method: 'POST',
    headers: {
      'User-Agent': 'Hotam-Marketplace/1.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    throw new Error(data?.Message || data?.error || 'SUMIT StartSession failed');
  }

  const paymentUrl = extractPaymentUrl(data);
  if (!paymentUrl) {
    throw new Error('SUMIT response did not include PaymentURL');
  }

  return {
    paymentUrl,
    data,
  };
}

export async function verifySumitPayment(input: VerifySessionInput) {
  const { businessId, privateKey, publicKey } = getSumitCredentials();

  const payload = {
    BusinessId: businessId,
    PrivateKey: privateKey,
    PublicKey: publicKey,
    ApiIdentifier: input.orderId || undefined,
    OrderId: input.orderId || undefined,
    SessionId: input.sessionId || undefined,
    SessionID: input.sessionId || undefined,
    TransactionId: input.transactionId || undefined,
  };

  const response = await fetch(buildSumitUrl('/Payment/GetSessionStatus'), {
    method: 'POST',
    headers: {
      'User-Agent': 'Hotam-Marketplace/1.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    return { success: false, data, message: 'SUMIT status verification call failed' };
  }

  const statuses = [
    data?.Status,
    data?.PaymentStatus,
    data?.TransactionStatus,
    data?.Data?.Status,
    data?.Data?.PaymentStatus,
  ];

  const hasSuccessFlag = [data?.Success, data?.IsSuccess, data?.Data?.Success, data?.Data?.IsSuccess].some((value) => value === true);
  const statusSuccess = statuses.some((status) => isSuccessStatus(status));
  const success = hasSuccessFlag || statusSuccess;

  return {
    success,
    data,
    message: success ? 'verified' : 'payment not verified as successful',
  };
}
