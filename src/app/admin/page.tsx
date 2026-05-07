
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Eye, 
  ShieldAlert,
  Loader2,
  Trash2,
  TrendingUp,
  Search,
  UserCheck,
  ShieldCheck,
  UserRound,
  Scroll,
  History,
  Flag,
  Star,
  MessageSquare,
  AlertTriangle,
  ShoppingBag,
  ArrowUpRight,
  ExternalLink,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Building2,
  Hash,
  AlertCircle,
  IdCard,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { 
  useUser, 
  useSupabaseClient, 
  useCollection, 
  useDoc, 
  useMemoStable,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/lib/supabase-hooks';
import { collection, query, doc, orderBy, where } from '@/lib/supabase-compat';
import Image from 'next/image';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import unsplashLoader from '@/lib/unsplashLoader';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 15;

const certLabels: Record<string, string> = {
  'valid': 'תעודה בתוקף',
  'expired': 'הייתה תעודה בעבר',
  'none': 'ללא תעודה'
};

export default function AdminDashboard() {
  const { user, isUserLoading } = useUser();
  const db = useSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  
  // Pagination states
  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [torahPage, setTorahPage] = useState(1);

  const adminEmails = ["admin@hotam.co.il", "davidafergan999@gmail.com", "davidafergan@gmail.com", "da@101.org.il", "DA@101.ORG.IL"];
  const isSuperAdmin = user?.uid === "f9hcxiHpzKYMzw7UNpi5II2F13l1" || 
                       user?.uid === "aMqKTe1Y4NSQdupLPupviiyrdyj2" ||
                       (user?.email && adminEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) ||
                       user?.role === 'admin';
  
  const adminRef = useMemoStable(() => {
    if (!user) return null;
    return doc(db, 'admins', user.uid);
  }, [db, user?.uid]);
  const { data: adminData, isLoading: isAdminCheckLoading } = useDoc<any>(adminRef);

  useEffect(() => {
    if (!isUserLoading && !isAdminCheckLoading) {
      if (!user || (!adminData && !isSuperAdmin)) {
        router.push('/');
      }
    }
  }, [user, isUserLoading, isAdminCheckLoading, adminData, isSuperAdmin, router]);

  const canLoadData = !!user && !isUserLoading && !isAdminCheckLoading && (isSuperAdmin || !!adminData);

  const sellersQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'sellers'));
  }, [db, canLoadData]);
  const { data: allSellers, isLoading: isSellersLoading } = useCollection<any>(sellersQuery);

  const customersQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'customers'));
  }, [db, canLoadData]);
  const { data: allCustomers } = useCollection<any>(customersQuery);

  const ordersQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'orders'), orderBy('created_at', 'desc'));
  }, [db, canLoadData]);
  const { data: allOrders } = useCollection<any>(ordersQuery);
  const visibleOrders = useMemo(
    () => (allOrders || []).filter((order: any) => order.status !== 'pending_payment'),
    [allOrders]
  );

  const reportsQuery = useMemoStable(() => {
    if (!canLoadData) return null;
    return query(collection(db, 'reports'), orderBy('created_at', 'desc'));
  }, [db, canLoadData]);
  const { data: allReports } = useCollection<any>(reportsQuery);

  const stats = useMemo(() => {
    const s = allSellers || [];
    const c = allCustomers || [];
    const o = visibleOrders.filter((x: any) => x.status === 'completed');
    const totalVolume = o.reduce((acc: number, x: any) => acc + Number(x.amount || 0), 0);
    
    return {
      totalScribes: s.filter(x => x.is_approved).length,
      totalCustomers: c.length,
      productsSold: o.length,
      totalVolume: totalVolume,
      siteEarnings: totalVolume * 0.20,
    };
  }, [allSellers, allCustomers, visibleOrders]);

  // Filtering Logic
  const filteredSellersPending = useMemo(() => {
    if (!allSellers) return [];
    return allSellers.filter(s => !s.is_approved && (
      `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [allSellers, searchTerm]);

  const filteredSellersActive = useMemo(() => {
    if (!allSellers) return [];
    return allSellers.filter(s => s.is_approved && (
      `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [allSellers, searchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    return allCustomers.filter(c => (
      `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [allCustomers, searchTerm]);

  const filteredOrders = useMemo(() => {
    return visibleOrders.filter(o => {
      if (o.status === 'torah_request') return false; 
      const matchSearch = (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (o.buyer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (o.product_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = salesStatusFilter === 'all' ? true :
                          salesStatusFilter === 'completed' ? o.status === 'completed' :
                          o.status !== 'completed';
      
      return matchSearch && matchStatus;
    });
  }, [visibleOrders, searchTerm, salesStatusFilter]);

  const torahOrders = useMemo(() => {
    return visibleOrders.filter(o => o.status === 'torah_request' && (
      (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.buyer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [visibleOrders, searchTerm]);

  const handleTabLink = (tab: string, search: string = '') => {
    setActiveTab(tab);
    setSearchTerm(search);
  };

  const approveScribe = (id: string) => {
    updateDocumentNonBlocking(doc(db, 'sellers', id), { is_approved: true });
    setActiveTab('active');
    setSearchTerm('');
    setActivePage(1);
    toast({ title: "הסופר הועבר לסופרים הפעילים והמאומתים" });
  };

  const deleteScribe = (id: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק סופר זה לצמיתות?')) {
      deleteDocumentNonBlocking(doc(db, 'sellers', id));
      toast({ variant: "destructive", title: "הסופר נמחק" });
    }
  };

  const deleteReport = (id: string) => {
    if (confirm('מחיקת הדיווח מהמערכת?')) {
      deleteDocumentNonBlocking(doc(db, 'reports', id));
      toast({ title: "הדיווח נמחק" });
    }
  };

  const deleteCustomer = (id: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק לקוח זה לצמיתות?')) {
      deleteDocumentNonBlocking(doc(db, 'customers', id));
      toast({ variant: "destructive", title: "הלקוח נמחק" });
    }
  };

  if (isUserLoading || isAdminCheckLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!user || (!adminData && !isSuperAdmin)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col" dir="rtl">
      <Navbar />
      
      <main className="container mx-auto px-4 py-32 max-w-7xl flex-1">
        <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
          <div className="text-right">
            <div className="flex items-center gap-3 mb-2">
               <div className="bg-primary/5 p-3 rounded-2xl">
                 <ShieldCheck className="w-8 h-8 text-primary" />
               </div>
               <div>
                 <h1 className="text-4xl font-headline font-black text-primary tracking-tight">ניהול מערכת HOTAM</h1>
                 <p className="text-muted-foreground font-medium">פיקוח על כשרות, אימות סופרים וניטור פיננסי</p>
               </div>
            </div>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="חפש לפי שם, אימייל או מזהה ID..." 
              className="pr-11 h-14 rounded-2xl bg-white border-none shadow-premium focus:ring-2 focus:ring-primary/10 transition-all text-sm font-bold text-slate-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          <StatCard label="מחזור עסקאות" value={`₪${stats.totalVolume.toLocaleString()}`} icon={<TrendingUp />} color="bg-primary" />
          <StatCard label="רווח אתר (20%)" value={`₪${stats.siteEarnings.toLocaleString()}`} icon={<Banknote />} color="bg-emerald-50 text-emerald-600" highlight />
          <StatCard label="סופרים פעילים" value={stats.totalScribes} icon={<Users />} color="bg-accent" />
          <StatCard label="לקוחות רשומים" value={stats.totalCustomers} icon={<UserRound />} color="bg-blue-500" />
          <StatCard label="מוצרים שנמכרו" value={stats.productsSold} icon={<ShoppingBag />} color="bg-orange-500" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white/50 backdrop-blur-md p-1.5 rounded-[2rem] shadow-premium border h-16 w-full flex overflow-x-auto whitespace-nowrap scrollbar-hide">
            <TabsTrigger value="pending" className="px-8 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest gap-2">
              <Clock className="w-4 h-4" /> ממתינים לאישור
            </TabsTrigger>
            <TabsTrigger value="active" className="px-8 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest gap-2">
              <CheckCircle2 className="w-4 h-4" /> סופרים פעילים ומאומתים
            </TabsTrigger>
            <TabsTrigger value="customers" className="px-8 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest gap-2">
              <UserRound className="w-4 h-4" /> לקוחות
            </TabsTrigger>
            <TabsTrigger value="sales" className="px-8 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest gap-2">
              <History className="w-4 h-4" /> יומן מכירות
            </TabsTrigger>
            <TabsTrigger value="torah" className="px-8 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest gap-2">
              <Scroll className="w-4 h-4" /> ספרי תורה
            </TabsTrigger>
            <TabsTrigger value="reports" className="px-8 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black text-[10px] uppercase tracking-widest gap-2">
              <Flag className="w-4 h-4" /> דיווחים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <ScribeTable 
              scribes={filteredSellersPending} 
              onApprove={approveScribe} 
              onDelete={deleteScribe} 
              isLoading={isSellersLoading} 
              orders={visibleOrders} 
              page={pendingPage}
              setPage={setPendingPage}
            />
          </TabsContent>

          <TabsContent value="active">
            <ScribeTable 
              scribes={filteredSellersActive} 
              onApprove={approveScribe} 
              onDelete={deleteScribe} 
              isLoading={isSellersLoading} 
              orders={visibleOrders} 
              page={activePage}
              setPage={setActivePage}
            />
          </TabsContent>

          <TabsContent value="customers">
            <CustomerTable 
              customers={filteredCustomers} 
              orders={visibleOrders}
              onDelete={deleteCustomer}
              page={customersPage}
              setPage={setCustomersPage}
            />
          </TabsContent>

          <TabsContent value="sales">
            <div className="space-y-6">
              <div className="flex gap-2 justify-end">
                <Button variant={salesStatusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSalesStatusFilter('all')} className="rounded-full text-[9px] h-8">הכל</Button>
                <Button variant={salesStatusFilter === 'completed' ? 'default' : 'outline'} size="sm" onClick={() => setSalesStatusFilter('completed')} className="rounded-full text-[9px] h-8">אושר/הושלם</Button>
                <Button variant={salesStatusFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setSalesStatusFilter('pending')} className="rounded-full text-[9px] h-8">בהמתנה</Button>
              </div>
              <SalesCards 
                orders={filteredOrders} 
                sellers={allSellers} 
                onLinkToTab={handleTabLink}
                page={salesPage}
                setPage={setSalesPage}
              />
            </div>
          </TabsContent>

          <TabsContent value="torah">
             <TorahRequestsTable 
               orders={torahOrders} 
               sellers={allSellers} 
               page={torahPage} 
               setPage={setTorahPage} 
             />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsTable 
              reports={allReports} 
              sellers={allSellers}
              onDelete={deleteReport} 
              onLinkToTab={handleTabLink}
              page={reportsPage} 
              setPage={setReportsPage} 
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color, highlight = false }: any) {
  return (
    <Card className={`border-none shadow-premium rounded-[2rem] overflow-hidden bg-white transition-all hover:translate-y-[-4px] ${highlight ? 'ring-2 ring-emerald-500/20' : ''}`}>
      <CardContent className="p-5 flex items-center justify-between">
        <div className="text-right">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-primary tabular-nums">{value}</p>
        </div>
        <div className={`p-3 rounded-2xl shadow-lg text-white ${color}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ScribeTable({ scribes, onApprove, onDelete, isLoading, orders, page, setPage }: any) {
  const db = useSupabaseClient();
  const logoImg = PlaceHolderImages.find(img => img.id === 'site-logo')?.imageUrl || 'https://picsum.photos/seed/hotam-logo/400/400';

  const paginatedData = scribes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (isLoading) return <div className="flex justify-center p-24"><Loader2 className="w-10 h-10 animate-spin text-primary/30" /></div>;
  if (!scribes || scribes.length === 0) return (
    <Card className="p-24 text-center bg-white rounded-[3rem] shadow-premium text-muted-foreground border-2 border-dashed border-muted italic">
      אין סופרים להצגה.
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="text-right font-black text-[10px] uppercase py-6 px-8">סופר / מזהה אישי</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">מיקום</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">חוב לסופר (החודש)</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">סטטוס הסמכה</TableHead>
              <TableHead className="text-left font-black text-[10px] uppercase py-6 px-8">ניהול</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((scribe: any) => {
              const scribeOrders = (orders || []).filter((o: any) => o.seller_id === scribe.id && o.status === 'completed');
              const currentMonth = new Date().getMonth();
              const currentYear = new Date().getFullYear();
              
              const monthlyEarnings = scribeOrders
                .filter((o: any) => {
                  const date = o.created_at?.toDate ? o.created_at.toDate() : (o.created_at ? new Date(o.created_at) : new Date());
                  return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                })
                .reduce((acc: number, o: any) => acc + (Number(o.seller_net) || Number(o.amount) * 0.80), 0);

              return (
                <TableRow key={scribe.id} className="hover:bg-muted/10 transition-colors border-muted/20">
                  <TableCell className="py-6 px-8">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 overflow-hidden relative">
                        <Image loader={unsplashLoader} src={scribe.profile_image || logoImg} alt="P" fill className="object-cover" />
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary text-sm leading-none mb-1 flex items-center gap-2">
                          {scribe.first_name} {scribe.last_name}
                          {scribe.is_approved && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </p>
                        <p className="text-[8px] text-muted-foreground font-bold font-mono bg-muted/50 px-2 py-0.5 rounded w-fit">ID: {scribe.id?.slice(0, 12)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-primary/70">{scribe.address || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-emerald-600">₪{monthlyEarnings.toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full", scribe.has_scribe_certificate === 'valid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200')}>
                      {certLabels[scribe.has_scribe_certificate] || scribe.has_scribe_certificate || 'לא צוין'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-8">
                    <div className="flex items-center gap-2 justify-end">
                      <VerifyScribeDialog scribe={scribe} db={db} />
                      {!scribe.is_approved ? (
                        <Button onClick={() => onApprove(scribe.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-5 h-8 text-[9px] font-black uppercase tracking-widest">אשר סופר</Button>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border-none px-4 py-1 text-[8px] font-black uppercase tracking-widest">סופר פעיל ומאומת</Badge>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => onDelete(scribe.id)} className="h-8 w-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Pagination current={page} total={scribes.length} onChange={setPage} />
    </div>
  );
}

function CustomerTable({ customers, orders, onDelete, page, setPage }: any) {
  const paginatedData = customers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-none">
              <TableHead className="text-right font-black text-[10px] uppercase py-6 px-8">לקוח / אימייל</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">מזהה (ID)</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">סך רכישות</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">תאריך הצטרפות</TableHead>
              <TableHead className="text-left font-black text-[10px] uppercase py-6 px-8">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((cust: any) => {
              const custOrdersCount = (orders || []).filter((o: any) => o.buyer_id === cust.id && o.status === 'completed').length;
              return (
                <TableRow key={cust.id} className="border-muted/20">
                  <TableCell className="py-6 px-8">
                    <div className="text-right">
                      <p className="font-black text-primary text-sm">{cust.first_name} {cust.last_name}</p>
                      <p className="text-[9px] text-muted-foreground">{cust.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-primary/60">{cust.id}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-primary/5 text-primary border-primary/10 rounded-full font-black text-[10px] px-3">{custOrdersCount} הזמנות</Badge>
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-muted-foreground">{cust.created_at ? new Date(cust.created_at).toLocaleDateString('he-IL') : '-'}</TableCell>
                  <TableCell className="px-8 text-left">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(cust)} aria-label={`צפה פרטי ${cust.first_name} ${cust.last_name}`} className="rounded-full h-8 px-4 text-[9px] font-black border-primary/5">
                      צפה
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Pagination current={page} total={customers.length} onChange={setPage} />

      {selectedCustomer && (
        <CustomerDetailsDialog
          customer={selectedCustomer}
          orders={(orders || []).filter((o: any) => o.buyer_id === selectedCustomer.id)}
          onDelete={() => { onDelete(selectedCustomer.id); setSelectedCustomer(null); }}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

function CustomerDetailsDialog({ customer, orders, onDelete, onClose }: any) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 border-none shadow-2xl bg-white max-h-[85vh] overflow-y-auto z-[150]" dir="rtl">
        <div className="bg-primary p-6 text-white text-right sticky top-0 z-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-black tracking-tight flex items-center gap-4 text-white">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <UserRound className="w-6 h-6 text-white" />
              </div>
              <div>
                <p>{customer.first_name} {customer.last_name}</p>
                <p className="text-[11px] font-medium opacity-70 mt-0.5">{customer.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6 text-right">
          {/* Customer details */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2"><IdCard className="w-4 h-4" /> פרטי לקוח</h4>
            <div className="bg-muted/30 p-5 rounded-2xl space-y-3 text-[11px] font-bold">
              <div className="flex justify-between border-b border-white/50 pb-2"><span>{customer.first_name} {customer.last_name}</span><span className="text-muted-foreground">שם מלא:</span></div>
              <div className="flex justify-between border-b border-white/50 pb-2"><span>{customer.email}</span><span className="text-muted-foreground">אימייל:</span></div>
              <div className="flex justify-between border-b border-white/50 pb-2"><span>{customer.phone || '-'}</span><span className="text-muted-foreground">טלפון:</span></div>
              <div className="flex justify-between border-b border-white/50 pb-2"><span>{customer.address || '-'}</span><span className="text-muted-foreground">כתובת:</span></div>
              <div className="flex justify-between"><span>{customer.created_at ? new Date(customer.created_at).toLocaleDateString('he-IL') : '-'}</span><span className="text-muted-foreground">תאריך הצטרפות:</span></div>
            </div>
          </div>

          {/* Orders */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> הזמנות ({orders.length})</h4>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-xl">אין הזמנות עבור לקוח זה.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {orders.map((o: any) => {
                  const date = o.created_at?.toDate ? o.created_at.toDate() : (o.created_at ? new Date(o.created_at) : null);
                  return (
                    <div key={o.id} className="bg-muted/20 p-4 rounded-2xl flex justify-between items-center text-[11px] font-bold border border-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge className={cn("border-none font-black text-[8px] uppercase", o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                          {o.status === 'completed' ? 'הושלם' : 'בהמתנה'}
                        </Badge>
                        <span className="text-primary/50 font-mono text-[9px]">#{o.id?.slice(0, 8)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-black">{o.product_name}</p>
                        <p className="text-muted-foreground text-[9px]">{date ? date.toLocaleDateString('he-IL') : '-'}</p>
                      </div>
                      <p className="text-emerald-600 font-black">₪{o.amount?.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delete button */}
          <div className="pt-4 border-t flex justify-end">
            <Button variant="destructive" onClick={onDelete} className="rounded-full px-6 h-10 text-[10px] font-black uppercase gap-2">
              <Trash2 className="w-3.5 h-3.5" /> מחק לקוח
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SalesCards({ orders, sellers, onLinkToTab, page, setPage }: any) {
  const paginatedData = orders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (orders.length === 0) return <Card className="p-24 text-center bg-white rounded-[3rem] shadow-premium italic text-muted-foreground">אין מכירות רשומות במערכת.</Card>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedData.map((o: any) => {
          const seller = sellers?.find((s: any) => s.id === o.seller_id);
          const date = o.created_at?.toDate ? o.created_at.toDate() : new Date(o.created_at);
          const formattedDate = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const formattedTime = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

          return (
            <Card key={o.id} className="border-none shadow-premium rounded-[2rem] bg-white overflow-hidden group hover:shadow-2xl transition-all">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <Badge className={cn("text-[8px] font-black uppercase", o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>
                    {o.status === 'completed' ? 'עסקה הושלמה' : 'שולם - בהמתנה'}
                  </Badge>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground">{formattedDate}</p>
                    <p className="text-[10px] font-bold text-primary/40">{formattedTime}</p>
                  </div>
                </div>

                <div className="space-y-1">
                   <p className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full w-fit font-mono flex items-center gap-1.5"><Hash className="w-3 h-3" /> {o.id}</p>
                   <div className="flex gap-4 items-center pt-1">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden border bg-muted shrink-0 shadow-inner">
                      <Image src={o.product_image} alt="P" fill className="object-cover" />
                    </div>
                    <div className="text-right flex-1 min-w-0">
                      <h4 className="font-black text-primary truncate text-sm">{o.product_name}</h4>
                      <p className="text-base font-black text-emerald-600">₪{o.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-muted/50">
                  <div className="flex justify-between items-center group/btn cursor-pointer" onClick={() => onLinkToTab('customers', o.buyer_name)}>
                     <div className="flex items-center gap-1.5"><UserRound className="w-3 h-3 text-accent" /><span className="text-[10px] font-bold text-primary/60 group-hover/btn:text-primary transition-colors underline decoration-primary/10">{o.buyer_name}</span></div>
                     <span className="text-[8px] font-black text-muted-foreground uppercase">קונה</span>
                  </div>
                  <div className="flex justify-between items-center group/btn cursor-pointer" onClick={() => onLinkToTab('active', `${seller?.first_name} ${seller?.last_name}`)}>
                     <div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-primary/40" /><span className="text-[10px] font-bold text-primary/60 group-hover/btn:text-primary transition-colors underline decoration-primary/10">{seller ? `${seller.first_name} ${seller.last_name}` : 'סופר לא מזוהה'}</span></div>
                     <span className="text-[8px] font-black text-muted-foreground uppercase">מוכר</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button asChild variant="outline" className="flex-1 h-9 rounded-xl font-black text-[9px] uppercase gap-2 border-primary/5 hover:bg-primary hover:text-white">
                    <Link href={`/products/${o.product_id}`}>צפה במוצר</Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Pagination current={page} total={orders.length} onChange={setPage} />
    </div>
  );
}

function TorahRequestsTable({ orders, sellers, page, setPage }: any) {
  const paginatedData = orders.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (orders.length === 0) return <Card className="p-24 text-center bg-white rounded-[3rem] shadow-premium italic text-muted-foreground">אין בקשות לספרי תורה.</Card>;

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-none">
              <TableHead className="text-right font-black text-[10px] uppercase py-6 px-8">ID / תאריך</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">קונה</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">מוכר (סופר)</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">מוצר</TableHead>
              <TableHead className="text-left font-black text-[10px] uppercase py-6 px-8">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((o: any) => {
              const seller = sellers?.find((s: any) => s.id === o.seller_id);
              const date = o.created_at?.toDate ? o.created_at.toDate() : new Date(o.created_at);
              return (
                <TableRow key={o.id} className="border-muted/20">
                  <TableCell className="py-6 px-8">
                     <p className="text-[9px] font-black text-primary font-mono mb-1">{o.id}</p>
                     <p className="text-[10px] font-bold text-muted-foreground">{date.toLocaleDateString('he-IL')}</p>
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-primary">{o.buyer_name}</TableCell>
                  <TableCell className="text-[10px] font-bold text-primary">{seller ? `${seller.first_name} ${seller.last_name}` : 'סופר לא מזוהה'}</TableCell>
                  <TableCell className="text-[10px] font-bold text-primary">{o.product_name}</TableCell>
                  <TableCell className="px-8 text-left">
                    <Button variant="ghost" size="sm" asChild className="rounded-full h-8 px-4 text-[9px] font-black border-primary/5">
                       <Link href={`/products/${o.product_id}`}>צפה במוצר</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Pagination current={page} total={orders.length} onChange={setPage} />
    </div>
  );
}

function ReportsTable({ reports, sellers, onDelete, onLinkToTab, page, setPage }: any) {
  const paginatedData = (reports || []).slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (!reports || reports.length === 0) return <Card className="p-24 text-center bg-white rounded-[3rem] shadow-premium italic text-muted-foreground">אין דיווחים במערכת.</Card>;

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-none">
              <TableHead className="text-right font-black text-[10px] uppercase py-6 px-8">תאריך</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">המדווח</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">על הסופר</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase py-6">סיבת הדיווח</TableHead>
              <TableHead className="text-left font-black text-[10px] uppercase py-6 px-8">ניהול</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((r: any) => {
              const date = r.created_at?.toDate ? r.created_at.toDate() : new Date(r.created_at);
              return (
                <TableRow key={r.id} className="border-muted/20">
                  <TableCell className="py-6 px-8 text-[10px] font-bold">{date.toLocaleDateString('he-IL')}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => onLinkToTab('customers', r.reporter_name)}
                      className="text-[10px] font-bold text-primary underline decoration-primary/20 hover:text-accent transition-colors"
                    >
                      {r.reporter_name}
                    </button>
                  </TableCell>
                  <TableCell>
                    {r.seller_id ? (
                      <Link
                        href={`/sellers/${r.seller_id}`}
                        className="text-[10px] font-bold text-primary underline decoration-primary/20 hover:text-accent transition-colors"
                        target="_blank"
                      >
                        {r.seller_name}
                      </Link>
                    ) : (
                      <span className="text-[10px] font-bold text-primary">{r.seller_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[10px] font-bold text-destructive max-w-xs truncate">{r.reason}</TableCell>
                  <TableCell className="px-8 text-left">
                    <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} className="h-8 w-8 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Pagination current={page} total={reports.length} onChange={setPage} />
    </div>
  );
}

function VerifyScribeDialog({ scribe, db }: any) {
  const reviewsQuery = useMemoStable(() => query(collection(db, 'reviews'), where('seller_id', '==', scribe.id)), [db, scribe.id]);
  const { data: reviews } = useCollection<any>(reviewsQuery);

  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full hover:bg-primary hover:text-white transition-all border-primary/5 shadow-sm">
          <Eye className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white max-h-[85vh] overflow-y-auto z-[150]" dir="rtl">
        <div className="bg-primary p-6 text-white text-right relative sticky top-0 z-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-black tracking-tight flex items-center gap-4 text-white">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20 relative overflow-hidden">
                <Image src={scribe.profile_image || 'https://picsum.photos/seed/scribe/200/200'} alt="S" fill className="object-cover" />
              </div>
              <div>
                <p>{scribe.first_name} {scribe.last_name}</p>
                <div className="flex items-center gap-1 mt-1">
                   {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 s ${s <= averageRating ? 'text-accent fill-accent' : 'text-white/20'}`} />)}
                   <span className="text-[8px] opacity-60 mr-2">({reviews?.length || 0} ביקורות)</span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="p-8 space-y-8 text-right">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Business & Bank Info */}
            <div className="space-y-6">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2"><Building2 className="w-4 h-4" /> פרטי עסק רשמיים</h4>
                  <div className="bg-muted/30 p-5 rounded-2xl space-y-3 text-[11px] font-bold">
                    <div className="flex justify-between border-b border-white/50 pb-2"><span>{scribe.business_name}</span><span className="text-muted-foreground">שם עסק:</span></div>
                    <div className="flex justify-between border-b border-white/50 pb-2"><span>{scribe.business_id}</span><span className="text-muted-foreground">ח.פ / עוסק:</span></div>
                    <div className="flex justify-between"><span>{scribe.business_type === 'osek_patur' ? 'עוסק פטור' : 'עוסק מורשה'}</span><span className="text-muted-foreground">סוג:</span></div>
                  </div>
               </div>
               
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2"><Landmark className="w-4 h-4" /> פרטי חשבון בנק</h4>
                  <div className="bg-emerald-50/50 p-5 rounded-2xl space-y-3 text-[11px] font-bold border border-emerald-100/50">
                    <div className="flex justify-between border-b border-emerald-100/50 pb-2"><span>{scribe.bank_name}</span><span className="text-muted-foreground">בנק:</span></div>
                    <div className="flex justify-between border-b border-emerald-100/50 pb-2"><span>{scribe.bank_branch}</span><span className="text-muted-foreground">סניף:</span></div>
                    <div className="flex justify-between"><span>{scribe.bank_account_number}</span><span className="text-muted-foreground">חשבון:</span></div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Phone className="w-4 h-4" /> פרטי התקשרות</h4>
                  <div className="bg-blue-50/50 p-5 rounded-2xl space-y-3 text-[11px] font-bold border border-blue-100/50">
                    <div className="flex justify-between border-b border-blue-100/50 pb-2"><span>{scribe.phone}</span><span className="text-muted-foreground">טלפון:</span></div>
                    <div className="flex justify-between border-b border-blue-100/50 pb-2"><span>{scribe.email}</span><span className="text-muted-foreground">אימייל:</span></div>
                    <div className="flex justify-between"><span>{scribe.address}</span><span className="text-muted-foreground">כתובת:</span></div>
                  </div>
               </div>
            </div>

            {/* Religious & Professional Info */}
            <div className="space-y-6">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><UserCheck className="w-4 h-4" /> רקע מקצועי והנהגה</h4>
                  <div className="bg-primary/5 p-5 rounded-2xl space-y-3 text-[11px] font-bold border border-primary/10">
                    <div className="flex justify-between border-b border-primary/10 pb-2"><span>{scribe.experience_years} שנים</span><span className="text-muted-foreground">ניסיון:</span></div>
                    <div className="flex justify-between border-b border-primary/10 pb-2"><span>{scribe.script_level}</span><span className="text-muted-foreground">רמת הידור:</span></div>
                    <div className="flex justify-between border-b border-primary/10 pb-2"><span>{scribe.torah_study_frequency === 'full-day' ? 'אברך יום שלם' : scribe.torah_study_frequency === 'half-day' ? 'אברך חצי יום' : 'קובע עיתים'}</span><span className="text-muted-foreground">לימוד:</span></div>
                    <div className="flex justify-between border-b border-primary/10 pb-2"><span>{scribe.mikveh_frequency === 'daily' ? 'כל יום' : scribe.mikveh_frequency === 'before' ? 'לפני כתיבה' : 'טבילת עזרא'}</span><span className="text-muted-foreground">טבילה:</span></div>
                    <div className="flex justify-between"><span>{scribe.marital_status === 'married' ? 'נשוי' : 'רווק'}</span><span className="text-muted-foreground">מצב משפחתי:</span></div>
                  </div>
               </div>
               <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">סוגי כתב</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(scribe.script_types || []).map((t: string) => (
                      <Badge key={t} className="bg-white border-primary/10 text-primary text-[9px] font-black px-3 py-1 rounded-full shadow-sm">{t}</Badge>
                    ))}
                  </div>
               </div>
               <div className="space-y-4 pt-2">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">מזהה פנימי (UID)</h4>
                  <p className="bg-muted p-2 rounded-lg text-[9px] font-mono break-all text-primary/60">{scribe.id}</p>
               </div>
            </div>
          </div>

          <div className="pt-6 border-t space-y-4">
             <h4 className="font-black text-sm text-primary underline decoration-accent/30 underline-offset-4">אודות והסמכה אישית</h4>
             <p className="text-xs text-primary/70 leading-relaxed italic bg-muted/20 p-4 rounded-xl">"{scribe.notes || '-'}"</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {scribe.certificate_url && (
              <div className="space-y-4">
                 <h4 className="font-black text-[11px] uppercase text-primary/40 tracking-widest">תעודת סופר מועלה</h4>
                 <div className="relative aspect-[1.4/1] w-full rounded-2xl overflow-hidden border shadow-inner bg-white">
                    <Image src={scribe.certificate_url} alt="Cert" fill className="object-contain" />
                 </div>
              </div>
            )}
            
            {(scribe.writing_samples || []).length > 0 && (
              <div className="space-y-4">
                 <h4 className="font-black text-[11px] uppercase text-primary/40 tracking-widest">דוגמאות כתיבה</h4>
                 <div className="grid grid-cols-2 gap-2">
                    {scribe.writing_samples.slice(0, 4).map((sample: string, idx: number) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border shadow-sm">
                         <Image src={sample} alt={`Sample ${idx}`} fill className="object-cover" />
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pagination({ current, total, onChange }: any) {
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-6">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onChange(current - 1)} 
        disabled={current === 1}
        className="rounded-xl h-10 px-4 font-bold border-primary/10 bg-white"
      >
        <ChevronRight className="w-4 h-4 ml-2" /> הקודם
      </Button>
      <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">עמוד {current} מתוך {totalPages}</span>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onChange(current + 1)} 
        disabled={current === totalPages}
        className="rounded-xl h-10 px-4 font-bold border-primary/10 bg-white"
      >
        הבא <ChevronLeft className="w-4 h-4 mr-2" />
      </Button>
    </div>
  );
}
