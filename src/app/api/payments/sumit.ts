export const FALLBACK_SUMIT_API_BASE_URL = 'https://api.sumit.co.il';
const SUMIT_BASE_URL = (process.env.SUMIT_BASE_URL || FALLBACK_SUMIT_API_BASE_URL).replace(/\/+$/, '');

export class SumitApiError extends Error {
  status: number;
  payload: any;

  constructor(message: string, status: number, payload: any) {
    super(message);
    this.name = 'SumitApiError';
    this.status = status;
    this.payload = payload;
  }
}

function resolveSumitBaseUrl(overrideBaseUrl?: string) {
  const candidate = (overrideBaseUrl || SUMIT_BASE_URL).trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname.toLowerCase() === 'help.sumit.co.il') {
      return FALLBACK_SUMIT_API_BASE_URL;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return FALLBACK_SUMIT_API_BASE_URL;
  }
}

function buildSumitUrl(path: string, overrideBaseUrl?: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${resolveSumitBaseUrl(overrideBaseUrl)}${normalizedPath}`;
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
  sumitBaseUrl?: string;
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

  if (!businessId || !privateKey) {
    throw new Error(
      'Missing SUMIT credentials: SUMMIT_BUSINESS_ID and SUMMIT_PRIVATE_KEY (or SUMIT_BUSINESS_ID and SUMIT_PRIVATE_KEY) environment variables are required'
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
    payload?.Data?.RedirectURL ||
    payload?.Data?.RedirectUrl ||
    payload?.data?.RedirectURL ||
    payload?.data?.RedirectUrl ||
    payload?.Data?.PaymentURL ||
    payload?.data?.PaymentURL ||
    null
  );
}

function getSumitErrorMessage(payload: any) {
  return payload?.ErrorMessage || payload?.Message || payload?.error || JSON.stringify(payload);
}

function normalizeStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function isSuccessStatus(status: unknown) {
  const normalized = normalizeStatus(status);
  return ['success', 'succeeded', 'paid', 'approved', 'completed'].includes(normalized);
}

export async function startSumitSession(input: StartSessionInput) {
  const { businessId, privateKey } = getSumitCredentials();
  const redirectURL = new URL(
    `/customer/dashboard?payment=success&orderId=${encodeURIComponent(input.orderId)}`,
    input.siteBaseUrl
  ).toString();
  const ipnURL = new URL(
    `/api/payments/webhook?orderId=${encodeURIComponent(input.orderId)}`,
    input.siteBaseUrl
  ).toString();

  const payload = {
    Credentials: {
      CompanyID: businessId,
      APIKey: privateKey,
    },
    Amount: Number(input.amount),
    Customer: {
      ExternalIdentifier: input.orderId,
      Name: input.buyerName || '',
      Email: input.buyerEmail || '',
      Phone: input.buyerPhone || '',
    },
    Items: {
      Item: [
        {
          Name: input.productName,
          Price: Number(input.amount),
          Quantity: 1,
        },
      ],
    },
    RedirectURL: redirectURL,
    IPNURL: ipnURL,
  };

  const response = await fetch(buildSumitUrl('/billing/payments/beginredirect/', input.sumitBaseUrl), {
    method: 'POST',
    headers: {
      'User-Agent': 'Hotam-Marketplace/1.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseClone = response.clone();
  let data: any = {};
  try {
    data = await response.json();
  } catch {
    const rawText = await responseClone.text();
    data = rawText ? { raw: rawText } : {};
  }

  if (!response.ok) {
    throw new SumitApiError(getSumitErrorMessage(data) || 'SUMIT beginredirect failed', response.status, data);
  }

  const paymentUrl = extractPaymentUrl(data);
  if (!paymentUrl) {
    console.error('SUMIT RAW RESPONSE:', data);
    throw new SumitApiError(getSumitErrorMessage(data), 400, data);
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
