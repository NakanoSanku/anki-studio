"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

export function AppAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    let active = true
    let checking = false
    const verify = async () => {
      if (!active || checking || !navigator.onLine) return
      checking = true
      try {
        const response = await fetch("/api/auth/access", { cache: "no-store" })
        if (!active) return
        if (response.status === 401 || response.status === 403) {
          router.replace("/login?error=AccessDenied")
        } else if (response.status === 503) {
          router.replace("/login?error=Configuration")
        }
      } catch {
        // Keep an already-authorized tab usable while temporarily offline.
      } finally {
        checking = false
      }
    }
    const onVisibility = () => { if (document.visibilityState === "visible") void verify() }
    window.addEventListener("focus", onVisibility)
    window.addEventListener("online", verify)
    document.addEventListener("visibilitychange", onVisibility)
    const interval = window.setInterval(verify, 60_000)
    return () => {
      active = false
      window.removeEventListener("focus", onVisibility)
      window.removeEventListener("online", verify)
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(interval)
    }
  }, [router])

  return children
}
