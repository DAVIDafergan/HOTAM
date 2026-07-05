import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
        'flex min-h-24 w-full rounded-lg border border-input/75 bg-background/95 px-3.5 py-2.5 text-base sm:text-sm ring-offset-background shadow-[0_4px_14px_-10px_rgba(15,23,42,0.5)] placeholder:text-muted-foreground/75 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-2 focus-visible:border-primary/35 focus-visible:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.7)] hover:border-primary/25 disabled:cursor-not-allowed disabled:opacity-50',
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
