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

  it("keeps the StudyStage wrapper inert so route entry does not wait on a morph", () => {
    const overview = readComponent("study-overview.tsx")
    const session = readComponent("study-session.tsx")
    const stage = readComponent("study-stage.tsx")
    expect(overview).toContain("StudyStage")
    expect(session).toContain("StudyStage")
    expect(stage).not.toContain("ViewTransition")
    expect(stage).not.toContain('share: "morph"')
    expect(stage).toContain("return children")
  })

  it("keeps the existing router call shape while disabling Study transition types", () => {
    const studio = readComponent("studio.tsx")
    const transition = readSource("lib", "study-transition.ts")
    expect(studio).toContain("studyPairTransitionTypes")
    expect(studio).toContain("transitionTypes")
    expect(transition).toContain("return undefined")
  })
})
