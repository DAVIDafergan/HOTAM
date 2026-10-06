"use client";

import { useEffect, useMemo, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-hooks';
import { SELLER_TYPE_LABELS, resolveSellerType } from '@/lib/product-catalog';
import { cn } from '@/lib/utils';

// Admin "יומן ביקורת": sensitive changes recorded by database triggers (docs/admin-audit-log-migration.sql),
// whoever made them and through whichever path. Bank/business values are never stored, only that they changed.

type AuditEntry = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_kind: 'admin' | 'user' | 'server' | 'database';
  action: string;
  table_name: string;
  record_id: string | null;
  details: Record<string, any>;
};

const FILTERS = [
  { key: 'all', label: 'הכל', match: () => true },
  { key: 'sellers', label: 'מוכרים', match: (e: AuditEntry) => e.table_name === 'sellers' },
  { key: 'orders', label: 'הזמנות', match: (e: AuditEntry) => e.table_name === 'orders' },
  { key: 'deletions', label: 'מחיקות', match: (e: AuditEntry) => e.action.endsWith('_deleted') },
  { key: 'admins', label: 'הרשאות מנהל', match: (e: AuditEntry) => e.table_name === 'admins' },
] as const;

const ORDER_STATUS: Record<string, string> = {
  pending_payment: 'ממתין לתשלום', paid: 'שולם', completed: 'הושלם', cancelled: 'בוטל', refunded: 'הוחזר', torah_request: 'בקשת ספר תורה',
};
const UPGRADE_STATUS: Record<string, string> = { none: 'ללא', pending: 'הוגשה', approved: 'אושרה', rejected: 'נדחתה' };

function describe(e: AuditEntry): string {
  const d = e.details || {};
  const name = d.name ? ` ${d.name}` : '';
  switch (e.action) {
    case 'seller_updated': {
      const parts: string[] = [];
      if (d.is_approved) parts.push(d.is_approved[1] ? 'אושר כמוכר' : 'אישור המוכר בוטל');
      if (d.seller_type) parts.push(`סוג המוכר שונה ל"${SELLER_TYPE_LABELS[resolveSellerType(d.seller_type[1])]}"`);
      if (d.stam_upgrade_status) parts.push(`בקשת שדרוג לסופר: ${UPGRADE_STATUS[d.stam_upgrade_status[1]] || d.stam_upgrade_status[1]}`);
      if (d.bank_details_changed) parts.push('פרטי הבנק עודכנו');
      if (d.business_details_changed) parts.push('פרטי העסק עודכנו');
      if (d.email_changed) parts.push('כתובת המייל שונתה');
      return `מוכר${name}: ${parts.join(' · ')}`;
    }
    case 'seller_deleted': return `המוכר${name} נמחק`;
    case 'customer_deleted': return `הלקוח${name} נמחק`;
    case 'product_deleted': return `מוצר נמחק (${d.product_type || 'מוצר'})`;
    case 'order_status_changed':
      return `הזמנה #${String(e.record_id).slice(0, 8)} (${d.product_name || ''}): ${ORDER_STATUS[d.from] || d.from} ← ${ORDER_STATUS[d.to] || d.to}`;
    case 'order_deleted': return `הזמנה #${String(e.record_id).slice(0, 8)} נמחקה (${ORDER_STATUS[d.status] || d.status})`;
    case 'admin_added': return `נוסף מנהל: ${d.email || ''}`;
    case 'admin_removed': return `הוסר מנהל: ${d.email || ''}`;
    default: return e.action;
  }
}

export function AdminAuditLogPanel() {
  const db = useSupabaseClient();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300);
      if (cancelled) return;
      if (error) {
        // Before the migration runs there's no audit_log table yet.
        setNotInstalled(true);
        setEntries([]);
        return;
      }
      const rows = (data || []) as AuditEntry[];
      setEntries(rows);
      const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
      if (ids.length === 0) return;
      const [admins, sellers, customers] = await Promise.all([
        db.from('admins').select('id, email').in('id', ids),
        db.from('sellers').select('id, first_name, last_name').in('id', ids),
        db.from('customers').select('id, first_name, last_name').in('id', ids),
      ]);
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const c of customers.data || []) map.set(c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim());
      for (const s of sellers.data || []) map.set(s.id, `${s.first_name || ''} ${s.last_name || ''}`.trim());
      for (const a of admins.data || []) map.set(a.id, a.email);
      setNames(map);
    })();
    return () => { cancelled = true; };
  }, [db]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return (entries || []).filter((e) => f.match(e));
  }, [entries, filter]);

  const actorLabel = (e: AuditEntry) => {
    if (e.actor_kind === 'server') return 'המערכת (שרת)';
    if (e.actor_kind === 'database') return 'ישירות במסד הנתונים';
    if (e.actor_id && e.actor_id === e.record_id) return 'המשתמש עצמו';
    const who = (e.actor_id && names.get(e.actor_id)) || 'משתמש';
    return e.actor_kind === 'admin' ? `מנהל: ${who}` : who;
  };

  if (entries === null) return <div className="flex justify-center p-24"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>;
  if (notInstalled) {
    return (
      <div className="rounded-[2rem] bg-white p-12 text-center shadow-premium" data-audit-not-installed>
        <History className="mx-auto mb-3 h-8 w-8 text-primary/30" />
        <p className="font-black text-primary">יומן הביקורת יופעל לאחר הרצת המיגרציה</p>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">docs/admin-audit-log-migration.sql</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-audit-log dir="rtl">
      <div className="flex flex-wrap justify-end gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn('h-9 rounded-full border px-4 text-xs font-black transition-colors', filter === f.key ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-white text-primary/60 hover:text-primary')}
          >
            {f.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-[2rem] bg-white p-16 text-center font-semibold text-muted-foreground shadow-premium">אין רשומות להצגה.</div>
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-primary/5 bg-white shadow-premium">
          {visible.map((e) => (
            <div key={e.id} data-audit-entry={e.action} className="flex flex-col gap-1 border-b border-primary/5 px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between md:gap-6">
              <p className="text-sm font-bold text-primary">{describe(e)}</p>
              <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-muted-foreground">
                <span data-audit-actor>{actorLabel(e)}</span>
                <span className="tabular-nums">{new Date(e.created_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="px-1 text-xs font-semibold text-muted-foreground">מוצגות 300 הרשומות האחרונות. פרטי בנק ועסק אינם נשמרים ביומן — רק העובדה שעודכנו.</p>
    </div>
  );
}
