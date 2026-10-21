"use client";

import { useMemo } from 'react';
import { Eye, IdCard, List, Loader2, ShoppingBag, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AdminPhoneStatus } from './AdminPhoneStatus';
import { OrdersMiniList, usePersonOrders } from './AdminSellers';
import { AdminEmpty, AdminLoading, AdminPagination, DetailRow, formatDate, formatShekels } from './admin-ui';

const fullName = (c: any) => `${c?.first_name || ''} ${c?.last_name || ''}`.trim() || 'ללא שם';

type Stats = { completedOrders: number; totalSpent: number; openOrders: number };

function useCustomerStats(orders: any[]) {
  return useMemo(() => {
    const map = new Map<string, Stats>();
    for (const o of orders || []) {
      if (!o?.buyer_id) continue;
      const s = map.get(o.buyer_id) || { completedOrders: 0, totalSpent: 0, openOrders: 0 };
      if (o.status === 'completed') { s.completedOrders += 1; s.totalSpent += Number(o.amount || 0); }
      else if (o.status === 'paid' || o.status === 'torah_request') s.openOrders += 1;
      map.set(o.buyer_id, s);
    }
    return map;
  }, [orders]);
}

function SummaryCard({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'money' }) {
  return (
    <div className="rounded-[1.25rem] border border-primary/5 bg-white p-4 shadow-sm">
      <p className={cn('text-2xl font-black tabular-nums', tone === 'money' ? 'text-emerald-700' : 'text-primary')}>{value}</p>
      <p className="mt-0.5 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

export function CustomersTable({
  customers, orders, isLoading, onOpen, onDelete, deletingCustomerId, totalCount, page, setPage, resolveCreatedAt, filtered,
}: {
  customers: any[]; orders: any[]; isLoading: boolean; onOpen: (c: any) => void; onDelete: (c: any) => void;
  deletingCustomerId: string | null; totalCount: number; page: number; setPage: (p: number) => void;
  resolveCreatedAt: (c: any) => string | null; filtered: boolean;
}) {
  const stats = useCustomerStats(orders);
  // Site-wide figures from the loaded orders (the last 1,000), not just this page of customers.
  const summary = useMemo(() => {
    let buyers = 0, completed = 0, revenue = 0;
    stats.forEach((s) => { if (s.completedOrders > 0) buyers += 1; completed += s.completedOrders; revenue += s.totalSpent; });
    return { buyers, completed, revenue };
  }, [stats]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label={filtered ? 'לקוחות תואמים' : 'לקוחות רשומים'} value={totalCount.toLocaleString('he-IL')} />
        <SummaryCard label="לקוחות שקנו" value={summary.buyers.toLocaleString('he-IL')} />
        <SummaryCard label="עסקאות שהושלמו" value={summary.completed.toLocaleString('he-IL')} />
        <SummaryCard label="סך רכישות" value={formatShekels(summary.revenue)} tone="money" />
      </div>

      {isLoading && customers.length === 0 ? <AdminLoading /> : customers.length === 0 ? (
        <AdminEmpty icon={<UserRound className="h-5 w-5" />} title={filtered ? 'לא נמצאו לקוחות תואמים' : 'אין עדיין לקוחות'} hint={filtered ? 'נסה שם, אימייל או טלפון אחר.' : undefined} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-premium md:block">
            <Table>
              <TableHeader className="bg-primary/[0.02]">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="px-6 py-4 text-right text-xs font-bold text-muted-foreground">לקוח</TableHead>
                  <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">טלפון</TableHead>
                  <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">רכישות</TableHead>
                  <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">הצטרף</TableHead>
                  <TableHead className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => {
                  const s = stats.get(c.id) || { completedOrders: 0, totalSpent: 0, openOrders: 0 };
                  const deleting = deletingCustomerId === c.id;
                  return (
                    <TableRow key={c.id} className="cursor-pointer border-primary/5 hover:bg-primary/[0.015]" onClick={() => onOpen(c)}>
                      <TableCell className="px-6 py-4">
                        <p className="text-sm font-black text-primary">{fullName(c)}</p>
                        <p className="text-xs font-medium text-muted-foreground" dir="ltr">{c.email || 'ללא אימייל'}</p>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-primary/70" dir="ltr">{c.phone || '—'}</TableCell>
                      <TableCell>
                        <p className="text-sm font-black tabular-nums text-emerald-700">{formatShekels(s.totalSpent)}</p>
                        <p className="text-xs font-medium text-muted-foreground">{s.completedOrders} הושלמו{s.openOrders ? ` · ${s.openOrders} פתוחות` : ''}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-semibold text-muted-foreground">{formatDate(resolveCreatedAt(c))}</TableCell>
                      <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => onOpen(c)} className="h-9 gap-1.5 rounded-full border-primary/10 px-4 text-xs font-bold" data-admin-open-customer>
                            <Eye className="h-4 w-4" /> פרטים
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(c)} disabled={deleting} aria-label={`מחיקת ${fullName(c)}`} title="מחיקת לקוח" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {customers.map((c) => {
              const s = stats.get(c.id) || { completedOrders: 0, totalSpent: 0, openOrders: 0 };
              const deleting = deletingCustomerId === c.id;
              return (
                <div key={c.id} className="space-y-3 rounded-[1.5rem] border border-primary/5 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-black text-primary">{fullName(c)}</p>
                      <p className="break-all text-xs font-medium text-muted-foreground" dir="ltr">{c.email || 'ללא אימייל'}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black tabular-nums text-emerald-700">{formatShekels(s.totalSpent)}</span>
                  </div>
                  <p className="text-xs font-semibold text-primary/70">
                    {s.completedOrders} עסקאות{s.openOrders ? ` · ${s.openOrders} פתוחות` : ''} · הצטרף {formatDate(resolveCreatedAt(c))}
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => onOpen(c)} className="h-11 flex-1 gap-1.5 rounded-2xl text-sm font-bold" data-admin-open-customer>
                      <Eye className="h-4 w-4" /> פרטים והזמנות
                    </Button>
                    <Button variant="outline" onClick={() => onDelete(c)} disabled={deleting} className="h-11 rounded-2xl px-4 text-destructive" aria-label={`מחיקת ${fullName(c)}`}>
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <AdminPagination current={page} total={totalCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export function CustomerDetailsDialog({ customer, createdAt, onDelete, onClose, isDeleting, onShowInList }: {
  customer: any; createdAt: string | null; onDelete: () => void; onClose: () => void; isDeleting: boolean; onShowInList?: () => void;
}) {
  const { orders, error } = usePersonOrders('buyer_id', customer.id, true);
  const spent = (orders || []).filter((o) => o.status === 'completed').reduce((s, o) => s + Number(o.amount || 0), 0);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="z-[150] max-h-[88vh] max-w-2xl overflow-y-auto rounded-[2rem] border-none bg-white p-0 shadow-2xl" dir="rtl" data-admin-customer-detail>
        <div className="sticky top-0 z-50 bg-primary p-5 text-right text-white md:p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-4 font-headline text-xl font-black text-white">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10"><UserRound className="h-6 w-6" /></span>
              <span className="min-w-0">
                <span className="block break-words">{fullName(customer)}</span>
                <span className="mt-0.5 block break-all text-xs font-medium text-white/70" dir="ltr">{customer.email}</span>
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">פרטי הלקוח, ההזמנות שלו ועדכוני הטלפון</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-7 p-5 text-right md:p-8">
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-primary"><IdCard className="h-4 w-4 text-accent-strong" /> פרטי לקוח</h3>
            <div className="rounded-2xl bg-primary/[0.03] px-4 py-1">
              <DetailRow label="טלפון" ltr>{customer.phone && <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>}</DetailRow>
              <DetailRow label="כתובת">{customer.address}</DetailRow>
              <DetailRow label="הצטרף">{formatDate(createdAt)}</DetailRow>
              <DetailRow label="סך רכישות שהושלמו">{orders ? formatShekels(spent) : '…'}</DetailRow>
              <DetailRow label="מזהה" ltr><span className="font-mono text-xs">{customer.id}</span></DetailRow>
            </div>
          </section>

          <section className="space-y-2" data-admin-customer-orders>
            <h3 className="flex items-center gap-2 text-sm font-black text-primary"><ShoppingBag className="h-4 w-4 text-accent-strong" /> הזמנות{orders ? ` (${orders.length})` : ''}</h3>
            <OrdersMiniList orders={orders} error={error} empty="אין הזמנות ללקוח הזה." />
          </section>

          <AdminPhoneStatus userId={customer.id} />
        </div>

        <div className="sticky bottom-0 z-40 flex flex-wrap justify-between gap-2 border-t bg-white p-4 md:p-5">
          {onShowInList ? (
            <Button variant="outline" onClick={onShowInList} className="h-10 gap-1.5 rounded-full text-xs font-bold"><List className="h-4 w-4" /> הצג ברשימה</Button>
          ) : <span />}
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting} className="h-10 gap-2 rounded-full px-5 text-xs font-bold">
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} מחיקת הלקוח
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
