"use client";

import React, { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * Presentational pieces of the product finder (home hero wizard + its mobile sheet).
 * No data or URL logic lives here — HeroAnimation owns the state and the search params.
 *
 * Motion model (why the old wizard did not "draw smoothly"):
 *  - steps were swapped with AnimatePresence mode="wait" + springs, so the old step had to
 *    finish leaving before the new one mounted (a visible empty gap), and the springs
 *    overshot sideways;
 *  - the container had no height of its own, so every step change (and every chip/summary
 *    row that mounted above the step) made the card or sheet jump to the new height;
 *  - category/option rows mounted all at once with scale springs, re-laying out siblings.
 * Here the old and new step cross-slide at the same time (popLayout), the frame animates
 * its height to the measured height of the incoming step, every row that can appear is
 * either always rendered or inside the animated frame, and options stagger in by opacity
 * and a few pixels of translate only.
 */

export const FINDER_EASE = [0.22, 1, 0.36, 1] as const;
const STEP_SHIFT_PX = 44;

/** Height that follows its content via ResizeObserver, for an animated frame. */
function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}

const stepVariants: Variants = {
  // RTL: "forward" means the next step arrives from the left and the old one leaves right.
  enter: (dir: number) => ({ x: dir > 0 ? -STEP_SHIFT_PX : STEP_SHIFT_PX, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? STEP_SHIFT_PX : -STEP_SHIFT_PX, opacity: 0 }),
};

/**
 * The sliding step area. `stepKey` changes → the old step slides out while the new one
 * slides in. With `animateHeight` (desktop card) the frame eases to the new step's height;
 * in the mobile sheet the frame is a scroll area and keeps its size.
 */
export function FinderStepFrame({
  stepKey,
  direction,
  animateHeight,
  className,
  children,
}: {
  stepKey: number;
  direction: number;
  animateHeight?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [innerRef, height] = useMeasuredHeight<HTMLDivElement>();
  const transition = reduce ? { duration: 0 } : { duration: 0.28, ease: FINDER_EASE };

  const steps = (
    <AnimatePresence initial={false} custom={direction} mode="popLayout">
      <motion.div
        key={stepKey}
        custom={direction}
        variants={reduce ? undefined : stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={transition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );

  if (!animateHeight) {
    return <div className={cn('relative', className)}>{steps}</div>;
  }
  return (
    <motion.div
      className={cn('relative overflow-hidden', className)}
      animate={{ height }}
      initial={false}
      transition={reduce ? { duration: 0 } : { duration: 0.32, ease: FINDER_EASE }}
    >
      {/* padding keeps focus rings / the selected ring inside the clipped frame */}
      <div ref={innerRef} className="px-1 py-1">
        {steps}
      </div>
    </motion.div>
  );
}

const groupVariants: Variants = { show: { transition: { staggerChildren: 0.03 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: FINDER_EASE } },
};

/** A labelled group of options whose tiles stagger in (30ms) when the step appears. */
export function FinderQuestion({
  label,
  hint,
  className,
  gridClassName,
  animateIn = true,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
  gridClassName?: string;
  animateIn?: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const play = animateIn && !reduce;
  return (
    <fieldset className={cn('min-w-0 space-y-3', className)}>
      {label && (
        <legend className="mb-3 flex w-full items-baseline justify-between gap-3 text-right">
          <span className="text-[15px] font-semibold text-primary">{label}</span>
          {hint && <span className="text-[13px] font-normal text-muted-foreground">{hint}</span>}
        </legend>
      )}
      <motion.div
        className={cn('grid gap-2.5', gridClassName)}
        variants={groupVariants}
        initial={play ? 'hidden' : false}
        animate="show"
      >
        {children}
      </motion.div>
    </fieldset>
  );
}

/**
 * Big, tappable option tile (≥56px). Selected = gold ring + check badge + a small scale pop.
 * Toggle-button semantics (aria-pressed), keyboard focus ring.
 */
export function OptionTile({
  label,
  description,
  icon,
  active,
  onSelect,
  className,
  cellClassName,
  size = 'md',
}: {
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  active: boolean;
  onSelect: () => void;
  className?: string;
  /** classes for the grid cell (e.g. col-span-2) */
  cellClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const reduce = useReducedMotion();
  // Outer cell takes part in the group's stagger; the inner button owns the tap/selection
  // pop (an element with its own `animate` would not inherit the parent's variants).
  return (
    <motion.div variants={itemVariants} className={cn('min-w-0', cellClassName)}>
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      animate={active && !reduce ? { scale: [1, 1.03, 1] } : { scale: 1 }}
      transition={{ duration: 0.28, ease: FINDER_EASE }}
      className={cn(
        'relative flex h-full w-full min-w-0 items-center gap-3 rounded-2xl border bg-card text-right transition-[border-color,background-color,box-shadow] duration-200 ease-lux',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        size === 'lg' ? 'min-h-[104px] flex-col justify-center px-3 py-4 text-center'
          : size === 'sm' ? 'min-h-[56px] justify-center px-2 py-3 text-center'
          : 'min-h-[56px] px-4 py-3',
        active
          ? 'border-gold-deep bg-accent/[0.07] shadow-[0_0_0_1px_hsl(var(--gold-deep))]'
          : 'border-border/80 hover:border-primary/30',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
            size === 'lg' ? 'h-12 w-12' : 'h-9 w-9',
            active ? 'bg-gold-deep text-white' : 'bg-secondary text-primary',
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className={cn('min-w-0 flex-1', size !== 'md' && 'flex-none')}>
        <span className={cn('block font-semibold leading-snug text-primary', size === 'lg' ? 'text-[15px]' : 'text-[15px]')}>{label}</span>
        {description && <span className="mt-0.5 block text-[13px] font-normal leading-snug text-muted-foreground">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
          size === 'lg' && 'absolute left-2.5 top-2.5',
          size === 'sm' && 'absolute left-1.5 top-1.5 h-4 w-4',
          active ? 'scale-100 border-gold-deep bg-gold-deep text-white' : 'border-primary/20 bg-card text-transparent',
          size !== 'md' && !active && 'opacity-0',
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    </motion.button>
    </motion.div>
  );
}

/** "שלב X מתוך N" + segmented gold progress + a one-line summary of what is chosen so far. */
export function FinderProgress({
  step,
  total,
  summary,
  action,
}: {
  step: number;
  total: number;
  summary?: string;
  action?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-2.5">
      <div className="flex min-h-[28px] items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-accent-strong" aria-live="polite">
          שלב <span className="num">{step}</span> מתוך <span className="num">{total}</span>
        </p>
        {action}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-primary/10">
            <motion.span
              className="block h-full origin-right rounded-full bg-gold-deep"
              initial={false}
              animate={{ scaleX: i < step ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.36, ease: FINDER_EASE }}
            />
          </span>
        ))}
      </div>
      {/* Always one line tall, so choosing something never pushes the step down. */}
      <p className="h-5 truncate text-[13px] font-medium text-muted-foreground">{summary || ' '}</p>
    </div>
  );
}
