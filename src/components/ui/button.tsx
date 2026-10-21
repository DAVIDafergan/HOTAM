import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Button system (luxury refresh): ink is the primary action, gold is reserved for the one
// accent CTA per view (`variant="gold"`), outline for secondary actions. No hover "jump" —
// a calm colour/shadow change reads more premium than movement.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-[15px] font-medium leading-none ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-lux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] active:duration-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_hsl(var(--shadow-color)/0.7)] hover:bg-primary/90",
        gold: "bg-gold-deep text-white shadow-[0_12px_28px_-16px_hsl(var(--gold-deep)/0.9)] hover:bg-[hsl(39_57%_31%)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-primary/20 bg-transparent text-primary hover:border-primary/45 hover:bg-card",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-primary hover:bg-primary/[0.06]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-base",
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
