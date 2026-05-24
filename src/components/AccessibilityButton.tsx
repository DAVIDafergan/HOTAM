
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Accessibility, 
  RotateCcw,
  Minus,
  Plus,
  Eye,
  Link as LinkIcon,
  MousePointer2,
  ALargeSmall
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

const ACCESSIBILITY_BUTTON_SIZE_PX = 48;
const ACCESSIBILITY_BUTTON_PADDING_PX = 16;
const ACCESSIBILITY_DEFAULT_BOTTOM_OFFSET_PX = 88;
const ACCESSIBILITY_DRAG_THRESHOLD_PX = 4;
const ACCESSIBILITY_KEYBOARD_NUDGE_PX = 24;

function exceedsDragThreshold(deltaX: number, deltaY: number) {
  return (deltaX * deltaX) + (deltaY * deltaY) > ACCESSIBILITY_DRAG_THRESHOLD_PX * ACCESSIBILITY_DRAG_THRESHOLD_PX;
}

export function AccessibilityButton() {
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [readableFont, setReadableFont] = useState(false);
  const [highlightLinks, setHighlightLinks] = useState(false);
  const [position, setPosition] = useState({ x: 4, y: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const clampPosition = (x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    return {
      x: Math.min(Math.max(0, x), window.innerWidth - ACCESSIBILITY_BUTTON_SIZE_PX),
      y: Math.min(Math.max(ACCESSIBILITY_BUTTON_PADDING_PX, y), window.innerHeight - ACCESSIBILITY_BUTTON_SIZE_PX),
    };
  };

  useEffect(() => {
    // Apply settings to document root
    const root = document.documentElement;
    root.style.fontSize = `${fontSize}%`;
    
    if (highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');
    
    if (grayscale) root.classList.add('grayscale-mode');
    else root.classList.remove('grayscale-mode');
    
    if (readableFont) root.classList.add('readable-font');
    else root.classList.remove('readable-font');
    
    if (highlightLinks) root.classList.add('highlight-links');
    else root.classList.remove('highlight-links');
    
  }, [fontSize, highContrast, grayscale, readableFont, highlightLinks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let frameId = 0;

    const syncToViewport = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setPosition(prev => {
          if (prev.y === 0) {
            return clampPosition(prev.x, window.innerHeight - ACCESSIBILITY_DEFAULT_BOTTOM_OFFSET_PX);
          }
          return clampPosition(prev.x, prev.y);
        });
      });
    };

    syncToViewport();
    window.addEventListener('resize', syncToViewport, { passive: true });
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncToViewport);
    };
  }, []);

  const reset = () => {
    setFontSize(100);
    setHighContrast(false);
    setGrayscale(false);
    setReadableFont(false);
    setHighlightLinks(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.moved && exceedsDragThreshold(deltaX, deltaY)) {
      dragState.moved = true;
      suppressClickRef.current = true;
    }

    if (!dragState.moved) return;
    setPosition(clampPosition(dragState.originX + deltaX, dragState.originY + deltaY));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        setPosition(prev => clampPosition(prev.x - ACCESSIBILITY_KEYBOARD_NUDGE_PX, prev.y));
        break;
      case 'ArrowRight':
        event.preventDefault();
        setPosition(prev => clampPosition(prev.x + ACCESSIBILITY_KEYBOARD_NUDGE_PX, prev.y));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setPosition(prev => clampPosition(prev.x, prev.y - ACCESSIBILITY_KEYBOARD_NUDGE_PX));
        break;
      case 'ArrowDown':
        event.preventDefault();
        setPosition(prev => clampPosition(prev.x, prev.y + ACCESSIBILITY_KEYBOARD_NUDGE_PX));
        break;
      default:
        break;
    }
  };

  return (
    <div
      className="fixed z-[200]"
      style={{ left: position.x, top: position.y === 0 ? `calc(100dvh - ${ACCESSIBILITY_DEFAULT_BOTTOM_OFFSET_PX}px)` : position.y }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="icon" 
            className="h-11 w-11 rounded-full bg-primary text-white shadow-2xl transition-transform border-2 border-white/20 animate-in fade-in zoom-in md:h-12 md:w-12"
            aria-label="תפריט נגישות, ניתן לגרור או להזיז עם מקשי החיצים"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
          >
            <Accessibility className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-3 rounded-[2rem] shadow-2xl border-none bg-white/95 backdrop-blur-xl text-right overflow-hidden">
          <div dir="rtl">
            <div className="absolute top-0 right-0 w-full h-12 bg-primary/5 -z-10" />
            <DropdownMenuLabel className="text-sm font-black uppercase text-primary flex items-center justify-between py-4 px-2">
              <span>הגדרות נגישות</span>
              <Accessibility className="w-4 h-4 text-accent" />
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-primary/5" />
            
            <div className="p-2 space-y-2">
               <div className="flex items-center justify-between p-2 rounded-xl hover:bg-primary/5 transition-colors">
                  <span className="text-xs font-bold text-primary">גודל טקסט</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="w-9 h-9 rounded-lg border-primary/10" onClick={() => setFontSize(prev => Math.max(prev - 10, 80))}><Minus className="w-4 h-4" /></Button>
                    <span className="text-[10px] font-black w-8 text-center">{fontSize}%</span>
                    <Button variant="outline" size="icon" className="w-9 h-9 rounded-lg border-primary/10" onClick={() => setFontSize(prev => Math.min(prev + 10, 150))}><Plus className="w-4 h-4" /></Button>
                  </div>
               </div>

               <AccessOption 
                 label="ניגודיות גבוהה" 
                 active={highContrast} 
                 onClick={() => setHighContrast(!highContrast)} 
                 icon={<Eye className="w-4 h-4" />} 
               />

               <AccessOption 
                 label="גווני אפור" 
                 active={grayscale} 
                 onClick={() => setGrayscale(!grayscale)} 
                 icon={<MousePointer2 className="w-4 h-4" />} 
               />

               <AccessOption 
                 label="פונט קריא (אסיסטנט)" 
                 active={readableFont} 
                 onClick={() => setReadableFont(!readableFont)} 
                 icon={<ALargeSmall className="w-4 h-4" />} 
               />

               <AccessOption 
                 label="הדגשת קישורים" 
                 active={highlightLinks} 
                 onClick={() => setHighlightLinks(!highlightLinks)} 
                 icon={<LinkIcon className="w-4 h-4" />} 
               />

               <Button 
                 variant="ghost" 
                 className="w-full justify-center gap-2 h-12 rounded-xl text-destructive hover:bg-destructive/5 font-black text-xs uppercase mt-2"
                 onClick={reset}
               >
                 <RotateCcw className="w-4 h-4" /> איפוס כל ההגדרות
               </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AccessOption({ label, active, onClick, icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-xl transition-all border-2",
        active ? "bg-primary text-white border-primary shadow-md" : "bg-white border-transparent hover:border-primary/10 text-primary"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-1.5 rounded-lg", active ? "bg-white/20" : "bg-primary/5")}>
          {icon}
        </div>
        <span className="text-xs font-bold">{label}</span>
      </div>
      <div className={cn("w-3.5 h-3.5 rounded-full border-2 transition-all", active ? "bg-accent border-white scale-110" : "border-primary/10")} />
    </button>
  );
}
