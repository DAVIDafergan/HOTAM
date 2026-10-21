import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * One heading pattern for every storefront section: small gold eyebrow, serif title,
 * optional lead paragraph, optional action (e.g. "to all products") on the opposite side.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  action,
  align = 'start',
  tone = 'light',
  className,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  align?: 'start' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-5 md:mb-12',
        centered ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={cn('space-y-3 md:space-y-4', centered ? 'flex flex-col items-center' : 'text-right')}>
        {eyebrow && <p className={cn('eyebrow', centered && 'eyebrow-center', tone === 'dark' && 'text-[#E2B35B] before:bg-[#E2B35B]/70 after:bg-[#E2B35B]/70')}>{eyebrow}</p>}
        <h2
          id={id}
          className={cn(
            'font-headline text-[30px] font-medium leading-[1.15] md:text-[44px]',
            tone === 'dark' ? 'text-white' : 'text-primary',
          )}
        >
          {title}
        </h2>
        {lead && (
          <p className={cn('text-[16px] leading-relaxed md:text-lg', centered && 'mx-auto', tone === 'dark' ? 'text-white/75' : 'text-primary/70')}>
            {lead}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
