import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
      "flex h-12 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 transition-[border-color,box-shadow] duration-200 hover:border-primary/35 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
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
