import { describe, expect, it } from "vitest"

import { readSource, sourceExists } from "../helpers/source"

const appLayout = readSource("app", "(app)", "layout.tsx")
const homePage = readSource("app", "(app)", "page.tsx")
const nextConfig = readSource("next.config.ts")
const preloader = readSource("components", "route-preloader.tsx")
const studyOverview = readSource("components", "study-overview.tsx")

describe("primary navigation performance", () => {
  it("keeps the app shell routes statically navigable", () => {
    expect(appLayout).not.toContain('dynamic = "force-dynamic"')
    expect(appLayout).toContain("<RoutePreloader />")
    expect(homePage).not.toContain("searchParams")
    expect(homePage).not.toContain("redirect(")
    expect(sourceExists("app", "(app)", "notes", "[id]", "page.tsx")).toBe(false)
    expect(nextConfig).toContain('{ source: "/notes/:id", destination: "/notes" }')
  })

  it("warms primary route payloads and split chunks before click", () => {
    expect(preloader).toContain(
      "const primaryRoutes = [PATHS.home, PATHS.notes, PATHS.settings, PATHS.studySession]"
    )
    expect(preloader).toContain("for (const route of primaryRoutes) router.prefetch(route)")
    expect(preloader).toContain("const eagerStudyWarmup")
    expect(preloader).toContain("warmWithoutWaiting(warmRoute(PATHS.notes))")
    expect(preloader).toContain("warmWithoutWaiting(warmRoute(PATHS.settings))")
    expect(preloader).toContain("warmWithoutWaiting(warmRoute(PATHS.studySession))")
    expect(preloader).toContain('import("@/components/card-editor")')
    expect(preloader).toContain('import("@/components/settings-overview")')
    expect(preloader).toContain('import("@/components/study-session")')
    expect(preloader).toContain('document.addEventListener("pointerdown", warmAnchor')
  })

  it("enters Study through the native History API instead of waiting on an RSC navigation", () => {
    expect(studyOverview).toContain('window.history.pushState(null, "", PATHS.studySession)')
    expect(studyOverview).toContain("onClick={startStudy}")
  })
})
