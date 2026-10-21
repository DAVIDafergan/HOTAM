
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
import { SectionHeading } from '@/components/SectionHeading';

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
    <section className="section-shell bg-primary text-primary-foreground overflow-hidden relative" dir="rtl">
      <div className="container mx-auto px-4 md:px-5 relative z-10">
        <SectionHeading eyebrow="מהסופר אליך" title="תהליך העבודה שלנו" align="center" tone="dark" className="md:mb-20" />

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
                <Icon className="w-5 h-5 md:w-6 md:h-6 text-[#E2B35B]/80 mb-5" strokeWidth={1.25} aria-hidden="true" />

                <span className="font-headline font-medium text-[2.5rem] md:text-[3rem] leading-none text-[#E2B35B] mb-4 num">
                  {String(step.id).padStart(2, '0')}
                </span>

                <h3 className="text-lg md:text-xl font-headline font-bold text-primary-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-[15px] text-primary-foreground/75 leading-relaxed max-w-[250px]">
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
