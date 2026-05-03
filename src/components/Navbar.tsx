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
  Sparkles,
  ChevronRight,
  MessageCircle,
  PhoneCall,
  Bell,
  Clock,
  Flag,
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Scroll
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useFirebase,
  useMemoFirebase, 
  useAuth,
  useCollection,
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
  const { user, isUserLoading, profile } = useFirebase();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use profile (DB lookup, more up-to-date) as primary source; fall back to
  // JWT user_metadata role so the bell renders even when the DB is unavailable.
  const isSeller = profile?.role === 'seller' || user?.role === 'seller';
  
  const adminEmails = ["admin@hotam.co.il", "davidafergan999@gmail.com", "davidafergan@gmail.com", "da@101.org.il", "DA@101.ORG.IL"];
  const isSuperAdmin = user?.uid === "f9hcxiHpzKYMzw7UNpi5II2F13l1" || 
                       user?.uid === "aMqKTe1Y4NSQdupLPupviiyrdyj2" ||
                       (user?.email && adminEmails.map(e => e.toLowerCase()).includes(user.email.toLowerCase()));
  
  const displayName = profile?.firstName || user?.email?.split('@')[0] || 'משתמש';
  const dashboardLink = isSuperAdmin ? '/admin' : (isSeller ? '/seller/dashboard' : '/customer/dashboard');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'בוקר טוב';
    if (hour >= 12 && hour < 18) return 'צהריים טובים';
    if (hour >= 18 && hour < 22) return 'ערב טוב';
    return 'לילה טוב';
  }, []);

  const unreadChatsQuery = useMemoFirebase(() => {
    if (!user || !mounted) return null;
    return query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', user.uid),
      where(`unread_${user.uid}`, '==', true)
    );
  }, [db, user?.uid, mounted]);
  const { data: unreadChats } = useCollection<any>(unreadChatsQuery);
  const unreadCount = (unreadChats || []).length;
  const hasUnreadMessages = unreadCount > 0;

  const pendingSellersQuery = useMemoFirebase(() => {
    if (!isSuperAdmin || !mounted) return null;
    return query(collection(db, 'sellers'), where('isApproved', '==', false));
  }, [db, isSuperAdmin, mounted]);
  const { data: pendingSellers } = useCollection<any>(pendingSellersQuery);

  const reportsQuery = useMemoFirebase(() => {
    if (!isSuperAdmin || !mounted) return null;
    return query(collection(db, 'reports'));
  }, [db, isSuperAdmin, mounted]);
  const { data: allReports } = useCollection<any>(reportsQuery);

  const adminNotificationCount = (pendingSellers?.length || 0) + (allReports?.length || 0);

  const sellerOrdersQuery = useMemoFirebase(() => {
    if (!isSeller || !user || !mounted) return null;
    return query(
      collection(db, 'orders'), 
      where('sellerId', '==', user.uid),
      where('isSeenBySeller', '==', false)
    );
  }, [db, isSeller, user?.uid, mounted]);
  const { data: sellerOrders } = useCollection<any>(sellerOrdersQuery);

  const activeUnreadOrders = (sellerOrders || []).filter(o => o.status === 'paid' || o.status === 'torah_request');
  const sellerNotificationCount = activeUnreadOrders.length + unreadCount;

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  const Logo = ({ className = "" }: { className?: string }) => (
    <Link href="/" className={`flex items-center gap-2 group ${className}`} onClick={() => setIsOpen(false)} aria-label="חותם - דף הבית">
      <div className="flex items-baseline gap-1">
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="text-primary group-hover:rotate-6 transition-transform"
          aria-hidden="true"
        >
          <path d="m12 19 7-7 3 3-7 7-3-3z" />
          <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="m2 2l5 5" />
          <path d="m11 11l1 1" />
        </svg>
        <span className="text-lg sm:text-xl font-headline font-black text-primary leading-none tracking-tighter uppercase">HOTAM</span>
      </div>
    </Link>
  );

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] p-4" role="navigation">
      <div className="container mx-auto max-w-7xl">
        <div className="bg-white/70 backdrop-blur-md border border-white/20 shadow-premium rounded-full px-4 sm:px-6 h-16 flex items-center justify-between relative overflow-hidden">
          
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
                      className="rounded-full h-10 w-10 bg-white/40 border border-white/30 shadow-sm active:scale-90 transition-transform relative"
                      aria-label="פתח תפריט ניווט"
                    >
                      <Menu className="w-5 h-5 text-primary" />
                      {(hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)) && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border border-white animate-pulse" />
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[280px] p-0 border-none bg-white/95 backdrop-blur-2xl h-full shadow-2xl animate-in slide-in-from-right duration-500 overflow-hidden rounded-l-[2.5rem]">
                    <SheetHeader className="sr-only">
                      <SheetTitle>תפריט ניווט</SheetTitle>
                      <SheetDescription>גישה מהירה לאיזור אישי, חיפוש ויצירת קשר</SheetDescription>
                    </SheetHeader>
                    <div className="flex flex-col h-full">
                      <div className="p-6 pb-4 text-right relative border-b border-primary/5 bg-gradient-to-br from-primary/5 to-accent/5">
                        <div className="flex justify-between items-center w-full">
                          {user ? (
                            <div className="flex items-center justify-end gap-3 w-full">
                              <div className="text-right space-y-0.5">
                                <p className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center justify-end gap-1.5 leading-none">
                                  <Sparkles className="w-3 h-3" /> {greeting},
                                </p>
                                <p className="text-lg font-headline font-black text-primary tracking-tight truncate max-w-[140px] leading-tight">{displayName}</p>
                              </div>
                              <Avatar className="h-12 w-12 border-2 border-white shadow-sm shrink-0">
                                <AvatarImage src={profile?.profileImage} />
                                <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{displayName.charAt(0)}</AvatarFallback>
                              </Avatar>
                            </div>
                          ) : (
                            <div className="text-right py-2 space-y-1">
                               <p className="text-[10px] font-black text-accent uppercase tracking-widest">ברוכים הבאים</p>
                               <Logo />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col p-4 gap-1 text-right overflow-y-auto">
                        <MobileNavLink href="/" icon={<Home className="w-4 h-4" />} label="דף הבית" onClick={() => setIsOpen(false)} />
                        <MobileNavLink href="/search?view=all" icon={<ShoppingBag className="w-4 h-4" />} label="כל המוצרים" onClick={() => setIsOpen(false)} />
                        <MobileNavLink href="/contact" icon={<PhoneCall className="w-4 h-4" />} label="צור קשר" onClick={() => setIsOpen(false)} />
                        
                        <div className="my-4 border-t border-primary/5 relative">
                           <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[7px] font-black text-primary/20 tracking-[0.3em] uppercase">MEMBER</span>
                        </div>

                        {user ? (
                          <>
                            <MobileNavLink 
                              href={dashboardLink} 
                              icon={<LayoutDashboard className="w-4 h-4" />} 
                              label="איזור אישי" 
                              onClick={() => setIsOpen(false)} 
                              hasBadge={hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)}
                            />
                            <button 
                              onClick={() => { handleLogout(); setIsOpen(false); }}
                              className="flex items-center justify-end gap-4 p-3 rounded-xl hover:bg-destructive/5 transition-all text-destructive font-black text-[11px] uppercase tracking-wider mt-2 group"
                            >
                              <span className="group-hover:-translate-x-1 transition-transform">התנתקות</span>
                              <div className="p-2 bg-destructive/10 rounded-lg group-hover:scale-110 transition-transform">
                                <LogOut className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          </>
                        ) : (
                          <div className="mt-4">
                            <Button asChild className="w-full bg-primary hover:bg-primary/90 h-12 rounded-xl shadow-lg font-black text-xs uppercase tracking-widest gap-2">
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
              </div>
            </div>

            <div className="md:hidden absolute left-1/2 -translate-x-1/2">
              <Logo />
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end z-10 gap-2 sm:gap-4">
            {!isUserLoading && user && mounted && (
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-11 w-11 bg-white/40 border border-white/30 shadow-sm relative hover:bg-white/60 transition-all"
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
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-[2rem] shadow-premium border-none bg-white/95 backdrop-blur-md mt-2" dir="rtl">
                      <DropdownMenuLabel className="text-sm font-black uppercase text-primary flex items-center gap-2 p-4">
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

                        {allReports && allReports.length > 0 ? (
                          <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-primary/5 transition-colors">
                            <Link href="/admin" className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-destructive/5 rounded-lg text-destructive"><Flag className="w-4 h-4" /></div>
                                <span className="text-[11px] font-bold text-primary">דיווחים חדשים</span>
                              </div>
                              <Badge className="bg-destructive text-white border-none text-[10px]">{allReports.length}</Badge>
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
                          <Button variant="ghost" asChild className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary">
                             <Link href="/admin">לניהול המערכת המלא ←</Link>
                          </Button>
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {isSeller && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-11 w-11 bg-white/40 border border-white/30 shadow-sm relative hover:bg-white/60 transition-all"
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
                    <DropdownMenuContent align="end" className="w-72 p-2 rounded-[2rem] shadow-premium border-none bg-white/95 backdrop-blur-md mt-2" dir="rtl">
                      <DropdownMenuLabel className="text-sm font-black uppercase text-primary flex items-center gap-2 p-4">
                        <Bell className="w-4 h-4 text-accent" /> התראות סופר
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-primary/5" />
                      
                      <div className="p-2 space-y-1">
                        {activeUnreadOrders.map((order: any) => (
                           <DropdownMenuItem 
                              key={order.id} 
                              onClick={() => {
                                updateDocumentNonBlocking(doc(db, 'orders', order.id), { isSeenBySeller: true });
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
                                  <span className="text-[9px] text-muted-foreground">{order.productName}</span>
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
                                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{chat.lastMessageText}</span>
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
                          <Button variant="ghost" asChild className="w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary/40 hover:text-primary">
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
                      className="h-11 px-3 gap-3 rounded-full bg-white/40 hover:bg-white/60 border border-white/30 transition-all group shadow-sm relative"
                      aria-label="פתח תפריט משתמש"
                    >
                      <div className="hidden sm:flex flex-col items-end text-right">
                        <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{greeting}, {displayName}</span>
                        <span className="text-[8px] font-bold text-accent uppercase">{isSuperAdmin ? 'מנהל מערכת' : 'ניהול חשבון'}</span>
                      </div>
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={profile?.profileImage} />
                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {(hasUnreadMessages || (isSuperAdmin && adminNotificationCount > 0) || (isSeller && sellerNotificationCount > 0)) && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive rounded-full border-2 border-white animate-pulse" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-[1.5rem] shadow-premium border-none bg-white/70 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 mt-2">
                    <DropdownMenuItem asChild className="rounded-xl p-3 cursor-pointer hover:bg-white/50 transition-colors">
                      <Link href={dashboardLink} className="flex items-center gap-2 justify-end w-full text-xs font-black text-primary uppercase">
                        איזור אישי 
                        <LayoutDashboard className="w-4 h-4 text-accent" />
                      </Link>
                    </DropdownMenuItem>
                    <div className="my-1 border-t border-primary/5" />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="rounded-xl p-3 cursor-pointer text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2 justify-end w-full font-black text-xs uppercase"
                    >
                      התנתקות 
                      <LogOut className="w-4 h-4" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {!isUserLoading && !user && mounted && (
              <Button asChild className="bg-primary text-white hover:bg-primary/90 px-6 h-9 rounded-full shadow-lg text-xs font-bold gap-2 border border-white/20">
                <Link href="/login"> <LogIn className="w-3.5 h-3.5" /> התחברות</Link>
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
      className="text-xs font-bold text-primary/60 hover:text-primary transition-all flex items-center gap-1.5 group relative py-1"
    >
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent" aria-hidden="true">{icon}</span>
      {label}
      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full rounded-full" />
    </Link>
  );
}

function MobileNavLink({ href, icon, label, onClick, hasBadge = false }: { href: string, icon: any, label: string, onClick: () => void, hasBadge?: boolean }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className="flex items-center justify-end gap-4 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all text-primary font-black text-[13px] border border-transparent hover:border-primary/5 group active:scale-95 relative"
    >
      <span className="group-hover:text-accent transition-colors">{label}</span>
      <span className="text-accent bg-accent/10 p-2.5 rounded-lg group-hover:scale-110 group-hover:bg-accent/20 transition-all relative">
        {icon}
        {hasBadge && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border border-white" />
        )}
      </span>
    </Link>
  );
}
