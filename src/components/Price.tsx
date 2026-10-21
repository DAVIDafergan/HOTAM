import { cn } from '@/lib/utils';

/**
 * Price with tabular figures. Rendered as an LTR run ("₪1,234") so the shekel sign always
 * sits immediately left of the number regardless of the surrounding RTL text, matching
 * the "₪x" form used in checkout and order summaries.
 */
export function Price({
  value,
  className,
  currencyClassName,
}: {
  value: number | string;
  className?: string;
  currencyClassName?: string;
}) {
  const formatted = typeof value === 'number' ? value.toLocaleString('he-IL') : value;
  return (
    <span dir="ltr" className={cn('price inline-flex items-baseline gap-[0.12em] whitespace-nowrap', className)}>
      <span className={cn('text-[0.68em] font-bold opacity-60', currencyClassName)}>₪</span>
      <span>{formatted}</span>
    </span>
  );
}
