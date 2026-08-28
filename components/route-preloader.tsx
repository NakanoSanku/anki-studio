"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { PATHS, homeTabRedirect } from "@/lib/app-paths"

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

const warmups = new Map<string, Promise<unknown>>()

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
  if (pathname === PATHS.studySession || pathname.startsWith(`${PATHS.studySession}/`)) {
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
    pathname === PATHS.settingsSync
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
    const primaryRoutes = [PATHS.home, PATHS.notes, PATHS.settings, PATHS.studySession]
    for (const route of primaryRoutes) router.prefetch(route)

    // Start fetching the three latency-sensitive workspaces immediately after paint.
    // They remain split from the initial Studio bundle, but are normally resident
    // before the user taps the primary navigation.
    warmWithoutWaiting(warmRoute(PATHS.notes))
    warmWithoutWaiting(warmRoute(PATHS.settings))
    warmWithoutWaiting(warmRoute(PATHS.studySession))

    const idleWindow = window as IdleWindow
    const warmSettings = () => {
      router.prefetch(PATHS.settingsDeck)
      router.prefetch(PATHS.settingsStudy)
      router.prefetch(PATHS.settingsAi)
      router.prefetch(PATHS.settingsSync)
      warmWithoutWaiting(warmRoute(PATHS.settingsStudy))
      warmWithoutWaiting(warmRoute(PATHS.settingsDeck))
    }

    let idleHandle: number | null = null
    let timeoutHandle: number | null = null
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(warmSettings, { timeout: 1600 })
    } else {
      timeoutHandle = window.setTimeout(warmSettings, 700)
    }

    const warmAnchor = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest<HTMLAnchorElement>("a[href]")
      if (!anchor) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      router.prefetch(url.pathname)
      warmWithoutWaiting(warmRoute(url.pathname))
    }

    document.addEventListener("pointerover", warmAnchor, { passive: true })
    document.addEventListener("pointerdown", warmAnchor, { passive: true })
    document.addEventListener("focusin", warmAnchor)

    return () => {
      if (idleHandle != null) idleWindow.cancelIdleCallback?.(idleHandle)
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle)
      document.removeEventListener("pointerover", warmAnchor)
      document.removeEventListener("pointerdown", warmAnchor)
      document.removeEventListener("focusin", warmAnchor)
    }
  }, [router])

  return null
}
