"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Loader2, Receipt, Search, ShieldCheck, ShoppingBag, UserRound, X } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { resolveSellerType } from '@/lib/product-catalog';
import { OrderStatusBadge, formatDate, formatShekels, personSearchFilter, phoneSearchPattern, sanitizeSearchTerm } from './admin-ui';

// One box to find a seller, a customer or an order — by name, email, phone or order number —
// and jump straight to it. Reads go through the admin's own session (RLS lets admins read these
// tables), so nothing new is exposed: the same fields the admin lists already show.

const PER_GROUP = 6;

export type SearchHit =
  | { type: 'seller'; id: string; row: any }
  | { type: 'customer'; id: string; row: any }
  | { type: 'order'; id: string; row: any };

function useGlobalSearch(term: string) {
  const db = useSupabaseClient();
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = term.trim();
    if (raw.length < 2) { setHits([]); setLoading(false); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const personFilter = personSearchFilter(raw);
        const sellerFilter = personSearchFilter(raw, ['business_name']);
        const clean = sanitizeSearchTerm(raw).replace(/^#/, '');
        const phone = phoneSearchPattern(raw);
        const orderParts = clean ? [
          `id.ilike.${clean}%`, `buyer_name.ilike.%${clean}%`, `buyer_email.ilike.%${clean}%`, `product_name.ilike.%${clean}%`,
          ...(phone ? [`buyer_phone.ilike.${phone}`] : []),
        ].join(',') : null;
        const [sellers, customers, orders] = await Promise.all([
          sellerFilter ? db.from('sellers').select('id, first_name, last_name, email, phone, city, is_approved, seller_type, business_name, stam_upgrade_status, created_at').or(sellerFilter).limit(PER_GROUP) : { data: [], error: null },
          personFilter ? db.from('customers').select('id, first_name, last_name, email, phone, address, created_at').or(personFilter).limit(PER_GROUP) : { data: [], error: null },
          orderParts ? db.from('orders').select('id, buyer_id, seller_id, buyer_name, buyer_email, product_name, amount, status, created_at').or(orderParts).order('created_at', { ascending: false }).limit(PER_GROUP) : { data: [], error: null },
        ]);
        if (cancelled) return;
        const failed = [sellers, customers, orders].find((r: any) => r.error);
        setError(failed ? 'חלק מהתוצאות לא נטענו. נסה שוב.' : null);
        setHits([
          ...(sellers.data || []).map((row: any) => ({ type: 'seller' as const, id: String(row.id), row: { ...row, id: String(row.id) } })),
          ...(customers.data || []).map((row: any) => ({ type: 'customer' as const, id: String(row.id), row: { ...row, id: String(row.id) } })),
          ...(orders.data || []).map((row: any) => ({ type: 'order' as const, id: String(row.id), row })),
        ]);
      } catch {
        if (!cancelled) setError('החיפוש נכשל. בדוק את החיבור ונסה שוב.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [db, term]);

  return { hits, loading, error };
}

const GROUPS: { type: SearchHit['type']; label: string }[] = [
  { type: 'seller', label: 'מוכרים' },
  { type: 'customer', label: 'לקוחות' },
  { type: 'order', label: 'הזמנות' },
];

function HitRow({ hit, active, onPick }: { hit: SearchHit; active: boolean; onPick: () => void }) {
  const r = hit.row;
  let icon, title: string, sub: string, badge: React.ReactNode = null;
  if (hit.type === 'seller') {
    const judaica = resolveSellerType(r.seller_type) === 'judaica_seller';
    icon = judaica ? <ShoppingBag className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />;
    title = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.business_name || 'מוכר';
    sub = [r.email, r.phone, r.city].filter(Boolean).join(' · ');
    badge = (
      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', r.is_approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
        {r.is_approved ? (judaica ? 'מוכר יודאיקה' : 'סופר סת"ם') : 'ממתין לאישור'}
      </span>
    );
  } else if (hit.type === 'customer') {
    icon = <UserRound className="h-4 w-4" />;
    title = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'לקוח';
    sub = [r.email, r.phone].filter(Boolean).join(' · ');
  } else {
    icon = <Receipt className="h-4 w-4" />;
    title = `${r.product_name || 'הזמנה'} · ${formatShekels(r.amount)}`;
    sub = `#${String(r.id).slice(0, 8)} · ${r.buyer_name || '—'} · ${formatDate(r.created_at)}`;
    badge = <OrderStatusBadge status={r.status} />;
  }
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      data-admin-search-hit={hit.type}
      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors', active ? 'bg-accent/15' : 'hover:bg-primary/[0.04]')}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary/60">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-primary">{title}</span>
        <span className="block truncate text-xs font-medium text-muted-foreground" dir="auto">{sub || '—'}</span>
      </span>
      {badge}
    </button>
  );
}

function Results({ term, hits, loading, error, activeIndex, onPick }: { term: string; hits: SearchHit[]; loading: boolean; error: string | null; activeIndex: number; onPick: (h: SearchHit) => void }) {
  if (term.trim().length < 2) {
    return <p className="px-4 py-6 text-center text-xs font-medium text-muted-foreground">הקלד לפחות 2 תווים: שם, אימייל, טלפון או מספר הזמנה.</p>;
  }
  if (loading && hits.length === 0) {
    return <p className="flex items-center justify-center gap-2 px-4 py-6 text-xs font-bold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> מחפש…</p>;
  }
  if (hits.length === 0) {
    return <p className="px-4 py-6 text-center text-sm font-bold text-muted-foreground">{error || `לא נמצאו תוצאות עבור "${term.trim()}"`}</p>;
  }
  let index = -1;
  return (
    <div className="space-y-3 p-2">
      {GROUPS.map((g) => {
        const group = hits.filter((h) => h.type === g.type);
        if (group.length === 0) return null;
        return (
          <div key={g.type}>
            <p className="px-3 pb-1 text-[11px] font-bold text-muted-foreground">{g.label}</p>
            {group.map((h) => { index++; const i = index; return <HitRow key={`${h.type}-${h.id}`} hit={h} active={i === activeIndex} onPick={() => onPick(h)} />; })}
          </div>
        );
      })}
      {error && <p className="px-3 text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}

function SearchInput({ value, onChange, onKeyDown, onFocus, autoFocus, loading }: { value: string; onChange: (v: string) => void; onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void; onFocus?: () => void; autoFocus?: boolean; loading?: boolean }) {
  return (
    <div className="flex h-12 items-center gap-2 rounded-2xl border border-primary/10 bg-white px-4 shadow-premium focus-within:border-primary/30">
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary/40" /> : <Search className="h-4 w-4 shrink-0 text-primary/40" aria-hidden />}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder="חיפוש מוכר, לקוח או הזמנה…"
        aria-label="חיפוש בכל המערכת"
        data-admin-global-search-input
        className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-primary outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')} className="rounded-full p-1 text-muted-foreground hover:bg-primary/5" aria-label="ניקוי החיפוש">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Desktop: an inline box with a dropdown. Phones: a search button that opens a full-width sheet. */
export function AdminGlobalSearch({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const { hits, loading, error } = useGlobalSearch(term);
  const boxRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => GROUPS.flatMap((g) => hits.filter((h) => h.type === g.type)), [hits]);

  useEffect(() => { setActiveIndex(0); }, [hits]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (hit: SearchHit) => {
    setOpen(false);
    setSheetOpen(false);
    setTerm('');
    onPick(hit);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, ordered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && ordered[activeIndex]) { e.preventDefault(); pick(ordered[activeIndex]); }
  };

  return (
    <>
      <div ref={boxRef} className="relative hidden w-full max-w-md md:block" data-admin-global-search>
        <SearchInput value={term} onChange={(v) => { setTerm(v); setOpen(true); }} onKeyDown={onKeyDown} onFocus={() => setOpen(true)} loading={loading} />
        {open && term.trim().length > 0 && (
          <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[60] max-h-[70vh] overflow-y-auto rounded-2xl border border-primary/10 bg-white shadow-2xl" role="listbox">
            <Results term={term} hits={hits} loading={loading} error={error} activeIndex={activeIndex} onPick={pick} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-white text-primary shadow-sm md:hidden"
        aria-label="חיפוש בכל המערכת"
        data-admin-search-trigger
      >
        <Search className="h-5 w-5" />
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="top" className="max-h-[90vh] overflow-y-auto rounded-b-[2rem] border-none bg-[#F8F9FA] p-4 pt-6" dir="rtl">
          <SheetHeader className="mb-3 pr-12 text-right">
            <SheetTitle className="text-base font-black text-primary">חיפוש בכל המערכת</SheetTitle>
            <SheetDescription className="text-xs">מוכרים, לקוחות והזמנות — לפי שם, אימייל, טלפון או מספר הזמנה</SheetDescription>
          </SheetHeader>
          <SearchInput value={term} onChange={setTerm} onKeyDown={onKeyDown} autoFocus loading={loading} />
          <div className="mt-3 rounded-2xl bg-white">
            <Results term={term} hits={hits} loading={loading} error={error} activeIndex={activeIndex} onPick={pick} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
