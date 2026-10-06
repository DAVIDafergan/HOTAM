import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUnsubscribeToken, normalizeEmail } from '@/lib/unsubscribe-token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Records an opt-out from admin broadcasts. Used by the /unsubscribe page's button and by mail
// clients' one-click "unsubscribe" (RFC 8058: POST to the List-Unsubscribe URL). A GET never
// unsubscribes, so link scanners that open every URL in an email can't opt people out.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, { key: 'unsubscribe', maxRequests: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const params = req.nextUrl.searchParams;
  let email = params.get('e') || '';
  let token = params.get('t') || '';
  if (!email || !token) {
    try {
      const body = await req.json();
      email = String(body?.e || '');
      token = String(body?.t || '');
    } catch {}
  }
  if (!email || !token || !isValidUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: 'הקישור אינו תקין' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await service
    .from('email_unsubscribes')
    .upsert({ email: normalizeEmail(email) }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) {
    console.error('[unsubscribe] failed:', error.message);
    return NextResponse.json({ error: 'לא ניתן היה להשלים את ההסרה. נסו שוב מאוחר יותר.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
