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
          className="fixed right-3 bottom-24 z-[70] flex max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-full bg-[#ffe39a] px-3.5 py-2.5 text-xs font-black tracking-tight text-[#654600] shadow-[0_18px_42px_-28px_rgba(0,0,0,0.8)] ring-1 ring-black/[0.04] dark:bg-[#68551f] dark:text-[#ffedb8] lg:bottom-4"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
            <CloudOff className="size-3.5" />
          </span>
          <span className="min-w-0 truncate">离线中 · 修改会安全保存在本机</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
