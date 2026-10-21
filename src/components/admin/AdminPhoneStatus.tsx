"use client";

import { useEffect, useState } from 'react';
import { BellRing, Loader2, Megaphone, MessageSquareText, PhoneCall } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { cn } from '@/lib/utils';
import { NOTIFY_CHANNEL_LABELS, NOTIFY_KIND_LABELS, NOTIFY_TONE_CLASSES, notifyStatusInfo } from '@/lib/notification-labels';
import { adminFetch } from './useAdminAttention';
import { formatDate, timeAgo } from './admin-ui';

// "עדכונים בטלפון" section of the customer / seller detail dialogs: the verified number (masked),
// which channels the user switched on, and their latest SMS / calls. Read via the admin-only
// /api/admin/notifications route — the tables themselves are closed to the browser.

type ChannelInfo = {
  phone: string | null; verified_at: string | null; sms_enabled: boolean; voice_enabled: boolean; marketing_enabled: boolean;
  sms_consent_at: string | null; voice_consent_at: string | null; marketing_consent_at: string | null;
};
type LogRow = { id: number; created_at: string; channel: string; kind: string; status: string; error: string | null };

function Toggle({ on, label, icon, since }: { on: boolean; label: string; icon: React.ReactNode; since?: string | null }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', on ? 'border-emerald-100 bg-emerald-50/70' : 'border-primary/5 bg-white')}>
      <span className={on ? 'text-emerald-700' : 'text-primary/30'}>{icon}</span>
      <div className="min-w-0">
        <p className={cn('text-xs font-bold', on ? 'text-emerald-800' : 'text-primary/60')}>{label}: {on ? 'פעיל' : 'כבוי'}</p>
        {on && since && <p className="text-[11px] text-emerald-700/70">הסכמה מ-{formatDate(since)}</p>}
      </div>
    </div>
  );
}

export function AdminPhoneStatus({ userId }: { userId: string }) {
  const db = useSupabaseClient();
  const [state, setState] = useState<{ loading: boolean; error?: string; installed?: boolean; channel?: ChannelInfo | null; recent?: LogRow[] }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    adminFetch(db, `/api/admin/notifications?mode=user&userId=${encodeURIComponent(userId)}`)
      .then((r) => { if (!cancelled) setState({ loading: false, installed: !!r.installed, channel: r.channel ?? null, recent: r.recent ?? [] }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, error: e?.message || 'הטעינה נכשלה' }); });
    return () => { cancelled = true; };
  }, [db, userId]);

  return (
    <section className="space-y-3" data-admin-phone-status>
      <h3 className="flex items-center gap-2 text-sm font-black text-primary"><BellRing className="h-4 w-4 text-accent-strong" /> עדכונים בטלפון (SMS ושיחות)</h3>
      {state.loading ? (
        <p className="flex items-center gap-2 rounded-2xl bg-primary/[0.03] p-4 text-xs font-bold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> טוען…</p>
      ) : state.error ? (
        <p className="rounded-2xl bg-destructive/5 p-4 text-xs font-bold text-destructive">לא ניתן לטעון את הגדרות הטלפון: {state.error}</p>
      ) : !state.installed ? (
        <p className="rounded-2xl bg-primary/[0.03] p-4 text-xs font-medium text-muted-foreground">התכונה עוד לא הותקנה במסד הנתונים (מיגרציית SMS ושיחות).</p>
      ) : !state.channel?.verified_at ? (
        <p className="rounded-2xl bg-primary/[0.03] p-4 text-xs font-medium text-muted-foreground">המשתמש לא אימת מספר טלפון לעדכונים — מקבל עדכונים במייל בלבד.</p>
      ) : (
        <div className="space-y-3 rounded-2xl bg-primary/[0.03] p-4">
          <p className="text-xs font-bold text-primary">
            מספר מאומת: <span dir="ltr" className="font-mono">{state.channel.phone}</span>
            <span className="font-medium text-muted-foreground"> · אומת ב-{formatDate(state.channel.verified_at)}</span>
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Toggle on={state.channel.sms_enabled} label="SMS" icon={<MessageSquareText className="h-4 w-4" />} since={state.channel.sms_consent_at} />
            <Toggle on={state.channel.voice_enabled} label="שיחה קולית" icon={<PhoneCall className="h-4 w-4" />} since={state.channel.voice_consent_at} />
            <Toggle on={state.channel.marketing_enabled} label="פרסומות" icon={<Megaphone className="h-4 w-4" />} since={state.channel.marketing_consent_at} />
          </div>
        </div>
      )}
      {!!state.recent?.length && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">הודעות אחרונות</p>
          <ul className="divide-y divide-primary/5 rounded-2xl border border-primary/5 bg-white">
            {state.recent.map((r) => {
              const s = notifyStatusInfo(r.status);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', NOTIFY_TONE_CLASSES[s.tone])}>{s.label}</span>
                  <span className="font-bold text-primary">{NOTIFY_KIND_LABELS[r.kind] || r.kind}</span>
                  <span className="text-muted-foreground">{NOTIFY_CHANNEL_LABELS[r.channel] || r.channel}</span>
                  <span className="ms-auto text-muted-foreground">{timeAgo(r.created_at)}</span>
                  {r.error && <span className="w-full text-[11px] font-medium text-red-700" dir="auto">{r.error}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
