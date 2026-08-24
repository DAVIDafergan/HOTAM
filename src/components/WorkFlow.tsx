
"use client";

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ShieldCheck,
  PenTool,
  Search,
  UserCheck
} from 'lucide-react';
import { EASE } from '@/lib/motion';

// Reference: luxury "savoir-faire" process pages (Patek Philippe "Steps of
// Servicing", Loewe "Craft Commitment") mark each step with a typographic
// numeral + tracked-caps label rather than an icon-in-a-glossy-medallion —
// the number carries the sequence, a single hairline-weight mark carries the
// theme. No circles, no blur, no drop shadow, no tilt.
export function WorkFlow() {
  const shouldReduceMotion = useReducedMotion();

  const steps = [
    {
      id: 1,
      title: 'אימות סופר',
      desc: 'אימות קפדני - כל סופר עובר אימות תעודות ורקע הלכתי',
      Icon: ShieldCheck,
    },
    {
      id: 2,
      title: 'כתיבה והעלאה',
      desc: 'כתיבה בקדושה - הסופר מעלה את המוצר עם פירוט מלא על רמת ההידור וטבילה',
      Icon: PenTool,
    },
    {
      id: 3,
      title: 'חיפוש מדויק',
      desc: 'דיוק מקסימלי - הלקוח מוצא בדיוק את מה שהוא מחפש לפי סוג כתב ורמת הידור',
      Icon: Search,
    },
    {
      id: 4,
      title: 'רכישה שקופה',
      desc: 'שקיפות מלאה - קנייה ישירה מהסופר עם ידיעה ברורה מי כתב את הקודש שלך',
      Icon: UserCheck,
    }
  ];

  return (
    <section className="py-16 md:py-32 bg-primary text-primary-foreground overflow-hidden relative" dir="rtl">
      <div className="container mx-auto px-4 md:px-5 relative z-10">
        <div className="text-center mb-12 md:mb-24 space-y-3 md:space-y-4">
          <motion.p
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs md:text-sm font-semibold tracking-[0.2em] text-accent uppercase"
          >
            מהסופר אליך
          </motion.p>
          <motion.h2
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-[2.1rem] md:text-[3rem] font-headline font-bold tracking-tight"
          >
            תהליך העבודה שלנו
          </motion.h2>
        </div>

        {/* Flat, bordered steps — a hairline rule marks the sequence instead of a glowing
            progress bar; vertical dividers on desktop (horizontal on mobile) read as one
            continuous ledger rather than four disconnected cards. */}
        <div className="grid grid-cols-1 md:grid-cols-4 border-t border-b border-primary-foreground/15 md:border-t-0 md:border-b-0 divide-y divide-primary-foreground/15 md:divide-y-0 md:divide-x md:divide-x-reverse">
          {steps.map((step, index) => {
            const { Icon } = step;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.08, duration: 0.5, ease: EASE }}
                className="flex flex-col text-center items-center px-6 py-10 md:py-2 md:px-8"
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6 text-destructive mb-5" strokeWidth={1.25} />

                <span className="font-headline text-[2.5rem] md:text-[3rem] leading-none text-accent mb-3">
                  {String(step.id).padStart(2, '0')}
                </span>

                <h3 className="text-base md:text-lg font-headline font-bold text-primary-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-primary-foreground/65 leading-relaxed max-w-[230px]">
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
