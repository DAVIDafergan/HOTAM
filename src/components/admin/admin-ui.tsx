"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Small, shared pieces of the admin screens: list states, pagination, a Hebrew confirm dialog,
// order-status labels and date formatting. Kept here so every panel looks and speaks the same.

export const ADMIN_PAGE_SIZE = 15;

/* ----------------------------------------- dates ----------------------------------------- */

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatDate = (value: any) => toDate(value)?.toLocaleDateString('he-IL') ?? '—';

export const formatDateTime = (value: any) => {
  const d = toDate(value);
  return d ? `${d.toLocaleDateString('he-IL')} · ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : '—';
};

/** "לפני 3 שעות" style, falling back to the date after a week. */
export function timeAgo(value: any) {
  const d = toDate(value);
  if (!d) return '—';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? 'לפני שעה' : `לפני ${hr} שעות`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'אתמול';
  if (day < 7) return `לפני ${day} ימים`;
  return d.toLocaleDateString('he-IL');
}

export const formatShekels = (n: unknown) => `₪${Math.round(Number(n) || 0).toLocaleString('he-IL')}`;

/* ------------------------------------- order status -------------------------------------- */

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'ממתין לתשלום', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  paid: { label: 'שולם — ממתין למסירה', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  completed: { label: 'הושלם', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  torah_request: { label: 'בקשת ספר תורה', tone: 'bg-amber-50 text-amber-800 border-amber-100' },
  cancelled: { label: 'בוטל', tone: 'bg-red-50 text-red-700 border-red-100' },
  refunded: { label: 'זוכה', tone: 'bg-red-50 text-red-700 border-red-100' },
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = ORDER_STATUS[status] || { label: status || 'לא ידוע', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold', s.tone, className)}>{s.label}</span>;
}

/* ------------------------------------- list states --------------------------------------- */

export function AdminLoading({ label = 'טוען...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 rounded-[1.5rem] border border-primary/5 bg-white p-10 text-sm font-bold text-muted-foreground shadow-premium', className)} role="status">
      <Loader2 className="h-5 w-5 animate-spin text-primary/40" /> {label}
    </div>
  );
}

export function AdminEmpty({ title, hint, icon, compact, className }: { title: string; hint?: string; icon?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-primary/10 bg-white text-center',
      compact ? 'gap-1 px-4 py-6' : 'gap-2 px-6 py-14', className,
    )}>
      {!compact && <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">{icon ?? <Inbox className="h-5 w-5" />}</span>}
      <p className={cn('font-bold text-primary', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {hint && <p className="max-w-md text-xs font-medium text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminError({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-[1.5rem] border border-destructive/15 bg-destructive/5 px-6 py-8 text-center', className)} role="alert">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm font-bold text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="h-9 gap-1.5 rounded-full bg-white text-xs font-bold">
          <RefreshCw className="h-3.5 w-3.5" /> נסה שוב
        </Button>
      )}
    </div>
  );
}

/** Small heading above a list, with an optional count and hint. */
export function AdminSectionTitle({ children, count, hint, className }: { children: ReactNode; count?: number; hint?: string; className?: string }) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1', className)}>
      <h2 className="text-base font-black text-primary">{children}</h2>
      {count != null && <span className="rounded-full bg-primary/5 px-2 py-0.5 text-xs font-bold tabular-nums text-primary/70">{count}</span>}
      {hint && <span className="text-xs font-medium text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** "Filter this list" box shown above list tabs (the header search looks across the whole site). */
export function AdminListFilter({ value, onChange, placeholder = 'סינון הרשימה לפי שם, אימייל או מזהה…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('flex h-11 w-full items-center gap-2 rounded-2xl border border-primary/10 bg-white px-3.5 shadow-sm focus-within:border-primary/30 sm:max-w-sm', className)}>
      <Search className="h-4 w-4 shrink-0 text-primary/40" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="סינון הרשימה"
        className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-primary outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="rounded-full p-1 text-muted-foreground hover:bg-primary/5 hover:text-primary" aria-label="ניקוי הסינון">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function AdminPagination({ current, total, onChange, pageSize = ADMIN_PAGE_SIZE }: { current: number; total: number; onChange: (p: number) => void; pageSize?: number }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3 py-4" aria-label="עימוד">
      <Button variant="outline" size="sm" onClick={() => onChange(current - 1)} disabled={current <= 1} className="h-10 gap-1 rounded-xl border-primary/10 bg-white px-3 font-bold">
        <ChevronRight className="h-4 w-4" /> הקודם
      </Button>
      <span className="text-xs font-bold tabular-nums text-muted-foreground">עמוד {current} מתוך {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onChange(current + 1)} disabled={current >= totalPages} className="h-10 gap-1 rounded-xl border-primary/10 bg-white px-3 font-bold">
        הבא <ChevronLeft className="h-4 w-4" />
      </Button>
    </nav>
  );
}

/** Label: value row used in the detail dialogs. Wraps instead of overflowing on phones. */
export function DetailRow({ label, children, ltr }: { label: string; children: ReactNode; ltr?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-primary/5 py-2 last:border-none">
      <span className="shrink-0 text-xs font-bold text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 break-words text-sm font-semibold text-primary', ltr && 'text-left')} dir={ltr ? 'ltr' : undefined}>{children || '—'}</span>
    </div>
  );
}

/* --------------------------------------- confirm ----------------------------------------- */

type ConfirmOptions = { title: string; description?: ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Hebrew confirmation dialog for destructive admin actions (instead of the browser's confirm()).
 * Above every other dialog (z-[220]) so it also works from inside a details dialog.
 */
export function AdminConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setState(opts);
  }), []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialogPrimitive.Root open={!!state} onOpenChange={(open) => { if (!open) close(false); }}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[220] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialogPrimitive.Content
            dir="rtl"
            className="fixed left-1/2 top-1/2 z-[221] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[1.75rem] bg-white p-6 text-right shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            data-admin-confirm
          >
            <div className="flex items-start gap-3">
              {state?.destructive && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></span>
              )}
              <div className="min-w-0 space-y-1.5">
                <AlertDialogPrimitive.Title className="text-lg font-black text-primary">{state?.title}</AlertDialogPrimitive.Title>
                {state?.description && (
                  <AlertDialogPrimitive.Description className="text-sm font-medium leading-relaxed text-muted-foreground">{state.description}</AlertDialogPrimitive.Description>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
              <AlertDialogPrimitive.Action asChild>
                <Button
                  onClick={() => close(true)}
                  variant={state?.destructive ? 'destructive' : 'default'}
                  className="h-11 rounded-full px-6 font-bold"
                >
                  {state?.confirmLabel || 'אישור'}
                </Button>
              </AlertDialogPrimitive.Action>
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="outline" onClick={() => close(false)} className="h-11 rounded-full px-6 font-bold">
                  {state?.cancelLabel || 'ביטול'}
                </Button>
              </AlertDialogPrimitive.Cancel>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}

/** `if (!(await confirm({ title, destructive: true }))) return;` — falls back to window.confirm. */
export function useAdminConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return ctx ?? (async (opts) => window.confirm(opts.title));
}

/* ------------------------------------- search terms -------------------------------------- */

/** Text safe to put inside a PostgREST or=(…) filter: no wildcards, commas, brackets or quotes. */
export function sanitizeSearchTerm(raw: string) {
  return raw.replace(/[%_*,()"'\\:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** An ilike pattern that finds a phone number whatever its separators ("%5%2%1%…"), or null. */
export function phoneSearchPattern(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6 || digits.length < raw.replace(/[\s\-+()]/g, '').length) return null;
  return `%${digits.slice(-7).split('').join('%')}%`;
}

/** or=(…) parts matching a person's name, email and phone. A two-word term also matches "first last". */
export function personSearchFilter(raw: string, extraColumns: string[] = []) {
  const term = sanitizeSearchTerm(raw);
  if (!term) return null;
  const like = `%${term}%`;
  const parts = ['first_name', 'last_name', 'email', ...extraColumns].map((c) => `${c}.ilike.${like}`);
  const words = term.split(' ');
  if (words.length >= 2) parts.push(`and(first_name.ilike.%${words[0]}%,last_name.ilike.%${words.slice(1).join(' ')}%)`);
  const phone = phoneSearchPattern(raw);
  if (phone) parts.push(`phone.ilike.${phone}`);
  if (/^[0-9a-f-]{32,36}$/i.test(term)) parts.push(`id.eq.${term}`);
  return parts.join(',');
}
