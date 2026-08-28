import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const readComponent = (name: string) => readSource("components", name)

describe("hand-written motion wiring", () => {
  it("uses motion/react in the session, banner, and chrome indicators", () => {
    for (const file of ["study-session.tsx", "offline-banner.tsx", "app-shell.tsx"]) {
      expect(readComponent(file)).toContain('from "motion/react"')
    }
  })

  it("keeps the offline banner's status role", () => {
    expect(readComponent("offline-banner.tsx")).toContain('role="status"')
    expect(readComponent("offline-banner.tsx")).toContain("AnimatePresence")
  })

  it("pairs `/` and `/study` with the same shared-element stage", () => {
    const overview = readComponent("study-overview.tsx")
    const session = readComponent("study-session.tsx")
    const stage = readComponent("study-stage.tsx")
    expect(overview).toContain("StudyStage")
    expect(session).toContain("StudyStage")
    expect(stage).toContain("STUDY_STAGE_NAME")
    expect(stage).toContain("ViewTransition")
    expect(stage).toContain('share: "morph"')
  })

  it("tags only the home ↔ session navigations", () => {
    const studio = readComponent("studio.tsx")
    expect(studio).toContain("studyPairTransitionTypes")
    expect(studio).toContain("transitionTypes")
  })
})
