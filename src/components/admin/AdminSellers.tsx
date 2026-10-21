"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Award, Building2, CheckCircle2, Eye, Landmark, List, Loader2, Pencil, Phone, ShieldCheck, ShoppingBag, Star, Trash2, UserCheck,
} from 'lucide-react';
import Image from '@/components/SmartImage';
import unsplashLoader from '@/lib/unsplashLoader';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoStable, useSupabaseClient } from '@/lib/supabase-hooks';
import { collection, query, where } from '@/lib/supabase-compat';
import { SELLER_TYPE_LABELS, resolveSellerType } from '@/lib/product-catalog';
import { resolveSellerNet } from '@/lib/commission';
import { cn } from '@/lib/utils';
import { ORDER_CLIENT_COLUMNS } from '@/lib/constants';
import { AdminPhoneStatus } from './AdminPhoneStatus';
import {
  AdminEmpty, AdminLoading, AdminPagination, DetailRow, OrderStatusBadge, formatDate, formatShekels, timeAgo, toDate,
} from './admin-ui';

const CERT_LABELS: Record<string, string> = { valid: 'תעודה בתוקף', expired: 'הייתה תעודה בעבר', none: 'ללא תעודה' };
const logoImg = () => PlaceHolderImages.find((img) => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';
const fullName = (s: any) => `${s?.first_name || ''} ${s?.last_name || ''}`.trim() || 'ללא שם';

export function SellerTypeBadge({ seller }: { seller: any }) {
  const type = resolveSellerType(seller?.seller_type);
  return (
    <span
      data-admin-seller-type={type}
      className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-bold', type === 'stam_scribe' ? 'bg-accent/15 text-accent-strong' : 'bg-sky-50 text-sky-700')}
    >
      {SELLER_TYPE_LABELS[type]}
    </span>
  );
}

function CertBadge({ seller }: { seller: any }) {
  if (resolveSellerType(seller.seller_type) === 'judaica_seller') return <span className="text-xs font-medium text-muted-foreground">לא רלוונטי</span>;
  const valid = seller.has_scribe_certificate === 'valid';
  return (
    <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', valid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700')}>
      {CERT_LABELS[seller.has_scribe_certificate] || seller.has_scribe_certificate || 'לא צוין'}
    </Badge>
  );
}

/* ------------------------------- STaM upgrade requests --------------------------------- */

// Judaica sellers requesting verification as סופר סת"ם. Approving flips seller_type to
// stam_scribe; rejecting leaves them a Judaica seller (their listings are never affected).
export function StamUpgradeRequests({ requests, orders, onResolve }: { requests: any[]; orders: any[]; onResolve: (seller: any, approve: boolean) => Promise<void> | void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const handle = async (seller: any, approve: boolean) => {
    setBusyId(seller.id);
    try { await onResolve(seller, approve); } finally { setBusyId(null); }
  };
  return (
    <section dir="rtl" className="rounded-[1.75rem] border border-accent/30 bg-white p-5 text-right shadow-premium md:p-6" data-stam-upgrade-requests>
      <h2 className="flex items-center gap-2 text-base font-black text-primary">
        <Award className="h-5 w-5 text-accent-strong" /> בקשות שדרוג לסופר סת"ם
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold tabular-nums text-accent-strong">{requests.length}</span>
      </h2>
      <p className="mt-1 text-xs font-medium text-muted-foreground">מוכרי יודאיקה שביקשו אימות הלכתי מלא. מוצרי היודאיקה שלהם ממשיכים להימכר בזמן הבדיקה.</p>
      <div className="mt-4 space-y-3">
        {requests.map((seller) => (
          <div key={seller.id} className="flex flex-col gap-3 rounded-2xl border border-primary/5 bg-[#FAFAF8] p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1 text-right">
              <p className="font-black text-primary">{fullName(seller)}</p>
              <p className="break-all text-xs font-semibold text-muted-foreground" dir="ltr">{seller.email}</p>
              <p className="mt-1 text-xs font-medium text-primary/60">
                {seller.experience_years != null ? `${seller.experience_years} שנות ניסיון` : 'ניסיון לא צוין'}
                {' · '}
                {Array.isArray(seller.writing_samples) ? `${seller.writing_samples.length} דוגמאות כתיבה` : 'אין דוגמאות'}
                {' · '}
                {seller.certificate_url ? 'תעודה הועלתה' : 'ללא תעודה'}
                {seller.stam_upgrade_requested_at ? ` · נשלח ${timeAgo(seller.stam_upgrade_requested_at)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SellerDetailDialog scribe={seller} orders={orders} />
              <Button onClick={() => handle(seller, true)} disabled={busyId === seller.id} className="h-10 flex-1 rounded-full bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-700 md:flex-none">
                {busyId === seller.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'אשר שדרוג'}
              </Button>
              <Button variant="outline" onClick={() => handle(seller, false)} disabled={busyId === seller.id} className="h-10 rounded-full px-5 text-xs font-bold text-destructive hover:bg-destructive/5">
                דחה בקשה
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------- sellers list ------------------------------------- */

function monthlyNet(orders: any[], sellerId: string) {
  const now = new Date();
  return (orders || [])
    .filter((o: any) => o.seller_id === sellerId && o.status === 'completed')
    .filter((o: any) => { const d = toDate(o.created_at); return !!d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((sum: number, o: any) => sum + resolveSellerNet(o), 0);
}

function Avatar({ seller, size = 40 }: { seller: any; size?: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full border border-primary/10 bg-primary/5" style={{ width: size, height: size }}>
      <Image loader={unsplashLoader} src={seller.profile_image || logoImg()} alt="" fill kind="avatar" sizes={`${size}px`} className="object-cover" />
    </div>
  );
}

export function SellersTable({
  sellers, orders, isLoading, totalCount, page, setPage, kind, pending, onApprove, onDelete, approvingId, emptyText,
}: {
  sellers: any[]; orders: any[]; isLoading: boolean; totalCount: number; page: number; setPage: (p: number) => void;
  kind: 'stam_scribe' | 'judaica_seller'; pending: boolean;
  onApprove: (seller: any) => void; onDelete: (seller: any) => void; approvingId?: string | null; emptyText: string;
}) {
  const judaica = kind === 'judaica_seller';
  if (isLoading && sellers.length === 0) return <AdminLoading />;
  if (sellers.length === 0) return <AdminEmpty compact={pending} title={emptyText} icon={judaica ? <ShoppingBag className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />} />;

  const approveLabel = judaica ? 'אשר מוכר' : 'אשר סופר';
  const actions = (s: any, mobile = false) => (
    <div className={cn('flex items-center gap-2', mobile ? 'w-full flex-wrap' : 'justify-end')}>
      <SellerDetailDialog scribe={s} orders={orders} />
      <EditSellerDialog scribe={s} />
      {pending && (
        <Button
          onClick={() => onApprove(s)}
          disabled={approvingId === s.id}
          className={cn('h-10 rounded-full bg-emerald-600 px-5 text-xs font-bold text-white hover:bg-emerald-700', mobile && 'flex-1')}
          data-admin-approve
        >
          {approvingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="ml-1.5 h-4 w-4" />{approveLabel}</>}
        </Button>
      )}
      <Button
        variant="ghost"
        size={mobile && pending ? 'default' : 'icon'}
        onClick={() => onDelete(s)}
        className={cn('h-10 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive', mobile && pending ? 'px-4 text-xs font-bold' : 'w-10')}
        aria-label={pending ? `דחייה ומחיקה של ${fullName(s)}` : `מחיקת ${fullName(s)}`}
        title={pending ? 'דחייה ומחיקה' : 'מחיקה'}
      >
        <Trash2 className="h-4 w-4" />{mobile && pending && <span className="mr-1.5">דחייה</span>}
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* desktop */}
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-primary/5 bg-white shadow-premium md:block">
        <Table>
          <TableHeader className="bg-primary/[0.02]">
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="px-6 py-4 text-right text-xs font-bold text-muted-foreground">{judaica ? 'מוכר' : 'סופר'}</TableHead>
              <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">עיר / כתובת</TableHead>
              <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">{pending ? 'נרשם' : 'הצטרף'}</TableHead>
              {!judaica && <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">הסמכה</TableHead>}
              {!pending && <TableHead className="py-4 text-right text-xs font-bold text-muted-foreground">לתשלום החודש</TableHead>}
              <TableHead className="px-6 py-4 text-left text-xs font-bold text-muted-foreground">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((s) => (
              <TableRow key={s.id} className="border-primary/5 hover:bg-primary/[0.015]" data-admin-seller-row={s.id}>
                <TableCell className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar seller={s} />
                    <div className="min-w-0 text-right">
                      <p className="flex items-center gap-1.5 text-sm font-black text-primary">{fullName(s)}{s.is_approved && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground" dir="ltr">{s.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] text-xs font-semibold text-primary/70">{s.city || s.address || '—'}</TableCell>
                <TableCell className="whitespace-nowrap text-xs font-semibold text-muted-foreground" title={formatDate(s.created_at)}>{pending ? timeAgo(s.created_at) : formatDate(s.created_at)}</TableCell>
                {!judaica && <TableCell><CertBadge seller={s} /></TableCell>}
                {!pending && <TableCell className="text-sm font-black tabular-nums text-emerald-700">{formatShekels(monthlyNet(orders, s.id))}</TableCell>}
                <TableCell className="px-6">{actions(s)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* phones */}
      <div className="grid gap-3 md:hidden">
        {sellers.map((s) => (
          <div key={s.id} className="space-y-3 rounded-[1.5rem] border border-primary/5 bg-white p-4 shadow-sm" data-admin-seller-card={s.id}>
            <div className="flex items-start gap-3">
              <Avatar seller={s} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-black leading-tight text-primary">{fullName(s)}</p>
                <p className="break-all text-xs font-medium text-muted-foreground" dir="ltr">{s.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <SellerTypeBadge seller={s} />
                  {!judaica && <CertBadge seller={s} />}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-primary/70">
              <span>{s.city || s.address || 'עיר לא צוינה'}</span>
              <span>{pending ? `נרשם ${timeAgo(s.created_at)}` : `הצטרף ${formatDate(s.created_at)}`}</span>
              {!pending && <span className="text-emerald-700">לתשלום החודש: {formatShekels(monthlyNet(orders, s.id))}</span>}
            </div>
            {actions(s, true)}
          </div>
        ))}
      </div>
      <AdminPagination current={page} total={totalCount} onChange={setPage} />
    </div>
  );
}

/* ------------------------------------ edit dialog ------------------------------------- */

export function EditSellerDialog({ scribe }: { scribe: any }) {
  const db = useSupabaseClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const buildForm = (s: any) => ({
    first_name: s.first_name || '', last_name: s.last_name || '', email: s.email || '', phone: s.phone || '',
    city: s.city || '', address: s.address || '', business_name: s.business_name || '', business_id: s.business_id || '',
    bank_name: s.bank_name || '', bank_branch: s.bank_branch || '', bank_account_number: s.bank_account_number || '',
    experience_years: s.experience_years ?? '', notes: s.notes || '',
  });
  const [form, setForm] = useState(buildForm(scribe));
  // Judaica sellers have no scribal background: no years-of-experience field, and saving never touches it.
  const isJudaicaSeller = resolveSellerType(scribe.seller_type) === 'judaica_seller';
  const noun = isJudaicaSeller ? 'המוכר' : 'הסופר';

  // Re-sync the form to the latest DB values every time the dialog is (re)opened, so a
  // stale in-memory copy never overwrites a change made elsewhere in the meantime.
  useEffect(() => {
    if (open) setForm(buildForm(scribe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateField = (key: string, value: string) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    const { experience_years: experienceInput, ...rest } = form;
    const payload = isJudaicaSeller ? rest : { ...rest, experience_years: experienceInput === '' ? null : Number(experienceInput) };
    const { error, count } = await db.from('sellers').update(payload, { count: 'exact' }).eq('id', scribe.id);
    setIsSaving(false);
    if (error || count === null || count === 0) {
      toast({ variant: 'destructive', title: `שגיאה בעדכון פרטי ${noun}`, description: error?.message ?? 'לא נמצאו שורות לעדכון' });
      return;
    }
    toast({ variant: 'success', title: `פרטי ${noun} עודכנו` });
    setOpen(false);
  };

  const field = (key: keyof ReturnType<typeof buildForm>, label: string, opts: { ltr?: boolean; type?: string; className?: string; bg?: boolean } = {}) => (
    <div className={cn('space-y-1.5', opts.className)}>
      <Label className="text-xs font-bold">{label}</Label>
      <Input type={opts.type} value={(form as any)[key]} onChange={(e) => updateField(key, e.target.value)} className={cn('h-11 rounded-xl', opts.bg && 'bg-white')} dir={opts.ltr ? 'ltr' : undefined} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full border-primary/10 shadow-sm hover:bg-accent hover:text-primary" aria-label={`עריכת פרטי ${noun}`} title={`עריכת פרטי ${noun}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[150] max-h-[88vh] max-w-2xl overflow-y-auto rounded-[2rem] border-none bg-white p-0 shadow-2xl" dir="rtl">
        <div className="sticky top-0 z-50 bg-primary p-5 text-right text-white md:p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-3 font-headline text-xl font-black text-white">
              <Pencil className="h-5 w-5 text-accent" /> עריכת פרטי {fullName(scribe)}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-white/70">כמנהל אפשר לערוך כאן את כל פרטי {noun} — כולל פרטי בנק ש{noun} עצמו לא יכול לערוך.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-7 p-5 text-right md:p-8">
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-primary"><UserCheck className="h-4 w-4" /> פרטים אישיים</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('first_name', 'שם פרטי')}
              {field('last_name', 'שם משפחה')}
              {field('email', 'אימייל', { ltr: true, type: 'email' })}
              {field('phone', 'טלפון', { ltr: true })}
              {field('city', 'עיר')}
              {field('address', 'כתובת')}
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-primary"><Building2 className="h-4 w-4" /> פרטי עסק</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('business_name', 'שם עסק')}
              {field('business_id', 'ח.פ / עוסק מורשה', { ltr: true })}
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-emerald-700"><Landmark className="h-4 w-4" /> פרטי חשבון בנק (עריכת מנהל בלבד)</h3>
            <div className="grid gap-4 rounded-2xl border border-emerald-100/60 bg-emerald-50/50 p-4 sm:grid-cols-2">
              {field('bank_name', 'שם בנק', { bg: true })}
              {field('bank_branch', 'סניף', { bg: true })}
              {field('bank_account_number', 'מספר חשבון', { ltr: true, bg: true, className: 'sm:col-span-2' })}
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-primary"><ShieldCheck className="h-4 w-4" /> {isJudaicaSeller ? 'על העסק' : 'רקע מקצועי'}</h3>
            {!isJudaicaSeller && (
              <div className="grid gap-4 sm:grid-cols-2" data-admin-edit-scribal>
                {field('experience_years', 'שנות ניסיון', { type: 'number' })}
              </div>
            )}
            <div className="space-y-1.5"><Label className="text-xs font-bold">הערות</Label><Textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} className="min-h-24 rounded-xl" /></div>
          </section>
        </div>

        <div className="sticky bottom-0 flex justify-start gap-3 border-t bg-white p-4 md:p-5">
          <Button onClick={handleSave} disabled={isSaving} className="h-11 gap-2 rounded-full bg-accent px-8 font-bold text-primary hover:bg-accent/90">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} שמירת שינויים
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="h-11 rounded-full px-6" disabled={isSaving}>ביטול</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------- detail dialog ------------------------------------ */

/**
 * Everything about one seller: business and bank details, scribal background, certificate and
 * samples, their sales, and their phone-notification settings. Uncontrolled (eye button) inside
 * the lists; controlled (`open`) when opened from the global search.
 */
export function SellerDetailDialog({ scribe, orders, open: openProp, onOpenChange, onShowInList }: {
  scribe: any; orders?: any[]; open?: boolean; onOpenChange?: (open: boolean) => void; onShowInList?: () => void;
}) {
  const db = useSupabaseClient();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? !!openProp : openState;
  const setOpen = (v: boolean) => { if (!controlled) setOpenState(v); onOpenChange?.(v); };

  // Scribal (halachic) details belong to סופרי סת"ם only. A Judaica seller shows none — unless they
  // have a pending upgrade request, where the admin has to review exactly what they submitted.
  const isJudaicaSeller = resolveSellerType(scribe.seller_type) === 'judaica_seller';
  const upgradePending = isJudaicaSeller && scribe.stam_upgrade_status === 'pending';
  const showScribal = !isJudaicaSeller || upgradePending;

  // Reviews load only when the dialog is open (before, every row of every list fetched them).
  // Scribe rating = profile-page ratings + post-purchase scribe ratings (reviews with an order_id).
  const orderReviewsQuery = useMemoStable(() => (open ? query(collection(db, 'reviews'), where('seller_id', '==', scribe.id)) : null), [db, scribe.id, open]);
  const { data: orderReviewsData } = useCollection<any>(orderReviewsQuery);
  const profileReviewsQuery = useMemoStable(() => (open ? query(collection(db, 'supermarket_reviews'), where('supermarket_id', '==', scribe.id)) : null), [db, scribe.id, open]);
  const { data: profileReviewsData } = useCollection<any>(profileReviewsQuery);
  const reviews = useMemo(() => [...(orderReviewsData || []).filter((r: any) => r.order_id), ...(profileReviewsData || [])], [orderReviewsData, profileReviewsData]);
  const averageRating = useMemo(() => {
    const ratings = reviews.map((r: any) => Number(r.rating)).filter((n: number) => Number.isFinite(n) && n > 0);
    return ratings.length ? ratings.reduce((a: number, n: number) => a + n, 0) / ratings.length : 0;
  }, [reviews]);

  const sellerOrders = usePersonOrders('seller_id', scribe.id, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full border-primary/10 shadow-sm hover:bg-accent hover:text-primary" aria-label={`פרטי ${fullName(scribe)}`} title="כל הפרטים" data-admin-open-seller>
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="z-[150] max-h-[88vh] max-w-3xl overflow-y-auto rounded-[2rem] border-none bg-white p-0 shadow-2xl" dir="rtl" data-admin-seller-detail>
        <div className="sticky top-0 z-50 bg-primary p-5 text-right text-white md:p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-4 font-headline text-xl font-black text-white">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10">
                <Image src={scribe.profile_image || logoImg()} alt="" fill kind="avatar" sizes="48px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="break-words">{fullName(scribe)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={cn('h-3 w-3', s <= averageRating ? 'fill-accent text-accent' : 'text-white/25')} />)}
                  </span>
                  <span className="text-[11px] font-medium text-white/70">{reviews.length} ביקורות</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', scribe.is_approved ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-300/20 text-amber-100')}>
                    {scribe.is_approved ? 'מאושר' : 'ממתין לאישור'}
                  </span>
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">פרטי המוכר, העסק, ההזמנות ועדכוני הטלפון</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-7 p-5 text-right md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-primary"><Phone className="h-4 w-4 text-accent-strong" /> פרטי התקשרות</h3>
                <div className="rounded-2xl bg-primary/[0.03] px-4 py-1">
                  <DetailRow label="טלפון" ltr>{scribe.phone && <a href={`tel:${scribe.phone}`} className="hover:underline">{scribe.phone}</a>}</DetailRow>
                  <DetailRow label="אימייל" ltr>{scribe.email && <a href={`mailto:${scribe.email}`} className="hover:underline">{scribe.email}</a>}</DetailRow>
                  <DetailRow label="כתובת">{[scribe.address, scribe.city].filter(Boolean).join(', ')}</DetailRow>
                  <DetailRow label="נרשם">{formatDate(scribe.created_at)}</DetailRow>
                </div>
              </section>
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-primary"><Building2 className="h-4 w-4 text-accent-strong" /> פרטי עסק</h3>
                <div className="rounded-2xl bg-primary/[0.03] px-4 py-1">
                  <DetailRow label="שם עסק">{scribe.business_name}</DetailRow>
                  <DetailRow label="ח.פ / עוסק" ltr>{scribe.business_id}</DetailRow>
                  <DetailRow label="סוג">{scribe.business_type ? (scribe.business_type === 'osek_patur' ? 'עוסק פטור' : 'עוסק מורשה') : ''}</DetailRow>
                </div>
              </section>
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-emerald-700"><Landmark className="h-4 w-4" /> חשבון בנק</h3>
                <div className="rounded-2xl border border-emerald-100/60 bg-emerald-50/50 px-4 py-1">
                  <DetailRow label="בנק">{scribe.bank_name}</DetailRow>
                  <DetailRow label="סניף">{scribe.bank_branch}</DetailRow>
                  <DetailRow label="חשבון" ltr>{scribe.bank_account_number}</DetailRow>
                </div>
              </section>
            </div>

            <div className="space-y-5">
              {showScribal ? (
                <>
                  <section className="space-y-2" data-admin-view-scribal>
                    <h3 className="flex items-center gap-2 text-sm font-black text-primary"><UserCheck className="h-4 w-4 text-accent-strong" /> {upgradePending ? 'פרטים שהוגשו בבקשת השדרוג' : 'רקע מקצועי והנהגה'}</h3>
                    <div className="rounded-2xl bg-primary/[0.03] px-4 py-1">
                      <DetailRow label="ניסיון">{scribe.experience_years != null ? `${scribe.experience_years} שנים` : ''}</DetailRow>
                      <DetailRow label="רמת הידור">{scribe.script_level}</DetailRow>
                      <DetailRow label="תעודת סופר">{CERT_LABELS[scribe.has_scribe_certificate] || scribe.has_scribe_certificate}</DetailRow>
                      <DetailRow label="לימוד">{scribe.torah_study_frequency === 'full-day' ? 'אברך יום שלם' : scribe.torah_study_frequency === 'half-day' ? 'אברך חצי יום' : scribe.torah_study_frequency ? 'קובע עיתים' : ''}</DetailRow>
                      <DetailRow label="טבילה">{scribe.mikveh_frequency === 'daily' ? 'כל יום' : scribe.mikveh_frequency === 'before' ? 'לפני כתיבה' : scribe.mikveh_frequency ? 'טבילת עזרא' : ''}</DetailRow>
                      <DetailRow label="מצב משפחתי">{scribe.marital_status === 'married' ? 'נשוי' : scribe.marital_status ? 'רווק' : ''}</DetailRow>
                    </div>
                  </section>
                  {(scribe.script_types || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(scribe.script_types || []).map((t: string) => (
                        <Badge key={t} className="rounded-full border-primary/10 bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">{t}</Badge>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <section className="space-y-2" data-admin-view-judaica>
                  <h3 className="text-sm font-black text-primary">סוג מוכר</h3>
                  <p className="rounded-2xl bg-primary/[0.03] p-4 text-sm font-semibold text-primary">מוכר יודאיקה — ללא פרטי הסמכה הלכתיים</p>
                </section>
              )}
              <section className="space-y-2">
                <h3 className="text-sm font-black text-primary">{showScribal ? 'אודות והסמכה אישית' : 'אודות העסק'}</h3>
                <p className="whitespace-pre-wrap rounded-2xl bg-primary/[0.03] p-4 text-sm leading-relaxed text-primary/80">{scribe.notes || '—'}</p>
              </section>
              <p className="break-all font-mono text-[11px] text-muted-foreground">מזהה: {scribe.id}</p>
            </div>
          </div>

          {showScribal && (scribe.certificate_url || (scribe.writing_samples || []).length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {scribe.certificate_url && (
                <section className="space-y-2">
                  <h3 className="text-sm font-black text-primary">תעודת סופר</h3>
                  <div className="relative aspect-[1.4/1] w-full overflow-hidden rounded-2xl border bg-white">
                    <Image src={scribe.certificate_url} alt="תעודת סופר" fill kind="certificate" sizes="(max-width: 768px) 100vw, 720px" className="object-contain" />
                  </div>
                </section>
              )}
              {(scribe.writing_samples || []).length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-black text-primary">דוגמאות כתיבה</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {scribe.writing_samples.slice(0, 4).map((sample: string, idx: number) => (
                      <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border">
                        <Image src={sample} alt={`דוגמת כתיבה ${idx + 1}`} fill kind="writing_sample" sizes="(max-width: 768px) 50vw, 360px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <section className="space-y-2" data-admin-seller-orders>
            <h3 className="flex items-center gap-2 text-sm font-black text-primary"><ShoppingBag className="h-4 w-4 text-accent-strong" /> הזמנות אצל המוכר{sellerOrders.orders ? ` (${sellerOrders.orders.length})` : ''}</h3>
            <OrdersMiniList orders={sellerOrders.orders} error={sellerOrders.error} empty="אין הזמנות אצל המוכר הזה." />
          </section>

          <AdminPhoneStatus userId={scribe.id} />
        </div>

        {onShowInList && (
          <div className="sticky bottom-0 flex justify-start border-t bg-white p-4">
            <Button variant="outline" onClick={onShowInList} className="h-10 gap-1.5 rounded-full text-xs font-bold"><List className="h-4 w-4" /> הצג ברשימה</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** One person's orders (as buyer or as seller), newest first — loaded when a detail dialog opens. */
export function usePersonOrders(column: 'buyer_id' | 'seller_id', id: string, enabled: boolean) {
  const db = useSupabaseClient();
  const [state, setState] = useState<{ orders: any[] | null; error: boolean }>({ orders: null, error: false });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ orders: null, error: false });
    db.from('orders').select(ORDER_CLIENT_COLUMNS).eq(column, id).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => { if (!cancelled) setState({ orders: (data as any[]) || [], error: !!error }); });
    return () => { cancelled = true; };
  }, [db, column, id, enabled]);
  return state;
}

/** Compact order list used inside the seller / customer dialogs. */
export function OrdersMiniList({ orders, empty, loading, error }: { orders: any[] | null; empty: string; loading?: boolean; error?: boolean }) {
  if (error) return <p className="rounded-2xl bg-destructive/5 p-4 text-sm font-bold text-destructive">טעינת ההזמנות נכשלה.</p>;
  if (loading || !orders) return <p className="flex items-center gap-2 rounded-2xl bg-primary/[0.03] p-4 text-xs font-bold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> טוען הזמנות…</p>;
  if (orders.length === 0) return <p className="rounded-2xl bg-primary/[0.03] p-4 text-sm font-medium text-muted-foreground">{empty}</p>;
  return (
    <ul className="max-h-72 divide-y divide-primary/5 overflow-y-auto rounded-2xl border border-primary/5">
      {orders.map((o: any) => (
        <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-primary">{o.product_name || 'מוצר'}</p>
            <p className="text-xs font-medium text-muted-foreground"><span className="font-mono">#{String(o.id).slice(0, 8)}</span> · {formatDate(o.created_at)}{o.buyer_name ? ` · ${o.buyer_name}` : ''}</p>
          </div>
          <OrderStatusBadge status={o.status} />
          <span className="w-20 text-left text-sm font-black tabular-nums text-emerald-700">{formatShekels(o.amount)}</span>
        </li>
      ))}
    </ul>
  );
}
