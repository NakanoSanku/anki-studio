import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-black tracking-tight whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white shadow-[0_8px_22px_-18px_rgba(0,0,0,0.78)] [a]:hover:bg-black/82 dark:bg-white dark:text-black dark:[a]:hover:bg-white/88",
        secondary:
          "bg-[#dff1ff] text-[#194f83] [a]:hover:bg-[#cfe6ff] dark:bg-[#244d74] dark:text-[#dceeff] dark:[a]:hover:bg-[#2b5a86]",
        destructive:
          "bg-[#ffd8df] text-[#761c31] focus-visible:ring-[#f59bab]/30 dark:bg-[#6a2835] dark:text-[#ffdce3] [a]:hover:bg-[#ffcad5] dark:[a]:hover:bg-[#74303e]",
        outline:
          "border-black/[0.07] bg-white/65 text-foreground shadow-[0_8px_22px_-20px_rgba(0,0,0,0.6)] [a]:hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.07] dark:[a]:hover:bg-white/[0.11]",
        ghost:
          "bg-black/[0.045] text-foreground/70 hover:bg-black/[0.075] hover:text-foreground dark:bg-white/[0.06] dark:hover:bg-white/[0.1]",
        link: "h-auto rounded-none px-0 text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
