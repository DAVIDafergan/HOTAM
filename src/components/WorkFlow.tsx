
"use client";

import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import {
  ShieldCheck,
  PenTool,
  Search,
  UserCheck
} from 'lucide-react';
import { EASE_OUT_EXPO } from '@/lib/motion';
import { SectionHeading } from '@/components/SectionHeading';

// Reference: luxury "savoir-faire" process pages (Patek Philippe "Steps of
// Servicing", Loewe "Craft Commitment") mark each step with a typographic
// numeral + tracked-caps label rather than an icon-in-a-glossy-medallion —
// the number carries the sequence, a single hairline-weight mark carries the
// theme. No circles, no blur, no drop shadow, no tilt.
export function WorkFlow() {
  const shouldReduceMotion = useReducedMotion();
  const stepsRef = useRef<HTMLDivElement>(null);
  // 0 → 1 while the steps travel from the lower part of the viewport to its middle.
  const { scrollYProgress } = useScroll({ target: stepsRef, offset: ['start 85%', 'end 55%'] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const drawn = useTransform(smoothProgress, (v) => (shouldReduceMotion ? 1 : v));
  const lineProgress = drawn;

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

        {/* A ledger of four steps joined by one gold hairline that draws itself as the section
            scrolls through the viewport (vertical timeline on phones, horizontal on desktop).
            Steps reveal one after another; the line is decorative and scroll-linked only. */}
        <div ref={stepsRef} className="relative grid grid-cols-1 md:grid-cols-4">
          <span aria-hidden="true" className="absolute right-7 top-10 bottom-10 w-px bg-primary-foreground/15 md:hidden" />
          <motion.span
            aria-hidden="true"
            style={{ scaleY: lineProgress }}
            className="absolute right-7 top-10 bottom-10 w-px origin-top bg-[#E2B35B]/80 md:hidden"
          />
          <span aria-hidden="true" className="absolute inset-x-0 top-0 hidden h-px bg-primary-foreground/15 md:block" />
          <motion.span
            aria-hidden="true"
            style={{ scaleX: lineProgress }}
            className="absolute inset-x-0 top-0 hidden h-px origin-right bg-[#E2B35B]/80 md:block"
          />

          {steps.map((step, index) => {
            const { Icon } = step;
            return (
              <motion.div
                key={step.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.14, duration: 0.9, ease: EASE_OUT_EXPO }}
                className="relative flex items-start gap-5 py-7 text-right md:flex-col md:items-center md:gap-0 md:px-8 md:pb-2 md:pt-14 md:text-center"
              >
                {/* Desktop: a gold node where the line meets each step */}
                <span aria-hidden="true" className="absolute left-1/2 top-0 hidden h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E2B35B] ring-4 ring-primary md:block" />

                <span className="relative z-10 flex w-14 shrink-0 justify-center bg-primary py-2 font-numbers font-normal text-[44px] leading-none text-[#E2B35B] num md:mb-5 md:w-auto md:py-0 md:text-[60px]">
                  {String(step.id).padStart(2, '0')}
                </span>

                <div className="min-w-0 pt-1 md:flex md:flex-col md:items-center md:pt-0">
                  <Icon className="mb-3 hidden h-6 w-6 text-[#E2B35B]/80 md:order-first md:mb-5 md:block" strokeWidth={1.25} aria-hidden="true" />
                  <h3 className="mb-2 font-body text-[21px] font-semibold text-primary-foreground md:mb-3 md:text-[24px]">
                    {step.title}
                  </h3>
                  <p className="text-base font-normal leading-relaxed text-primary-foreground/80 md:max-w-[260px]">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
