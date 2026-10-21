"use client";

import Link from 'next/link';
import { ExternalLink, Hash, Mail, Phone, Receipt, Scroll, ShieldCheck, UserRound } from 'lucide-react';
import Image from '@/components/SmartImage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StuckOrdersPanel } from './StuckOrdersPanel';
import { ADMIN_PAGE_SIZE, AdminEmpty, AdminPagination, OrderStatusBadge, formatDateTime, formatShekels } from './admin-ui';

export type SalesFilter = 'all' | 'completed' | 'pending' | 'stuck';
export const SALES_FILTERS: { id: SalesFilter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'pending', label: 'שולמו — ממתינות למסירה' },
  { id: 'completed', label: 'הושלמו' },
  { id: 'stuck', label: 'תקועות' },
];
export const isSalesFilter = (v: unknown): v is SalesFilter => SALES_FILTERS.some((f) => f.id === v);

type OpenPerson = (type: 'seller' | 'customer', id: string) => void;
const sellerName = (s: any) => (s ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : '');

export function SalesFilterBar({ value, onChange, stuckCount }: { value: SalesFilter; onChange: (f: SalesFilter) => void; stuckCount: number }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="סינון הזמנות">
      {SALES_FILTERS.map((f) => {
        const on = value === f.id;
        const stuck = f.id === 'stuck';
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(f.id)}
            data-sales-filter-stuck={stuck ? '' : undefined}
            className={cn(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors',
              on ? (stuck ? 'border-destructive bg-destructive text-white' : 'border-primary bg-primary text-primary-foreground')
                : stuck && stuckCount > 0 ? 'border-destructive/30 bg-white text-destructive' : 'border-primary/10 bg-white text-primary/70 hover:border-primary/30',
            )}
          >
            {f.label}
            {stuck && stuckCount > 0 && <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', on ? 'bg-white/25' : 'bg-destructive/10')}>{stuckCount}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SalesList({ orders, allOrders, sellers, filter, page, setPage, onOpenPerson, filtered }: {
  orders: any[]; allOrders: any[]; sellers: any[]; filter: SalesFilter; page: number; setPage: (p: number) => void; onOpenPerson: OpenPerson; filtered: boolean;
}) {
  if (filter === 'stuck') return <StuckOrdersPanel orders={allOrders} sellers={sellers} />;
  if (orders.length === 0) {
    return <AdminEmpty icon={<Receipt className="h-5 w-5" />} title={filtered ? 'לא נמצאו הזמנות תואמות' : 'אין הזמנות להצגה'} hint={filtered ? 'נסה מספר הזמנה, שם קונה או שם מוצר אחר.' : undefined} />;
  }
  const pageRows = orders.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pageRows.map((o: any) => {
          const seller = sellers?.find((s: any) => s.id === o.seller_id);
          return (
            <article key={o.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-primary/5 bg-white p-5 shadow-premium" data-admin-order={o.id}>
              <div className="flex items-start justify-between gap-2">
                <OrderStatusBadge status={o.status} />
                <span className="text-xs font-semibold text-muted-foreground">{formatDateTime(o.created_at)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-primary/5">
                  {o.product_image && <Image src={o.product_image} alt="" fill kind="product" sizes="56px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-primary">{o.product_name || 'מוצר'}</p>
                  <p className="text-base font-black tabular-nums text-emerald-700">{formatShekels(o.amount)}</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground" dir="ltr"><Hash className="h-3 w-3" />{o.id}</p>
              <div className="space-y-1.5 border-t border-primary/5 pt-3 text-sm">
                <button type="button" onClick={() => o.buyer_id && onOpenPerson('customer', o.buyer_id)} className="flex w-full items-center justify-between gap-2 rounded-lg text-right hover:text-accent-strong">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-primary"><UserRound className="h-3.5 w-3.5 shrink-0 text-accent-strong" /><span className="truncate underline decoration-primary/15 underline-offset-2">{o.buyer_name || 'קונה'}</span></span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">קונה</span>
                </button>
                <button type="button" onClick={() => o.seller_id && onOpenPerson('seller', o.seller_id)} className="flex w-full items-center justify-between gap-2 rounded-lg text-right hover:text-accent-strong">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/40" /><span className="truncate underline decoration-primary/15 underline-offset-2">{sellerName(seller) || 'מוכר'}</span></span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">מוכר</span>
                </button>
              </div>
              {o.product_id && (
                <Button asChild variant="outline" className="h-9 rounded-xl border-primary/10 text-xs font-bold hover:bg-accent hover:text-primary">
                  <Link href={`/products/${o.product_id}`} target="_blank">צפייה במוצר <ExternalLink className="mr-1 h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <AdminPagination current={page} total={orders.length} onChange={setPage} />
    </div>
  );
}

function ContactBlock({ title, icon, name, phone, email, onOpen }: { title: string; icon: React.ReactNode; name: string; phone?: string | null; email?: string | null; onOpen?: () => void }) {
  return (
    <div className="space-y-2 text-right">
      <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">{icon} {title}</p>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="text-sm font-black text-primary underline decoration-primary/15 underline-offset-2 hover:text-accent-strong">{name || 'לא צוין'}</button>
      ) : <p className="text-sm font-black text-primary">{name || 'לא צוין'}</p>}
      <div className="space-y-1.5 text-sm font-semibold">
        {phone ? (
          <a href={`tel:${phone}`} className="flex w-fit items-center gap-2 text-primary hover:text-accent-strong" dir="ltr"><Phone className="h-3.5 w-3.5" />{phone}</a>
        ) : <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 opacity-40" /> לא צוין</p>}
        {email ? (
          <a href={`mailto:${email}`} className="flex w-fit items-center gap-2 break-all text-primary hover:text-accent-strong" dir="ltr"><Mail className="h-3.5 w-3.5 shrink-0" />{email}</a>
        ) : <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5 opacity-40" /> לא צוין</p>}
      </div>
    </div>
  );
}

// One card per request: a torah_request has 8 fields worth showing (buyer and seller contacts,
// product, date) — a table can't fit that without hiding half of it.
export function TorahRequestsList({ orders, sellers, page, setPage, onOpenPerson, filtered }: { orders: any[]; sellers: any[]; page: number; setPage: (p: number) => void; onOpenPerson: OpenPerson; filtered: boolean }) {
  if (orders.length === 0) return <AdminEmpty icon={<Scroll className="h-5 w-5" />} title={filtered ? 'לא נמצאו בקשות תואמות' : 'אין בקשות לספרי תורה'} />;
  const pageRows = orders.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
  return (
    <div className="space-y-4">
      {pageRows.map((o: any) => {
        const seller = sellers?.find((s: any) => s.id === o.seller_id);
        return (
          <article key={o.id} className="space-y-4 rounded-[1.75rem] border border-primary/5 bg-white p-5 shadow-premium md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-black text-primary"><Scroll className="h-4 w-4 shrink-0 text-accent-strong" />{o.product_name}</p>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatDateTime(o.created_at)} · <span className="font-mono">#{String(o.id).slice(0, 8)}</span></p>
              </div>
              {o.product_id && (
                <Button variant="outline" size="sm" asChild className="h-9 gap-1.5 rounded-full border-primary/10 px-4 text-xs font-bold">
                  <Link href={`/products/${o.product_id}`} target="_blank">צפייה במוצר <ExternalLink className="h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </div>
            <div className="grid gap-5 border-t border-primary/5 pt-4 md:grid-cols-2">
              <ContactBlock title="הלקוח" icon={<UserRound className="h-3.5 w-3.5" />} name={o.buyer_name} phone={o.buyer_phone} email={o.buyer_email} onOpen={o.buyer_id ? () => onOpenPerson('customer', o.buyer_id) : undefined} />
              <div className="border-primary/5 md:border-r md:pr-6">
                <ContactBlock title="הסופר" icon={<Scroll className="h-3.5 w-3.5" />} name={sellerName(seller)} phone={seller?.phone} email={seller?.email} onOpen={o.seller_id ? () => onOpenPerson('seller', o.seller_id) : undefined} />
              </div>
            </div>
          </article>
        );
      })}
      <AdminPagination current={page} total={orders.length} onChange={setPage} />
    </div>
  );
}
