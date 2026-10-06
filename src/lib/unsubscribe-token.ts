import { createHmac, timingSafeEqual } from 'crypto';

// Signed unsubscribe links: the token proves the link came from one of our emails, so nobody
// can unsubscribe someone else by guessing an address. Server-only.

function secret() {
  const value = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('No secret available for unsubscribe tokens');
  return value;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function unsubscribeToken(email: string) {
  return createHmac('sha256', secret()).update(`unsubscribe:${normalizeEmail(email)}`).digest('base64url');
}

export function isValidUnsubscribeToken(email: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(String(token || ''));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(siteUrl: string, email: string) {
  const params = new URLSearchParams({ e: normalizeEmail(email), t: unsubscribeToken(email) });
  return `${siteUrl}/unsubscribe?${params.toString()}`;
}

export function unsubscribeApiUrl(siteUrl: string, email: string) {
  const params = new URLSearchParams({ e: normalizeEmail(email), t: unsubscribeToken(email) });
  return `${siteUrl}/api/unsubscribe?${params.toString()}`;
}
