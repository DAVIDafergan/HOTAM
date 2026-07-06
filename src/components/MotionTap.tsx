'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// Small tap/hover feedback for primary CTAs, usable from Server Components (wraps a single
// child). Skips the transform entirely when the user prefers reduced motion.
export function MotionTap({ children, className }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} className={className}>
      {children}
    </motion.div>
  );
}
