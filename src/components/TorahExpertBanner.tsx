
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TorahExpertBanner() {
  const whatsappNumber = "972556674329";
  const message = encodeURIComponent("שלום, אני מעוניין בייעוץ לרכישת ספר תורה דרך מערכת חותם.");

  return (
    <section className="w-full bg-primary relative overflow-hidden border-y-2 border-accent/20 shadow-2xl py-4 md:py-6">
      {/* Animated background elements */}
      <div className="absolute inset-0 bg-accent/5 opacity-30 pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-accent/10 rounded-full blur-[80px]" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-accent/10 rounded-full blur-[80px]" />

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12">
          
          {/* Content Side */}
          <div className="flex-1 text-right flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="hidden lg:flex items-center justify-center p-3 bg-accent/20 rounded-2xl text-accent shadow-inner border border-accent/10"
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>

            <div className="space-y-2">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  className="bg-accent text-primary px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em]"
                >
                  VIP SERVICE
                </motion.div>
                <div className="flex items-center gap-3 text-white/40 font-black text-[9px] uppercase tracking-widest">
                   <div className="flex items-center gap-1">
                     <CheckCircle2 className="w-3 h-3 text-accent" /> ליווי מלא
                   </div>
                   <div className="flex items-center gap-1">
                     <ShieldCheck className="w-3 h-3 text-accent" /> אחריות כשרות
                   </div>
                </div>
              </div>

              <motion.h2 
                initial={{ y: 5, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-2xl md:text-3xl lg:text-4xl font-headline font-black leading-tight tracking-tighter text-center md:text-right"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent via-white to-accent bg-[length:200%_auto] block animate-pulse">
                  קנה ספר תורה בליווי צוות המומחים של חותם
                </span>
              </motion.h2>
            </div>
          </div>

          {/* Action Side */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            className="shrink-0 w-full md:w-auto"
          >
            <Button 
              asChild
              className="w-full md:w-auto bg-accent text-primary hover:bg-accent/90 px-12 h-16 rounded-2xl font-black text-xl uppercase tracking-widest shadow-[0_15px_30px_rgba(212,175,55,0.4)] transition-all hover:scale-[1.05] active:scale-95 group border-2 border-white/20"
            >
              <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-7 h-7 ml-3 group-hover:rotate-12 transition-transform" />
                ייעוץ מומחה בוואטסאפ
              </a>
            </Button>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
