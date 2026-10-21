"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/**
 * Tab list with a sliding indicator: one pill glides (transform + size, ease-lux) to the
 * active trigger instead of the background jumping between tabs. Until it has measured the
 * active tab (and without JS) the trigger's own active background is shown, so there is
 * never a frame without a highlighted tab. `indicatorClassName` styles the pill (defaults
 * to the card surface); globals.css hides the trigger background once `data-tabs-ready`.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { indicatorClassName?: string }
>(({ className, indicatorClassName, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const indicatorRef = React.useRef<HTMLSpanElement | null>(null)
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref]
  )

  React.useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    let first = true
    const place = () => {
      const active = list.querySelector<HTMLElement>(':scope > [role="tab"][data-state="active"]')
      if (!active || active.offsetWidth === 0) {
        indicator.style.opacity = "0"
        list.removeAttribute("data-tabs-ready")
        return
      }
      indicator.style.transition = first ? "none" : ""
      indicator.style.width = `${active.offsetWidth}px`
      indicator.style.height = `${active.offsetHeight}px`
      indicator.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`
      indicator.style.opacity = "1"
      list.setAttribute("data-tabs-ready", "")
      first = false
    }
    place()
    const mo = new MutationObserver(place)
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] })
    const ro = new ResizeObserver(place)
    ro.observe(list)
    list.querySelectorAll(':scope > [role="tab"]').forEach((t) => ro.observe(t))
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "relative isolate inline-flex h-12 items-center justify-center gap-1 rounded-full border border-border/70 bg-secondary/60 p-1 text-muted-foreground",
        className
      )}
      {...props}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-0 -z-10 rounded-full bg-card opacity-0 shadow-sm transition-[transform,width,height,opacity] duration-500 ease-lux motion-reduce:transition-none",
          indicatorClassName
        )}
      />
      {children}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-medium ring-offset-background transition-[color,background-color,box-shadow] duration-300 ease-lux hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
