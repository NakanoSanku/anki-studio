import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 min-w-0 w-full max-w-full resize-y rounded-[16px] border border-black/[0.075] bg-card px-3.5 py-3 text-base shadow-none transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-foreground/35 focus-visible:ring-3 focus-visible:ring-energy/30 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-sm dark:border-white/[0.1] dark:bg-input/22 dark:disabled:bg-input/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
