import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/notify-channels';

// "להסרה" link at the bottom of every SMS: turns off SMS, calls and promotional messages for that
// user. Only the button on /p/<token> calls this (POST), so link scanners can't opt anyone out.
// The token is a random 10-character value stored with the user's settings.
export async function POST(req: Request) {
  if (!checkRateLimit(getClientIp(req), { key: 'phone-optout', maxRequests: 20, windowMs: 60_000 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  let token = '';
  try { token = String((await req.json())?.t || ''); } catch {}
  if (!/^[A-Za-z0-9]{10}$/.test(token)) return NextResponse.json({ error: 'הקישור אינו תקין' }, { status: 400 });
  const service = serviceClient();
  if (!service) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  const { data, error } = await service
    .from('notification_channels')
    .update({ sms_enabled: false, voice_enabled: false, marketing_enabled: false, updated_at: new Date().toISOString() })
    .eq('optout_token', token)
    .select('user_id');
  if (error) {
    console.error('[notifications/opt-out] failed:', error.message);
    return NextResponse.json({ error: 'לא ניתן היה להשלים את ההסרה. נסו שוב מאוחר יותר.' }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'הקישור אינו תקין' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
