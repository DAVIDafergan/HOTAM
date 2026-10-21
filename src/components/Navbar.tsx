"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetHeader, 
  SheetTitle, 
  SheetDescription
} from '@/components/ui/sheet';
import { 
  User, 
  Menu, 
  Search, 
  Home, 
  LogIn, 
  LogOut, 
  LayoutDashboard, 
  ShoppingBag, 
  X,
  ChevronRight,
  MessageCircle,
  PhoneCall,
  Bell,
  Clock,
  Flag,
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Scroll,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Award
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useSupabaseClient, 
  useApp,
  useMemoStable, 
  useAuth,
  useCollection,
  useCollectionCount,
  useDoc,
  updateDocumentNonBlocking
} from '@/lib/supabase-hooks';
import { doc, collection, query, where, selectColumns } from '@/lib/supabase-compat';
import { SELLER_ORDER_COLUMNS } from '@/lib/constants';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, isUserLoading, profile, isProfileLoading } = useApp();
  const db = useSupabaseClient();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use profile (DB lookup, more up-to-date) as primary source; fall back to
  // JWT user_metadata role so the bell renders even when the DB is unavailable.
  const isSeller = profile?.role === 'seller' || user?.role === 'seller';
  // Judaica sellers aren't scribes — neutral wording for them (seller_type from the seller row).
  const sellerNoun = profile?.seller_type === 'judaica_seller' ? 'מוכר' : 'סופר';

  const adminRef = useMemoStable(() => {
    if (!user?.uid || user?.role !== 'admin') return null;
    return doc(db, 'admins', user.uid);
  }, [db, user?.uid, user?.role]);
  const { data: adminData } = useDoc<any>(adminRef);
  const isSuperAdmin = !!adminData;
  
  const displayName = profile?.first_name?.trim() || user?.displayName || user?.email?.split('@')[0] || 'משתמש';
  const dashboardLink = isSuperAdmin ? '/admin' : (isSeller ? '/seller/dashboard' : '/customer/dashboard');

  const greeting = useMemo(() => {
    if (!mounted) return '';
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'בוקר טוב';
    if (hour >= 12 && hour < 18) return 'צהריים טובים';
    if (hour >= 18 && hour < 22) return 'ערב טוב';
    return 'לילה טוב';
  }, [mounted]);

  const greetingIcon = useMemo(() => {
    if (!mounted) return null;
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return <Sunrise className="w-3 h-3" />;
    if (hour >= 12 && hour < 18) return <Sun className="w-3 h-3" />;
    if (hour >= 18 && hour < 22) return <Sunset className="w-3 h-3" />;
    return <Moon className="w-3 h-3" />;
  }, [mounted]);

  const unreadChatsQuery = useMemoStable(() => {
    if (!user || !mounted || isProfileLoading) return null;
    return query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', user.uid),
      where(`unread_${user.uid}`, '==', true)
    );
  }, [db, user?.uid, mounted, isProfileLoading]);
  const { data: unreadChats } = useCollection<any>(unreadChatsQuery);
  const unreadCount = (unreadChats || []).length;
  const hasUnreadMessages = unreadCount > 0;

  const pendingSellersQuery = useMemoStable(() => {
    if (!isSuperAdmin || !mounted) return null;
    return query(collection(db, 'sellers'), where('is_approved', '==', false));
  }, [db, isSuperAdmin, mounted]);
  const { data: pendingSellers } = useCollection<any>(pendingSellersQuery);

  const reportsCountQuery = useMemoStable(() => {
    if (!isSuperAdmin || !mounted) return null;
    return query(collection(db, 'reports'));
  }, [db, isSuperAdmin, mounted]);
  const { count: reportsCount } = useCollectionCount(reportsCountQuery);

  // Judaica sellers asking to be verified as סופרי סת"ם (reviewed in /admin → ממתינים לאישור).
  const upgradeRequestsQuery = useMemoStable(() => {
    if (!isSuperAdmin || !mounted) return null;
    return query(collection(db, 'sellers'), where('stam_upgrade_status', '==', 'pending'));
  }, [db, isSuperAdmin, mounted]);
  const { data: upgradeRequests } = useCollection<any>(upgradeRequestsQuery);

  const adminNotificationCount = (pendingSellers?.length || 0) + (upgradeRequests?.length || 0) + (reportsCount || 0);

  const sellerOrdersQuery = useMemoStable(() => {
    if (!isSeller || !user || !mounted || isProfileLoading) return null;
    return query(
      collection(db, 'orders'),
      where('seller_id', '==', user.uid),
      where('is_seen_by_seller', '==', false),
      selectColumns(SELLER_ORDER_COLUMNS)
    );
  }, [db, isSeller, user?.uid, mounted, isProfileLoading]);
  const { data: sellerOrders } = useCollection<any>(sellerOrdersQuery);

  const activeUnreadOrders = (sellerOrders || []).filter(o => o.status === 'paid' || o.status === 'torah_request');
  const sellerNotificationCount = activeUnreadOrders.length + unreadCount;

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn('[logout] signOut error (ignored):', err);
    }
    router.push('/');
    router.refresh();
  };

  const Logo = ({ className = "", compact = false }: { className?: string; compact?: boolean }) => {
    const iconSize = compact ? 20 : 24;
    return (
      <Link href="/" className={`flex items-center gap-2 group whitespace-nowrap transition-transform duration-200 active:scale-95 ${className}`} onClick={() => setIsOpen(false)} aria-label="חותם - דף הבית">
        <div className={`flex items-center shrink-0 ${compact ? 'gap-1' : 'gap-1.5'}`}>
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary group-hover:rotate-6 transition-transform duration-300 shrink-0"
            style={{ width: `${iconSize}px`, height: `${iconSize}px`, minWidth: `${iconSize}px`, minHeight: `${iconSize}px` }}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <path d="m12 19 7-7 3 3-7 7-3-3z" />
            <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="m2 2l5 5" />
            <path d="m11 11l1 1" />
          </svg>
          <span className={`font-numbers font-normal text-primary leading-none tracking-[0.16em] uppercase whitespace-nowrap shrink-0 ${compact ? 'text-[17px]' : 'text-[20px]'}`}>HOTAM</span>
        </div>
      </Link>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5 md:pt-4" role="navigation" aria-label="ניווט ראשי">
      <div className="container mx-auto max-w-7xl">
        <div className="bg-card/90 backdrop-blur-md border border-border/70 shadow-premium rounded-full px-2.5 sm:px-6 h-16 md:h-[4.25rem] flex items-center justify-between relative">
          
          <div className="flex-1 flex items-center justify-start z-10 gap-2">
            {mounted && pathname !== '/' && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()} 
                className="rounded-full h-11 w-11 border border-border/70 bg-transparent hover:bg-primary/[0.05] text-primary active:scale-95 shrink-0"
                aria-label="חזור לדף הקודם"
              >
                <ChevronRight className="!w-5 !h-5" />
              </Button>
            )}

            <div className="hidden md:block">
              <Logo />
            </div>

            <div className="md:hidden">
              {mounted && (
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full h-11 w-11 border border-border/70 bg-transparent hover:bg-primary/[0.05] active:scale-95 relative"
                      aria-label="פתח תפריט ניווט"
                    >
                      <Menu className="w-5 h-5 text-primary" />
                      {(hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)) && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border border-white animate-pulse" />
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[86vw] max-w-[340px] p-0 border-none bg-card h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden rounded-l-[2rem]">
                    <SheetHeader className="sr-only">
                      <SheetTitle>תפריט ניווט</SheetTitle>
                      <SheetDescription>גישה מהירה לאיזור אישי, חיפוש ויצירת קשר</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col h-full">
                      <div className="p-6 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] text-right relative border-b border-border/70 bg-secondary/40">
                        <div className="flex justify-between items-center w-full">
                          {user ? (
                            <div className="flex items-center justify-start gap-3 w-full">
                              <Avatar className="h-14 w-14 border-2 border-white shadow-md shrink-0">
                                <AvatarImage src={profile?.profile_image} />
                                <AvatarFallback className="bg-primary/5 text-primary text-sm font-black">{displayName.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="text-right space-y-0.5">
                                <p className="text-[13px] font-medium text-accent-strong flex items-center gap-1.5 leading-none">
                                  {greetingIcon} {greeting},
                                </p>
                                <p className="text-xl font-body font-semibold text-primary truncate max-w-[180px] leading-tight">{displayName}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-right py-2 space-y-1">
                               <p className="text-[13px] font-medium text-accent-strong">ברוכים הבאים</p>
                               <Logo />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col p-4 gap-1.5 text-right overflow-y-auto">
                        <MobileNavLink href="/" icon={<Home className="w-5 h-5" />} label="דף הבית" onClick={() => setIsOpen(false)} active={pathname === '/'} />
                        <MobileNavLink href="/search?view=all" icon={<ShoppingBag className="w-5 h-5" />} label="כל המוצרים" onClick={() => setIsOpen(false)} active={pathname === '/search'} />
                        <MobileNavLink href="/contact" icon={<PhoneCall className="w-5 h-5" />} label="צור קשר" onClick={() => setIsOpen(false)} active={pathname === '/contact'} />
                        {isSuperAdmin && (
                          <MobileNavLink href="/admin" icon={<LayoutDashboard className="w-5 h-5" />} label="ניהול" onClick={() => setIsOpen(false)} active={pathname === '/admin'} />
                        )}
                        <div className="my-3 border-t border-border/70" />

                        {user ? (
                          <>
                            <MobileNavLink 
                              href={dashboardLink} 
                              icon={<LayoutDashboard className="w-5 h-5" />} 
                              label="איזור אישי" 
                              onClick={() => setIsOpen(false)} 
                              hasBadge={hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)}
                              active={pathname === dashboardLink}
                            />
                            <button 
                              onClick={() => { handleLogout(); setIsOpen(false); }}
                              className="flex items-center justify-start gap-3 px-3 py-2.5 rounded-2xl hover:bg-destructive/5 transition-colors text-destructive font-semibold text-base mt-1 group active:scale-[0.98] min-h-[52px]"
                            >
                              <div className="p-2.5 bg-destructive/10 rounded-xl">
                                <LogOut className="w-4 h-4" />
                              </div>
                              <span>התנתקות</span>
                            </button>
                          </>
                        ) : (
                          <div className="mt-4 px-1">
                            <Button asChild size="lg" className="w-full gap-2">
                              <Link href="/login" onClick={() => setIsOpen(false)}>
                                <LogIn className="w-4 h-4" /> התחברות / הרשמה
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center z-0">
            <div className="hidden md:block navigation-desktop">
              <div className="flex items-center gap-8">
                <NavLink href="/" label="דף הבית" active={pathname === '/'} />
                <NavLink href="/search?view=all" label="כל המוצרים" active={pathname === '/search'} />
                <NavLink href="/contact" label="צור קשר" active={pathname === '/contact'} />
                {isSuperAdmin && (
                  <NavLink href="/admin" label="ניהול" active={pathname === '/admin'} />
                )}
              </div>
            </div>

            <div className="md:hidden absolute inset-x-0 top-0 h-full flex items-center justify-center pointer-events-none z-0">
              <div className="pointer-events-auto">
                <Logo compact />
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end z-10 gap-2 sm:gap-4">
            {isUserLoading && !user && (
              <div className="flex items-center gap-2">
                <div className="h-11 w-11 rounded-full bg-primary/8 animate-pulse" />
                <div className="hidden sm:flex flex-col gap-1">
                  <div className="h-2.5 w-20 rounded-full bg-primary/8 animate-pulse" />
                  <div className="h-2 w-14 rounded-full bg-primary/6 animate-pulse" />
                </div>
              </div>
            )}

            {user && (
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <DropdownMenu dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-11 w-11 border border-border/70 bg-transparent hover:bg-primary/[0.05] relative"
                        aria-label="עדכוני ניהול"
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        {adminNotificationCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                            {adminNotificationCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 p-2 rounded-3xl shadow-premium-lg border border-border/70 bg-card mt-2">
                      <DropdownMenuLabel className="text-[15px] font-bold text-primary flex items-center gap-2 p-4">
                        <Bell className="w-4 h-4 text-accent" /> עדכוני מערכת
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-primary/5" />
                      
                      <div className="p-2 space-y-1">
                        {pendingSellers && pendingSellers.length > 0 ? (
                          <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                            <Link href="/admin" className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Clock className="w-4 h-4" /></div>
                                <span className="text-sm font-bold text-primary">מוכרים ממתינים לאישור</span>
                              </div>
                              <Badge className="bg-orange-500 text-white border-none text-xs">{pendingSellers.length}</Badge>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}

                        {upgradeRequests && upgradeRequests.length > 0 ? (
                          <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                            <Link href="/admin" className="flex items-center justify-between w-full" data-admin-bell-upgrades>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 rounded-lg text-amber-700"><Award className="w-4 h-4" /></div>
                                <span className="text-sm font-bold text-primary">בקשות שדרוג לסופר סת"ם</span>
                              </div>
                              <Badge className="bg-amber-600 text-white border-none text-xs">{upgradeRequests.length}</Badge>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}

                        {reportsCount != null && reportsCount > 0 ? (
                          <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                            <Link href="/admin" className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-destructive/5 rounded-lg text-destructive"><Flag className="w-4 h-4" /></div>
                                <span className="text-sm font-bold text-primary">דיווחים חדשים</span>
                              </div>
                              <Badge className="bg-destructive text-white border-none text-xs">{reportsCount}</Badge>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}

                        {adminNotificationCount === 0 && (
                          <div className="py-8 text-center space-y-2">
                             <CheckCircle2 className="w-8 h-8 text-accent/40 mx-auto" />
                             <p className="text-sm font-medium text-muted-foreground">אין עדכונים דחופים כרגע</p>
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <Button variant="ghost" asChild className="w-full h-11 rounded-xl text-sm font-semibold text-primary/70 hover:text-primary">
                             <Link href="/admin">לניהול המערכת המלא ←</Link>
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {!isSeller && !isSuperAdmin && (
                  <DropdownMenu dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-11 w-11 border border-border/70 bg-transparent hover:bg-primary/[0.05] relative"
                        aria-label="התראות הודעות"
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent text-primary text-xs font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                            {unreadCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 p-2 rounded-3xl shadow-premium-lg border border-border/70 bg-card mt-2">
                      <DropdownMenuLabel className="text-[15px] font-bold text-primary flex items-center gap-2 p-4">
                        <Bell className="w-4 h-4 text-accent" /> התראות הודעות
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-primary/5" />
                      <div className="p-2 space-y-1">
                        {unreadChats && unreadChats.length > 0 ? (
                          unreadChats.map((chat: any) => {
                            const otherId = chat.participants.find((p: string) => p !== user.uid);
                            return (
                              <DropdownMenuItem key={chat.id} asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                                <Link href={`/chat/${otherId}`} className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-accent/10 rounded-lg text-accent-strong"><MessageCircle className="w-4 h-4" /></div>
                                    <div className="flex flex-col text-right">
                                      <span className="text-sm font-bold text-primary">הודעה חדשה</span>
                                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{chat.last_message_text}</span>
                                    </div>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                                </Link>
                              </DropdownMenuItem>
                            );
                          })
                        ) : (
                          <div className="py-8 text-center space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-accent/40 mx-auto" />
                            <p className="text-sm font-medium text-muted-foreground">אין הודעות חדשות</p>
                          </div>
                        )}
                        <div className="pt-2">
                          <Button variant="ghost" asChild className="w-full h-11 rounded-xl text-sm font-semibold text-primary/70 hover:text-primary">
                            <Link href="/customer/dashboard?tab=messages">לכל ההודעות ←</Link>
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {isSeller && (
                  <DropdownMenu dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-11 w-11 border border-border/70 bg-transparent hover:bg-primary/[0.05] relative"
                        aria-label={`עדכוני ${sellerNoun}`}
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        {sellerNotificationCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent text-primary text-xs font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                            {sellerNotificationCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 p-2 rounded-3xl shadow-premium-lg border border-border/70 bg-card mt-2">
                      <DropdownMenuLabel className="text-[15px] font-bold text-primary flex items-center gap-2 p-4">
                        <Bell className="w-4 h-4 text-accent" /> התראות {sellerNoun}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-primary/5" />
                      
                      <div className="p-2 space-y-1">
                        {activeUnreadOrders.map((order: any) => (
                           <DropdownMenuItem 
                              key={order.id} 
                              onClick={() => {
                                updateDocumentNonBlocking(doc(db, 'orders', order.id), { is_seen_by_seller: true });
                                router.push('/seller/dashboard?tab=sales');
                              }}
                              className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors flex items-center justify-between w-full"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg", order.status === 'paid' ? 'bg-primary/5 text-primary' : 'bg-accent/10 text-accent-strong')}>
                                  {order.status === 'paid' ? <PackageCheck className="w-4 h-4" /> : <Scroll className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-sm font-bold text-primary">{order.status === 'paid' ? 'הזמנה חדשה למסירה' : 'בקשה לספר תורה'}</span>
                                  <span className="text-xs text-muted-foreground">{order.product_name}</span>
                                </div>
                              </div>
                              <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                           </DropdownMenuItem>
                        ))}

                        {unreadChats && unreadChats.length > 0 ? (
                          unreadChats.map((chat: any) => {
                            const otherId = chat.participants.find((p: string) => p !== user.uid);
                            return (
                              <DropdownMenuItem key={chat.id} asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                                <Link href={`/chat/${otherId}`} className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-accent/10 rounded-lg text-accent-strong"><MessageCircle className="w-4 h-4" /></div>
                                    <div className="flex flex-col text-right">
                                      <span className="text-sm font-bold text-primary">הודעה חדשה</span>
                                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{chat.last_message_text}</span>
                                    </div>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                                </Link>
                              </DropdownMenuItem>
                            );
                          })
                        ) : null}

                        {sellerNotificationCount === 0 && (
                          <div className="py-8 text-center space-y-2">
                             <CheckCircle2 className="w-8 h-8 text-accent/40 mx-auto" />
                             <p className="text-sm font-medium text-muted-foreground">הכל מעודכן! אין התראות חדשות</p>
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <Button variant="ghost" asChild className="w-full h-11 rounded-xl text-sm font-semibold text-primary/70 hover:text-primary">
                             <Link href="/seller/dashboard">ללוח הבקרה המלא ←</Link>
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="hidden md:inline-flex h-11 pr-4 pl-1.5 gap-3 rounded-full border border-border/70 bg-transparent hover:bg-primary/[0.05] group relative"
                      aria-label="פתח תפריט משתמש"
                    >
                      <div className="flex flex-col items-end text-right">
                        <span className="text-[13px] font-semibold leading-tight text-primary">{greeting}, {displayName}</span>
                        <span className="text-xs font-medium leading-tight text-accent-strong">{isSuperAdmin ? 'מנהל מערכת' : 'ניהול חשבון'}</span>
                      </div>
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={profile?.profile_image} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">{displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {(hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)) && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full border-2 border-white animate-pulse" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-premium-lg border border-border/70 bg-card animate-in fade-in zoom-in-95 duration-200 mt-2">
                    <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-white/50 transition-colors">
                      <Link href={dashboardLink} className="flex items-center gap-2 justify-start w-full text-sm font-semibold text-primary">
                        <LayoutDashboard className="w-4 h-4 text-accent-strong" />
                        איזור אישי
                      </Link>
                    </DropdownMenuItem>
                    <div className="my-1 border-t border-primary/5" />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="rounded-xl p-3 cursor-pointer text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2 justify-start w-full font-semibold text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      התנתקות
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {!user && (
              <Button asChild className="h-11 w-11 p-0 md:w-auto md:px-6 rounded-full text-sm font-semibold gap-2 shrink-0">
                <Link href="/login" aria-label="התחברות">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden md:inline">התחברות</span>
                </Link>
              </Button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label, active = false }: { href: string, label: string, active?: boolean }) {
  return (
    <Link 
      href={href} 
      aria-current={active ? 'page' : undefined}
      className={cn(
        "text-[15px] font-normal transition-colors flex items-center group relative min-h-[44px] rounded-md",
        active ? "text-primary" : "text-primary/70 hover:text-primary"
      )}
    >
      {label}
      <span className={cn(
        "absolute bottom-1.5 inset-x-0 h-px origin-right bg-accent transition-transform duration-500 ease-lux",
        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
      )} />
    </Link>
  );
}

function MobileNavLink({ href, icon, label, onClick, hasBadge = false, active = false }: { href: string, icon: any, label: string, onClick: () => void, hasBadge?: boolean, active?: boolean }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={cn(
        "flex items-center justify-start gap-3 px-3 py-2.5 rounded-2xl transition-colors text-base border group active:scale-[0.98] relative min-h-[52px]",
        active
          ? "font-bold bg-secondary/60 border-border/70 text-primary"
          : "font-medium border-transparent text-primary/80 hover:bg-secondary/40 hover:text-primary"
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className={cn(
        "p-2.5 rounded-xl transition-colors relative shrink-0",
        active ? "bg-primary text-primary-foreground" : "text-accent-strong bg-accent/10"
      )}>
        {icon}
        {hasBadge && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-white" />
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}
