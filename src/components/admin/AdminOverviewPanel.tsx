"use client";

import { useEffect, useState } from 'react';
import {
  Package, Users, UserCheck, Clock, ShoppingBag, Banknote, Star,
  Inbox, Flag, ShieldAlert, Eye, TrendingUp, LogIn, UserCog, Timer, PieChart, BarChart3,
} from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { cn } from '@/lib/utils';
import { FunnelSummary } from '@/components/admin/AdminActivityPanel';

const RECENT_DAYS = 30;
const VIEW_SAMPLE_LIMIT = 2000;
const TOP_PRODUCTS_COUNT = 6;
const BEST_SELLERS_SAMPLE_LIMIT = 1000;
const RESPONSE_TIME_CHAT_SAMPLE = 60;
const RESPONSE_TIME_MESSAGE_SAMPLE = 3000;
const ACTIVATION_ORDER_SAMPLE = 3000;
const GROWTH_WEEKS = 6;

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'ממתין לתשלום',
  paid: 'שולם',
  completed: 'הושלם',
  cancelled: 'בוטל',
  refunded: 'זוכה',
};

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

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] bg-white border shadow-premium p-5">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} שעות`;
  return `${Math.round(hours / 24)} ימים`;
}

// The dashboard's landing screen — every other tab is an operational list (pending sellers,
// orders, reports...), none of them answer "how is the business doing right now" at a
// glance. Every metric here comes from either a plain count/aggregate against tables that
// already existed (zero new instrumentation) or a sample of activity_events (Phase 2) —
// deliberately no new migration for this pass (see the summary sent alongside this commit
// for what would need one). Several aggregations (best-sellers, response time, growth,
// activation) are computed client-side over a bounded recent sample rather than a SQL
// aggregation — fine at today's volume, worth revisiting with a dedicated RPC if any of
// these tables grow large enough that the sample stops being representative.
export function AdminOverviewPanel() {
  const db = useSupabaseClient();
  const [stats, setStats] = useState<Record<string, number | null>>({});
  const [orderStatusCounts, setOrderStatusCounts] = useState<Record<string, number> | null>(null);
  const [topProducts, setTopProducts] = useState<{ id: string; name: string; views: number }[] | null>(null);
  const [viewCount7d, setViewCount7d] = useState<number | null>(null);
  const [logins7d, setLogins7d] = useState<number | null>(null);
  const [activationRate, setActivationRate] = useState<number | null>(null);
  const [bestSellers, setBestSellers] = useState<{ id: string; name: string; qty: number; revenue: number }[] | null>(null);
  const [topSellers, setTopSellers] = useState<{ id: string; name: string; revenue: number }[] | null>(null);
  const [avgResponseMs, setAvgResponseMs] = useState<number | null | 'none'>(null);
  const [growth, setGrowth] = useState<{ label: string; customers: number; sellers: number }[] | null>(null);

  useEffect(() => {
    const since30d = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const head = { count: 'exact' as const, head: true };

    // ── Core stat cards + order-status breakdown (reuses the same 30-day order fetch) ──
    Promise.all([
      db.from('products').select('id', head),
      db.from('sellers').select('id', head).eq('is_approved', true),
      db.from('sellers').select('id', head).eq('is_approved', false),
      db.from('customers').select('id', head),
      db.from('orders').select('amount, created_at, status').gte('created_at', since30d),
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

      const statusCounts: Record<string, number> = {};
      orderRows.forEach((o: any) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
      setOrderStatusCounts(statusCounts);

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

    // ── Product views (existing instrumentation) ──
    db.from('activity_events')
      .select('event_data, created_at')
      .eq('event_type', 'product_viewed')
      .order('created_at', { ascending: false })
      .limit(VIEW_SAMPLE_LIMIT)
      .then(async ({ data }) => {
        if (!data) { setTopProducts([]); setViewCount7d(0); return; }
        setViewCount7d(data.filter((row: any) => row.created_at >= since7d).length);
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

    // ── Logins, 7 days (new instrumentation — user_signed_in, added alongside this panel;
    // will read 0 until real sign-ins happen after deploy, that's expected, not a bug) ──
    db.from('activity_events')
      .select('id', head)
      .eq('event_type', 'user_signed_in')
      .gte('created_at', since7d)
      .then(({ count }) => setLogins7d(count ?? 0));

    // ── Best-selling products + top sellers by revenue, over a recent order sample ──
    db.from('orders')
      .select('product_id, product_name, seller_id, amount, buyer_id')
      .order('created_at', { ascending: false })
      .limit(BEST_SELLERS_SAMPLE_LIMIT)
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setBestSellers([]); setTopSellers([]); setActivationRate(null); return; }

        const productAgg = new Map<string, { name: string; qty: number; revenue: number }>();
        const sellerAgg = new Map<string, number>();
        data.forEach((o: any) => {
          const p = productAgg.get(o.product_id) || { name: o.product_name || o.product_id, qty: 0, revenue: 0 };
          p.qty += 1;
          p.revenue += Number(o.amount) || 0;
          productAgg.set(o.product_id, p);
          sellerAgg.set(o.seller_id, (sellerAgg.get(o.seller_id) || 0) + (Number(o.amount) || 0));
        });

        const topProductsBySales = Array.from(productAgg.entries())
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, TOP_PRODUCTS_COUNT)
          .map(([id, v]) => ({ id, ...v }));
        setBestSellers(topProductsBySales);

        const topSellerIds = Array.from(sellerAgg.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP_PRODUCTS_COUNT);
        const { data: sellerRows } = await db.from('sellers').select('id, first_name, last_name').in('id', topSellerIds.map(([id]) => id));
        const sellerNameById = new Map((sellerRows || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`.trim()]));
        setTopSellers(topSellerIds.map(([id, revenue]) => ({ id, revenue, name: sellerNameById.get(id) || id })));
      });

    // ── Customer activation rate: % of registered customers who ever placed an order,
    // over a bounded recent-order sample (not a full-table scan) ──
    db.from('orders')
      .select('buyer_id')
      .order('created_at', { ascending: false })
      .limit(ACTIVATION_ORDER_SAMPLE)
      .then(({ data }) => {
        if (!data) return;
        const uniqueBuyers = new Set(data.map((o: any) => o.buyer_id)).size;
        setStats((prev) => (prev.customers ? prev : prev)); // no-op placeholder to satisfy deps lint if needed
        setActivationRate(uniqueBuyers);
      });

    // ── Average first-response time in chats: first buyer message → first subsequent
    // seller reply, averaged across a sample of recently-active chats ──
    (async () => {
      const { data: chats } = await db.from('chats').select('id, participants').order('last_message_at', { ascending: false }).limit(RESPONSE_TIME_CHAT_SAMPLE);
      if (!chats || chats.length === 0) { setAvgResponseMs('none'); return; }
      const allParticipantIds = Array.from(new Set(chats.flatMap((c: any) => c.participants || [])));
      const { data: sellerRows } = await db.from('sellers').select('id').in('id', allParticipantIds);
      const sellerIdSet = new Set((sellerRows || []).map((s: any) => s.id));
      const { data: messages } = await db.from('messages')
        .select('chat_id, sender_id, timestamp')
        .in('chat_id', chats.map((c: any) => c.id))
        .order('timestamp', { ascending: true })
        .limit(RESPONSE_TIME_MESSAGE_SAMPLE);
      if (!messages) { setAvgResponseMs('none'); return; }

      const byChat = new Map<string, any[]>();
      messages.forEach((m: any) => {
        if (!byChat.has(m.chat_id)) byChat.set(m.chat_id, []);
        byChat.get(m.chat_id)!.push(m);
      });

      const deltas: number[] = [];
      byChat.forEach((msgs) => {
        let buyerTime: number | null = null;
        for (const m of msgs) {
          const isSeller = sellerIdSet.has(m.sender_id);
          if (!isSeller && buyerTime === null) {
            buyerTime = new Date(m.timestamp).getTime();
          } else if (isSeller && buyerTime !== null) {
            const delta = new Date(m.timestamp).getTime() - buyerTime;
            if (delta > 0) deltas.push(delta);
            break;
          }
        }
      });
      setAvgResponseMs(deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 'none');
    })();

    // ── Signup growth, last N weeks, customers vs sellers ──
    const growthSince = new Date(Date.now() - GROWTH_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      db.from('customers').select('created_at').gte('created_at', growthSince),
      db.from('sellers').select('created_at').gte('created_at', growthSince),
    ]).then(([customersData, sellersData]) => {
      const now = Date.now();
      const buckets: { label: string; customers: number; sellers: number }[] = [];
      for (let w = GROWTH_WEEKS - 1; w >= 0; w--) {
        const weekStart = now - (w + 1) * 7 * 24 * 60 * 60 * 1000;
        const weekEnd = now - w * 7 * 24 * 60 * 60 * 1000;
        const count = (rows: any[]) => rows.filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= weekStart && t < weekEnd;
        }).length;
        buckets.push({
          label: `-${w + 1}שב'`,
          customers: count(customersData.data || []),
          sellers: count(sellersData.data || []),
        });
      }
      setGrowth(buckets);
    });
  }, [db]);

  const has = (k: string) => stats[k] !== undefined;
  const customersTotal = stats.customers ?? 0;
  const activationPct = activationRate != null && customersTotal > 0 ? Math.min(100, Math.round((activationRate / customersTotal) * 100)) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Package className="w-4 h-4" />} label="סה״כ מוצרים" value={has('products') ? stats.products! : '...'} />
        <StatCard icon={<UserCheck className="w-4 h-4" />} label="סופרים פעילים" value={has('activeSellers') ? stats.activeSellers! : '...'} />
        <StatCard icon={<Clock className="w-4 h-4" />} label="ממתינים לאישור" value={has('pendingSellers') ? stats.pendingSellers! : '...'} tone={stats.pendingSellers ? 'accent' : 'default'} />
        <StatCard icon={<Users className="w-4 h-4" />} label="לקוחות רשומים" value={has('customers') ? stats.customers! : '...'} />
        <StatCard icon={<Star className="w-4 h-4" />} label="דירוג ממוצע" value={stats.avgRating != null ? stats.avgRating : '—'} />
        <StatCard icon={<ShoppingBag className="w-4 h-4" />} label={`הזמנות (${RECENT_DAYS} יום)`} value={has('orders30d') ? stats.orders30d! : '...'} />
        <StatCard icon={<Banknote className="w-4 h-4" />} label={`הכנסות (${RECENT_DAYS} יום)`} value={has('revenue30d') ? `₪${Math.round(stats.revenue30d!).toLocaleString('he-IL')}` : '...'} />
        <StatCard icon={<Eye className="w-4 h-4" />} label="צפיות מוצר (7 ימים)" value={viewCount7d ?? '...'} sub="מדד חדש" tone="accent" />
        <StatCard icon={<LogIn className="w-4 h-4" />} label="כניסות (7 ימים)" value={logins7d ?? '...'} sub="מדד חדש" tone="accent" />
        <StatCard icon={<UserCog className="w-4 h-4" />} label="לקוחות עם הזמנה" value={activationPct != null ? `${activationPct}%` : '...'} sub="מתוך כלל הלקוחות" />
        <StatCard icon={<Inbox className="w-4 h-4" />} label="פניות פתוחות" value={has('openInquiries') ? stats.openInquiries! : '...'} tone={stats.openInquiries ? 'warn' : 'default'} />
        <StatCard icon={<Flag className="w-4 h-4" />} label="דיווחים פתוחים" value={has('openReports') ? stats.openReports! : '...'} tone={stats.openReports ? 'warn' : 'default'} />
      </div>

      {(stats.flaggedChats ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-[1.25rem] bg-destructive/5 border border-destructive/15 px-5 py-3 text-[12px] font-bold text-destructive">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {stats.flaggedChats} שיחות מסומנות כחשודות ממתינות לבדיקה — טאב &quot;שיחות&quot;
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="גידול נרשמים (6 שבועות אחרונים)" icon={<BarChart3 className="w-3.5 h-3.5" />}>
          {!growth && <p className="text-xs font-bold text-muted-foreground py-6 text-center">טוען...</p>}
          {growth && (
            <div className="flex items-end gap-2 h-32">
              {growth.map((w) => {
                const max = Math.max(1, ...growth.map((g) => g.customers + g.sellers));
                return (
                  <div key={w.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div className="w-full flex flex-col justify-end gap-0.5 flex-1">
                      <div className="w-full bg-accent rounded-t-sm" style={{ height: `${(w.sellers / max) * 100}%`, minHeight: w.sellers ? 3 : 0 }} title={`${w.sellers} סופרים`} />
                      <div className="w-full bg-primary/20 rounded-t-sm" style={{ height: `${(w.customers / max) * 100}%`, minHeight: w.customers ? 3 : 0 }} title={`${w.customers} לקוחות`} />
                    </div>
                    <span className="text-[8px] font-bold text-muted-foreground">{w.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/20" /> לקוחות</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" /> סופרים</span>
          </div>
        </Panel>

        <Panel title={`פילוח סטטוס הזמנות (${RECENT_DAYS} יום)`} icon={<PieChart className="w-3.5 h-3.5" />}>
          {!orderStatusCounts && <p className="text-xs font-bold text-muted-foreground py-6 text-center">טוען...</p>}
          {orderStatusCounts && Object.keys(orderStatusCounts).length === 0 && (
            <p className="text-xs font-bold text-muted-foreground italic py-6 text-center">אין הזמנות בטווח הזה.</p>
          )}
          {orderStatusCounts && Object.entries(orderStatusCounts).length > 0 && (
            <div className="space-y-2.5">
              {Object.entries(orderStatusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const total = Object.values(orderStatusCounts).reduce((a, b) => a + b, 0);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status}>
                    <div className="flex justify-between text-[11px] font-bold text-primary mb-1">
                      <span>{ORDER_STATUS_LABELS[status] || status}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-primary/5 overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel title="מוצרים הכי נצפים" icon={<TrendingUp className="w-3.5 h-3.5" />}>
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
        </Panel>

        <Panel title="הכי נמכרים" icon={<ShoppingBag className="w-3.5 h-3.5" />}>
          {bestSellers === null && <p className="text-xs font-bold text-muted-foreground py-6 text-center">טוען...</p>}
          {bestSellers?.length === 0 && <p className="text-xs font-bold text-muted-foreground italic py-6 text-center">אין עדיין הזמנות.</p>}
          <div className="space-y-2.5">
            {bestSellers?.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
                <span className="flex-1 text-xs font-bold text-primary truncate">{p.name}</span>
                <span className="text-[11px] font-black text-accent-strong shrink-0">{p.qty}×</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="סופרים מובילים (הכנסה)" icon={<Banknote className="w-3.5 h-3.5" />}>
          {topSellers === null && <p className="text-xs font-bold text-muted-foreground py-6 text-center">טוען...</p>}
          {topSellers?.length === 0 && <p className="text-xs font-bold text-muted-foreground italic py-6 text-center">אין עדיין הזמנות.</p>}
          <div className="space-y-2.5">
            {topSellers?.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
                <span className="flex-1 text-xs font-bold text-primary truncate">{s.name}</span>
                <span className="text-[11px] font-black text-accent-strong shrink-0">₪{Math.round(s.revenue).toLocaleString('he-IL')}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4 items-start">
        <Panel title="זמן תגובה ראשוני ממוצע בצ׳אט" icon={<Timer className="w-3.5 h-3.5" />}>
          {avgResponseMs === null && <p className="text-xs font-bold text-muted-foreground py-6 text-center">טוען...</p>}
          {avgResponseMs === 'none' && <p className="text-xs font-bold text-muted-foreground italic py-6 text-center">אין מספיק נתוני שיחה עדיין.</p>}
          {typeof avgResponseMs === 'number' && (
            <>
              <p className="text-3xl font-black text-primary">{formatDuration(avgResponseMs)}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">
                מהודעת הלקוח הראשונה ועד תגובת הסופר, ממוצע על {RESPONSE_TIME_CHAT_SAMPLE} השיחות הפעילות האחרונות
              </p>
            </>
          )}
        </Panel>

        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">Funnel הרשמת סופרים</h3>
          <FunnelSummary db={db} />
        </div>
      </div>
    </div>
  );
}
