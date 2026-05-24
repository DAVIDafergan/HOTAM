import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
      "flex h-12 w-full rounded-xl border border-input/80 bg-background/95 px-4 py-2.5 text-sm ring-offset-background shadow-[0_8px_20px_-14px_rgba(15,23,42,0.46)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/75 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/75 focus-visible:ring-offset-2 focus-visible:border-primary/40 focus-visible:shadow-[0_16px_30px_-20px_rgba(15,23,42,0.62)] hover:border-primary/30 hover:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.5)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
