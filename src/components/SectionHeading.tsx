import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/motion/Reveal';

/**
 * One heading pattern for every storefront section: small gold eyebrow, serif title,
 * optional lead paragraph, optional action (e.g. "to all products") on the opposite side.
 * Rises into view the first time it is scrolled to, while the eyebrow's gold hairline draws.
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
    <Reveal
      className={cn(
        'mb-10 flex flex-col gap-6 md:mb-16',
        centered ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className={cn('space-y-4 md:space-y-5', centered ? 'flex flex-col items-center' : 'text-right')}>
        {eyebrow && <p className={cn('eyebrow', centered && 'eyebrow-center', tone === 'dark' && 'text-[#E2B35B] before:bg-[#E2B35B]/70 after:bg-[#E2B35B]/70')}>{eyebrow}</p>}
        <h2
          id={id}
          className={cn(
            'font-headline text-[32px] font-semibold leading-[1.16] md:text-[48px]',
            tone === 'dark' ? 'text-white' : 'text-primary',
          )}
        >
          {title}
        </h2>
        {lead && (
          <p className={cn('max-w-xl text-[17px] font-normal leading-[1.7] md:text-[19px]', centered && 'mx-auto', tone === 'dark' ? 'text-white/85' : 'text-primary/90')}>
            {lead}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Reveal>
  );
}
