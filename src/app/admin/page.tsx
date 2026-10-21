"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileDown, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useDoc, useMemoStable, useSupabaseClient, useUser } from '@/lib/supabase-hooks';
import { collection, doc, limit, orderBy, query, selectColumns } from '@/lib/supabase-compat';
import { ORDER_CLIENT_COLUMNS } from '@/lib/constants';
import { resolveSellerType } from '@/lib/product-catalog';
import { classifyStuckOrder } from '@/lib/stuck-orders';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminGlobalSearch, type SearchHit } from '@/components/admin/AdminGlobalSearch';
import { isAdminTab, type AdminBadges, type AdminNavParams, type AdminTabId } from '@/components/admin/admin-nav';
import { ADMIN_PAGE_SIZE, AdminConfirmProvider, AdminListFilter, AdminSectionTitle, personSearchFilter, useAdminConfirm } from '@/components/admin/admin-ui';
import { useAdminAttention } from '@/components/admin/useAdminAttention';
import { AdminOverviewPanel } from '@/components/admin/AdminOverviewPanel';
import { SellerDetailDialog, SellersTable, StamUpgradeRequests } from '@/components/admin/AdminSellers';
import { CustomerDetailsDialog, CustomersTable } from '@/components/admin/AdminCustomers';
import { SalesFilterBar, SalesList, TorahRequestsList, isSalesFilter, type SalesFilter } from '@/components/admin/AdminSales';
import { InquiriesList, InquiryFilterBar, ReportsList, matchesInquiryFilter, type InquiryFilter } from '@/components/admin/AdminInbox';
import { AdminAuditLogPanel } from '@/components/admin/AdminAuditLogPanel';
import { AdminChatsPanel } from '@/components/admin/AdminChatsPanel';
import { AdminActivityPanel } from '@/components/admin/AdminActivityPanel';
import { AdminBroadcastPanel } from '@/components/admin/AdminBroadcastPanel';
import { AdminNotificationsPanel } from '@/components/admin/AdminNotificationsPanel';

// /admin — the owner's control room. The section lives in the URL (?tab=…&q=…&filter=…) so
// refresh, back and deep links work. Lists and detail views are in src/components/admin/*;
// this file loads the data a section needs (only while that section is open) and runs the
// admin actions. Every privileged write still goes through RLS (admins) or an admin-only API.

const SELLER_TABS: AdminTabId[] = ['pending', 'active', 'judaica'];
const ORDER_TABS: AdminTabId[] = ['sales', 'torah', 'customers', 'active', 'judaica'];
const LIST_FILTER_TABS: AdminTabId[] = ['pending', 'active', 'judaica', 'customers', 'sales', 'torah', 'reports', 'inquiries'];

const fullName = (p: any) => `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'ללא שם';
const pageRange = (page: number) => [(page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1] as const;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const FullPageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
);

export default function AdminPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <AdminConfirmProvider>
        <AdminDashboard />
      </AdminConfirmProvider>
    </Suspense>
  );
}

function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const confirm = useAdminConfirm();

  /* ------------------------------- admin check (unchanged) ------------------------------- */
  const adminRef = useMemoStable(() => (user ? doc(db, 'admins', user.uid) : null), [db, user?.uid]);
  const { data: adminData, isLoading: isAdminCheckLoading, isLoaded: isAdminCheckLoaded } = useDoc<any>(adminRef);
  useEffect(() => {
    if (isUserLoading) return;
    // Logged out: the admin lookup never runs (no user), so send to login instead of a blank page.
    if (!user) { router.replace('/login?redirect=' + encodeURIComponent('/admin')); return; }
    if (isAdminCheckLoading || !isAdminCheckLoaded) return;
    if (!adminData) router.push('/');
  }, [user, isUserLoading, isAdminCheckLoading, isAdminCheckLoaded, adminData, router]);
  const canLoadData = !!user && !isUserLoading && isAdminCheckLoaded && !!adminData;

  /* ---------------------------------- URL state ---------------------------------- */
  const tabParam = searchParams.get('tab');
  const activeTab: AdminTabId = isAdminTab(tabParam) ? tabParam : 'overview';
  const qParam = searchParams.get('q') || '';
  const filterParam = searchParams.get('filter') || '';

  const navigate = useCallback((tab: AdminTabId, params: AdminNavParams = {}) => {
    const sp = new URLSearchParams();
    if (tab !== 'overview') sp.set('tab', tab);
    if (params.q) sp.set('q', params.q);
    if (params.filter) sp.set('filter', params.filter);
    const qs = sp.toString();
    router.push(`/admin${qs ? `?${qs}` : ''}`);
  }, [router]);

  // The list filter belongs to the section: it starts from ?q= and resets when the section changes.
  const [searchTerm, setSearchTerm] = useState(qParam);
  useEffect(() => { setSearchTerm(qParam); }, [activeTab, qParam]);
  const debouncedSearch = useDebounced(searchTerm.trim());
  const listFilter = debouncedSearch;

  const [salesFilter, setSalesFilter] = useState<SalesFilter>('all');
  const [inquiryFilter, setInquiryFilter] = useState<InquiryFilter>('open');
  useEffect(() => {
    if (activeTab === 'sales') setSalesFilter(isSalesFilter(filterParam) ? filterParam : 'all');
    if (activeTab === 'inquiries') setInquiryFilter(filterParam === 'new' || filterParam === 'resolved' || filterParam === 'all' ? filterParam : 'open');
  }, [activeTab, filterParam]);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingJudaicaPage, setPendingJudaicaPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [judaicaPage, setJudaicaPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [torahPage, setTorahPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [inquiriesPage, setInquiriesPage] = useState(1);
  useEffect(() => {
    setPendingPage(1); setPendingJudaicaPage(1); setActivePage(1); setJudaicaPage(1); setCustomersPage(1);
    setSalesPage(1); setTorahPage(1); setReportsPage(1); setInquiriesPage(1);
  }, [debouncedSearch, activeTab, salesFilter, inquiryFilter]);

  const [refreshTick, setRefreshTick] = useState(0);
  const attention = useAdminAttention(canLoadData, refreshTick);

  /* ------------------------------------ sellers ------------------------------------ */
  const needSellers = canLoadData && SELLER_TABS.includes(activeTab);
  const [sellerLists, setSellerLists] = useState<{ pending: any[]; active: any[]; pendingJudaica: any[]; judaica: any[]; totals: Record<string, number> }>({ pending: [], active: [], pendingJudaica: [], judaica: [], totals: {} });
  const [isSellersLoading, setIsSellersLoading] = useState(false);
  const [stamUpgradeRequests, setStamUpgradeRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!needSellers) return;
    let cancelled = false;
    setIsSellersLoading(true);
    const filter = personSearchFilter(listFilter, ['business_name']);
    const fetchPage = (isApproved: boolean, sellerType: 'stam_scribe' | 'judaica_seller', page: number) => {
      const [from, to] = pageRange(page);
      let q = db.from('sellers').select('*', { count: 'exact' }).eq('is_approved', isApproved).eq('seller_type', sellerType)
        .order('created_at', { ascending: false }).range(from, to);
      if (filter) q = q.or(filter);
      return q;
    };
    (async () => {
      const [p, a, pj, j, up] = await Promise.all([
        fetchPage(false, 'stam_scribe', pendingPage),
        fetchPage(true, 'stam_scribe', activePage),
        fetchPage(false, 'judaica_seller', pendingJudaicaPage),
        fetchPage(true, 'judaica_seller', judaicaPage),
        db.from('sellers').select('*').eq('stam_upgrade_status', 'pending').order('stam_upgrade_requested_at', { ascending: true }),
      ]);
      if (cancelled) return;
      const norm = (rows: any[] | null) => (rows || []).map((s: any) => ({ ...s, id: String(s.id) }));
      setSellerLists((prev) => ({
        pending: p.error ? prev.pending : norm(p.data),
        active: a.error ? prev.active : norm(a.data),
        pendingJudaica: pj.error ? prev.pendingJudaica : norm(pj.data),
        judaica: j.error ? prev.judaica : norm(j.data),
        totals: { pending: p.count ?? 0, active: a.count ?? 0, pendingJudaica: pj.count ?? 0, judaica: j.count ?? 0 },
      }));
      // Before the seller-types migration the column doesn't exist — just show none.
      setStamUpgradeRequests(up.error ? [] : norm(up.data));
      if ([p, a, pj, j].some((r) => r.error)) toast({ variant: 'destructive', title: 'חלק מרשימות המוכרים לא נטענו', description: 'נסה לרענן את הדף.' });
      setIsSellersLoading(false);
    })();
    return () => { cancelled = true; };
  }, [db, needSellers, listFilter, pendingPage, activePage, pendingJudaicaPage, judaicaPage, refreshTick, toast]);

  /* ----------------------------------- customers ----------------------------------- */
  const needCustomers = canLoadData && activeTab === 'customers';
  const [customers, setCustomers] = useState<{ rows: any[]; total: number }>({ rows: [], total: 0 });
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [customerAuthCreatedAt, setCustomerAuthCreatedAt] = useState<Record<string, string>>({});
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!needCustomers) return;
    let cancelled = false;
    setIsCustomersLoading(true);
    const [from, to] = pageRange(customersPage);
    const filter = personSearchFilter(listFilter);
    let q = db.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (filter) q = q.or(filter);
    q.then(({ data, error, count }) => {
      if (cancelled) return;
      if (error) toast({ variant: 'destructive', title: 'טעינת הלקוחות נכשלה', description: error.message });
      else setCustomers({ rows: (data || []).map((c: any) => ({ ...c, id: String(c.id) })), total: count || 0 });
      setIsCustomersLoading(false);
    });
    return () => { cancelled = true; };
  }, [db, needCustomers, listFilter, customersPage, refreshTick, toast]);

  // Older customer rows have no created_at — fetch it from auth (admin-only route).
  useEffect(() => {
    const missing = customers.rows.filter((c) => !c.created_at && !customerAuthCreatedAt[c.id]).map((c) => c.id);
    if (!canLoadData || missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/admin/customers-created-at', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: missing }) });
      if (!res.ok) return;
      const payload = await res.json().catch(() => null);
      if (!cancelled && payload?.usersCreatedAt && typeof payload.usersCreatedAt === 'object') setCustomerAuthCreatedAt((prev) => ({ ...prev, ...payload.usersCreatedAt }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.rows, canLoadData, db]);
  const resolveCreatedAt = useCallback((c: any) => c?.created_at || customerAuthCreatedAt[c?.id] || null, [customerAuthCreatedAt]);

  // Lists refresh when someone else changes sellers / customers.
  useEffect(() => {
    if (!canLoadData) return;
    const channel = db
      .channel('admin-realtime-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => setRefreshTick((t) => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => setRefreshTick((t) => t + 1))
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [db, canLoadData]);

  /* ------------------------------------- orders ------------------------------------- */
  const needOrders = canLoadData && ORDER_TABS.includes(activeTab);
  const ordersQuery = useMemoStable(
    () => (needOrders ? query(collection(db, 'orders'), orderBy('created_at', 'desc'), limit(1000), selectColumns(ORDER_CLIENT_COLUMNS)) : null),
    [db, needOrders],
  );
  const { data: allOrders } = useCollection<any>(ordersQuery);
  // pending_payment rows are unfinished checkouts, not sales.
  const visibleOrders = useMemo(() => (allOrders || []).filter((o: any) => o.status !== 'pending_payment'), [allOrders]);

  const [sellerDirectory, setSellerDirectory] = useState<any[]>([]);
  useEffect(() => {
    const ids = Array.from(new Set(visibleOrders.map((o: any) => o?.seller_id).filter((id: any): id is string => typeof id === 'string' && id.length > 0)));
    if (!canLoadData || ids.length === 0) { setSellerDirectory([]); return; }
    let cancelled = false;
    (async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
      const results = await Promise.all(chunks.map(async (chunk) => {
        const { data } = await db.from('sellers').select('id, first_name, last_name, phone, email, seller_type, is_approved').in('id', chunk);
        return (data || []).map((s: any) => ({ ...s, id: String(s.id) }));
      }));
      if (!cancelled) setSellerDirectory(results.flat());
    })();
    return () => { cancelled = true; };
  }, [canLoadData, db, visibleOrders]);

  const stuckCount = useMemo(() => { const now = new Date(); return (allOrders || []).filter((o: any) => classifyStuckOrder(o, now)).length; }, [allOrders]);
  const matchesOrderSearch = useCallback((o: any, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase().replace(/^#/, '');
    return [o.id, o.buyer_name, o.buyer_email, o.product_name].some((v) => String(v || '').toLowerCase().includes(t));
  }, []);
  const salesOrders = useMemo(() => visibleOrders.filter((o: any) => {
    if (o.status === 'torah_request') return false;
    if (salesFilter === 'completed' && o.status !== 'completed') return false;
    if (salesFilter === 'pending' && o.status !== 'paid') return false;
    return matchesOrderSearch(o, searchTerm.trim());
  }), [visibleOrders, salesFilter, searchTerm, matchesOrderSearch]);
  const torahOrders = useMemo(() => visibleOrders.filter((o: any) => o.status === 'torah_request' && matchesOrderSearch(o, searchTerm.trim())), [visibleOrders, searchTerm, matchesOrderSearch]);

  /* ------------------------------- reports & inquiries ------------------------------- */
  const reportsQuery = useMemoStable(() => (canLoadData && activeTab === 'reports' ? query(collection(db, 'reports'), orderBy('created_at', 'desc'), limit(500)) : null), [db, canLoadData, activeTab]);
  const { data: allReports } = useCollection<any>(reportsQuery);
  const inquiriesQuery = useMemoStable(() => (canLoadData && activeTab === 'inquiries' ? query(collection(db, 'contact_messages'), orderBy('created_at', 'desc'), limit(500)) : null), [db, canLoadData, activeTab]);
  const { data: allInquiries } = useCollection<any>(inquiriesQuery);
  // Local view of changes made here, so the list reacts at once (realtime may lag).
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [inquiryStatus, setInquiryStatus] = useState<Record<string, string>>({});

  const reports = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    return (allReports || []).filter((r: any) => !removed.has(`r:${r.id}`)).filter((r: any) => !t
      || [r.reporter_name, r.seller_name, r.id, r.reason].some((v) => String(v || '').toLowerCase().includes(t)));
  }, [allReports, removed, searchTerm]);
  const inquiriesAll = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    return (allInquiries || [])
      .filter((m: any) => !removed.has(`i:${m.id}`))
      .map((m: any) => (inquiryStatus[m.id] ? { ...m, status: inquiryStatus[m.id] } : m))
      .filter((m: any) => !t || [m.name, m.email, m.phone, m.message].some((v) => String(v || '').toLowerCase().includes(t)));
  }, [allInquiries, removed, inquiryStatus, searchTerm]);
  const inquiryCounts = useMemo(() => ({
    open: inquiriesAll.filter((m) => matchesInquiryFilter(m, 'open')).length,
    new: inquiriesAll.filter((m) => matchesInquiryFilter(m, 'new')).length,
    resolved: inquiriesAll.filter((m) => matchesInquiryFilter(m, 'resolved')).length,
    all: inquiriesAll.length,
  }), [inquiriesAll]);
  const inquiries = useMemo(() => inquiriesAll.filter((m) => matchesInquiryFilter(m, inquiryFilter)), [inquiriesAll, inquiryFilter]);

  /* ------------------------------------- actions ------------------------------------- */
  const authHeader = async () => {
    const { data: { session } } = await db.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : null;
  };
  const afterChange = () => { setRefreshTick((t) => t + 1); };

  const deleteManagedUser = async (id: string, role: 'seller' | 'customer') => {
    const auth = await authHeader();
    if (!auth) { toast({ variant: 'destructive', title: 'שגיאת הרשאות', description: 'לא ניתן לאמת את מנהל המערכת. התחבר מחדש ונסה שוב.' }); return false; }
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: id, targetRole: role, reason: 'admin_delete' }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      toast({ variant: 'destructive', title: role === 'seller' ? 'מחיקת המוכר נכשלה' : 'מחיקת הלקוח נכשלה', description: payload?.error || 'אירעה שגיאה במחיקת המשתמש מהמסד.' });
      return false;
    }
    return true;
  };

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approveSeller = async (seller: any) => {
    setApprovingId(seller.id);
    try {
      const { error, count } = await db.from('sellers').update({ is_approved: true }, { count: 'exact' }).eq('id', seller.id);
      if (error || count === null || count === 0) {
        const msg = error?.message ?? (count === null ? 'לא התקבל מידע על מספר השורות שעודכנו' : 'המוכר לא נמצא (אולי כבר אושר או נמחק)');
        toast({ variant: 'destructive', title: 'אישור המוכר נכשל', description: msg });
        return;
      }
      const judaica = resolveSellerType(seller.seller_type) === 'judaica_seller';
      if (seller.email) {
        const auth = await authHeader();
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
          body: JSON.stringify({ to: seller.email, subject: '🎉 הפרופיל שלך באתר חותם אושר!', text: `שלום ${seller.first_name}, הפרופיל שלך אושר על ידי צוות חותם. כעת תוכל להתחיל להעלות מוצרים ולמכור באתר.`, html: approvalEmailHtml(seller.first_name) }),
        }).catch((err) => console.error('[admin] approval email failed', err));
      }
      // Stay in the queue so the next seller can be reviewed right away.
      afterChange();
      toast({ variant: 'success', title: `${fullName(seller)} אושר/ה`, description: `עבר/ה לרשימת ${judaica ? 'מוכרי היודאיקה' : 'סופרי הסת"ם'} ונשלח מייל אישור.` });
    } finally {
      setApprovingId(null);
    }
  };

  const deleteSeller = async (seller: any) => {
    const pending = !seller.is_approved;
    const ok = await confirm({
      title: pending ? `לדחות ולמחוק את ${fullName(seller)}?` : `למחוק את ${fullName(seller)}?`,
      description: 'החשבון והפרופיל של המוכר יימחקו לצמיתות. אי אפשר לבטל את הפעולה.',
      confirmLabel: pending ? 'דחייה ומחיקה' : 'מחיקה לצמיתות',
      destructive: true,
    });
    if (!ok) return;
    if (await deleteManagedUser(seller.id, 'seller')) {
      toast({ title: `${fullName(seller)} נמחק/ה` });
      afterChange();
    }
  };

  const deleteCustomer = async (customer: any) => {
    const ok = await confirm({
      title: `למחוק את הלקוח ${fullName(customer)}?`,
      description: 'החשבון של הלקוח יימחק לצמיתות. אי אפשר לבטל את הפעולה.',
      confirmLabel: 'מחיקה לצמיתות',
      destructive: true,
    });
    if (!ok) return false;
    setDeletingCustomerId(customer.id);
    try {
      if (!(await deleteManagedUser(customer.id, 'customer'))) return false;
      toast({ title: `הלקוח ${fullName(customer)} נמחק` });
      afterChange();
      return true;
    } finally {
      setDeletingCustomerId((cur) => (cur === customer.id ? null : cur));
    }
  };

  const resolveStamUpgrade = async (seller: any, approve: boolean) => {
    if (!approve) {
      const ok = await confirm({
        title: `לדחות את בקשת השדרוג של ${fullName(seller)}?`,
        description: 'המוכר יקבל מייל שהבקשה לא אושרה. מוצרי היודאיקה שלו ממשיכים להימכר כרגיל, והוא יוכל להגיש בקשה חדשה.',
        confirmLabel: 'דחיית הבקשה',
        destructive: true,
      });
      if (!ok) return;
    }
    const { error, count } = await db.from('sellers')
      .update(approve
        ? { seller_type: 'stam_scribe', stam_upgrade_status: 'approved', updated_at: new Date().toISOString() }
        : { stam_upgrade_status: 'rejected', updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', seller.id)
      .eq('stam_upgrade_status', 'pending');
    if (error || !count) {
      toast({ variant: 'destructive', title: 'העדכון נכשל', description: error?.message || 'הבקשה כבר טופלה או לא נמצאה.' });
      return;
    }
    setStamUpgradeRequests((prev) => prev.filter((s) => s.id !== seller.id));
    afterChange();
    toast({ variant: 'success', title: approve ? 'השדרוג אושר — המוכר הוא כעת סופר סת"ם' : 'בקשת השדרוג נדחתה' });
    if (seller.email) {
      const auth = await authHeader();
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
        body: JSON.stringify({
          to: seller.email,
          subject: approve ? '🎉 אושרת כסופר סת"ם באתר חותם' : 'עדכון לגבי בקשת השדרוג שלך באתר חותם',
          text: approve
            ? `שלום ${seller.first_name}, בקשת השדרוג שלך אושרה. מעכשיו תוכל להוסיף באזור האישי גם כתבי קודש (מזוזה, תפילין, מגילה, ספר תורה) לצד מוצרי היודאיקה שלך.`
            : `שלום ${seller.first_name}, לאחר בדיקה, בקשת השדרוג לסופר סת"ם לא אושרה בשלב זה. מוצרי היודאיקה שלך ממשיכים להימכר כרגיל, ותוכל להגיש בקשה חדשה מהאזור האישי או לפנות אלינו לבירור.`,
        }),
      }).catch((err) => console.error('[stam-upgrade] email failed', err));
    }
  };

  const deleteReport = async (r: any) => {
    const ok = await confirm({ title: 'למחוק את הדיווח?', description: 'מחיקה מסמנת שהדיווח טופל. אי אפשר לשחזר אותו.', confirmLabel: 'מחיקת הדיווח', destructive: true });
    if (!ok) return;
    const { error } = await db.from('reports').delete().eq('id', r.id);
    if (error) { toast({ variant: 'destructive', title: 'מחיקת הדיווח נכשלה', description: error.message }); return; }
    setRemoved((prev) => new Set(prev).add(`r:${r.id}`));
    afterChange();
    toast({ variant: 'success', title: 'הדיווח נמחק' });
  };

  const deleteInquiry = async (m: any) => {
    const ok = await confirm({ title: `למחוק את הפנייה של ${m.name || 'הפונה'}?`, description: 'הפנייה תימחק לצמיתות. אם רק טיפלת בה, עדיף לסמן "טופלה".', confirmLabel: 'מחיקת הפנייה', destructive: true });
    if (!ok) return;
    const { error } = await db.from('contact_messages').delete().eq('id', m.id);
    if (error) { toast({ variant: 'destructive', title: 'מחיקת הפנייה נכשלה', description: error.message }); return; }
    setRemoved((prev) => new Set(prev).add(`i:${m.id}`));
    afterChange();
    toast({ variant: 'success', title: 'הפנייה נמחקה' });
  };

  const updateInquiryStatus = async (id: string, status: 'new' | 'read' | 'resolved') => {
    const before = inquiryStatus[id];
    setInquiryStatus((prev) => ({ ...prev, [id]: status }));
    const { error } = await db.from('contact_messages').update({ status }).eq('id', id);
    if (error) {
      setInquiryStatus((prev) => { const next = { ...prev }; if (before) next[id] = before; else delete next[id]; return next; });
      toast({ variant: 'destructive', title: 'עדכון סטטוס הפנייה נכשל', description: error.message });
      return;
    }
    afterChange();
  };

  /* ------------------------------ detail dialogs / search ------------------------------ */
  const [detail, setDetail] = useState<{ type: 'seller' | 'customer'; row: any } | null>(null);
  const openPerson = useCallback(async (type: 'seller' | 'customer', id: string) => {
    const { data, error } = await db.from(type === 'seller' ? 'sellers' : 'customers').select('*').eq('id', id).maybeSingle();
    if (error || !data) {
      toast({ variant: 'destructive', title: type === 'seller' ? 'המוכר לא נמצא' : 'הלקוח לא נמצא', description: error?.message || 'ייתכן שהחשבון נמחק.' });
      return;
    }
    setDetail({ type, row: { ...data, id: String((data as any).id) } });
  }, [db, toast]);

  const onSearchPick = (hit: SearchHit) => {
    if (hit.type === 'order') navigate('sales', { q: hit.id });
    else openPerson(hit.type, hit.id);
  };
  const showSellerInList = (s: any) => {
    setDetail(null);
    navigate(!s.is_approved ? 'pending' : resolveSellerType(s.seller_type) === 'judaica_seller' ? 'judaica' : 'active', { q: s.email || fullName(s) });
  };

  const exportSellersToExcel = async () => {
    const { data, error } = await db.from('sellers').select('*').order('created_at', { ascending: false });
    if (error) { toast({ variant: 'destructive', title: 'ייצוא המוכרים נכשל', description: error.message }); return; }
    const sellers = data || [];
    if (sellers.length === 0) { toast({ variant: 'destructive', title: 'אין נתונים לייצוא' }); return; }
    const certLabelMap: Record<string, string> = { valid: 'תעודה בתוקף', expired: 'הייתה תעודה בעבר', none: 'ללא תעודה' };
    const headers = ['מזהה', 'סוג מוכר', 'סטטוס', 'שם פרטי', 'שם משפחה', 'אימייל', 'טלפון', 'כתובת', 'גיל', 'מצב משפחתי', 'ניסיון (שנים)', 'רמת כתב', 'סוגי כתב', 'תדירות מקווה', 'תדירות לימוד תורה', 'תעודת סופר', 'שם עסק', 'מספר עסק/ח.פ', 'סוג עסק', 'בנק', 'סניף', 'מספר חשבון', 'תאריך יצירה'];
    const rows = sellers.map((s: any) => [
      s.id || '', resolveSellerType(s.seller_type) === 'judaica_seller' ? 'מוכר יודאיקה' : 'סופר סת"ם', s.is_approved ? 'פעיל' : 'ממתין לאישור',
      s.first_name || '', s.last_name || '', s.email || '', s.phone || '', s.address || '', s.age ?? '', s.marital_status || '', s.experience_years ?? '',
      s.script_level || '', Array.isArray(s.script_types) ? s.script_types.join(' | ') : (s.script_types || ''), s.mikveh_frequency || '', s.torah_study_frequency || '',
      certLabelMap[s.has_scribe_certificate] || s.has_scribe_certificate || '', s.business_name || '', s.business_id || '', s.business_type || '',
      s.bank_name || '', s.bank_branch || '', s.bank_account_number || '', s.created_at ? new Date(s.created_at).toLocaleString('he-IL') : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    // UTF-8 BOM so Excel opens the Hebrew correctly.
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `hotam-sellers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast({ variant: 'success', title: 'קובץ Excel מוכן להורדה' });
  };

  /* --------------------------------------- badges --------------------------------------- */
  const a = attention;
  const badges: AdminBadges = {
    pending: { count: a.pendingStam + a.pendingJudaica + a.stamUpgrades, tone: 'alert' },
    sales: { count: a.stuckOrders, tone: 'alert' },
    torah: { count: a.torahRequests, tone: 'info' },
    inquiries: { count: a.newInquiries, tone: 'alert' },
    reports: { count: a.reports, tone: 'alert' },
    chats: a.flaggedChats > 0 ? { count: a.flaggedChats, tone: 'alert' } : { count: a.waitingChatIds.length, tone: 'info' },
    notifications: { count: a.sms?.installed ? a.sms.failed24h : 0, tone: 'alert' },
  };

  if (isUserLoading || isAdminCheckLoading) return <FullPageLoader />;
  if (!user || !adminData) return null;

  const filtered = !!searchTerm.trim();
  const listFilterBox = LIST_FILTER_TABS.includes(activeTab) && (
    <AdminListFilter
      value={searchTerm}
      onChange={setSearchTerm}
      placeholder={activeTab === 'sales' || activeTab === 'torah' ? 'סינון לפי מספר הזמנה, קונה או מוצר…' : activeTab === 'inquiries' || activeTab === 'reports' ? 'סינון לפי שם, אימייל או תוכן…' : 'סינון לפי שם, אימייל או טלפון…'}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA]" dir="rtl">
      <Navbar />
      <main className="flex-1 px-4 pb-16 pt-24 md:px-6 md:pt-28">
        <AdminShell
          active={activeTab}
          badges={badges}
          onNavigate={(tab) => navigate(tab)}
          adminName={(adminData as any)?.email || user.email}
          search={<AdminGlobalSearch onPick={onSearchPick} />}
          actions={(listFilterBox || SELLER_TABS.includes(activeTab)) ? (
            <>
              {listFilterBox}
              {SELLER_TABS.includes(activeTab) && (
                <Button onClick={exportSellersToExcel} variant="outline" className="h-11 gap-2 rounded-2xl border-primary/10 bg-white px-4 text-sm font-bold text-primary">
                  <FileDown className="h-4 w-4" /> ייצוא מוכרים לאקסל
                </Button>
              )}
            </>
          ) : undefined}
        >
          <div className="space-y-8" data-admin-tab={activeTab}>
            {activeTab === 'overview' && <AdminOverviewPanel attention={attention} onNavigate={navigate} />}

            {activeTab === 'pending' && (
              <>
                {stamUpgradeRequests.length > 0 && <StamUpgradeRequests requests={stamUpgradeRequests} orders={[]} onResolve={resolveStamUpgrade} />}
                <section data-admin-pending-section="stam_scribe">
                  <AdminSectionTitle count={sellerLists.totals.pending ?? 0}>סופרי סת"ם ממתינים לאישור</AdminSectionTitle>
                  <SellersTable sellers={sellerLists.pending} orders={[]} isLoading={isSellersLoading} totalCount={sellerLists.totals.pending ?? 0} page={pendingPage} setPage={setPendingPage}
                    kind="stam_scribe" pending onApprove={approveSeller} onDelete={deleteSeller} approvingId={approvingId}
                    emptyText={filtered ? 'אין סופרים ממתינים שמתאימים לסינון' : 'אין סופרים שממתינים לאישור'} />
                </section>
                <section data-admin-pending-section="judaica_seller">
                  <AdminSectionTitle count={sellerLists.totals.pendingJudaica ?? 0}>מוכרי יודאיקה ממתינים לאישור</AdminSectionTitle>
                  <SellersTable sellers={sellerLists.pendingJudaica} orders={[]} isLoading={isSellersLoading} totalCount={sellerLists.totals.pendingJudaica ?? 0} page={pendingJudaicaPage} setPage={setPendingJudaicaPage}
                    kind="judaica_seller" pending onApprove={approveSeller} onDelete={deleteSeller} approvingId={approvingId}
                    emptyText={filtered ? 'אין מוכרים ממתינים שמתאימים לסינון' : 'אין מוכרי יודאיקה שממתינים לאישור'} />
                </section>
              </>
            )}

            {activeTab === 'active' && (
              <section>
                <AdminSectionTitle count={sellerLists.totals.active ?? 0}>סופרי סת"ם מאושרים</AdminSectionTitle>
                <SellersTable sellers={sellerLists.active} orders={visibleOrders} isLoading={isSellersLoading} totalCount={sellerLists.totals.active ?? 0} page={activePage} setPage={setActivePage}
                  kind="stam_scribe" pending={false} onApprove={approveSeller} onDelete={deleteSeller} emptyText={filtered ? 'לא נמצאו סופרים תואמים' : 'אין עדיין סופרים מאושרים'} />
              </section>
            )}

            {activeTab === 'judaica' && (
              <section>
                <AdminSectionTitle count={sellerLists.totals.judaica ?? 0}>מוכרי יודאיקה מאושרים</AdminSectionTitle>
                <SellersTable sellers={sellerLists.judaica} orders={visibleOrders} isLoading={isSellersLoading} totalCount={sellerLists.totals.judaica ?? 0} page={judaicaPage} setPage={setJudaicaPage}
                  kind="judaica_seller" pending={false} onApprove={approveSeller} onDelete={deleteSeller} emptyText={filtered ? 'לא נמצאו מוכרים תואמים' : 'אין עדיין מוכרי יודאיקה מאושרים'} />
              </section>
            )}

            {activeTab === 'customers' && (
              <CustomersTable customers={customers.rows} orders={visibleOrders} isLoading={isCustomersLoading} onOpen={(c) => setDetail({ type: 'customer', row: c })}
                onDelete={deleteCustomer} deletingCustomerId={deletingCustomerId} totalCount={customers.total} page={customersPage} setPage={setCustomersPage}
                resolveCreatedAt={resolveCreatedAt} filtered={filtered} />
            )}

            {activeTab === 'sales' && (
              <div className="space-y-5">
                <SalesFilterBar value={salesFilter} onChange={(f) => setSalesFilter(f)} stuckCount={stuckCount} />
                {!allOrders && needOrders ? <AdminSectionTitle>טוען הזמנות…</AdminSectionTitle> : (
                  <SalesList orders={salesOrders} allOrders={allOrders || []} sellers={sellerDirectory} filter={salesFilter} page={salesPage} setPage={setSalesPage} onOpenPerson={openPerson} filtered={filtered} />
                )}
              </div>
            )}

            {activeTab === 'torah' && (
              <TorahRequestsList orders={torahOrders} sellers={sellerDirectory} page={torahPage} setPage={setTorahPage} onOpenPerson={openPerson} filtered={filtered} />
            )}

            {activeTab === 'reports' && (
              <ReportsList reports={reports} page={reportsPage} setPage={setReportsPage} onDelete={deleteReport} onOpenPerson={openPerson} filtered={filtered} />
            )}

            {activeTab === 'inquiries' && (
              <div className="space-y-4">
                <InquiryFilterBar value={inquiryFilter} onChange={setInquiryFilter} counts={inquiryCounts} />
                <InquiriesList inquiries={inquiries} allInquiries={inquiriesAll} page={inquiriesPage} setPage={setInquiriesPage} onDelete={deleteInquiry} onUpdateStatus={updateInquiryStatus} filtered={filtered || inquiryFilter !== 'all'} />
              </div>
            )}

            {activeTab === 'chats' && <AdminChatsPanel key={filterParam} initialFilter={filterParam} waitingChatIds={attention.waitingChatIds} />}
            {activeTab === 'activity' && <AdminActivityPanel />}
            {activeTab === 'broadcast' && <AdminBroadcastPanel />}
            {activeTab === 'notifications' && <AdminNotificationsPanel key={filterParam} initialStatus={filterParam} />}
            {activeTab === 'audit' && <AdminAuditLogPanel />}
          </div>
        </AdminShell>
      </main>

      {detail?.type === 'seller' && (
        <SellerDetailDialog scribe={detail.row} open onOpenChange={(o) => { if (!o) setDetail(null); }} onShowInList={() => showSellerInList(detail.row)} />
      )}
      {detail?.type === 'customer' && (
        <CustomerDetailsDialog
          customer={detail.row}
          createdAt={resolveCreatedAt(detail.row)}
          isDeleting={deletingCustomerId === detail.row.id}
          onClose={() => setDetail(null)}
          onDelete={async () => { if (await deleteCustomer(detail.row)) setDetail(null); }}
          onShowInList={() => { const c = detail.row; setDetail(null); navigate('customers', { q: c.email || fullName(c) }); }}
        />
      )}
    </div>
  );
}

function approvalEmailHtml(firstName: string) {
  const name = String(firstName || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  return `
    <div dir="rtl" style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.12);border:1px solid rgba(212,175,55,0.18);">
        <div style="background:#111827;padding:32px;text-align:center;">
          <img src="https://hotam.shop/icon.svg" alt="Hotam" width="64" height="64" style="display:block;margin:0 auto 14px;" />
          <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;">🎉 הפרופיל שלך אושר!</h1>
          <p style="margin:10px 0 0;color:#d4af37;font-size:15px;font-weight:700;">ברוך הבא לקהילת המוכרים של חותם</p>
        </div>
        <div style="padding:32px;text-align:right;">
          <p style="margin:0 0 18px;font-size:17px;line-height:1.8;color:#111827;">שלום ${name},</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.9;color:#374151;">
            הפרופיל שלך אושר על ידי צוות חותם. כעת תוכל להתחיל להעלות מוצרים ולמכור באתר.
          </p>
          <div style="background:#fff8e1;border-right:4px solid #d4af37;border-radius:14px;padding:18px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:15px;line-height:1.8;color:#92400e;font-weight:700;">
              כדי להתחיל, היכנס לדשבורד המוכר שלך והעלה את המוצר הראשון.
            </p>
          </div>
          <div style="text-align:center;">
            <a href="https://hotam.shop/seller/dashboard" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-size:15px;font-weight:800;">
              מעבר לדשבורד המוכר
            </a>
          </div>
        </div>
        <div style="padding:18px 28px;background:#faf7f0;border-top:1px solid rgba(212,175,55,0.2);text-align:center;">
          <p style="margin:0;font-size:12px;color:#6b7280;">Hotam Shop · זירת המסחר המאובטחת לכלי קודש וסת&quot;ם מהודרים</p>
        </div>
      </div>
    </div>
  `;
}
