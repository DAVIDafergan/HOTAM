"use client";

import { useEffect, useMemo, useState } from 'react';
import { Search, Users, TrendingDown, X } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const EVENTS_PAGE_SIZE = 25;
const FUNNEL_SAMPLE_LIMIT = 1000;

interface EventRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_role: string | null;
  session_id: string | null;
  event_type: string;
  event_data: Record<string, any>;
}

const EVENT_LABELS: Record<string, string> = {
  seller_onboarding_step_viewed: 'צפייה בשלב הרשמה',
  seller_onboarding_completed: 'הרשמת סופר הושלמה',
  product_created: 'מוצר נוצר',
  product_updated: 'מוצר עודכן',
  product_deleted: 'מוצר נמחק',
  customer_profile_updated: 'פרופיל לקוח עודכן',
};

function eventLabel(type: string) {
  return EVENT_LABELS[type] || type;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Cursor-based pagination (created_at < cursor) rather than the limit(1000)-then-slice
// pattern the rest of the admin dashboard uses today — this table is expected to grow much
// faster than any other (every step view, every save), so it needed real pagination from
// the start rather than fetching an ever-larger fixed window.
export function AdminActivityPanel() {
  const db = useSupabaseClient();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  const loadPage = async (reset: boolean) => {
    setIsLoading(true);
    let q = db.from('activity_events').select('*').order('created_at', { ascending: false }).limit(EVENTS_PAGE_SIZE);
    if (!reset && cursor) q = q.lt('created_at', cursor);
    if (typeFilter !== 'all') q = q.eq('event_type', typeFilter);
    if (actorFilter) q = q.eq('actor_id', actorFilter.id);
    const { data, error } = await q;
    setIsLoading(false);
    if (error || !data) { if (reset) setEvents([]); setHasMore(false); return; }
    setEvents((prev) => (reset ? data : [...prev, ...data]));
    setCursor(data.length > 0 ? data[data.length - 1].created_at : null);
    setHasMore(data.length === EVENTS_PAGE_SIZE);

    const ids = Array.from(new Set(data.map((e: EventRow) => e.actor_id).filter(Boolean))) as string[];
    const missing = ids.filter((id) => !profileNames[id]);
    if (missing.length > 0) {
      const { data: profiles } = await db.from('profiles').select('id, full_name').in('id', missing);
      if (profiles) {
        setProfileNames((prev) => {
          const next = { ...prev };
          profiles.forEach((p: any) => { next[p.id] = p.full_name || 'משתמש'; });
          return next;
        });
      }
    }
  };

  useEffect(() => {
    setCursor(null);
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, actorFilter]);

  const nameFor = (id: string | null) => (id ? profileNames[id] || '...' : 'אנונימי');

  const visibleEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const term = searchTerm.trim().toLowerCase();
    return events.filter((e) => nameFor(e.actor_id).toLowerCase().includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, searchTerm, profileNames]);

  return (
    <div className="space-y-5">
      <FunnelSummary db={db} />

      <div className="flex flex-wrap items-center gap-3 rounded-[1.75rem] bg-white border p-4 shadow-premium">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-full bg-primary/[0.03] px-4 h-11">
          <Search className="w-4 h-4 text-primary/40 shrink-0" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם משתמש (בדף הנוכחי)..."
            className="border-none bg-transparent h-auto p-0 shadow-none focus-visible:ring-0 text-sm font-bold"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-11 rounded-full border-2 border-primary/10 px-4 text-[11px] font-black text-primary bg-white"
        >
          <option value="all">כל סוגי הפעולות</option>
          {Object.entries(EVENT_LABELS).map(([type, label]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
        {actorFilter && (
          <button
            type="button"
            onClick={() => setActorFilter(null)}
            className="flex items-center gap-1.5 h-11 rounded-full bg-accent/15 text-accent-strong px-4 text-[11px] font-black"
          >
            <Users className="w-3.5 h-3.5" /> {actorFilter.name} <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="rounded-[1.75rem] bg-white border shadow-premium overflow-hidden">
        <div className="divide-y">
          {visibleEvents.length === 0 && !isLoading && (
            <p className="p-10 text-center text-sm font-bold text-muted-foreground italic">אין אירועים תואמים.</p>
          )}
          {visibleEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-4 p-4">
              <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={!e.actor_id}
                    onClick={() => e.actor_id && setActorFilter({ id: e.actor_id, name: nameFor(e.actor_id) })}
                    className={cn(
                      "text-xs font-black",
                      e.actor_id ? "text-primary hover:text-accent-strong hover:underline" : "text-muted-foreground italic",
                    )}
                  >
                    {nameFor(e.actor_id)}
                  </button>
                  {e.actor_role && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-primary/5 rounded-full px-2 py-0.5">
                      {e.actor_role}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-primary/70 mt-1">{eventLabel(e.event_type)}</p>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground shrink-0">{formatDateTime(e.created_at)}</span>
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="p-4 border-t text-center">
            <button
              type="button"
              onClick={() => loadPage(false)}
              disabled={isLoading}
              className="h-10 px-6 rounded-full bg-primary/5 text-primary text-[11px] font-black hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'טוען...' : 'טען עוד'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function FunnelSummary({ db }: { db: ReturnType<typeof useSupabaseClient> }) {
  const [counts, setCounts] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.from('activity_events')
      .select('event_data')
      .eq('event_type', 'seller_onboarding_step_viewed')
      .order('created_at', { ascending: false })
      .limit(FUNNEL_SAMPLE_LIMIT)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const perStep = [0, 0, 0, 0];
        data.forEach((row: any) => {
          const step = row.event_data?.step;
          if (typeof step === 'number' && step >= 1 && step <= 4) perStep[step - 1] += 1;
        });
        setCounts(perStep);
      });
    return () => { cancelled = true; };
  }, [db]);

  if (!counts) return null;
  const total = counts[0] || 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {counts.map((count, i) => {
        const pct = Math.round((count / total) * 100);
        const isFirst = i === 0;
        return (
          <div key={i} className="rounded-[1.5rem] bg-white border shadow-premium p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {isFirst ? <Users className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              שלב {i + 1}
            </div>
            <p className="text-2xl font-black text-primary mt-1">{count}</p>
            <p className="text-[10px] font-bold text-muted-foreground">{isFirst ? 'התחילו' : `${pct}% מהתחלה`}</p>
          </div>
        );
      })}
    </div>
  );
}
