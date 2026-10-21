
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
      title: 'אימות הסופר',
      desc: 'כל סופר עובר אימות תעודות ורקע הלכתי לפני שהוא מעלה מוצר ראשון.',
      Icon: ShieldCheck,
    },
    {
      id: 2,
      title: 'כתיבה ופרסום',
      desc: 'הסופר כותב בקדושה ומפרסם את המוצר עם פירוט מלא: סוג כתב, רמת הידור והגהה.',
      Icon: PenTool,
    },
    {
      id: 3,
      title: 'חיפוש מדויק',
      desc: 'מסננים לפי סוג כתב, רמת הידור, גודל ומיקום — ומוצאים בדיוק את מה שמחפשים.',
      Icon: Search,
    },
    {
      id: 4,
      title: 'רכישה שקופה',
      desc: 'קונים ישירות מהסופר, בתשלום מאובטח בנאמנות, ויודעים בדיוק מי כתב.',
      Icon: UserCheck,
    }
  ];

  return (
    <section id="how-it-works" className="section-shell bg-primary text-primary-foreground overflow-hidden relative scroll-mt-20" dir="rtl" aria-labelledby="how-heading">
      <div className="container mx-auto px-4 md:px-5 relative z-10">
        <SectionHeading id="how-heading" eyebrow="מהסופר אליכם" title="איך זה עובד" align="center" tone="dark" className="md:mb-20" />

        {/* Flat, bordered steps — a hairline rule marks the sequence instead of a glowing
            progress bar; vertical dividers on desktop (horizontal on mobile) read as one
            continuous ledger rather than four disconnected cards. */}
        <div className="grid grid-cols-1 md:grid-cols-4 border-t border-b border-primary-foreground/15 md:border-t-0 md:border-b-0 divide-y divide-primary-foreground/15 md:divide-y-0 md:divide-x md:divide-x-reverse">
          {steps.map((step, index) => {
            const { Icon } = step;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: index * 0.08, duration: 0.45, ease: EASE }}
                className="flex flex-col text-center items-center px-6 py-10 md:py-2 md:px-8"
              >
                <Icon className="w-5 h-5 md:w-6 md:h-6 text-[#E2B35B]/80 mb-5" strokeWidth={1.25} aria-hidden="true" />

                <span className="font-headline font-medium text-[44px] md:text-[56px] leading-none text-[#E2B35B] mb-5 num">
                  {String(step.id).padStart(2, '0')}
                </span>

                <h3 className="text-[22px] md:text-[24px] font-body font-semibold text-primary-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-base font-light text-primary-foreground/75 leading-relaxed max-w-[260px]">
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
