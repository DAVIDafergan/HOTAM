"use client";

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, ShieldCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, adminNavItem, type AdminBadges, type AdminTabId } from './admin-nav';

// Frame of the admin: grouped sidebar with live counts (desktop), a drawer with the same menu
// (phones / tablets), and a header naming the current section with the global search.

function Badge({ count, tone, active }: { count: number; tone: 'alert' | 'info'; active?: boolean }) {
  return (
    <span className={cn(
      'min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-black leading-none tabular-nums',
      tone === 'alert' ? 'bg-destructive text-white' : active ? 'bg-white/70 text-primary' : 'bg-primary/10 text-primary/70',
    )}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavList({ active, badges, onNavigate }: { active: AdminTabId; badges: AdminBadges; onNavigate: (tab: AdminTabId) => void }) {
  return (
    <nav className="space-y-3" aria-label="ניווט ניהול">
      {ADMIN_NAV.map((group) => (
        <div key={group.group}>
          <p className="mb-1 px-3 text-[11px] font-bold text-primary/45">{group.group}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const on = item.id === active;
              const badge = badges[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={on ? 'page' : undefined}
                    data-admin-nav={item.id}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-right text-sm transition-colors',
                      on ? 'bg-accent font-black text-primary shadow-sm' : 'font-semibold text-primary/70 hover:bg-primary/[0.04] hover:text-primary',
                    )}
                  >
                    <span className={cn('shrink-0', on ? 'text-primary' : 'text-primary/40 group-hover:text-primary/70')}>{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge && badge.count > 0 && <Badge count={badge.count} tone={badge.tone} active={on} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  active, badges, onNavigate, search, actions, adminName, children,
}: {
  active: AdminTabId;
  badges: AdminBadges;
  onNavigate: (tab: AdminTabId) => void;
  search?: ReactNode;
  actions?: ReactNode;
  adminName?: string | null;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const item = adminNavItem(active);
  useEffect(() => { setDrawer(false); }, [active]);
  const alertTotal = Object.values(badges).reduce((sum, b) => sum + (b && b.tone === 'alert' ? b.count : 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6">
      <aside className="sticky top-28 hidden max-h-[calc(100vh-8rem)] w-60 shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-primary/5 bg-white/80 p-3 shadow-premium backdrop-blur lg:flex" data-admin-sidebar>
        <div className="mb-3 flex items-center gap-2.5 px-2 pt-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5"><ShieldCheck className="h-5 w-5 text-primary" /></span>
          <div className="min-w-0">
            <p className="font-headline text-base font-black leading-tight text-primary">ניהול HOTAM</p>
            {adminName && <p className="truncate text-[11px] font-medium text-muted-foreground">{adminName}</p>}
          </div>
        </div>
        <NavList active={active} badges={badges} onNavigate={onNavigate} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-white text-primary shadow-sm lg:hidden"
              aria-label="תפריט ניהול"
              data-admin-mobile-nav-trigger
            >
              <Menu className="h-5 w-5" />
              {alertTotal > 0 && <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-destructive ring-2 ring-white" aria-hidden />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="hidden text-xs font-bold text-accent-strong sm:block">ניהול HOTAM</p>
              <h1 className="truncate font-headline text-2xl font-black leading-tight text-primary md:text-3xl" data-admin-title>{item.label}</h1>
              <p className="hidden truncate text-sm font-medium text-muted-foreground md:block">{item.hint}</p>
            </div>
            {search}
          </div>
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="right" className="w-[86%] max-w-[320px] overflow-y-auto overscroll-contain border-none bg-[#F8F9FA] p-4 pb-10" dir="rtl" data-admin-drawer>
          <SheetHeader className="mb-5 space-y-0 pr-12 text-right">
            <SheetTitle className="flex items-center gap-2 font-headline text-lg font-black text-primary">
              <ShieldCheck className="h-5 w-5 text-accent-strong" /> ניהול HOTAM
            </SheetTitle>
            <SheetDescription className="text-xs">{alertTotal > 0 ? `${alertTotal} פריטים מחכים לטיפול` : 'הכל מטופל'}</SheetDescription>
          </SheetHeader>
          <NavList active={active} badges={badges} onNavigate={(tab) => { onNavigate(tab); setDrawer(false); }} />
          <Link href="/" className="mt-6 flex items-center justify-center gap-1.5 rounded-2xl border border-primary/10 bg-white py-3 text-sm font-bold text-primary/70">
            <ArrowRight className="h-4 w-4" /> חזרה לאתר
          </Link>
        </SheetContent>
      </Sheet>
    </div>
  );
}
