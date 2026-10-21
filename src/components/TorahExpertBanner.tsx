
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLATFORM_WHATSAPP_NUMBER } from '@/lib/constants';

export function TorahExpertBanner() {
  const whatsappNumber = PLATFORM_WHATSAPP_NUMBER;
  const message = encodeURIComponent("שלום, אני מעוניין בייעוץ לרכישת ספר תורה דרך מערכת חותם.");

  // Light band (was a navy block): it sits right above the dark seller CTA, and two dark
  // slabs in a row read heavy. Ink + gold hairline keeps it premium on parchment.
  return (
    <section className="relative w-full py-14 md:py-20" aria-labelledby="torah-concierge-heading">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-accent/30 bg-card px-6 py-9 shadow-premium md:rounded-[2.5rem] md:px-14 md:py-12">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-accent/60 to-transparent" />
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-right">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-start"
              >
                <span className="font-body text-xs font-semibold uppercase tracking-[0.22em] text-accent-strong">TORAH CONCIERGE</span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary/70">
                  <CheckCircle2 className="h-4 w-4 text-accent-strong" aria-hidden="true" /> ליווי אישי
                </span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary/70">
                  <ShieldCheck className="h-4 w-4 text-accent-strong" aria-hidden="true" /> אחריות כשרות
                </span>
              </motion.div>

              <h2 id="torah-concierge-heading" className="font-headline text-[32px] font-semibold leading-[1.12] text-primary md:text-[46px]">
                ספר תורה? נלווה אתכם אישית
              </h2>
              <p className="mx-auto max-w-2xl text-[17px] font-light leading-relaxed text-primary/85 md:mx-0 md:text-[19px]">
                ייעוץ דיסקרטי, בחירת כתב והידור, תיאום התרשמות מלאה וליווי מדויק עד למסירת ספר התורה.
              </p>
            </div>

            <Button asChild size="lg" className="w-full shrink-0 gap-2.5 md:w-auto">
              <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                לתיאום ייעוץ בוואטסאפ
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
