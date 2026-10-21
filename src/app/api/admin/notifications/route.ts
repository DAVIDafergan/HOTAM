import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingTable, requireAdmin } from '@/lib/admin-api';
import { maskIsraeliPhone } from '@/lib/phone';
import { smsConfigured, voiceConfigured } from '@/lib/twilio';
import { NOTIFY_KIND_LABELS } from '@/lib/notification-labels';

// Admin-only view of the SMS / voice notifications (tables notification_channels and
// notification_log, which are locked to the service role). Phone numbers leave this route
// masked (050-•••-•567). Modes (GET ?mode=):
//   summary            counts for the "דורש טיפול" queue and the nav badge
//   user&userId=…      one user's phone settings and their latest messages (detail dialogs)
//   (default) list     paginated log with status / channel / kind filters + 14 daily counts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
const DAILY_DAYS = 14;
const DAY_MS = 864e5;
const LOG_COLUMNS = 'id, user_id, channel, kind, phone, status, provider_id, error, created_at';

const israelDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso));

function bucket(status: string) {
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  if (status === 'reserved') return 'pending';
  return 'skipped';
}

async function namesFor(service: SupabaseClient, ids: string[]) {
  const map = new Map<string, { name: string; role: 'seller' | 'customer' }>();
  if (ids.length === 0) return map;
  const [sellers, customers] = await Promise.all([
    service.from('sellers').select('id, first_name, last_name').in('id', ids),
    service.from('customers').select('id, first_name, last_name').in('id', ids),
  ]);
  for (const c of customers.data || []) map.set(String(c.id), { name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'לקוח', role: 'customer' });
  for (const s of sellers.data || []) map.set(String(s.id), { name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'מוכר', role: 'seller' });
  return map;
}

function publicRow(row: any, names?: Map<string, { name: string; role: 'seller' | 'customer' }>) {
  const who = row.user_id ? names?.get(String(row.user_id)) : undefined;
  return {
    id: row.id,
    created_at: row.created_at,
    channel: row.channel,
    kind: row.kind,
    status: row.status,
    error: row.error || null,
    provider_id: row.provider_id || null,
    phone: maskIsraeliPhone(row.phone) || null,
    user_id: row.user_id || null,
    user_name: who?.name || null,
    user_role: who?.role || null,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    const { service } = auth.ctx;
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'list';
    const configured = { sms: smsConfigured(), voice: voiceConfigured() };

    if (mode === 'summary') {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      const head = { count: 'exact' as const, head: true };
      // A HEAD count carries no error body, so probe with a tiny GET to tell "no table" apart.
      const probe = await service.from('notification_log').select('id').limit(1);
      if (isMissingTable(probe.error)) return NextResponse.json({ installed: false, configured });
      const [failed, sent] = await Promise.all([
        service.from('notification_log').select('id', head).eq('status', 'failed').gte('created_at', since),
        service.from('notification_log').select('id', head).eq('status', 'sent').gte('created_at', since),
      ]);
      if (failed.error || sent.error) return NextResponse.json({ error: 'שגיאה בקריאת יומן ההודעות' }, { status: 500 });
      return NextResponse.json({ installed: true, configured, failed24h: failed.count ?? 0, sent24h: sent.count ?? 0 });
    }

    if (mode === 'user') {
      const userId = String(url.searchParams.get('userId') || '').trim();
      if (!/^[\w-]{1,64}$/.test(userId)) return NextResponse.json({ error: 'Bad userId' }, { status: 400 });
      const [channel, recent] = await Promise.all([
        service.from('notification_channels')
          .select('phone, phone_verified_at, sms_enabled, voice_enabled, marketing_enabled, sms_consent_at, voice_consent_at, marketing_consent_at, updated_at')
          .eq('user_id', userId).maybeSingle(),
        service.from('notification_log').select(LOG_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      ]);
      if (isMissingTable(channel.error) || isMissingTable(recent.error)) return NextResponse.json({ installed: false, configured });
      const c: any = channel.data;
      return NextResponse.json({
        installed: true,
        configured,
        channel: c ? {
          phone: maskIsraeliPhone(c.phone) || null,
          verified_at: c.phone_verified_at,
          sms_enabled: !!c.sms_enabled,
          voice_enabled: !!c.voice_enabled,
          marketing_enabled: !!c.marketing_enabled,
          sms_consent_at: c.sms_consent_at,
          voice_consent_at: c.voice_consent_at,
          marketing_consent_at: c.marketing_consent_at,
          updated_at: c.updated_at,
        } : null,
        recent: (recent.data || []).map((r) => publicRow(r)),
      });
    }

    // ---- list ----
    const page = Math.max(1, Math.min(400, Number(url.searchParams.get('page')) || 1));
    const status = url.searchParams.get('status') || 'all';
    const channel = url.searchParams.get('channel') || 'all';
    const kind = url.searchParams.get('kind') || 'all';

    let q = service.from('notification_log').select(LOG_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (status === 'sent' || status === 'failed' || status === 'reserved') q = q.eq('status', status);
    else if (status === 'skipped') q = q.like('status', 'skipped:%');
    if (channel === 'sms' || channel === 'voice') q = q.eq('channel', channel);
    if (kind !== 'all' && kind in NOTIFY_KIND_LABELS) q = q.eq('kind', kind);

    const { data, count, error } = await q;
    if (isMissingTable(error)) return NextResponse.json({ installed: false, configured });
    if (error) throw new Error(error.message);

    // daily counts (Israel days) over a bounded window, read in pages of 1000
    const since = new Date(Date.now() - (DAILY_DAYS - 1) * DAY_MS);
    since.setUTCHours(0, 0, 0, 0);
    const daily = new Map<string, { sent: number; failed: number; skipped: number; pending: number }>();
    for (let d = 0; d < DAILY_DAYS; d++) daily.set(israelDay(new Date(Date.now() - d * DAY_MS).toISOString()), { sent: 0, failed: 0, skipped: 0, pending: 0 });
    const last24 = { sent: 0, failed: 0, skipped: 0, pending: 0 };
    const cutoff24 = Date.now() - DAY_MS;
    for (let from = 0; from < 10000; from += 1000) {
      const { data: rows, error: e } = await service.from('notification_log').select('created_at, status')
        .gte('created_at', since.toISOString()).order('created_at', { ascending: false }).range(from, from + 999);
      if (e) break;
      for (const r of rows || []) {
        const b = bucket(String(r.status)) as keyof typeof last24;
        const day = daily.get(israelDay(r.created_at));
        if (day) day[b]++;
        if (new Date(r.created_at).getTime() >= cutoff24) last24[b]++;
      }
      if (!rows || rows.length < 1000) break;
    }

    const { data: channels } = await service.from('notification_channels')
      .select('sms_enabled, voice_enabled, marketing_enabled').not('phone_verified_at', 'is', null).limit(10000);
    const subscribers = { verified: 0, sms: 0, voice: 0, marketing: 0 };
    for (const c of channels || []) {
      subscribers.verified++;
      if (c.sms_enabled) subscribers.sms++;
      if (c.voice_enabled) subscribers.voice++;
      if (c.marketing_enabled) subscribers.marketing++;
    }

    const rows = data || [];
    const names = await namesFor(service, Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean).map(String))));
    return NextResponse.json({
      installed: true,
      configured,
      page,
      pageSize: PAGE_SIZE,
      total: count ?? rows.length,
      rows: rows.map((r) => publicRow(r, names)),
      daily: Array.from(daily.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      last24,
      subscribers,
    });
  } catch (error: any) {
    console.error('[admin/notifications] error:', error?.message ?? error);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
}
