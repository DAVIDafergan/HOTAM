"use client";

import { motion, useReducedMotion } from 'framer-motion';

// Shared success-feedback mark — a small gold-filled circle with a checkmark that draws
// itself in. Kept deliberately brief (280ms) and understated: this confirms an action
// succeeded, it isn't a celebratory moment. Used anywhere a toast reports a completed
// save/send/delete, so the same visual language appears for every such action site-wide.
export function SuccessCheck({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={className ?? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent"}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent-foreground">
        <motion.path
          d="M4 12.5 9.5 18 20 6"
          initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: shouldReduceMotion ? 0 : 0.1, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}
