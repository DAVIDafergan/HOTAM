
"use client";

import React, { useState, useEffect } from 'react';
import { 
  Accessibility, 
  Type, 
  Sun, 
  Moon, 
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

export function AccessibilityButton() {
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [readableFont, setReadableFont] = useState(false);
  const [highlightLinks, setHighlightLinks] = useState(false);

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

  const reset = () => {
    setFontSize(100);
    setHighContrast(false);
    setGrayscale(false);
    setReadableFont(false);
    setHighlightLinks(false);
  };

  return (
    <div className="fixed left-6 bottom-6 z-[200]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="icon" 
            className="w-14 h-14 rounded-full bg-primary text-white shadow-2xl hover:scale-110 transition-all border-4 border-white/20 animate-in fade-in zoom-in"
            aria-label="תפריט נגישות"
          >
            <Accessibility className="w-7 h-7" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-3 rounded-[2rem] shadow-2xl border-none bg-white/95 backdrop-blur-xl text-right overflow-hidden" dir="rtl">
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
