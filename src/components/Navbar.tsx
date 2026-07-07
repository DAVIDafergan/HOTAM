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
  Moon
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
import { doc, collection, query, where } from '@/lib/supabase-compat';
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

  const adminNotificationCount = (pendingSellers?.length || 0) + (reportsCount || 0);

  const sellerOrdersQuery = useMemoStable(() => {
    if (!isSeller || !user || !mounted || isProfileLoading) return null;
    return query(
      collection(db, 'orders'),
      where('seller_id', '==', user.uid),
      where('is_seen_by_seller', '==', false)
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
          <span className={`font-headline font-black text-primary leading-none tracking-tighter uppercase whitespace-nowrap shrink-0 ${compact ? 'text-lg' : 'text-xl'}`}>HOTAM</span>
        </div>
      </Link>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] p-4 md:p-5 pt-[max(1rem,env(safe-area-inset-top))]" role="navigation">
      <div className="container mx-auto max-w-7xl">
        <div className="bg-white/78 backdrop-blur-xl border border-white/35 ring-1 ring-primary/5 shadow-premium-lg rounded-full px-5 sm:px-7 h-[4.5rem] flex items-center justify-between relative">
          
          <div className="flex-1 flex items-center justify-start z-10 gap-2">
            {mounted && pathname !== '/' && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()} 
                className="rounded-full h-10 w-10 hover:bg-primary/5 text-primary transition-all active:scale-90 shrink-0"
                aria-label="חזור לדף הקודם"
              >
                <ChevronRight className="w-6 h-6" />
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
                      className="rounded-full h-11 w-11 bg-white/55 border border-white/45 shadow-premium active:scale-90 transition-all relative"
                      aria-label="פתח תפריט ניווט"
                    >
                      <Menu className="w-5 h-5 text-primary" />
                      {(hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)) && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border border-white animate-pulse" />
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[88vw] max-w-[320px] p-0 border-none bg-white/95 backdrop-blur-2xl h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-hidden rounded-l-[2.5rem]">
                    <SheetHeader className="sr-only">
                      <SheetTitle>תפריט ניווט</SheetTitle>
                      <SheetDescription>גישה מהירה לאיזור אישי, חיפוש ויצירת קשר</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col h-full">
                      <div className="p-6 pb-5 text-right relative border-b border-primary/5 bg-gradient-to-br from-primary/5 to-accent/5">
                        <div className="flex justify-between items-center w-full">
                          {user ? (
                            <div className="flex items-center justify-end gap-3 w-full">
                              <div className="text-right space-y-0.5">
                                <p className="text-[10px] font-semibold text-accent uppercase tracking-widest flex items-center justify-end gap-1.5 leading-none">
                                  {greetingIcon} {greeting},
                                </p>
                                <p className="text-xl font-headline font-black text-primary tracking-tight truncate max-w-[150px] leading-tight">{displayName}</p>
                              </div>
                              <Avatar className="h-14 w-14 border-2 border-white shadow-md shrink-0">
                                <AvatarImage src={profile?.profile_image} />
                                <AvatarFallback className="bg-primary/5 text-primary text-sm font-black">{displayName.charAt(0)}</AvatarFallback>
                              </Avatar>
                            </div>
                          ) : (
                            <div className="text-right py-2 space-y-1">
                               <p className="text-[10px] font-semibold text-accent uppercase tracking-widest">ברוכים הבאים</p>
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
                        
                        <div className="my-3 border-t border-primary/5 relative">
                           <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[7px] font-semibold text-primary/20 tracking-[0.3em] uppercase">MEMBER</span>
                        </div>

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
                              className="flex items-center justify-end gap-4 p-4 rounded-2xl hover:bg-destructive/5 transition-all text-destructive font-bold text-sm mt-2 group active:scale-95 min-h-[56px]"
                            >
                              <span className="group-hover:-translate-x-1 transition-transform">התנתקות</span>
                              <div className="p-2.5 bg-destructive/10 rounded-xl group-hover:scale-110 transition-transform">
                                <LogOut className="w-4 h-4" />
                              </div>
                            </button>
                          </>
                        ) : (
                          <div className="mt-4 px-1">
                            <Button asChild className="w-full bg-primary hover:bg-primary/90 h-14 rounded-2xl shadow-lg font-bold text-sm uppercase tracking-widest gap-2">
                              <Link href="/login" onClick={() => setIsOpen(false)}>
                                <LogIn className="w-4 h-4" /> התחברות למערכת 
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
              <div className="flex items-center gap-6">
                <NavLink href="/" icon={<Home className="w-3.5 h-3.5" />} label="דף הבית" />
                <NavLink href="/search?view=all" icon={<ShoppingBag className="w-3.5 h-3.5" />} label="כל המוצרים" />
                <NavLink href="/contact" icon={<PhoneCall className="w-3.5 h-3.5" />} label="צור קשר" />
                {isSuperAdmin && (
                  <NavLink href="/admin" icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="ניהול" />
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
                        className="rounded-full h-11 w-11 bg-white/55 border border-white/45 shadow-premium relative hover:bg-white/72 transition-all"
                        aria-label="עדכוני ניהול"
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        {adminNotificationCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                            {adminNotificationCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-[2rem] shadow-premium border-none bg-white/95 backdrop-blur-md mt-2">
                      <DropdownMenuLabel className="text-sm font-semibold uppercase text-primary flex items-center gap-2 p-4">
                        <Bell className="w-4 h-4 text-accent" /> עדכוני מערכת
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-primary/5" />
                      
                      <div className="p-2 space-y-1">
                        {pendingSellers && pendingSellers.length > 0 ? (
                          <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                            <Link href="/admin" className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Clock className="w-4 h-4" /></div>
                                <span className="text-[11px] font-bold text-primary">ממתינים לאישור סופר</span>
                              </div>
                              <Badge className="bg-orange-500 text-white border-none text-[10px]">{pendingSellers.length}</Badge>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}

                        {reportsCount != null && reportsCount > 0 ? (
                          <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                            <Link href="/admin" className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-destructive/5 rounded-lg text-destructive"><Flag className="w-4 h-4" /></div>
                                <span className="text-[11px] font-bold text-primary">דיווחים חדשים</span>
                              </div>
                              <Badge className="bg-destructive text-white border-none text-[10px]">{reportsCount}</Badge>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}

                        {adminNotificationCount === 0 && (
                          <div className="py-8 text-center space-y-2">
                             <CheckCircle2 className="w-8 h-8 text-emerald-500/20 mx-auto" />
                             <p className="text-[10px] font-bold text-muted-foreground italic">אין עדכונים דחופים כרגע</p>
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <Button variant="ghost" asChild className="w-full h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest text-primary/40 hover:text-primary">
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
                        className="rounded-full h-11 w-11 bg-white/55 border border-white/45 shadow-premium relative hover:bg-white/72 transition-all"
                        aria-label="התראות הודעות"
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent text-primary text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                            {unreadCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-[2rem] shadow-premium border-none bg-white/95 backdrop-blur-md mt-2">
                      <DropdownMenuLabel className="text-sm font-semibold uppercase text-primary flex items-center gap-2 p-4">
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
                                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><MessageCircle className="w-4 h-4" /></div>
                                    <div className="flex flex-col text-right">
                                      <span className="text-[11px] font-bold text-primary">הודעה חדשה</span>
                                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{chat.last_message_text}</span>
                                    </div>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                                </Link>
                              </DropdownMenuItem>
                            );
                          })
                        ) : (
                          <div className="py-8 text-center space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500/20 mx-auto" />
                            <p className="text-[10px] font-bold text-muted-foreground italic">אין הודעות חדשות</p>
                          </div>
                        )}
                        <div className="pt-2">
                          <Button variant="ghost" asChild className="w-full h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest text-primary/40 hover:text-primary">
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
                        className="rounded-full h-11 w-11 bg-white/55 border border-white/45 shadow-premium relative hover:bg-white/72 transition-all"
                        aria-label="עדכוני סופר"
                      >
                        <Bell className="w-5 h-5 text-primary" />
                        {sellerNotificationCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent text-primary text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                            {sellerNotificationCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-[2rem] shadow-premium border-none bg-white/95 backdrop-blur-md mt-2">
                      <DropdownMenuLabel className="text-sm font-semibold uppercase text-primary flex items-center gap-2 p-4">
                        <Bell className="w-4 h-4 text-accent" /> התראות סופר
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
                                <div className={cn("p-2 rounded-lg", order.status === 'paid' ? 'bg-blue-50 text-blue-600' : 'bg-accent/10 text-accent')}>
                                  {order.status === 'paid' ? <PackageCheck className="w-4 h-4" /> : <Scroll className="w-4 h-4" />}
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="text-[11px] font-bold text-primary">{order.status === 'paid' ? 'הזמנה חדשה למסירה' : 'בקשה לספר תורה'}</span>
                                  <span className="text-[9px] text-muted-foreground">{order.product_name}</span>
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
                                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><MessageCircle className="w-4 h-4" /></div>
                                    <div className="flex flex-col text-right">
                                      <span className="text-[11px] font-bold text-primary">הודעה חדשה</span>
                                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{chat.last_message_text}</span>
                                    </div>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                                </Link>
                              </DropdownMenuItem>
                            );
                          })
                        ) : null}

                        {sellerNotificationCount === 0 && (
                          <div className="py-8 text-center space-y-2">
                             <CheckCircle2 className="w-8 h-8 text-emerald-500/20 mx-auto" />
                             <p className="text-[10px] font-bold text-muted-foreground italic">הכל מעודכן! אין התראות חדשות</p>
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <Button variant="ghost" asChild className="w-full h-10 rounded-xl text-[10px] font-semibold uppercase tracking-widest text-primary/40 hover:text-primary">
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
                      className="h-11 px-3.5 gap-3 rounded-full bg-white/55 hover:bg-white/72 border border-white/45 transition-all group shadow-premium relative"
                      aria-label="פתח תפריט משתמש"
                    >
                      <div className="hidden sm:flex flex-col items-end text-right">
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-tighter">{greeting}, {displayName}</span>
                        <span className="text-[8px] font-bold text-accent uppercase">{isSuperAdmin ? 'מנהל מערכת' : 'ניהול חשבון'}</span>
                      </div>
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={profile?.profile_image} />
                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {(hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)) && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full border-2 border-white animate-pulse" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-[1.5rem] shadow-premium border-none bg-white/70 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 mt-2">
                    <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-white/50 transition-colors">
                      <Link href={dashboardLink} className="flex items-center gap-2 justify-end w-full text-xs font-semibold text-primary uppercase">
                        איזור אישי 
                        <LayoutDashboard className="w-4 h-4 text-accent" />
                      </Link>
                    </DropdownMenuItem>
                    <div className="my-1 border-t border-primary/5" />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="rounded-xl p-3 cursor-pointer text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2 justify-end w-full font-bold text-xs uppercase"
                    >
                      התנתקות 
                      <LogOut className="w-4 h-4" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {!user && (
              <Button asChild className="bg-primary text-white hover:bg-primary/95 h-10 w-10 p-0 md:h-10 md:w-auto md:px-7 rounded-full shadow-premium text-xs font-bold gap-2 border border-white/30 shrink-0 transition-transform duration-200 hover:scale-105 active:scale-95">
                <Link href="/login" aria-label="התחברות">
                  <LogIn className="w-4 h-4 md:w-3.5 md:h-3.5" />
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

function NavLink({ href, icon, label }: { href: string, icon: any, label: string }) {
  return (
    <Link 
      href={href} 
      className="text-[13px] font-bold text-primary/65 hover:text-primary transition-all flex items-center gap-1.5 group relative py-1.5 min-h-[44px]"
    >
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent" aria-hidden="true">{icon}</span>
      {label}
      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full rounded-full" />
    </Link>
  );
}

function MobileNavLink({ href, icon, label, onClick, hasBadge = false, active = false }: { href: string, icon: any, label: string, onClick: () => void, hasBadge?: boolean, active?: boolean }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={cn(
        "flex items-center justify-end gap-4 px-4 py-3.5 rounded-2xl transition-all text-sm border group active:scale-95 relative min-h-[56px]",
        active
          ? "font-bold bg-primary/5 border-primary/10 text-primary shadow-sm"
          : "font-medium border-transparent text-primary/70 hover:bg-white hover:border-primary/5 hover:text-primary hover:shadow-sm"
      )}
    >
      <span className={cn("transition-colors", active ? "text-primary" : "group-hover:text-accent")}>{label}</span>
      <span className={cn(
        "p-2.5 rounded-xl transition-all relative shrink-0",
        active ? "bg-primary text-white shadow-md" : "text-accent bg-accent/10 group-hover:scale-110 group-hover:bg-accent/20"
      )}>
        {icon}
        {hasBadge && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-white" />
        )}
      </span>
    </Link>
  );
}
