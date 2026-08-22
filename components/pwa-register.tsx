"use client"

import { useEffect } from "react"

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async () => {
      const registration = await navigator.serviceWorker.ready
      const urls = performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name))
        .filter((url) => url.origin === window.location.origin && url.pathname.startsWith("/_next/static/"))
        .map((url) => `${url.pathname}${url.search}`)

      registration.active?.postMessage({ type: "CACHE_URLS", urls })
    }).catch(() => {
      // Offline support is an enhancement; IndexedDB editing still works if registration fails.
    })
  }, [])

  return null
}
