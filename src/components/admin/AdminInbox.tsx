"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Flag, Inbox, Mail, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ADMIN_PAGE_SIZE, AdminEmpty, AdminPagination, DetailRow, formatDate, formatDateTime, timeAgo } from './admin-ui';

type OpenPerson = (type: 'seller' | 'customer', id: string) => void;

/* --------------------------------------- reports ---------------------------------------- */

export function ReportsList({ reports, page, setPage, onDelete, onOpenPerson, filtered }: {
  reports: any[]; page: number; setPage: (p: number) => void; onDelete: (r: any) => void; onOpenPerson: OpenPerson; filtered: boolean;
}) {
  if (reports.length === 0) {
    return <AdminEmpty icon={<Flag className="h-5 w-5" />} title={filtered ? 'לא נמצאו דיווחים תואמים' : 'אין דיווחים פתוחים'} hint={filtered ? undefined : 'כשלקוח מדווח על מוכר, הדיווח יופיע כאן.'} />;
  }
  const rows = reports.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-primary/5 overflow-hidden rounded-[1.5rem] border border-primary/5 bg-white shadow-premium">
        {rows.map((r: any) => (
          <li key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:gap-5 md:p-5" data-admin-report={r.id}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-bold leading-relaxed text-destructive">{r.reason || 'ללא סיבה'}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {r.reporter_id ? (
                  <button type="button" onClick={() => onOpenPerson('customer', r.reporter_id)} className="font-bold text-primary underline decoration-primary/15 underline-offset-2 hover:text-accent-strong">{r.reporter_name || 'מדווח'}</button>
                ) : <span className="font-bold text-primary">{r.reporter_name || 'מדווח'}</span>}
                {' דיווח/ה על '}
                {r.seller_id ? (
                  <button type="button" onClick={() => onOpenPerson('seller', r.seller_id)} className="font-bold text-primary underline decoration-primary/15 underline-offset-2 hover:text-accent-strong">{r.seller_name || 'מוכר'}</button>
                ) : <span className="font-bold text-primary">{r.seller_name || 'מוכר'}</span>}
                {' · '}{timeAgo(r.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {r.seller_id && (
                <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 rounded-full border-primary/10 text-xs font-bold">
                  <Link href={`/sellers/${r.seller_id}`} target="_blank">פרופיל המוכר <ExternalLink className="h-3.5 w-3.5" /></Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onDelete(r)} className="h-9 gap-1.5 rounded-full text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" /> טופל — מחיקה
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <AdminPagination current={page} total={reports.length} onChange={setPage} />
    </div>
  );
}

/* -------------------------------------- inquiries --------------------------------------- */

const STATUS_LABEL: Record<string, string> = { new: 'חדשה', read: 'נקראה', resolved: 'טופלה' };
const STATUS_TONE: Record<string, string> = {
  new: 'bg-accent/15 text-accent-strong border-accent/30',
  read: 'bg-sky-50 text-sky-700 border-sky-100',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};
export type InquiryFilter = 'open' | 'new' | 'resolved' | 'all';
export const INQUIRY_FILTERS: { id: InquiryFilter; label: string }[] = [
  { id: 'open', label: 'פתוחות' }, { id: 'new', label: 'חדשות' }, { id: 'resolved', label: 'טופלו' }, { id: 'all', label: 'הכל' },
];
export const matchesInquiryFilter = (m: any, f: InquiryFilter) => {
  const s = m.status || 'new';
  return f === 'all' ? true : f === 'open' ? s !== 'resolved' : s === f;
};

export function InquiryFilterBar({ value, onChange, counts }: { value: InquiryFilter; onChange: (f: InquiryFilter) => void; counts: Record<InquiryFilter, number> }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {INQUIRY_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          aria-pressed={value === f.id}
          className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors',
            value === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/10 bg-white text-primary/70 hover:border-primary/30')}
        >
          {f.label}<span className="tabular-nums opacity-70">{counts[f.id]}</span>
        </button>
      ))}
    </div>
  );
}

export function InquiriesList({ inquiries, allInquiries, page, setPage, onDelete, onUpdateStatus, filtered }: {
  inquiries: any[]; /** unfiltered list: an opened inquiry stays open after it leaves the filter (new → read) */ allInquiries?: any[]; page: number; setPage: (p: number) => void; onDelete: (m: any) => void;
  onUpdateStatus: (id: string, status: 'new' | 'read' | 'resolved') => void; filtered: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = (allInquiries || inquiries).find((m) => m.id === openId) || null;
  const dialog = opened && <InquiryDialog inquiry={opened} onClose={() => setOpenId(null)} onUpdateStatus={onUpdateStatus} />;
  if (inquiries.length === 0) {
    return <>{dialog}<AdminEmpty icon={<Inbox className="h-5 w-5" />} title={filtered ? 'אין פניות בסינון הזה' : 'אין פניות'} hint={filtered ? 'נסה סינון אחר.' : undefined} /></>;
  }
  const rows = inquiries.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
  const open = (m: any) => {
    setOpenId(m.id);
    if ((m.status || 'new') === 'new') onUpdateStatus(m.id, 'read');
  };
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-primary/5 overflow-hidden rounded-[1.5rem] border border-primary/5 bg-white shadow-premium">
        {rows.map((m: any) => {
          const status = m.status || 'new';
          return (
            <li key={m.id} className={cn('flex items-start gap-3 p-4 md:p-5', status === 'new' && 'bg-accent/[0.04]')} data-admin-inquiry={m.id}>
              <button type="button" onClick={() => open(m)} className="min-w-0 flex-1 space-y-1 text-right">
                <span className="flex flex-wrap items-center gap-2">
                  {status === 'new' && <span className="h-2 w-2 rounded-full bg-accent-strong" aria-label="חדשה" />}
                  <span className="text-sm font-black text-primary">{m.name || 'ללא שם'}</span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', STATUS_TONE[status] || STATUS_TONE.new)}>{STATUS_LABEL[status] || 'חדשה'}</span>
                  <span className="text-xs font-medium text-muted-foreground">{timeAgo(m.created_at)}</span>
                </span>
                <span className="line-clamp-2 block text-sm font-medium leading-relaxed text-primary/75">{m.message}</span>
                <span className="block break-all text-xs font-medium text-muted-foreground" dir="ltr">{m.email}{m.phone ? ` · ${m.phone}` : ''}</span>
              </button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(m)} className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`מחיקת הפנייה של ${m.name || ''}`} title="מחיקה">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      <AdminPagination current={page} total={inquiries.length} onChange={setPage} />
      {dialog}
    </div>
  );
}

function InquiryDialog({ inquiry, onClose, onUpdateStatus }: { inquiry: any; onClose: () => void; onUpdateStatus: (id: string, status: 'new' | 'read' | 'resolved') => void }) {
  const status = inquiry.status || 'new';
  const whatsappHref = inquiry.phone ? `https://wa.me/${String(inquiry.phone).replace(/\D/g, '').replace(/^0/, '972')}` : null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="z-[150] max-h-[88vh] max-w-lg overflow-y-auto rounded-[2rem] border-none bg-white p-0 shadow-2xl" dir="rtl">
        <div className="sticky top-0 z-50 bg-primary p-5 text-right text-white md:p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-3 font-headline text-xl font-black text-white"><Inbox className="h-5 w-5 text-accent" />{inquiry.name || 'פנייה'}</DialogTitle>
            <DialogDescription className="text-xs font-medium text-white/70">{formatDateTime(inquiry.created_at)}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 p-5 text-right md:p-7">
          <div className="rounded-2xl bg-primary/[0.03] px-4 py-1">
            <DetailRow label="אימייל" ltr>{inquiry.email}</DetailRow>
            {inquiry.phone && <DetailRow label="טלפון" ltr>{inquiry.phone}</DetailRow>}
            <DetailRow label="התקבלה">{formatDate(inquiry.created_at)}</DetailRow>
          </div>
          <p className="whitespace-pre-wrap rounded-2xl bg-accent/5 p-4 text-sm leading-relaxed text-primary/85">{inquiry.message}</p>
          <div className="flex flex-wrap gap-2">
            {inquiry.email && (
              <Button asChild className="h-11 gap-2 rounded-full bg-accent px-6 text-sm font-bold text-primary hover:bg-accent/90">
                <a href={`mailto:${inquiry.email}`}><Mail className="h-4 w-4" /> מענה במייל</a>
              </Button>
            )}
            {whatsappHref && (
              <Button asChild variant="outline" className="h-11 gap-2 rounded-full border-emerald-200 px-6 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer"><MessageSquare className="h-4 w-4" /> וואטסאפ</a>
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs font-bold text-muted-foreground">סטטוס הפנייה</p>
            <div className="flex gap-1.5">
              {(['new', 'read', 'resolved'] as const).map((s) => (
                <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => onUpdateStatus(inquiry.id, s)} className="h-9 rounded-full px-4 text-xs font-bold">
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
