type RateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __hotamRateLimitMap: Map<string, RateLimitEntry> | undefined;
}

const rateLimitMap = globalThis.__hotamRateLimitMap ?? new Map<string, RateLimitEntry>();
globalThis.__hotamRateLimitMap = rateLimitMap;

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
}

export function checkRateLimit(
  ip: string,
  options?: { key?: string; maxRequests?: number; windowMs?: number },
): boolean {
  const now = Date.now();
  const maxRequests = options?.maxRequests ?? 5;
  const windowMs = options?.windowMs ?? 60_000;
  const key = options?.key ?? 'default';
  const id = `${key}:${ip}`;
  const record = rateLimitMap.get(id);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}
