import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 touch-manipulation items-center justify-center rounded-[12px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform,box-shadow] duration-150 outline-none select-none [-webkit-tap-highlight-color:transparent] focus-visible:border-signal/45 focus-visible:ring-3 focus-visible:ring-signal/16 active:not-aria-[haspopup]:scale-[0.99] disabled:pointer-events-none disabled:opacity-42 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_20px_-18px_rgba(15,23,42,0.72)] hover:bg-primary/92 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.62)]",
        outline:
          "border-foreground/[0.085] bg-card/86 text-foreground shadow-none backdrop-blur-xl hover:border-foreground/[0.14] hover:bg-card aria-expanded:bg-muted aria-expanded:text-foreground dark:border-white/[0.11] dark:bg-card/80 dark:hover:border-white/[0.17] dark:hover:bg-muted/78",
        secondary:
          "bg-accent text-accent-foreground shadow-none hover:bg-accent/82 aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "text-foreground/72 hover:bg-foreground/[0.05] hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-white/[0.07]",
        destructive:
          "bg-destructive/9 text-destructive hover:bg-destructive/15 focus-visible:border-destructive/35 focus-visible:ring-destructive/15 dark:bg-destructive/17 dark:hover:bg-destructive/25 dark:focus-visible:ring-destructive/30",
        link: "rounded-none text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1 rounded-[9px] px-2.5 text-xs in-data-[slot=button-group]:rounded-[9px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[10px] px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-[10px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-1.5 rounded-[14px] px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10 rounded-[12px]",
        "icon-xs": "size-7 rounded-[9px] in-data-[slot=button-group]:rounded-[9px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[10px] in-data-[slot=button-group]:rounded-[10px]",
        "icon-lg": "size-11 rounded-[13px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
