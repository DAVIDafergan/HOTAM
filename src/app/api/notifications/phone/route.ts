import { NextResponse } from 'next/server';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { formatIsraeliPhone, isMobile, normalizeIsraeliPhone } from '@/lib/phone';
import { placeVoiceCall, sendSms, smsConfigured, voiceConfigured } from '@/lib/twilio';
import { quietReason } from '@/lib/quiet-hours';
import { getChannelPrefs, newOptOutToken, serviceClient } from '@/lib/notify-channels';

// The signed-in user's phone notification settings (SMS / voice call) — read, verify a number
// with a one-time code, switch channels on/off, or remove the number altogether.
//
// GET                                   → current settings
// POST { action: 'send-code', phone, channel: 'sms' | 'voice' }
// POST { action: 'verify', code }
// POST { action: 'prefs', sms?, voice?, marketing? }
// POST { action: 'remove' }
//
// Sending codes costs money and rings real phones, so it is limited in notification_log (which
// 'remove' and 'verify' never touch): per user, per number, and for the whole site per day. A send
// is reserved in the log before Twilio is called, so parallel requests can't slip through.

export const runtime = 'nodejs';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const LIMITS = {
  userGap: { window: MIN, max: 1 },     // one code a minute
  userHour: { window: HOUR, max: 5 },
  userDay: { window: DAY, max: 10 },
  phoneHour: { window: HOUR, max: 3 },  // the same number, from any account
  phoneDay: { window: DAY, max: 5 },
  siteDay: { window: DAY, max: 500 },   // safety net for the Twilio bill
};

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}
const hashCode = (userId: string, phone: string, code: string) =>
  createHmac('sha256', secret()).update(`phone-code:${userId}:${phone}:${code}`).digest('hex');

async function auth(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const service = serviceClient();
  if (!token || !service) return null;
  const { data: { user } } = await service.auth.getUser(token);
  return user ? { user, service } : null;
}

async function view(service: SupabaseClient, userId: string) {
  const { error: tableError } = await service.from('notification_channels').select('user_id').limit(1);
  const prefs = tableError ? null : await getChannelPrefs(service, userId);
  return {
    ready: !tableError, // false until the migration has been run
    available: { sms: smsConfigured(), voice: voiceConfigured() },
    phone: prefs?.phone ? formatIsraeliPhone(prefs.phone) : '',
    verified: !!(prefs?.phone && prefs.phone_verified_at),
    isMobile: prefs?.phone ? isMobile(prefs.phone) : true,
    sms: !!prefs?.sms_enabled,
    voice: !!prefs?.voice_enabled,
    marketing: !!prefs?.marketing_enabled,
  };
}

/** verify_code sends in the window, filtered by user or phone (or the whole site). */
async function codeCount(service: SupabaseClient, windowMs: number, by: { user_id?: string; phone?: string }) {
  let q = service
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'verify_code')
    .in('status', ['sent', 'reserved'])
    .gte('created_at', new Date(Date.now() - windowMs).toISOString());
  if (by.user_id) q = q.eq('user_id', by.user_id);
  if (by.phone) q = q.eq('phone', by.phone);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** The first limit that is exceeded (after counting this request's own reservation), or null. */
async function overLimit(service: SupabaseClient, userId: string, phone: string, includingMine: boolean) {
  const extra = includingMine ? 0 : 1; // before reserving, "would this one be too many?"
  const checks: [keyof typeof LIMITS, { user_id?: string; phone?: string }, string][] = [
    ['userGap', { user_id: userId }, 'קוד נשלח זה עתה. אפשר לבקש קוד חדש בעוד דקה.'],
    ['userHour', { user_id: userId }, 'נשלחו יותר מדי קודים. נסו שוב בעוד שעה.'],
    ['userDay', { user_id: userId }, 'נשלחו יותר מדי קודים היום. נסו שוב מחר.'],
    ['phoneHour', { phone }, 'נשלחו יותר מדי קודים למספר הזה. נסו שוב בעוד שעה.'],
    ['phoneDay', { phone }, 'נשלחו יותר מדי קודים למספר הזה היום. נסו שוב מחר.'],
    ['siteDay', {}, 'השירות עמוס כרגע. נסו שוב מאוחר יותר.'],
  ];
  for (const [key, by, message] of checks) {
    const { window, max } = LIMITS[key];
    if ((await codeCount(service, window, by)) + extra > max) return message;
  }
  return null;
}

export async function GET(req: Request) {
  const a = await auth(req);
  if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await view(a.service, a.user.id));
}

export async function POST(req: Request) {
  try {
    if (!checkRateLimit(getClientIp(req), { key: 'notif-phone', maxRequests: 30, windowMs: 60_000 })) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.' }, { status: 429 });
    }
    const a = await auth(req);
    if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, service } = a;
    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = String(body?.action || '');

    const { error: tableError } = await service.from('notification_channels').select('user_id').limit(1);
    if (tableError) return NextResponse.json({ error: 'האפשרות עדיין לא הופעלה באתר.' }, { status: 503 });

    if (action === 'send-code') {
      if (!checkRateLimit(getClientIp(req), { key: 'notif-send-code', maxRequests: 5, windowMs: HOUR })) {
        return NextResponse.json({ error: 'נשלחו יותר מדי קודים. נסו שוב בעוד שעה.' }, { status: 429 });
      }
      const phone = normalizeIsraeliPhone(body?.phone);
      const channel = body?.channel === 'voice' ? 'voice' : 'sms';
      if (!phone) return NextResponse.json({ error: 'מספר הטלפון אינו תקין. יש להזין מספר ישראלי, לדוגמה 050-1234567.' }, { status: 400 });
      if (channel === 'sms' && !isMobile(phone)) return NextResponse.json({ error: 'אפשר לקבל SMS רק במספר נייד. למספר נייח בחרו אימות בשיחה.' }, { status: 400 });
      if (channel === 'sms' ? !smsConfigured() : !voiceConfigured()) return NextResponse.json({ error: 'השירות עדיין לא הופעל באתר.' }, { status: 503 });
      const quiet = quietReason(channel);
      if (quiet === 'shabbat') return NextResponse.json({ error: 'בשבת ובחג לא שולחים הודעות. אפשר לאמת את המספר במוצאי שבת.' }, { status: 409 });
      if (quiet === 'night') return NextResponse.json({ error: 'בשעות הלילה לא מתקשרים. אפשר לקבל את הקוד ב-SMS, או לנסות שוב אחרי 08:00.' }, { status: 409 });

      const before = await overLimit(service, user.id, phone, false);
      if (before) return NextResponse.json({ error: before }, { status: 429 });
      // reserve the send, then re-check: concurrent requests now see each other
      const { data: reservation, error: reserveError } = await service
        .from('notification_log')
        .insert({ user_id: user.id, channel, kind: 'verify_code', phone, status: 'reserved' })
        .select('id')
        .single();
      if (reserveError || !reservation) throw new Error(reserveError?.message || 'reserve failed');
      const after = await overLimit(service, user.id, phone, true);
      if (after) {
        await service.from('notification_log').delete().eq('id', reservation.id);
        return NextResponse.json({ error: after }, { status: 429 });
      }

      const code = String(randomInt(100000, 1000000));
      const { error: saveError } = await service.from('phone_verifications').upsert({
        user_id: user.id,
        phone,
        channel,
        code_hash: hashCode(user.id, phone, code),
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        attempts: 0,
        last_sent_at: new Date().toISOString(),
      });
      if (saveError) {
        await service.from('notification_log').update({ status: 'failed', error: `save: ${saveError.message}` }).eq('id', reservation.id);
        return NextResponse.json({ error: 'אירעה שגיאה. נסו שוב.' }, { status: 500 });
      }
      const r = channel === 'sms'
        ? await sendSms(phone, `חותם - קוד אימות: ${code}`)
        : await placeVoiceCall(phone, `קוד האימות שלך באתר חותם הוא: ${code.split('').join(', ')}.`);
      await service.from('notification_log')
        .update({ status: r.ok ? 'sent' : 'failed', provider_id: r.ok ? r.sid : null, error: r.ok ? null : r.error })
        .eq('id', reservation.id);
      if (!r.ok) {
        console.error('[notifications/phone] code send failed:', r.error);
        return NextResponse.json({ error: channel === 'sms' ? 'שליחת ה-SMS נכשלה. בדקו את המספר ונסו שוב.' : 'השיחה לא יצאה. בדקו את המספר ונסו שוב.' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, phone: formatIsraeliPhone(phone), channel });
    }

    if (action === 'verify') {
      const code = String(body?.code || '').replace(/\D/g, '');
      const { data: pending } = await service.from('phone_verifications').select('*').eq('user_id', user.id).maybeSingle();
      if (!pending) return NextResponse.json({ error: 'לא נמצא קוד פעיל. בקשו קוד חדש.' }, { status: 400 });
      if (new Date(pending.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'תוקף הקוד פג. בקשו קוד חדש.' }, { status: 400 });
      if (pending.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'יותר מדי ניסיונות. בקשו קוד חדש.' }, { status: 429 });
      // count this attempt atomically (compare-and-set), before comparing the code
      const { data: counted } = await service
        .from('phone_verifications')
        .update({ attempts: pending.attempts + 1 })
        .eq('user_id', user.id)
        .eq('attempts', pending.attempts)
        .select('user_id');
      if (!counted || counted.length === 0) return NextResponse.json({ error: 'נסו שוב.' }, { status: 409 });
      const expected = Buffer.from(pending.code_hash);
      const given = Buffer.from(hashCode(user.id, pending.phone, code));
      if (code.length !== 6 || expected.length !== given.length || !timingSafeEqual(expected, given)) {
        return NextResponse.json({ error: 'הקוד שגוי. בדקו ונסו שוב.' }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      const existing = await getChannelPrefs(service, user.id);
      // Verifying a number switches nothing on by itself: the user's own toggles do (the settings
      // screen sends them right after). Changing the number keeps the existing choices, except that
      // a landline can't receive SMS.
      const { error: saveError } = await service.from('notification_channels').upsert({
        user_id: user.id,
        phone: pending.phone,
        phone_verified_at: nowIso,
        sms_enabled: !!existing?.sms_enabled && isMobile(pending.phone),
        voice_enabled: !!existing?.voice_enabled,
        marketing_enabled: !!existing?.marketing_enabled,
        optout_token: existing?.optout_token || newOptOutToken(),
        updated_at: nowIso,
      });
      if (saveError) return NextResponse.json({ error: 'אירעה שגיאה. נסו שוב.' }, { status: 500 });
      await service.from('phone_verifications').delete().eq('user_id', user.id);
      return NextResponse.json(await view(service, user.id));
    }

    if (action === 'prefs') {
      const prefs = await getChannelPrefs(service, user.id);
      const wantsOn = body?.sms === true || body?.voice === true || body?.marketing === true;
      if (wantsOn && !(prefs?.phone && prefs.phone_verified_at)) {
        return NextResponse.json({ error: 'קודם יש לאמת מספר טלפון.' }, { status: 400 });
      }
      if (body?.sms === true && !smsConfigured()) return NextResponse.json({ error: 'הודעות SMS עדיין לא הופעלו באתר.' }, { status: 503 });
      if (body?.voice === true && !voiceConfigured()) return NextResponse.json({ error: 'שיחות קוליות עדיין לא הופעלו באתר.' }, { status: 503 });
      if (body?.sms === true && prefs?.phone && !isMobile(prefs.phone)) {
        return NextResponse.json({ error: 'אפשר לקבל SMS רק במספר נייד.' }, { status: 400 });
      }
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (typeof body?.sms === 'boolean') { patch.sms_enabled = body.sms; if (body.sms) patch.sms_consent_at = nowIso; }
      if (typeof body?.voice === 'boolean') { patch.voice_enabled = body.voice; if (body.voice) patch.voice_consent_at = nowIso; }
      if (typeof body?.marketing === 'boolean') { patch.marketing_enabled = body.marketing; if (body.marketing) patch.marketing_consent_at = nowIso; }
      if (prefs) await service.from('notification_channels').update(patch).eq('user_id', user.id);
      return NextResponse.json(await view(service, user.id));
    }

    if (action === 'remove') {
      await Promise.all([
        service.from('notification_channels').delete().eq('user_id', user.id),
        service.from('phone_verifications').delete().eq('user_id', user.id),
      ]);
      return NextResponse.json(await view(service, user.id));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[notifications/phone] failed:', error?.message ?? error);
    return NextResponse.json({ error: 'אירעה שגיאה. נסו שוב.' }, { status: 500 });
  }
}
