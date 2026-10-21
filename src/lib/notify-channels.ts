import 'server-only';
import { randomBytes } from 'crypto';
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
  /** SMS text. Keep it short: Hebrew SMS segments are 67 characters. A link is fine. */
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
  optout_token?: string | null;
}

/** How many phone updates of one kind a recipient may get (counted in notification_log). */
export interface Throttle { perHour?: number; perDay?: number }

const PREF_COLUMNS = 'phone, phone_verified_at, sms_enabled, voice_enabled, marketing_enabled, optout_token';

export function siteUrl() {
  const value = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(value) ? value : 'https://www.hotam.shop';
}

/** hotam.shop/… without scheme or www — phones turn it into a link, and it costs fewer characters. */
export const shortSite = () => siteUrl().replace(/^https?:\/\/(www\.)?/, '');

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function getChannelPrefs(service: SupabaseClient, userId: string): Promise<ChannelPrefs | null> {
  const { data, error } = await service.from('notification_channels').select(PREF_COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) return null; // e.g. migration not run yet → behave as "no phone channels"
  return data as ChannelPrefs | null;
}

/** sellers / customers share one auth user id; find it from an email address. */
export async function userIdByEmail(service: SupabaseClient, email: string): Promise<string | null> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  // ilike = case-insensitive exact match; escape its wildcards (an email may contain "_")
  const pattern = e.replace(/[\\%_]/g, '\\$&');
  const [{ data: s }, { data: c }] = await Promise.all([
    service.from('sellers').select('id').ilike('email', pattern).limit(1).maybeSingle(),
    service.from('customers').select('id').ilike('email', pattern).limit(1).maybeSingle(),
  ]);
  return (s as any)?.id || (c as any)?.id || null;
}

export async function logAttempt(service: SupabaseClient, row: { user_id: string | null; channel: 'sms' | 'voice'; kind: NotifyKind; status: string; phone?: string | null; provider_id?: string | null; error?: string | null }) {
  try { await service.from('notification_log').insert(row); } catch { /* logging must never break a send */ }
}

/** Phone updates of this kind that went (or are going) to this user since `sinceMs` ago. */
async function recentCount(service: SupabaseClient, userId: string, kind: NotifyKind, sinceMs: number) {
  const { count } = await service
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .in('status', ['sent', 'reserved'])
    .gte('created_at', new Date(Date.now() - sinceMs).toISOString());
  return count ?? 0;
}

async function throttled(service: SupabaseClient, userId: string, kind: NotifyKind, t?: Throttle) {
  if (!t) return false;
  if (t.perHour != null && (await recentCount(service, userId, kind, 3600_000)) >= t.perHour) return true;
  if (t.perDay != null && (await recentCount(service, userId, kind, 86_400_000)) >= t.perDay) return true;
  return false;
}

/* ------------- short opt-out links for SMS ("להסרה: hotam.shop/p/<10 chars>") ------------- */

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newOptOutToken(len = 10) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** The user's opt-out token, created on first use. */
export async function ensureOptOutToken(service: SupabaseClient, userId: string, prefs?: ChannelPrefs | null) {
  if (prefs?.optout_token) return prefs.optout_token;
  for (let i = 0; i < 3; i++) {
    const token = newOptOutToken();
    const { error } = await service.from('notification_channels').update({ optout_token: token }).eq('user_id', userId).is('optout_token', null);
    if (!error) {
      const { data } = await service.from('notification_channels').select('optout_token').eq('user_id', userId).maybeSingle();
      if ((data as any)?.optout_token) return String((data as any).optout_token);
    }
  }
  return null;
}

export const optOutUrl = (token: string) => `${shortSite()}/p/${token}`;

/* ------------------------------------- text helpers ------------------------------------- */

// emojis, XML-invalid control characters, extra spaces
const clean = (s: string) => String(s ?? '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F￾￿]/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/ ([,.!?:;])/g, '$1')
  .replace(/\s*\n\s*/g, '\n')
  .trim();

/**
 * A user-written name that goes into an SMS or a call: letters, spaces and a few marks only (no
 * links, no digits, no phone numbers), at most `max` characters. Someone can't use their display
 * name to send a link or a message under the site's name.
 */
export function safeName(name: unknown, fallback = 'משתמש/ת באתר', max = 25) {
  const s = clean(String(name ?? ''))
    .replace(/(https?:\/\/|www\.)\S*/gi, ' ')
    .replace(/\S+\.(com|co|il|net|org|ly|me|io|shop|link|app)\S*/gi, ' ')
    .replace(/[^\p{L}\s'"׳״\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return s.length >= 2 ? s : fallback;
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

/* ----------------------------------------- sending ----------------------------------------- */

/**
 * Sends the SMS and/or call this user asked for. Never throws.
 *  - `marketing`: needs the separate marketing consent; marked "פרסומת" as Israeli law requires.
 *  - `bulk`: mailings — no SMS at night either (calls are never placed at night).
 *  - `throttle`: at most N of this kind per hour / day to this recipient.
 */
export async function notifyUser(opts: {
  userId: string | null | undefined;
  kind: NotifyKind;
  message: PhoneMessage;
  marketing?: boolean;
  bulk?: boolean;
  throttle?: Throttle;
  service?: SupabaseClient | null;
  prefs?: ChannelPrefs | null;
}): Promise<{ sms?: string; voice?: string }> {
  const result: { sms?: string; voice?: string } = {};
  try {
    const service = opts.service ?? serviceClient();
    if (!service || !opts.userId) return result;
    const userId = opts.userId;
    const prefs = opts.prefs ?? await getChannelPrefs(service, userId);
    if (!prefs?.phone || !prefs.phone_verified_at) return result;
    if (opts.marketing && !prefs.marketing_enabled) return result;
    if (!prefs.sms_enabled && !prefs.voice_enabled) return result;
    if (await throttled(service, userId, opts.kind, opts.throttle)) {
      for (const ch of ['sms', 'voice'] as const) {
        if (ch === 'sms' ? prefs.sms_enabled : prefs.voice_enabled) {
          result[ch] = 'skipped:throttled';
          await logAttempt(service, { user_id: userId, channel: ch, kind: opts.kind, status: 'skipped:throttled', phone: prefs.phone });
        }
      }
      return result;
    }
    const bulk = !!(opts.bulk || opts.marketing);
    const outcome = (r: { ok: boolean; error?: string }) => r.ok ? 'sent' : (r.error === 'not-configured' ? 'skipped:not-configured' : 'failed');

    const jobs: Promise<void>[] = [];
    if (prefs.sms_enabled) {
      jobs.push((async () => {
        const quiet = quietReason('sms', { bulk });
        if (quiet) { result.sms = `skipped:${quiet}`; await logAttempt(service, { user_id: userId, channel: 'sms', kind: opts.kind, status: result.sms, phone: prefs.phone }); return; }
        const token = await ensureOptOutToken(service, userId, prefs);
        if (!token) { result.sms = 'skipped:no-optout-link'; await logAttempt(service, { user_id: userId, channel: 'sms', kind: opts.kind, status: result.sms, phone: prefs.phone }); return; }
        let body = clean(opts.message.sms);
        if (opts.marketing) body = `פרסומת: ${body}`;
        body += `\nלהסרה: ${optOutUrl(token)}`;
        const r = await sendSms(prefs.phone!, body);
        result.sms = outcome(r);
        await logAttempt(service, { user_id: userId, channel: 'sms', kind: opts.kind, status: result.sms, phone: prefs.phone, provider_id: r.ok ? r.sid : null, error: r.ok ? null : r.error });
      })());
    }
    if (prefs.voice_enabled) {
      jobs.push((async () => {
        const quiet = quietReason('voice', { bulk });
        if (quiet) { result.voice = `skipped:${quiet}`; await logAttempt(service, { user_id: userId, channel: 'voice', kind: opts.kind, status: result.voice, phone: prefs.phone }); return; }
        const intro = opts.marketing ? 'שלום, זוהי הודעת פרסומת מאתר חותם.' : 'שלום, זוהי הודעה מאתר חותם.';
        const outro = 'להפסקת השיחות, אפשר לבטל בכל רגע בהגדרות באזור האישי באתר חותם. תודה ולהתראות.';
        const r = await placeVoiceCall(prefs.phone!, `${intro} ${speakable(opts.message.voice, 600)} ${outro}`);
        result.voice = outcome(r);
        await logAttempt(service, { user_id: userId, channel: 'voice', kind: opts.kind, status: result.voice, phone: prefs.phone, provider_id: r.ok ? r.sid : null, error: r.ok ? null : r.error });
      })());
    }
    await Promise.allSettled(jobs);
  } catch (error: any) {
    console.error('[notify-channels] failed:', error?.message ?? error);
  }
  return result;
}

/** Same, by email address (for flows that only know the recipient's email). */
export async function notifyEmailOwner(email: string, kind: NotifyKind, message: PhoneMessage, extra: { marketing?: boolean; throttle?: Throttle } = {}) {
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
