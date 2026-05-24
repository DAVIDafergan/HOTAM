import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-semibold tracking-tight ring-offset-background shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_26px_-14px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_18px_34px_-16px_rgba(15,23,42,0.6)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_26px_-14px_rgba(127,29,29,0.45)] hover:-translate-y-0.5 hover:bg-destructive/92 hover:shadow-[0_18px_34px_-16px_rgba(127,29,29,0.55)]",
        outline:
          "border-input/80 bg-background/95 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.4)] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/45 hover:text-accent-foreground hover:shadow-[0_14px_28px_-18px_rgba(15,23,42,0.45)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/88",
        ghost: "hover:-translate-y-0.5 hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-10 px-4",
        lg: "h-12 px-9",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
