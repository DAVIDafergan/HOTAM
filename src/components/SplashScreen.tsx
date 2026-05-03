
"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the splash screen in this session
    const hasSeenSplash = sessionStorage.getItem('hotam_splash_seen');
    
    if (!hasSeenSplash) {
      setShouldRender(true);
      setIsVisible(true);
      sessionStorage.setItem('hotam_splash_seen', 'true');
      
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 4000); // Total duration of the animation
      
      return () => clearTimeout(timer);
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FDFCF0]"
        >
          {/* Parchment Texture Overlay */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" 
               style={{ 
                 backgroundImage: `url('https://www.transparenttextures.com/patterns/papyros.png')`,
                 backgroundColor: '#FDFCF0'
               }} 
          />
          
          <div className="relative flex flex-col items-center gap-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="relative"
            >
              {/* Sacred Hebrew Logo Animation */}
              <svg 
                width="160" 
                height="160" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#1A2B3C" 
                strokeWidth="0.8" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="drop-shadow-2xl"
              >
                {/* Visual representation of a Stylized Quill/Hebrew Path */}
                <motion.path 
                  d="M12 2C7 2 4 7 4 12C4 17 7 22 12 22C17 22 20 17 20 12C20 7 17 2 12 2Z" 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
                <motion.path 
                  d="m12 19 7-7 3 3-7 7-3-3z" 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
                />
                <motion.path 
                  d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2, ease: "easeInOut", delay: 0.8 }}
                />
                <motion.path 
                  d="m2 2l5 5" 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut", delay: 1.5 }}
                />
              </svg>
              
              {/* Gold Glow */}
              <motion.div 
                className="absolute inset-0 bg-accent/25 blur-[70px] -z-10 rounded-full"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.3, 0.6, 0.3] 
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.2, delay: 1.8, ease: "easeOut" }}
              className="flex flex-col items-center text-center"
            >
              <h1 className="text-6xl md:text-7xl font-headline font-black text-primary tracking-tight leading-none mb-2">
                חותם
              </h1>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 100 }}
                transition={{ duration: 1.5, delay: 2.5, ease: "easeInOut" }}
                className="h-1 bg-accent rounded-full" 
              />
              <p className="text-xs md:text-sm font-black text-primary/60 mt-6 tracking-[0.4em] uppercase">
                מלאכת שמיים וקדושה
              </p>
            </motion.div>
          </div>

          {/* Elegant Progress Line */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-56 h-[1.5px] bg-primary/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ left: "-100%" }}
              animate={{ left: "100%" }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-1/2 bg-accent/30"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
