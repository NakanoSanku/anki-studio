import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[22px] border border-black/[0.06] bg-card px-3.5 py-3 text-base shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring/45 focus-visible:ring-3 focus-visible:ring-ring/18 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-white/[0.08] dark:bg-input/25 dark:disabled:bg-input/70 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
