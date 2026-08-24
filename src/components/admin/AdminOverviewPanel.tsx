"use client";

import { useEffect, useState } from 'react';
import {
  Package, Users, UserCheck, Clock, ShoppingBag, Banknote, Star,
  Inbox, Flag, ShieldAlert, Eye, TrendingUp,
} from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { cn } from '@/lib/utils';
import { FunnelSummary } from '@/components/admin/AdminActivityPanel';

const RECENT_DAYS = 30;
const VIEW_SAMPLE_LIMIT = 2000;
const TOP_PRODUCTS_COUNT = 6;

function StatCard({ icon, label, value, sub, tone = 'default' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
  tone?: 'default' | 'accent' | 'warn';
}) {
  return (
    <div className="rounded-[1.5rem] bg-white border shadow-premium p-5">
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
        tone === 'accent' ? "bg-accent/15 text-accent-strong" : tone === 'warn' ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary/60",
      )}>
        {icon}
      </div>
      <p className="text-2xl font-black text-primary leading-none">{value}</p>
      <p className="text-[11px] font-black text-muted-foreground mt-2">{label}</p>
      {sub && <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

// The dashboard's landing screen — every other tab is an operational list (pending sellers,
// orders, reports...), none of them answer "how is the business doing right now" at a
// glance. Two data sources: plain counts against tables that already existed (zero new
// instrumentation) and a sample of activity_events (Phase 2) for the metrics nothing
// measured before this — product views specifically.
export function AdminOverviewPanel() {
  const db = useSupabaseClient();
  const [stats, setStats] = useState<Record<string, number | null>>({});
  const [topProducts, setTopProducts] = useState<{ id: string; name: string; views: number }[] | null>(null);
  const [viewCount7d, setViewCount7d] = useState<number | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const head = { count: 'exact' as const, head: true };

    Promise.all([
      db.from('products').select('id', head),
      db.from('sellers').select('id', head).eq('is_approved', true),
      db.from('sellers').select('id', head).eq('is_approved', false),
      db.from('customers').select('id', head),
      db.from('orders').select('amount, created_at, status').gte('created_at', since),
      db.from('reviews').select('rating'),
      db.from('contact_messages').select('id', head).eq('status', 'new'),
      db.from('reports').select('id', head),
      db.from('chats').select('id', head).eq('is_suspicious', true),
    ]).then(([products, activeSellers, pendingSellers, customers, orders, reviews, inquiries, reports, flaggedChats]) => {
      const orderRows = orders.data || [];
      const revenue30d = orderRows.reduce((sum, o: any) => sum + (Number(o.amount) || 0), 0);
      const reviewRows = reviews.data || [];
      const avgRating = reviewRows.length
        ? (reviewRows.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviewRows.length).toFixed(1)
        : null;

      setStats({
        products: products.count ?? 0,
        activeSellers: activeSellers.count ?? 0,
        pendingSellers: pendingSellers.count ?? 0,
        customers: customers.count ?? 0,
        orders30d: orderRows.length,
        revenue30d,
        avgRating: avgRating ? Number(avgRating) : null,
        openInquiries: inquiries.count ?? 0,
        openReports: reports.count ?? 0,
        flaggedChats: flaggedChats.count ?? 0,
      });
    });

    // Most-viewed products + 7-day total, from a bounded recent sample of product_viewed
    // events — same client-side-aggregation tradeoff as the funnel summary (good enough for
    // v1; move to a proper SQL aggregation RPC if this table's volume outgrows it).
    db.from('activity_events')
      .select('event_data, created_at')
      .eq('event_type', 'product_viewed')
      .order('created_at', { ascending: false })
      .limit(VIEW_SAMPLE_LIMIT)
      .then(async ({ data }) => {
        if (!data) { setTopProducts([]); setViewCount7d(0); return; }

        const recentCount = data.filter((row: any) => row.created_at >= since7d).length;
        setViewCount7d(recentCount);

        const counts = new Map<string, number>();
        data.forEach((row: any) => {
          const pid = row.event_data?.product_id;
          if (pid) counts.set(pid, (counts.get(pid) || 0) + 1);
        });
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP_PRODUCTS_COUNT);

        if (sorted.length === 0) { setTopProducts([]); return; }
        const { data: productRows } = await db.from('products').select('id, product_type, sub_type').in('id', sorted.map(([id]) => id));
        const nameById = new Map((productRows || []).map((p: any) => [p.id, p.sub_type ? `${p.product_type} · ${p.sub_type}` : p.product_type]));
        setTopProducts(sorted.map(([id, views]) => ({ id, views, name: nameById.get(id) || id })));
      });
  }, [db]);

  const has = (k: string) => stats[k] !== undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={<Package className="w-4 h-4" />} label="סה״כ מוצרים" value={has('products') ? stats.products! : '...'} />
        <StatCard icon={<UserCheck className="w-4 h-4" />} label="סופרים פעילים" value={has('activeSellers') ? stats.activeSellers! : '...'} />
        <StatCard icon={<Clock className="w-4 h-4" />} label="ממתינים לאישור" value={has('pendingSellers') ? stats.pendingSellers! : '...'} tone={stats.pendingSellers ? 'accent' : 'default'} />
        <StatCard icon={<Users className="w-4 h-4" />} label="לקוחות רשומים" value={has('customers') ? stats.customers! : '...'} />
        <StatCard icon={<Star className="w-4 h-4" />} label="דירוג ממוצע" value={stats.avgRating != null ? stats.avgRating : '—'} />
        <StatCard icon={<ShoppingBag className="w-4 h-4" />} label={`הזמנות (${RECENT_DAYS} יום)`} value={has('orders30d') ? stats.orders30d! : '...'} />
        <StatCard icon={<Banknote className="w-4 h-4" />} label={`הכנסות (${RECENT_DAYS} יום)`} value={has('revenue30d') ? `₪${Math.round(stats.revenue30d!).toLocaleString('he-IL')}` : '...'} />
        <StatCard icon={<Eye className="w-4 h-4" />} label="צפיות מוצר (7 ימים)" value={viewCount7d ?? '...'} sub="מדד חדש" tone="accent" />
        <StatCard icon={<Inbox className="w-4 h-4" />} label="פניות פתוחות" value={has('openInquiries') ? stats.openInquiries! : '...'} tone={stats.openInquiries ? 'warn' : 'default'} />
        <StatCard icon={<Flag className="w-4 h-4" />} label="דיווחים פתוחים" value={has('openReports') ? stats.openReports! : '...'} tone={stats.openReports ? 'warn' : 'default'} />
      </div>

      {(stats.flaggedChats ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-[1.25rem] bg-destructive/5 border border-destructive/15 px-5 py-3 text-[12px] font-bold text-destructive">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {stats.flaggedChats} שיחות מסומנות כחשודות ממתינות לבדיקה — טאב &quot;שיחות&quot;
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4 items-start">
        <div className="rounded-[1.5rem] bg-white border shadow-premium p-5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> מוצרים הכי נצפים
          </h3>
          {topProducts === null && <p className="text-xs font-bold text-muted-foreground py-6 text-center">טוען...</p>}
          {topProducts?.length === 0 && <p className="text-xs font-bold text-muted-foreground italic py-6 text-center">אין עדיין נתוני צפייה.</p>}
          <div className="space-y-2.5">
            {topProducts?.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
                <span className="flex-1 text-xs font-bold text-primary truncate">{p.name}</span>
                <span className="text-[11px] font-black text-accent-strong shrink-0">{p.views} צפיות</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">Funnel הרשמת סופרים</h3>
          <FunnelSummary db={db} />
        </div>
      </div>
    </div>
  );
}
