
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Gem, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TorahExpertBanner() {
  const whatsappNumber = "972556674329";
  const message = encodeURIComponent("שלום, אני מעוניין בייעוץ לרכישת ספר תורה דרך מערכת חותם.");

  return (
    <section className="relative w-full overflow-hidden border-y border-accent/25 bg-[#11182A] py-6 shadow-[0_30px_80px_rgba(7,12,24,0.35)] md:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-accent/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-white/30 to-transparent" />

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:gap-12">
          
          <div className="flex flex-1 flex-col items-center gap-4 text-right md:flex-row md:gap-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="hidden h-16 w-16 items-center justify-center rounded-[1.5rem] border border-accent/25 bg-white/5 text-accent shadow-inner lg:flex"
            >
              <Gem className="h-7 w-7" />
            </motion.div>

            <div className="space-y-3">
              <div className="mb-1 flex items-center justify-center gap-3 md:justify-start">
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  className="rounded-full bg-accent px-3 py-1 text-[10px] font-black tracking-[0.22em] text-primary"
                >
                  PREMIUM
                </motion.div>
                <div className="flex items-center gap-3 text-[10px] font-black tracking-widest text-white/50">
                   <div className="flex items-center gap-1">
                     <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> ליווי אישי
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-accent" /> אחריות כשרות
                    </div>
                 </div>
               </div>

              <motion.h2 
                initial={{ y: 5, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center font-headline text-3xl font-black leading-tight tracking-tight text-white md:text-right lg:text-[2.7rem]"
              >
                רכישת ספר תורה יוקרתי בליווי אישי של צוות חותם
              </motion.h2>
              <p className="max-w-3xl text-center text-sm font-medium leading-relaxed text-white/70 md:text-right md:text-base">
                ייעוץ דיסקרטי, בחירת כתב והידור, תיאום התרשמות מלאה וליווי מדויק עד למסירת ספר התורה.
              </p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="w-full shrink-0 md:w-auto"
          >
            <Button 
              asChild
              className="h-16 w-full rounded-[1.5rem] border border-white/15 bg-accent px-10 text-lg font-black tracking-tight text-primary shadow-[0_18px_40px_rgba(212,175,55,0.3)] transition-all hover:scale-[1.02] hover:bg-accent/90 active:scale-95 group md:w-auto"
            >
              <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="ml-3 h-6 w-6 transition-transform group-hover:rotate-6" />
                תיאום ייעוץ לרכישת ספר תורה
              </a>
            </Button>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
