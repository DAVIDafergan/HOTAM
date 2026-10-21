import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
        'flex min-h-28 w-full rounded-xl border border-input bg-card px-4 py-3 text-base leading-relaxed text-foreground ring-offset-background placeholder:text-muted-foreground/80 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
