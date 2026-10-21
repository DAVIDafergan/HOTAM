'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

// Client-side stagger primitives so Server Components (e.g. src/app/page.tsx) can still
// get a real parent-orchestrated stagger for a grid of cards, instead of each card faking
// it with its own hand-picked delay.
export function StaggerGrid({ children, className }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
