import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const componentsRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(componentsRoot, "..")
const appLayout = readFileSync(join(repoRoot, "app", "(app)", "layout.tsx"), "utf8")
const homePage = readFileSync(join(repoRoot, "app", "(app)", "page.tsx"), "utf8")
const preloader = readFileSync(join(componentsRoot, "route-preloader.tsx"), "utf8")

describe("primary navigation performance", () => {
  it("keeps the app shell routes statically navigable", () => {
    expect(appLayout).not.toContain('dynamic = "force-dynamic"')
    expect(appLayout).toContain("<RoutePreloader />")
    expect(homePage).not.toContain("searchParams")
    expect(homePage).not.toContain("redirect(")
  })

  it("warms primary route payloads and split chunks before click", () => {
    expect(preloader).toContain(
      "const primaryRoutes = [PATHS.home, PATHS.notes, PATHS.settings, PATHS.studySession]"
    )
    expect(preloader).toContain("for (const route of primaryRoutes) router.prefetch(route)")
    expect(preloader).toContain("warmWithoutWaiting(warmRoute(PATHS.notes))")
    expect(preloader).toContain("warmWithoutWaiting(warmRoute(PATHS.settings))")
    expect(preloader).toContain("warmWithoutWaiting(warmRoute(PATHS.studySession))")
    expect(preloader).toContain('import("@/components/card-editor")')
    expect(preloader).toContain('import("@/components/settings-overview")')
    expect(preloader).toContain('import("@/components/study-session")')
    expect(preloader).toContain('document.addEventListener("pointerdown", warmAnchor')
  })
})
