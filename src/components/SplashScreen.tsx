"use client";

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useState, useEffect } from 'react';

// Total time the splash blocks interaction with the site. Scaled down from an earlier 4s
// design (0.375x) — every delay/duration below keeps the same relative choreography, just
// compressed, so first-time visitors aren't stuck waiting before they can do anything.
const SPLASH_DURATION_MS = 1500;

// Subtle parchment-grain noise, generated inline via SVG feTurbulence — no external request,
// unlike the previous transparenttextures.com dependency (which had gone 404 in production).
const PARCHMENT_TEXTURE_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMjAnIGhlaWdodD0nMjIwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC44NScgbnVtT2N0YXZlcz0nMicgc3RpdGNoVGlsZXM9J3N0aXRjaCcgcmVzdWx0PSd0Jy8+PGZlQ29sb3JNYXRyaXggaW49J3QnIHR5cGU9J21hdHJpeCcgdmFsdWVzPScwIDAgMCAwIDAuMzYgIDAgMCAwIDAgMC4yOSAgMCAwIDAgMCAwLjE1ICAwIDAgMCAwLjQgMCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnIGZpbHRlcj0ndXJsKCNuKScvPjwvc3ZnPg==";

export function SplashScreen() {
  const shouldReduceMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the splash screen in this session
    const hasSeenSplash = sessionStorage.getItem('hotam_splash_seen');
    if (hasSeenSplash) return;

    sessionStorage.setItem('hotam_splash_seen', 'true');

    // Respect the OS-level motion preference — skip straight to the site, no delay at all.
    if (shouldReduceMotion) return;

    setShouldRender(true);
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  if (!shouldRender) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.45, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FDFCF0] pointer-events-none"
        >
          {/* Parchment Texture Overlay */}
          <div className="absolute inset-0 opacity-40 pointer-events-none"
               style={{
                 backgroundImage: `url('${PARCHMENT_TEXTURE_DATA_URL}')`,
                 backgroundColor: '#FDFCF0'
               }}
          />

          <div className="relative flex flex-col items-center gap-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
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
                  transition={{ duration: 0.75, ease: "easeInOut" }}
                />
                <motion.path
                  d="m12 19 7-7 3 3-7 7-3-3z"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.75, ease: "easeInOut", delay: 0.19 }}
                />
                <motion.path
                  d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.75, ease: "easeInOut", delay: 0.3 }}
                />
                <motion.path
                  d="m2 2l5 5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.56, ease: "easeInOut", delay: 0.56 }}
                />
              </svg>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.68, ease: "easeOut" }}
              className="flex flex-col items-center text-center"
            >
              <h1 className="text-6xl md:text-7xl font-headline font-black text-primary tracking-tight leading-none mb-2">
                חותם
              </h1>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 100 }}
                transition={{ duration: 0.56, delay: 0.94, ease: "easeInOut" }}
                className="h-1 bg-accent rounded-full"
              />
              <p className="text-xs md:text-sm font-black text-primary/60 mt-6 tracking-[0.4em] uppercase">
                מלאכת שמיים וקדושה
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
