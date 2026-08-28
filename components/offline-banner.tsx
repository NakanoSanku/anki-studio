"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CloudOff } from "lucide-react"

const BANNER_DURATION_S = 0.2

export function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const reducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  return (
    <AnimatePresence initial={false}>
      {!online ? (
        <motion.div
          role="status"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: BANNER_DURATION_S, ease: "easeOut" }}
          className="fixed right-3 bottom-24 z-[70] flex max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-[14px] border border-black/[0.07] bg-card/95 px-3.5 py-2.5 text-xs font-semibold tracking-tight text-foreground shadow-[0_16px_36px_-26px_rgba(0,0,0,0.55)] backdrop-blur-2xl dark:border-white/[0.1] lg:bottom-4"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-foreground text-background">
            <CloudOff className="size-3.5" />
          </span>
          <span className="min-w-0 truncate">Offline · changes are saved on this device</span>
          <span className="size-2 shrink-0 rounded-full bg-energy" aria-hidden="true" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
