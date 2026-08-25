import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const dir = dirname(fileURLToPath(import.meta.url))
const read = (name: string) => readFileSync(join(dir, name), "utf8")

describe("hand-written motion wiring", () => {
  it("uses motion/react in the session, banner, and chrome indicators", () => {
    for (const file of ["study-session.tsx", "offline-banner.tsx", "app-shell.tsx"]) {
      expect(read(file)).toContain('from "motion/react"')
    }
  })

  it("keeps the offline banner's status role", () => {
    expect(read("offline-banner.tsx")).toContain('role="status"')
    expect(read("offline-banner.tsx")).toContain("AnimatePresence")
  })

  it("pairs `/` and `/study` with the same shared-element stage", () => {
    const overview = read("study-overview.tsx")
    const session = read("study-session.tsx")
    const stage = read("study-stage.tsx")
    expect(overview).toContain("StudyStage")
    expect(session).toContain("StudyStage")
    expect(stage).toContain("STUDY_STAGE_NAME")
    expect(stage).toContain("ViewTransition")
    expect(stage).toContain('share: "morph"')
  })

  it("tags only the home ↔ session navigations", () => {
    const studio = read("studio.tsx")
    expect(studio).toContain("studyPairTransitionTypes")
    expect(studio).toContain("transitionTypes")
  })
})
