"use client";

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquareText, PhoneCall, PlugZap, Users } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { cn } from '@/lib/utils';
import { NOTIFY_CHANNEL_LABELS, NOTIFY_KIND_LABELS, NOTIFY_TONE_CLASSES, notifyStatusInfo } from '@/lib/notification-labels';
import { adminFetch } from './useAdminAttention';
import { AdminEmpty, AdminError, AdminLoading, AdminPagination, AdminSectionTitle, formatDateTime } from './admin-ui';

// "הודעות SMS ושיחות": every SMS / voice call the site tried to send (notification_log), with
// filters, failures highlighted, and daily counts — so once the Twilio keys are added the owner
// can see whether messages actually go out. Data comes from the admin-only API route.

type Row = { id: number; created_at: string; channel: string; kind: string; status: string; error: string | null; provider_id: string | null; phone: string | null; user_name: string | null; user_role: 'seller' | 'customer' | null };
type Day = { date: string; sent: number; failed: number; skipped: number; pending: number };
type Payload = {
  installed: boolean;
  configured: { sms: boolean; voice: boolean };
  page?: number; pageSize?: number; total?: number; rows?: Row[]; daily?: Day[];
  last24?: { sent: number; failed: number; skipped: number; pending: number };
  subscribers?: { verified: number; sms: number; voice: number; marketing: number };
};

const STATUS_FILTERS = [
  { id: 'all', label: 'הכל' }, { id: 'sent', label: 'נשלחו' }, { id: 'failed', label: 'נכשלו' }, { id: 'skipped', label: 'דולגו' },
] as const;
const CHANNEL_FILTERS = [{ id: 'all', label: 'כל הערוצים' }, { id: 'sms', label: 'SMS' }, { id: 'voice', label: 'שיחות' }] as const;

// status colours (reserved meanings, always with a text legend): sent = good, failed = critical, skipped = neutral
const BAR = { sent: 'bg-emerald-500', failed: 'bg-red-500', skipped: 'bg-slate-300' };

function Chip({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'h-9 shrink-0 rounded-full border px-3.5 text-xs font-bold transition-colors',
        on ? (tone === 'danger' ? 'border-destructive bg-destructive text-white' : 'border-primary bg-primary text-primary-foreground')
          : 'border-primary/10 bg-white text-primary/70 hover:border-primary/30',
      )}
    >
      {children}
    </button>
  );
}

function StatusCard({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-[1.25rem] border p-4', ok ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-200 bg-amber-50')}>
      {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
      <div className="min-w-0">
        <p className={cn('text-sm font-black', ok ? 'text-emerald-900' : 'text-amber-900')}>{title}</p>
        <p className={cn('text-xs font-medium', ok ? 'text-emerald-800/80' : 'text-amber-900/80')}>{text}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-[1.25rem] border border-primary/5 bg-white p-4 shadow-sm">
      <p className={cn('text-2xl font-black tabular-nums', tone === 'bad' && value > 0 ? 'text-red-600' : tone === 'good' ? 'text-emerald-700' : 'text-primary')}>{value.toLocaleString('he-IL')}</p>
      <p className="mt-0.5 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function DailyChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.sent + d.failed + d.skipped));
  const total = days.reduce((s, d) => s + d.sent + d.failed + d.skipped, 0);
  if (total === 0) return <AdminEmpty compact title="לא נשלחו הודעות בשבועיים האחרונים" />;
  return (
    <div>
      <div className="flex h-36 items-end gap-1 sm:gap-1.5" role="img" aria-label="מספר הודעות ביום, 14 הימים האחרונים">
        {days.map((d) => {
          const sum = d.sent + d.failed + d.skipped;
          const label = new Date(d.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
          return (
            <div key={d.date} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${label}: ${d.sent} נשלחו · ${d.failed} נכשלו · ${d.skipped} דולגו`}>
              <div className="flex w-full max-w-[28px] flex-1 flex-col justify-end gap-[2px]">
                {(['failed', 'skipped', 'sent'] as const).map((k) => d[k] > 0 && (
                  <div key={k} className={cn('w-full first:rounded-t-[4px]', BAR[k])} style={{ height: `${(d[k] / max) * 100}%`, minHeight: 3 }} />
                ))}
              </div>
              <span className="mt-1 w-full truncate text-center text-[10px] font-semibold text-muted-foreground">{label}</span>
              {sum > 0 && (
                <span className="pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground shadow group-hover:block">
                  {d.sent} נשלחו · {d.failed} נכשלו · {d.skipped} דולגו
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> נשלחו</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> נכשלו</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> דולגו (לילה, שבת, הגבלה, Twilio לא מחובר)</span>
      </div>
    </div>
  );
}

export function AdminNotificationsPanel({ initialStatus }: { initialStatus?: string }) {
  const db = useSupabaseClient();
  const [status, setStatus] = useState<string>(STATUS_FILTERS.some((f) => f.id === initialStatus) ? initialStatus! : 'all');
  const [channel, setChannel] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), status, channel, kind });
      setData(await adminFetch(db, `/api/admin/notifications?${qs}`));
    } catch (e: any) {
      setError(e?.message || 'הטעינה נכשלה');
    } finally {
      setLoading(false);
    }
  }, [db, page, status, channel, kind]);

  useEffect(() => { load(); }, [load, reloadKey]);
  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  if (!data && loading) return <AdminLoading label="טוען את יומן ההודעות…" />;
  if (!data && error) return <AdminError message={`לא ניתן לטעון את יומן ההודעות: ${error}`} onRetry={() => setReloadKey((k) => k + 1)} />;
  if (data && !data.installed) {
    return (
      <AdminEmpty
        icon={<MessageSquareText className="h-5 w-5" />}
        title="הודעות SMS ושיחות עוד לא הותקנו במסד הנתונים"
        hint="יש להריץ את docs/sms-voice-notifications-migration.sql ב-Supabase. עד אז האתר שולח עדכונים במייל בלבד."
      />
    );
  }
  const d = data!;
  const rows = d.rows || [];
  const twilioOk = d.configured.sms || d.configured.voice;

  return (
    <div className="space-y-8" dir="rtl" data-admin-notifications>
      <section className="grid gap-3 md:grid-cols-2">
        <StatusCard
          ok={d.configured.sms}
          title={d.configured.sms ? 'SMS מחובר (Twilio)' : 'SMS לא מחובר'}
          text={d.configured.sms ? 'הודעות SMS יוצאות למי שאישר אותן.' : 'חסרים מפתחות Twilio ב-Vercel (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM). ההודעות נרשמות כ"דולג".'}
        />
        <StatusCard
          ok={d.configured.voice}
          title={d.configured.voice ? 'שיחות קוליות מחוברות' : 'שיחות קוליות לא מחוברות'}
          text={d.configured.voice ? 'שיחות יוצאות למי שאישר אותן (לא בלילה ולא בשבת).' : 'חסר TWILIO_VOICE_FROM (מספר Twilio) בהגדרות ב-Vercel.'}
        />
      </section>

      <section>
        <AdminSectionTitle hint="24 השעות האחרונות">סיכום</AdminSectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="נשלחו" value={d.last24?.sent ?? 0} tone="good" />
          <Stat label="נכשלו" value={d.last24?.failed ?? 0} tone="bad" />
          <Stat label="דולגו" value={d.last24?.skipped ?? 0} />
          <div className="rounded-[1.25rem] border border-primary/5 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-2xl font-black tabular-nums text-primary"><Users className="h-5 w-5 text-primary/30" />{d.subscribers?.verified ?? 0}</p>
            <p className="mt-0.5 text-xs font-bold text-muted-foreground">טלפונים מאומתים · {d.subscribers?.sms ?? 0} SMS · {d.subscribers?.voice ?? 0} שיחות · {d.subscribers?.marketing ?? 0} פרסומות</p>
          </div>
        </div>
        {!twilioOk && (d.last24?.skipped ?? 0) > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-800"><PlugZap className="h-4 w-4" /> ההודעות מדולגות כי Twilio עוד לא מחובר — אחרי הוספת המפתחות הן יתחילו לצאת.</p>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-primary/5 bg-white p-5 shadow-premium">
        <AdminSectionTitle hint="14 הימים האחרונים">הודעות לפי יום</AdminSectionTitle>
        <DailyChart days={d.daily || []} />
      </section>

      <section className="space-y-3">
        <AdminSectionTitle count={d.total}>יומן ההודעות</AdminSectionTitle>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.id} on={status === f.id} tone={f.id === 'failed' ? 'danger' : undefined} onClick={() => setFilter(() => setStatus(f.id))}>{f.label}</Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-primary/10" aria-hidden />
            {CHANNEL_FILTERS.map((f) => (
              <Chip key={f.id} on={channel === f.id} onClick={() => setFilter(() => setChannel(f.id))}>{f.label}</Chip>
            ))}
          </div>
          <select
            value={kind}
            onChange={(e) => setFilter(() => setKind(e.target.value))}
            className="h-10 rounded-xl border border-primary/10 bg-white px-3 text-sm font-semibold text-primary"
            aria-label="סוג ההודעה"
          >
            <option value="all">כל סוגי ההודעות</option>
            {Object.entries(NOTIFY_KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>

        {error && <AdminError message={`הרענון נכשל: ${error}`} onRetry={() => setReloadKey((k) => k + 1)} />}
        {rows.length === 0 ? (
          <AdminEmpty compact title={status === 'failed' ? 'אין הודעות שנכשלו' : 'אין הודעות להצגה'} hint={status !== 'all' || channel !== 'all' || kind !== 'all' ? 'נסה לשנות את הסינון.' : undefined} />
        ) : (
          <ul className={cn('divide-y divide-primary/5 overflow-hidden rounded-[1.5rem] border border-primary/5 bg-white shadow-premium', loading && 'opacity-60')}>
            {rows.map((r) => {
              const s = notifyStatusInfo(r.status);
              return (
                <li key={r.id} className={cn('flex flex-col gap-1.5 px-4 py-3 md:flex-row md:items-center md:gap-4', s.tone === 'failed' && 'bg-red-50/60')} data-notif-status={s.tone}>
                  <div className="flex items-center gap-2 md:w-56 md:shrink-0">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', r.channel === 'voice' ? 'bg-sky-50 text-sky-700' : 'bg-primary/5 text-primary/60')}>
                      {r.channel === 'voice' ? <PhoneCall className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-primary">{NOTIFY_KIND_LABELS[r.kind] || r.kind}</p>
                      <p className="text-[11px] font-medium text-muted-foreground">{NOTIFY_CHANNEL_LABELS[r.channel] || r.channel} · {formatDateTime(r.created_at)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-semibold text-primary">
                      {r.user_name || 'משתמש לא מזוהה'}
                      {r.user_role && <span className="font-medium text-muted-foreground"> · {r.user_role === 'seller' ? 'מוכר' : 'לקוח'}</span>}
                      {r.phone && <span className="ms-1.5 inline-block font-mono text-muted-foreground" dir="ltr">{r.phone}</span>}
                    </p>
                    {r.error && <p className="mt-0.5 flex items-start gap-1 font-medium text-red-700" dir="auto"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{r.error}</p>}
                  </div>
                  <span className={cn('w-fit shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold', NOTIFY_TONE_CLASSES[s.tone])}>{s.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        <AdminPagination current={page} total={d.total ?? 0} onChange={setPage} pageSize={d.pageSize ?? 25} />
      </section>
    </div>
  );
}
