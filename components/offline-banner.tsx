"use client"

import { useEffect, useState } from "react"
import { CloudOff } from "lucide-react"

export function OfflineBanner() {
  const [online, setOnline] = useState(true)

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

  if (online) return null

  return (
    <div
      role="status"
      className="fixed right-3 bottom-20 z-[70] flex items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 lg:bottom-4"
    >
      <CloudOff className="size-4" />
      离线模式 · 修改会保存在本机
    </div>
  )
}
