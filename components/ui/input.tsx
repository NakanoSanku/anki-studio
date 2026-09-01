import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, value, onChange, onBlur, onKeyDown, id, ...props }: React.ComponentProps<"input">) {
  const deferCardFieldCommit = typeof id === "string" && id.startsWith("field-") && value !== undefined
  const [draft, setDraft] = React.useState(value)
  const focusedRef = React.useRef(false)

  React.useEffect(() => {
    if (!deferCardFieldCommit || focusedRef.current) return
    setDraft(value)
  }, [deferCardFieldCommit, value])

  const commitDraft = (element: HTMLInputElement) => {
    if (!deferCardFieldCommit || !onChange || draft === value) return
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
    descriptor?.set?.call(element, draft ?? "")
    element.dispatchEvent(new Event("input", { bubbles: true }))
    setDraft(value)
  }

  return (
    <input
      id={id}
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[14px] border border-black/[0.075] bg-card px-3.5 py-2 text-base shadow-none transition-[border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground focus-visible:border-foreground/35 focus-visible:ring-3 focus-visible:ring-energy/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-sm dark:border-white/[0.1] dark:bg-input/22 dark:disabled:bg-input/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
      value={deferCardFieldCommit ? draft : value}
      onFocus={(event) => {
        focusedRef.current = true
        props.onFocus?.(event)
      }}
      onChange={(event) => {
        if (deferCardFieldCommit) {
          setDraft(event.target.value)
          return
        }
        onChange?.(event)
      }}
      onBlur={(event) => {
        focusedRef.current = false
        if (deferCardFieldCommit) {
          commitDraft(event.currentTarget)
        }
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (deferCardFieldCommit && event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}

export { Input }
