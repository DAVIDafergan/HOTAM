import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold tracking-tight ring-offset-background shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_14px_30px_-16px_rgba(15,23,42,0.62)] hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-[0_22px_42px_-20px_rgba(15,23,42,0.65)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_14px_28px_-16px_rgba(127,29,29,0.52)] hover:-translate-y-0.5 hover:bg-destructive/95 hover:shadow-[0_22px_38px_-18px_rgba(127,29,29,0.62)]",
        outline:
          "border-input/85 bg-background/95 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.42)] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/50 hover:text-accent-foreground hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,0.5)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/90",
        ghost: "hover:-translate-y-0.5 hover:bg-accent/65 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 py-2.5",
        sm: "h-10 px-4",
        lg: "h-14 px-10",
        icon: "h-11 w-11",
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
