"use client";

import { useMemo, useState } from 'react';
import { AlertTriangle, BellRing, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { STUCK_THRESHOLDS, classifyStuckOrder, type StuckKind } from '@/lib/stuck-orders';
import { cn } from '@/lib/utils';

const KIND_TONE: Record<StuckKind, string> = {
  awaiting_delivery: 'bg-red-50 text-red-700 border-red-100',
  torah_request: 'bg-amber-50 text-amber-800 border-amber-100',
  abandoned_payment: 'bg-slate-50 text-slate-600 border-slate-200',
};

/** Israeli local number → wa.me link (972…), or null when there's no usable number. */
function whatsappHref(phone: unknown, text: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  const intl = digits.startsWith('972') ? digits : `972${digits.replace(/^0/, '')}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Orders stuck past their state's threshold, oldest first, with contact + reminder actions. */
export function StuckOrdersPanel({ orders, sellers }: { orders: any[]; sellers: any[] }) {
  const { toast } = useToast();
  const db = useSupabaseClient();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const now = new Date();
    return (orders || [])
      .map((order) => ({ order, info: classifyStuckOrder(order, now) }))
      .filter((row): row is { order: any; info: NonNullable<ReturnType<typeof classifyStuckOrder>> } => row.info !== null)
      .sort((a, b) => b.info.days - a.info.days);
  }, [orders]);

  const remind = async (orderId: string) => {
    setSendingId(orderId);
    try {
      const { data: { session } } = await db.auth.getSession();
      const res = await fetch('/api/admin/orders/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      toast({ title: 'התזכורת נשלחה למוכר', description: 'נשלח מייל למוכר עם פרטי ההזמנה.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'שליחת התזכורת נכשלה', description: error?.message || 'אנא נסה שוב.' });
    } finally {
      setSendingId(null);
    }
  };

  if (rows.length === 0) {
    return <div className="rounded-[2rem] bg-white p-16 text-center font-semibold text-muted-foreground shadow-premium" data-stuck-orders-empty>אין הזמנות תקועות כרגע.</div>;
  }

  return (
    <div className="space-y-3" data-stuck-orders>
      {rows.map(({ order, info }) => {
        const rule = STUCK_THRESHOLDS[info.kind];
        const seller = sellers?.find((s: any) => s.id === order.seller_id);
        const sellerName = seller ? `${seller.first_name || ''} ${seller.last_name || ''}`.trim() : 'מוכר';
        const shortId = String(order.id).slice(0, 8);
        const buyerWa = whatsappHref(order.buyer_phone, `שלום ${order.buyer_name || ''}, כאן חותם בנוגע להזמנה #${shortId} (${order.product_name || ''}).`);
        const sellerWa = whatsappHref(seller?.phone, `שלום ${sellerName}, כאן חותם בנוגע להזמנה #${shortId} (${order.product_name || ''}) שממתינה לטיפולך.`);
        const canRemind = info.kind !== 'abandoned_payment';
        return (
          <div key={order.id} data-stuck-order={order.id} data-stuck-kind={info.kind} className="flex flex-col gap-3 rounded-[1.5rem] border border-primary/5 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', KIND_TONE[info.kind])}><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 space-y-1 text-right">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-black', KIND_TONE[info.kind])}>{rule.label}</span>
                  <span className="text-xs font-black text-primary">{info.days} ימים</span>
                  <span className="font-mono text-[11px] text-muted-foreground">#{shortId}</span>
                </div>
                <p className="truncate text-sm font-bold text-primary">{order.product_name || 'מוצר'} · ₪{Number(order.amount || 0).toLocaleString('he-IL')}</p>
                <p className="text-xs font-semibold text-muted-foreground">קונה: {order.buyer_name || '—'} · מוכר: {sellerName}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {buyerWa && (
                <Button asChild variant="outline" size="sm" className="h-10 rounded-full text-xs font-bold">
                  <a href={buyerWa} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-1.5 h-4 w-4 text-emerald-600" />לקונה</a>
                </Button>
              )}
              {sellerWa && (
                <Button asChild variant="outline" size="sm" className="h-10 rounded-full text-xs font-bold">
                  <a href={sellerWa} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-1.5 h-4 w-4 text-emerald-600" />למוכר</a>
                </Button>
              )}
              {canRemind && (
                <Button size="sm" onClick={() => remind(order.id)} disabled={sendingId === order.id} className="h-10 rounded-full text-xs font-black" data-remind-seller>
                  {sendingId === order.id ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <BellRing className="ml-1.5 h-4 w-4" />}
                  שלח תזכורת למוכר
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <p className="px-1 text-xs font-semibold text-muted-foreground">
        {Object.values(STUCK_THRESHOLDS).map((rule) => `${rule.label}: ${rule.hint}`).join(' · ')}
      </p>
    </div>
  );
}
