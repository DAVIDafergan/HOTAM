
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  PenTool, 
  Search, 
  UserCheck,
  Check
} from 'lucide-react';

const steps = [
  {
    id: 1,
    title: 'אימות סופר',
    desc: 'אימות קפדני - כל סופר עובר אימות תעודות ורקע הלכתי',
    icon: <ShieldCheck className="w-8 h-8" />,
    animation: {
      icon: (
        <div className="relative">
          <ShieldCheck className="w-12 h-12 text-accent" />
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1"
          >
            <Check className="w-3 h-3 text-white" />
          </motion.div>
        </div>
      )
    }
  },
  {
    id: 2,
    title: 'כתיבה והעלאה',
    desc: 'כתיבה בקדושה - הסופר מעלה את המוצר עם פירוט מלא על רמת ההידור וטבילה',
    icon: <PenTool className="w-8 h-8" />,
    animation: {
      icon: (
        <div className="relative">
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 10 }}
            transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
          >
            <PenTool className="w-12 h-12 text-accent" />
          </motion.div>
        </div>
      )
    }
  },
  {
    id: 3,
    title: 'חיפוש מדויק',
    desc: 'דיוק מקסימלי - הלקוח מוצא בדיוק את מה שהוא מחפש לפי סוג כתב ורמת הידור',
    icon: <Search className="w-8 h-8" />,
    animation: {
      icon: (
        <div className="relative">
          <motion.div
            animate={{ x: [0, 5, -5, 0], y: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <Search className="w-12 h-12 text-accent" />
          </motion.div>
        </div>
      )
    }
  },
  {
    id: 4,
    title: 'רכישה שקופה',
    desc: 'שקיפות מלאה - קנייה ישירה מהסופר עם ידיעה ברורה מי כתב את הקודש שלך',
    icon: <UserCheck className="w-8 h-8" />,
    animation: {
      icon: (
        <div className="relative">
          <UserCheck className="w-12 h-12 text-accent" />
        </div>
      )
    }
  }
];

export function WorkFlow() {
  return (
    <section className="py-24 bg-primary text-white overflow-hidden relative" dir="rtl">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%"><pattern id="wf-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#wf-grid)" /></svg>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-20 space-y-4">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-headline font-black tracking-tight"
          >
            תהליך העבודה שלנו
          </motion.h2>
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: 64 }}
            viewport={{ once: true }}
            className="h-1 bg-accent mx-auto rounded-full"
          />
        </div>

        <div className="relative">
          {/* Timeline Line - Desktop */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2">
            <motion.div 
              initial={{ width: "0%" }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="h-full bg-accent shadow-[0_0_10px_rgba(212,175,55,0.5)]"
            />
          </div>

          {/* Timeline Line - Mobile */}
          <div className="md:hidden absolute top-0 bottom-0 right-8 w-0.5 bg-white/10">
            <motion.div 
              initial={{ height: "0%" }}
              whileInView={{ height: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="w-full bg-accent shadow-[0_0_10px_rgba(212,175,55,0.5)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-4 relative">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="flex flex-col items-center md:items-center text-center md:text-center space-y-6 relative"
              >
                {/* Icon Container */}
                <div className="relative">
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    className="w-20 h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-premium relative z-10"
                  >
                    {step.animation.icon}
                  </motion.div>
                  
                  {/* Step Number Badge */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent text-primary rounded-full flex items-center justify-center font-black text-xs shadow-lg z-20">
                    {step.id}
                  </div>
                </div>

                {/* Text Content */}
                <div className="space-y-3 px-4">
                  <h3 className="text-xl font-headline font-black text-accent">{step.title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed font-medium max-w-[200px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
