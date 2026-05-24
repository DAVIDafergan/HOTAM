'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type CitySelectProps = {
  value: string;
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
};

export function CitySelect({
  value,
  options,
  placeholder = 'בחר עיר',
  emptyLabel = 'לא נמצאו ערים תואמות',
  onChange,
  className,
  triggerClassName,
}: CitySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-11 w-full justify-between rounded-2xl border border-primary/10 bg-white px-4 text-right font-bold text-xs hover:bg-white',
            triggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate">{value || placeholder}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-primary/40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[min(24rem,calc(100vw-2rem))] rounded-[1.5rem] border border-primary/10 bg-white p-3 shadow-2xl', className)} align="end" dir="rtl">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/30" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="חיפוש עיר..."
              className="h-11 rounded-2xl border-primary/10 pr-10 text-right font-medium"
            />
          </div>

          <ScrollArea className="h-64 rounded-2xl border border-primary/5">
            <div className="space-y-1 p-1">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-right text-sm font-bold text-primary/70 transition-colors hover:bg-primary/5"
              >
                <span>{placeholder}</span>
                {!value && <Check className="h-4 w-4 text-accent" />}
              </button>

              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm font-medium text-primary/45">{emptyLabel}</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-right text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                  >
                    <span>{option}</span>
                    <Check className={cn('h-4 w-4 text-accent', value === option ? 'opacity-100' : 'opacity-0')} />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
