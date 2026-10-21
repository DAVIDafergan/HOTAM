import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'דף הבית' },
  { href: '/search?view=all', label: 'כל המוצרים' },
  { href: '/contact', label: 'צור קשר' },
  { href: '/terms', label: 'תקנון ותנאי שימוש' },
];

/** Shared site footer for the public storefront pages (server component, no client JS). */
export function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-border/70 bg-card/70 ${className}`}>
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-start md:justify-between md:text-right">
          <div className="space-y-3">
            <Link href="/" aria-label="חותם - דף הבית" className="inline-flex items-center gap-2.5 rounded-md text-primary transition-opacity hover:opacity-80">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8 shrink-0"
                aria-hidden="true"
              >
                <path d="m12 19 7-7 3 3-7 7-3-3z" />
                <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="m2 2 5 5" />
                <path d="m11 11l1 1" />
              </svg>
              <span className="font-numbers text-[24px] font-normal uppercase tracking-[0.16em]">HOTAM</span>
              {/* The one decorative STaM touch outside the hero: the name, as a scribe writes it. */}
              <span aria-hidden="true" className="border-r border-accent/40 pr-3 font-stam text-[26px] leading-none text-accent-strong">חותם</span>
            </Link>
            <p className="mx-auto max-w-xs text-base font-normal leading-relaxed text-muted-foreground md:mx-0">
              סת״ם מהודר ויודאיקה, ישירות מסופרים ומוכרים מאומתים.
            </p>
          </div>

          <nav aria-label="קישורי תחתית" className="flex flex-wrap justify-center gap-x-7 gap-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-primary/75 transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border/70 pt-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} חותם · HOTAM</p>
          <p>נבנה ע״י DA ניהול פרויקטים</p>
        </div>
      </div>
    </footer>
  );
}
