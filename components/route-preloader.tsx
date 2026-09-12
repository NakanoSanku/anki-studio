"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { PATHS, homeTabRedirect } from "@/lib/app-paths"

const warmups = new Map<string, Promise<unknown>>()
const prefetchedRoutes = new Set<string>()

function cachedWarmup(key: string, loader: () => Promise<unknown>): Promise<unknown> {
  const existing = warmups.get(key)
  if (existing) return existing
  const pending = loader().catch((error) => {
    warmups.delete(key)
    throw error
  })
  warmups.set(key, pending)
  return pending
}

function warmRoute(pathname: string): Promise<unknown> | null {
  if (pathname === PATHS.notes || pathname.startsWith(`${PATHS.notes}/`)) {
    return cachedWarmup("notes", () => import("@/components/card-editor"))
  }
  if (pathname === PATHS.studyStats) {
    return cachedWarmup("study-stats", () => import("@/components/study-analytics"))
  }
  if (pathname === PATHS.studySession) {
    return cachedWarmup("study-session", () => import("@/components/study-session"))
  }
  if (pathname === PATHS.settings) {
    return cachedWarmup("settings-overview", () => import("@/components/settings-overview"))
  }
  if (pathname === PATHS.settingsTemplates || pathname === PATHS.settingsTemplatesLegacy) {
    return cachedWarmup("template-editor", () => import("@/components/template-editor"))
  }
  if (pathname === PATHS.settingsDeck) {
    return cachedWarmup("settings-deck", () =>
      Promise.all([
        import("@/components/settings-form"),
        import("@/components/deck-tools-panel"),
      ])
    )
  }
  if (
    pathname === PATHS.settingsStudy ||
    pathname === PATHS.settingsAi ||
    pathname === PATHS.settingsSync ||
    pathname === PATHS.settingsMedia
  ) {
    return cachedWarmup("settings-form", () => import("@/components/settings-form"))
  }
  return null
}

function warmWithoutWaiting(promise: Promise<unknown> | null) {
  if (!promise) return
  void promise.catch(() => undefined)
}

export function RoutePreloader() {
  const router = useRouter()
  const pathname = usePathname() ?? PATHS.home

  useEffect(() => {
    if (pathname !== PATHS.home) return
    const destination = homeTabRedirect(new URLSearchParams(window.location.search).get("tab"))
    if (destination) router.replace(destination)
  }, [pathname, router])

  useEffect(() => {
    const warmAnchor = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>("a[href]")
      if (!anchor) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === pathname || prefetchedRoutes.has(url.pathname)) return
      prefetchedRoutes.add(url.pathname)
      router.prefetch(url.pathname)
      warmWithoutWaiting(warmRoute(url.pathname))
    }

    document.addEventListener("pointerover", warmAnchor, { passive: true })
    document.addEventListener("pointerdown", warmAnchor, { passive: true })
    document.addEventListener("focusin", warmAnchor)

    return () => {
      document.removeEventListener("pointerover", warmAnchor)
      document.removeEventListener("pointerdown", warmAnchor)
      document.removeEventListener("focusin", warmAnchor)
    }
  }, [pathname, router])

  return null
}
