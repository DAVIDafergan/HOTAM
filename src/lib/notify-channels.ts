import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import { placeVoiceCall, sendSms } from '@/lib/twilio';
import { quietReason } from '@/lib/quiet-hours';

// SMS / voice copies of the updates we email. Email stays the main channel: these run after the
// email and independently of it, and they never throw, so a Twilio problem can't stop an email.
// Users opt in per channel in their dashboard (table notification_channels); nobody gets an SMS
// or a call without a verified number and the channel switched on.

export type NotifyKind =
  | 'chat' | 'order_paid_buyer' | 'order_paid_seller' | 'order_reminder'
  | 'account' | 'broadcast' | 'verify_code';

export interface PhoneMessage {
  /** SMS text. Keep it short: Hebrew SMS segments are 70 characters. A link is fine. */
  sms: string;
  /** What the call says (plain Hebrew sentences, no links). */
  voice: string;
}

export interface ChannelPrefs {
  phone: string | null;
  phone_verified_at: string | null;
  sms_enabled: boolean;
  voice_enabled: boolean;
  marketing_enabled: boolean;
}

export function siteUrl() {
  const value = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(value) ? value : 'https://www.hotam.shop';
}

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function getChannelPrefs(service: SupabaseClient, userId: string): Promise<ChannelPrefs | null> {
  const { data, error } = await service
    .from('notification_channels')
    .select('phone, phone_verified_at, sms_enabled, voice_enabled, marketing_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null; // e.g. migration not run yet → behave as "no phone channels"
  return data as ChannelPrefs | null;
}

/** sellers / customers share one auth user id; find it from an email address. */
export async function userIdByEmail(service: SupabaseClient, email: string): Promise<string | null> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  const [{ data: s }, { data: c }] = await Promise.all([
    // ilike = case-insensitive exact match; escape its wildcards (an email may contain "_")
    service.from('sellers').select('id').ilike('email', e.replace(/[\\%_]/g, '\\$&')).limit(1).maybeSingle(),
    service.from('customers').select('id').ilike('email', e.replace(/[\\%_]/g, '\\$&')).limit(1).maybeSingle(),
  ]);
  return (s as any)?.id || (c as any)?.id || null;
}

export async function logAttempt(service: SupabaseClient, row: { user_id: string | null; channel: 'sms' | 'voice'; kind: NotifyKind; status: string; provider_id?: string | null; error?: string | null }) {
  try { await service.from('notification_log').insert(row); } catch { /* logging must never break a send */ }
}

/* ---------------- signed opt-out links for SMS (short, so they fit in a text) ---------------- */

function secret() {
  const v = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error('No secret available for opt-out links');
  return v;
}
const sign = (userId: string) => createHmac('sha256', secret()).update(`phone-optout:${userId}`).digest('base64url').slice(0, 16);

export function optOutToken(userId: string) {
  return `${Buffer.from(userId.replace(/-/g, ''), 'hex').toString('base64url')}.${sign(userId)}`;
}

export function userIdFromOptOutToken(token: string): string | null {
  const [idPart, sig] = String(token || '').split('.');
  if (!idPart || !sig) return null;
  const hex = Buffer.from(idPart, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  const userId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const a = Buffer.from(sign(userId)), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

export const optOutUrl = (userId: string) => `${siteUrl().replace(/^https?:\/\/(www\.)?/, '')}/p/${optOutToken(userId)}`;

/* ----------------------------------------- sending ----------------------------------------- */

const clean = (s: string) => s
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/ ([,.!?:;])/g, '$1')
  .replace(/\s*\n\s*/g, '\n')
  .trim();

/**
 * Sends the SMS and/or call this user asked for. Never throws. `marketing` messages need the
 * separate marketing consent and are marked "פרסומת" as Israeli law requires.
 */
export async function notifyUser(opts: {
  userId: string | null | undefined;
  kind: NotifyKind;
  message: PhoneMessage;
  marketing?: boolean;
  service?: SupabaseClient | null;
  prefs?: ChannelPrefs | null;
}): Promise<{ sms?: string; voice?: string }> {
  const result: { sms?: string; voice?: string } = {};
  try {
    const service = opts.service ?? serviceClient();
    if (!service || !opts.userId) return result;
    const prefs = opts.prefs ?? await getChannelPrefs(service, opts.userId);
    if (!prefs?.phone || !prefs.phone_verified_at) return result;
    if (opts.marketing && !prefs.marketing_enabled) return result;

    const jobs: Promise<void>[] = [];
    if (prefs.sms_enabled) {
      jobs.push((async () => {
        const quiet = quietReason('sms', { marketing: opts.marketing });
        if (quiet) { result.sms = `skipped:${quiet}`; await logAttempt(service, { user_id: opts.userId!, channel: 'sms', kind: opts.kind, status: result.sms }); return; }
        let body = clean(opts.message.sms);
        if (opts.marketing) body = `פרסומת: ${body}`;
        body += `\nלהסרה: ${optOutUrl(opts.userId!)}`;
        const r = await sendSms(prefs.phone!, body);
        result.sms = r.ok ? 'sent' : (r.error === 'not-configured' ? 'skipped:not-configured' : 'failed');
        await logAttempt(service, { user_id: opts.userId!, channel: 'sms', kind: opts.kind, status: r.ok ? 'sent' : (r.error === 'not-configured' ? 'skipped:not-configured' : 'failed'), provider_id: r.ok ? r.sid : null, error: r.ok ? null : r.error });
      })());
    }
    if (prefs.voice_enabled) {
      jobs.push((async () => {
        const quiet = quietReason('voice', { marketing: opts.marketing });
        if (quiet) { result.voice = `skipped:${quiet}`; await logAttempt(service, { user_id: opts.userId!, channel: 'voice', kind: opts.kind, status: result.voice }); return; }
        const intro = opts.marketing ? 'שלום, זוהי הודעת פרסומת מאתר חותם.' : 'שלום, זוהי הודעה מאתר חותם.';
        const outro = 'להפסקת השיחות, אפשר לבטל בכל רגע בהגדרות באזור האישי באתר חותם. תודה ולהתראות.';
        const r = await placeVoiceCall(prefs.phone!, `${intro} ${clean(opts.message.voice)} ${outro}`);
        result.voice = r.ok ? 'sent' : (r.error === 'not-configured' ? 'skipped:not-configured' : 'failed');
        await logAttempt(service, { user_id: opts.userId!, channel: 'voice', kind: opts.kind, status: r.ok ? 'sent' : (r.error === 'not-configured' ? 'skipped:not-configured' : 'failed'), provider_id: r.ok ? r.sid : null, error: r.ok ? null : r.error });
      })());
    }
    await Promise.allSettled(jobs);
  } catch (error: any) {
    console.error('[notify-channels] failed:', error?.message ?? error);
  }
  return result;
}

/** Same, by email address (for flows that only know the recipient's email). */
export async function notifyEmailOwner(email: string, kind: NotifyKind, message: PhoneMessage, extra: { marketing?: boolean } = {}) {
  try {
    const service = serviceClient();
    if (!service) return {};
    const userId = await userIdByEmail(service, email);
    return await notifyUser({ userId, kind, message, service, ...extra });
  } catch { return {}; }
}

/**
 * Runs phone notifications after the response is sent (so the request isn't slowed down and an
 * error there can't affect it). Falls back to fire-and-forget outside a request scope.
 */
export function afterResponse(task: () => Promise<unknown>) {
  const run = () => task().catch((error) => console.error('[notify-channels] background task failed:', error?.message ?? error));
  try { after(run); } catch { void run(); }
}

/** Short, speakable text from an email body: no URLs, no emojis, at most `max` characters. */
export function speakable(text: string, max = 350) {
  // drop links together with a label in front of them ("לפרטים: https://…"), and markdown marks
  const s = clean(String(text || '').replace(/(\S+:\s*)?(https?:\/\/|www\.)\S+/g, '').replace(/[*_#>`]/g, '')).replace(/\n+/g, ' ');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')) + ' לפרטים המלאים, בדקו את תיבת המייל.';
}
