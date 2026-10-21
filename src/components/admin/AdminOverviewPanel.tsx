"use client";

import { useEffect, useState, type ReactNode } from 'react';
import {
  Package, Users, UserCheck, Clock, ShoppingBag, Banknote,
  Inbox, Flag, ShieldAlert, Eye, TrendingUp, LogIn, UserCog, Timer, PieChart, BarChart3,
  CheckCircle2, ChevronLeft, Truck, Trophy, SlidersHorizontal, ShieldCheck, AlertTriangle, CreditCard, MessageSquare, BellRing,
} from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { cn } from '@/lib/utils';
import { FunnelSummary } from '@/components/admin/AdminActivityPanel';
import type { AdminNavigate } from './admin-nav';
import type { AdminAttention } from './useAdminAttention';
import { timeAgo } from './admin-ui';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const RECENT_DAYS = 30;
const VIEW_SAMPLE_LIMIT = 2000;
const TOP_PRODUCTS_COUNT = 6;
const BEST_SELLERS_SAMPLE_LIMIT = 1000;
const RESPONSE_TIME_CHAT_SAMPLE = 60;
const RESPONSE_TIME_MESSAGE_SAMPLE = 3000;
const ACTIVATION_ORDER_SAMPLE = 3000;
const GROWTH_WEEKS = 6;
// Only these statuses are real money — pending_payment rows are abandoned/unfinished checkouts.
const PAID_ORDER_STATUSES = ['paid', 'completed'];

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'ממתין לתשלום',
  paid: 'שולם — ממתין למסירה',
  completed: 'הושלם',
  torah_request: 'בקשת ספר תורה',
  cancelled: 'בוטל',
  refunded: 'זוכה',
};

type RankedItem = { id: string; name: string; value: string };

export type AdminOverviewData = {
  counts: {
    products?: number;
    activeSellers?: number;
    activeJudaicaSellers?: number;
    customers?: number;
  };
  sales: { revenue30d: number; paidOrders30d: number; completed30d: number } | null;
  orderStatusCounts: Record<string, number> | null;
  viewCount7d: number | null;
  logins7d: number | null;
  activationPct: number | null;
  avgResponseMs: number | null | 'none';
  growth: { label: string; customers: number; sellers: number }[] | null;
  topViewed: RankedItem[] | null;
  bestSellers: RankedItem[] | null;
  topSellers: RankedItem[] | null;
};

export type { AdminTabId } from './admin-nav';

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} שעות`;
  return `${Math.round(hours / 24)} ימים`;
}

const formatShekels = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;

// Every metric comes from either a plain count/aggregate against existing tables or a sample
// of activity_events. Several aggregations (best-sellers, response time, growth, activation)
// are computed client-side over a bounded recent sample rather than in SQL — fine at today's
// volume, worth a dedicated RPC if these tables grow large enough for the sample to drift.
function useAdminOverviewData(): AdminOverviewData {
  const db = useSupabaseClient();
  const [counts, setCounts] = useState<AdminOverviewData['counts']>({});
  const [sales, setSales] = useState<AdminOverviewData['sales']>(null);
  const [orderStatusCounts, setOrderStatusCounts] = useState<Record<string, number> | null>(null);
  const [topViewed, setTopViewed] = useState<RankedItem[] | null>(null);
  const [viewCount7d, setViewCount7d] = useState<number | null>(null);
  const [logins7d, setLogins7d] = useState<number | null>(null);
  const [activeBuyers, setActiveBuyers] = useState<number | null>(null);
  const [bestSellers, setBestSellers] = useState<RankedItem[] | null>(null);
  const [topSellers, setTopSellers] = useState<RankedItem[] | null>(null);
  const [avgResponseMs, setAvgResponseMs] = useState<number | null | 'none'>(null);
  const [growth, setGrowth] = useState<AdminOverviewData['growth']>(null);

  useEffect(() => {
    const since30d = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const head = { count: 'exact' as const, head: true };

    // ── Site counts, 30-day sales and order-status breakdown. (What needs the admin — pending
    // sellers, stuck orders, inquiries… — is counted once in useAdminAttention and passed in.) ──
    Promise.all([
      db.from('products').select('id', head),
      db.from('sellers').select('id', head).eq('is_approved', true).eq('seller_type', 'stam_scribe'),
      db.from('customers').select('id', head),
      db.from('orders').select('amount, created_at, status').gte('created_at', since30d),
      db.from('sellers').select('id', head).eq('is_approved', true).eq('seller_type', 'judaica_seller'),
    ]).then(([products, activeSellers, customers, orders, activeJudaica]) => {
      const orderRows = orders.data || [];
      const paidRows = orderRows.filter((o: any) => PAID_ORDER_STATUSES.includes(o.status));

      const statusCounts: Record<string, number> = {};
      orderRows.forEach((o: any) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
      setOrderStatusCounts(statusCounts);

      setSales({
        revenue30d: paidRows.reduce((sum, o: any) => sum + (Number(o.amount) || 0), 0),
        paidOrders30d: paidRows.length,
        completed30d: orderRows.filter((o: any) => o.status === 'completed').length,
      });

      setCounts({
        products: products.count ?? 0,
        activeSellers: activeSellers.count ?? 0,
        activeJudaicaSellers: activeJudaica.error ? 0 : (activeJudaica.count ?? 0),
        customers: customers.count ?? 0,
      });
    });

    // ── Product views ──
    db.from('activity_events')
      .select('event_data, created_at')
      .eq('event_type', 'product_viewed')
      .order('created_at', { ascending: false })
      .limit(VIEW_SAMPLE_LIMIT)
      .then(async ({ data }) => {
        if (!data) { setTopViewed([]); setViewCount7d(0); return; }
        setViewCount7d(data.filter((row: any) => row.created_at >= since7d).length);
        const viewCounts = new Map<string, number>();
        data.forEach((row: any) => {
          const pid = row.event_data?.product_id;
          if (pid) viewCounts.set(pid, (viewCounts.get(pid) || 0) + 1);
        });
        const sorted = Array.from(viewCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP_PRODUCTS_COUNT);
        if (sorted.length === 0) { setTopViewed([]); return; }
        const { data: productRows } = await db.from('products').select('id, product_type, sub_type').in('id', sorted.map(([id]) => id));
        const nameById = new Map((productRows || []).map((p: any) => [p.id, p.sub_type ? `${p.product_type} · ${p.sub_type}` : p.product_type]));
        setTopViewed(sorted.map(([id, views]) => ({ id, name: nameById.get(id) || id, value: `${views} צפיות` })));
      });

    // ── Logins, 7 days ──
    db.from('activity_events')
      .select('id', head)
      .eq('event_type', 'user_signed_in')
      .gte('created_at', since7d)
      .then(({ count }) => setLogins7d(count ?? 0));

    // ── Best-selling products + top sellers by revenue, over paid orders only ──
    db.from('orders')
      .select('product_id, product_name, seller_id, amount')
      .in('status', PAID_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .limit(BEST_SELLERS_SAMPLE_LIMIT)
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setBestSellers([]); setTopSellers([]); return; }

        const productAgg = new Map<string, { name: string; qty: number; revenue: number }>();
        const sellerAgg = new Map<string, number>();
        data.forEach((o: any) => {
          const p = productAgg.get(o.product_id) || { name: o.product_name || o.product_id, qty: 0, revenue: 0 };
          p.qty += 1;
          p.revenue += Number(o.amount) || 0;
          productAgg.set(o.product_id, p);
          sellerAgg.set(o.seller_id, (sellerAgg.get(o.seller_id) || 0) + (Number(o.amount) || 0));
        });

        setBestSellers(
          Array.from(productAgg.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, TOP_PRODUCTS_COUNT)
            .map(([id, v]) => ({ id, name: v.name, value: `${v.qty} נמכרו` })),
        );

        const topSellerIds = Array.from(sellerAgg.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP_PRODUCTS_COUNT);
        const { data: sellerRows } = await db.from('sellers').select('id, first_name, last_name').in('id', topSellerIds.map(([id]) => id));
        const sellerNameById = new Map((sellerRows || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`.trim()]));
        setTopSellers(topSellerIds.map(([id, revenue]) => ({ id, name: sellerNameById.get(id) || id, value: formatShekels(revenue) })));
      });

    // ── Customer activation: unique buyers over a bounded recent-order sample ──
    db.from('orders')
      .select('buyer_id')
      .in('status', PAID_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .limit(ACTIVATION_ORDER_SAMPLE)
      .then(({ data }) => {
        if (!data) return;
        setActiveBuyers(new Set(data.map((o: any) => o.buyer_id)).size);
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
        const inWeek = (rows: any[]) => rows.filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= weekStart && t < weekEnd;
        }).length;
        buckets.push({
          label: w === 0 ? 'השבוע' : `לפני ${w} שב'`,
          customers: inWeek(customersData.data || []),
          sellers: inWeek(sellersData.data || []),
        });
      }
      setGrowth(buckets);
    });
  }, [db]);

  const customersTotal = counts.customers ?? 0;
  const activationPct = activeBuyers != null && customersTotal > 0
    ? Math.min(100, Math.round((activeBuyers / customersTotal) * 100))
    : null;

  return {
    counts, sales, orderStatusCounts, viewCount7d, logins7d, activationPct,
    avgResponseMs, growth, topViewed, bestSellers, topSellers,
  };
}

export function AdminOverviewPanel({ onNavigate, attention }: { onNavigate?: AdminNavigate; attention: AdminAttention }) {
  const db = useSupabaseClient();
  const data = useAdminOverviewData();
  return <AdminOverviewView data={data} attention={attention} onNavigate={onNavigate} funnelSlot={<FunnelSummary db={db} />} />;
}

// ─── Presentation ─────────────────────────────────────────────────────────────

function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2 px-1">
      <h2 className="text-base font-black text-primary">{children}</h2>
      {hint && <span className="text-[11px] font-semibold text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Panel({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[1.5rem] border border-primary/5 bg-white p-5 shadow-premium", className)}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-primary">
        <span className="text-accent-strong">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

const Loading = () => <p className="py-6 text-center text-xs font-bold text-muted-foreground">טוען...</p>;
const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-6 text-center text-xs font-bold italic text-muted-foreground">{children}</p>
);

function KpiCard({ icon, label, value, sub, emphasis, className, ...rest }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; emphasis?: boolean; className?: string; [data: `data-${string}`]: unknown }) {
  return (
    <div {...rest} className={cn(
      "rounded-[1.5rem] border p-5 shadow-premium", className,
      emphasis ? "border-transparent bg-primary text-primary-foreground" : "border-primary/5 bg-white",
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl",
          emphasis ? "bg-white/10 text-accent" : "bg-accent/10 text-accent-strong",
        )}>
          {icon}
        </span>
        <p className={cn("text-xs font-bold", emphasis ? "text-white/70" : "text-muted-foreground")}>{label}</p>
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums tracking-tight">{value}</p>
      {sub && <p className={cn("mt-1 text-[11px] font-semibold", emphasis ? "text-white/55" : "text-muted-foreground")}>{sub}</p>}
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/5 bg-white px-4 py-3.5 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary/60">{icon}</span>
      <div className="min-w-0">
        <p className="text-xl font-black leading-none tabular-nums text-primary">{value}</p>
        <p className="mt-1 truncate text-[11px] font-bold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

type QueueItem = { key: string; count: number; label: string; sub?: string; icon: ReactNode; go: () => void; tone: 'urgent' | 'normal' };

/** "דורש טיפול": one list of everything waiting for the admin, each with a count and a one-click jump. */
function AttentionQueue({ attention: a, onNavigate }: { attention: AdminAttention; onNavigate?: AdminNavigate }) {
  const nav: AdminNavigate = (tab, params) => onNavigate?.(tab, params);
  const smsFailed = a.sms?.installed ? a.sms.failed24h : 0;
  const items: QueueItem[] = [
    { key: 'pendingStam', count: a.pendingStam, label: 'סופרי סת"ם ממתינים לאישור', sub: a.oldestPendingAt ? `הוותיק נרשם ${timeAgo(a.oldestPendingAt)}` : undefined, icon: <Clock className="h-5 w-5" />, go: () => nav('pending'), tone: 'normal' },
    { key: 'pendingJudaica', count: a.pendingJudaica, label: 'מוכרי יודאיקה ממתינים לאישור', icon: <ShoppingBag className="h-5 w-5" />, go: () => nav('pending'), tone: 'normal' },
    { key: 'stamUpgrades', count: a.stamUpgrades, label: 'בקשות שדרוג לסופר סת"ם', sub: 'מוכרי יודאיקה שביקשו אימות הלכתי', icon: <ShieldCheck className="h-5 w-5" />, go: () => nav('pending'), tone: 'normal' },
    { key: 'stuckOrders', count: a.stuckOrders, label: 'הזמנות תקועות', sub: a.stuckMaxDays ? `שולמו ולא נמסרו / ספר תורה ללא טיפול · הוותיקה ${a.stuckMaxDays} ימים` : undefined, icon: <AlertTriangle className="h-5 w-5" />, go: () => nav('sales', { filter: 'stuck' }), tone: 'urgent' },
    { key: 'newInquiries', count: a.newInquiries, label: 'פניות חדשות מטופס צור קשר', sub: a.oldestInquiryAt ? `הוותיקה ${timeAgo(a.oldestInquiryAt)}` : undefined, icon: <Inbox className="h-5 w-5" />, go: () => nav('inquiries', { filter: 'new' }), tone: 'urgent' },
    { key: 'reports', count: a.reports, label: 'דיווחים על מוכרים', icon: <Flag className="h-5 w-5" />, go: () => nav('reports'), tone: 'urgent' },
    { key: 'flaggedChats', count: a.flaggedChats, label: 'שיחות שסומנו כחשודות', sub: 'ניסיון להעביר פרטי קשר מחוץ לאתר', icon: <ShieldAlert className="h-5 w-5" />, go: () => nav('chats', { filter: 'flagged' }), tone: 'urgent' },
    { key: 'waitingChats', count: a.waitingChatIds.length, label: 'קונים שמחכים לתשובת מוכר', sub: 'יותר מ-24 שעות בלי מענה', icon: <MessageSquare className="h-5 w-5" />, go: () => nav('chats', { filter: 'waiting' }), tone: 'normal' },
    { key: 'smsFailed', count: smsFailed, label: 'הודעות SMS / שיחות שנכשלו', sub: '24 השעות האחרונות', icon: <BellRing className="h-5 w-5" />, go: () => nav('notifications', { filter: 'failed' }), tone: 'urgent' },
  ];
  const open = items.filter((i) => i.count > 0);
  const total = open.reduce((sum, i) => sum + i.count, 0);

  return (
    <section className="rounded-[1.75rem] border border-primary/5 bg-white p-5 shadow-premium md:p-6" data-admin-attention>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-headline text-xl font-black text-primary">מה מחכה לך</h2>
        {a.loaded && open.length > 0 && <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-black tabular-nums text-destructive">{total} פריטים</span>}
      </div>
      {!a.loaded ? (
        <Loading />
      ) : open.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-5" data-admin-attention-clear>
          <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
          <div>
            <p className="font-black text-emerald-900">הכל מטופל</p>
            <p className="text-sm font-medium text-emerald-800/75">אין מוכרים ממתינים, פניות, דיווחים או הזמנות תקועות.</p>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {open.map((item) => (
            <li key={item.key} className="min-w-0">
              <button
                type="button"
                onClick={item.go}
                data-attention-item={item.key}
                className="group flex w-full items-center gap-3 rounded-2xl border border-primary/5 bg-[#FAFAF8] px-3 py-3 text-right transition-colors hover:border-accent/40 hover:bg-white md:gap-4 md:px-4"
              >
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', item.tone === 'urgent' ? 'bg-destructive/10 text-destructive' : 'bg-accent/15 text-accent-strong')}>{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-black leading-snug text-primary">{item.label}</span>
                  <span className="line-clamp-2 block text-xs font-medium text-muted-foreground">{item.sub || 'לחץ לטיפול'}</span>
                </span>
                <span className={cn('min-w-[2.25rem] rounded-full px-2.5 py-1 text-center text-sm font-black tabular-nums', item.tone === 'urgent' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground')}>{item.count}</span>
                <ChevronLeft className="hidden h-5 w-5 shrink-0 text-primary/25 transition-transform group-hover:-translate-x-1 group-hover:text-primary/60 sm:block" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {a.loaded && a.sms && a.sms.installed && !a.sms.configured.sms && !a.sms.configured.voice && (
        <button type="button" onClick={() => nav('notifications')} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-right text-xs font-bold text-amber-900 hover:bg-amber-100">
          <BellRing className="h-4 w-4 shrink-0" /> Twilio עוד לא מחובר — הודעות SMS ושיחות לא יוצאות עד שיתווספו המפתחות ב-Vercel.
        </button>
      )}
    </section>
  );
}

function GrowthChart({ growth }: { growth: AdminOverviewData['growth'] }) {
  if (!growth) return <Loading />;
  const max = Math.max(1, ...growth.map((g) => g.customers + g.sellers));
  return (
    <>
      <div className="flex h-36 items-end gap-2">
        {growth.map((w) => (
          <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-black tabular-nums text-primary/60">{w.customers + w.sellers || ''}</span>
            <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
              <div className="w-full rounded-t-md bg-accent" style={{ height: `${(w.sellers / max) * 100}%`, minHeight: w.sellers ? 3 : 0 }} title={`${w.sellers} מוכרים`} />
              <div className="w-full rounded-t-md bg-primary/15" style={{ height: `${(w.customers / max) * 100}%`, minHeight: w.customers ? 3 : 0 }} title={`${w.customers} לקוחות`} />
            </div>
            <span className="whitespace-nowrap text-[9px] font-bold text-muted-foreground">{w.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[11px] font-bold text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/15" /> לקוחות</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> מוכרים</span>
      </div>
    </>
  );
}

function OrderStatusBreakdown({ statusCounts }: { statusCounts: Record<string, number> | null }) {
  if (!statusCounts) return <Loading />;
  const entries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <Empty>אין הזמנות בטווח הזה.</Empty>;
  const total = entries.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="space-y-3">
      {entries.map(([status, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={status}>
            <div className="mb-1 flex justify-between text-xs font-bold text-primary">
              <span>{ORDER_STATUS_LABELS[status] || status}</span>
              <span className="tabular-nums text-muted-foreground">{count} · {pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-primary/5">
              <div className={cn("h-full rounded-full", status === 'completed' ? "bg-emerald-500" : status === 'pending_payment' ? "bg-primary/20" : "bg-accent")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const LEADER_TABS = [
  { id: 'bestSellers', label: 'הכי נמכרים', empty: 'אין עדיין מכירות.' },
  { id: 'topSellers', label: 'סופרים מובילים', empty: 'אין עדיין מכירות.' },
  { id: 'topViewed', label: 'הכי נצפים', empty: 'אין עדיין נתוני צפייה.' },
] as const;

function Leaderboard({ data }: { data: AdminOverviewData }) {
  const [tab, setTab] = useState<(typeof LEADER_TABS)[number]['id']>('bestSellers');
  const active = LEADER_TABS.find((t) => t.id === tab)!;
  const rows = data[tab];
  return (
    <Panel title="מובילים" icon={<Trophy className="h-4 w-4" />}>
      <div className="mb-4 flex gap-1 rounded-full bg-primary/[0.04] p-1" role="tablist">
        {LEADER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all",
              tab === t.id ? "bg-white text-primary shadow-sm" : "text-primary/50 hover:text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty>{active.empty}</Empty> : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-primary/[0.03]">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                i === 0 ? "bg-accent text-primary" : "bg-primary/5 text-primary/50",
              )}>
                {i + 1}
              </span>
              <span className="flex-1 truncate text-xs font-bold text-primary">{r.name}</span>
              <span className="shrink-0 text-[11px] font-black text-accent-strong">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function AdminOverviewView({
  data, attention, onNavigate, funnelSlot,
}: {
  data: AdminOverviewData;
  attention: AdminAttention;
  onNavigate?: AdminNavigate;
  funnelSlot?: ReactNode;
}) {
  const { counts, sales } = data;
  const a = attention;
  const dash = (v: number | undefined | null, fmt: (n: number) => ReactNode = (n) => n) => (v == null ? '...' : fmt(v));
  const avgOrder = sales && sales.paidOrders30d > 0 ? sales.revenue30d / sales.paidOrders30d : null;

  // Explicit RTL: this renders inside the admin page's Radix Tabs, which default to dir="ltr".
  return (
    <div dir="rtl" className="space-y-10 text-right">
      <AttentionQueue attention={attention} onNavigate={onNavigate} />

      <section>
        <SectionTitle hint={`${RECENT_DAYS} הימים האחרונים · הזמנות ששולמו בלבד`}>מכירות</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard emphasis icon={<Banknote className="h-4 w-4" />} label="הכנסות" value={sales ? formatShekels(sales.revenue30d) : '...'} sub={avgOrder != null ? `ממוצע להזמנה ${formatShekels(avgOrder)}` : undefined} />
          <KpiCard icon={<ShoppingBag className="h-4 w-4" />} label="הזמנות ששולמו" value={sales ? sales.paidOrders30d : '...'} />
          <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="עסקאות שהושלמו" value={sales ? sales.completed30d : '...'} sub="המסירה אומתה בקוד" />
          <KpiCard icon={<Truck className="h-4 w-4" />} label="ממתינות למסירה" value={a.loaded ? a.awaitingDelivery : '...'} sub="כל הזמנים" />
          <KpiCard
            className="col-span-2 lg:col-span-1"
            data-abandoned-payments
            icon={<CreditCard className="h-4 w-4" />}
            label="נטישת תשלום"
            value={a.loaded ? a.abandonedPayments : '...'}
            sub="התחילו תשלום ולא סיימו (מעל 48 שעות) · כל הזמנים"
          />
        </div>
      </section>

      <section>
        <SectionTitle>האתר</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatPill icon={<UserCheck className="h-4 w-4" />} label='סופרי סת"ם פעילים' value={dash(counts.activeSellers)} />
          <StatPill icon={<ShoppingBag className="h-4 w-4" />} label="מוכרי יודאיקה פעילים" value={dash(counts.activeJudaicaSellers)} />
          <StatPill icon={<Users className="h-4 w-4" />} label="לקוחות רשומים" value={dash(counts.customers)} />
          <StatPill icon={<Package className="h-4 w-4" />} label="מוצרים באתר" value={dash(counts.products)} />
          <StatPill icon={<Eye className="h-4 w-4" />} label="צפיות במוצרים (7 ימים)" value={dash(data.viewCount7d)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="נרשמים חדשים — 6 שבועות" icon={<BarChart3 className="h-4 w-4" />} className="lg:col-span-1">
          <GrowthChart growth={data.growth} />
        </Panel>
        <Panel title={`סטטוס הזמנות — ${RECENT_DAYS} יום`} icon={<PieChart className="h-4 w-4" />} className="lg:col-span-1">
          <OrderStatusBreakdown statusCounts={data.orderStatusCounts} />
        </Panel>
        <div className="lg:col-span-1">
          <Leaderboard data={data} />
        </div>
      </section>

      <Accordion type="single" collapsible dir="rtl">
        <AccordionItem value="advanced" className="rounded-[1.5rem] border border-primary/5 bg-white px-5 shadow-premium">
          <AccordionTrigger className="py-4 text-sm font-black text-primary hover:no-underline">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-accent-strong" /> מדדים מתקדמים
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatPill icon={<LogIn className="h-4 w-4" />} label="כניסות לאתר (7 ימים)" value={dash(data.logins7d)} />
              <StatPill icon={<UserCog className="h-4 w-4" />} label="לקוחות שקנו לפחות פעם אחת" value={data.activationPct != null ? `${data.activationPct}%` : '...'} />
              <StatPill
                icon={<Timer className="h-4 w-4" />}
                label="זמן תגובה ממוצע של סופר בצ׳אט"
                value={data.avgResponseMs === null ? '...' : data.avgResponseMs === 'none' ? '—' : formatDuration(data.avgResponseMs)}
              />
            </div>
            {funnelSlot && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-primary">
                  <TrendingUp className="h-4 w-4 text-accent-strong" /> משפך הרשמת סופרים
                </h3>
                {funnelSlot}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
