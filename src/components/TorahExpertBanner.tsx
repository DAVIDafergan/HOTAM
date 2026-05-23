
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Gem, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TorahExpertBanner() {
  const whatsappNumber = "972556674329";
  const message = encodeURIComponent("שלום, אני מעוניין בייעוץ לרכישת ספר תורה דרך מערכת חותם.");

  return (
    <section className="relative w-full overflow-hidden border-y border-white/10 bg-[#0D111A] py-6 shadow-[0_22px_60px_rgba(6,10,18,0.45)] md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:gap-10">
          
          <div className="flex flex-1 flex-col items-center gap-4 text-right md:flex-row md:gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="hidden h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white shadow-inner lg:flex"
            >
              <Gem className="h-6 w-6" />
            </motion.div>

            <div className="space-y-3">
              <div className="mb-1 flex items-center justify-center gap-3 md:justify-start">
                <motion.div 
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-black tracking-[0.22em] text-white/80"
                >
                  TORAH CONCIERGE
                </motion.div>
                <div className="flex items-center gap-3 text-[10px] font-black tracking-widest text-white/55">
                   <div className="flex items-center gap-1">
                     <CheckCircle2 className="h-3.5 w-3.5 text-white/75" /> ליווי אישי
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-white/75" /> אחריות כשרות
                    </div>
                 </div>
               </div>

              <motion.h2 
                initial={{ y: 6, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="text-center font-headline text-[1.9rem] font-black leading-tight tracking-tight text-white md:text-right lg:text-[2.35rem]"
              >
                רכישת ספר תורה יוקרתי בליווי אישי של צוות חותם
              </motion.h2>
              <p className="max-w-3xl text-center text-sm font-medium leading-relaxed text-white/70 md:text-right md:text-base">
                ייעוץ דיסקרטי, בחירת כתב והידור, תיאום התרשמות מלאה וליווי מדויק עד למסירת ספר התורה.
              </p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full shrink-0 md:w-auto"
          >
            <Button 
              asChild
              className="h-14 w-full rounded-2xl border border-white/20 bg-white/5 px-8 text-base font-black tracking-tight text-white shadow-[0_16px_34px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 active:scale-95 group md:w-auto"
            >
              <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="ml-2.5 h-5 w-5 transition-transform duration-300 group-hover:rotate-6" />
                תיאום ייעוץ לרכישת ספר תורה
              </a>
            </Button>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
