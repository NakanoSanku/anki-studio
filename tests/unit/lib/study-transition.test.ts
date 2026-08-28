import { describe, expect, it } from "vitest"

import { PATHS } from "@/lib/app-paths"
import { STUDY_STAGE_NAME, studyPairTransitionTypes } from "@/lib/study-transition"

describe("studyPairTransitionTypes", () => {
  it("keeps Home ↔ Study untyped so navigation does not wait on a route morph", () => {
    expect(studyPairTransitionTypes(PATHS.home, PATHS.studySession)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.studySession, PATHS.home)).toBeUndefined()
  })

  it("does not tag any other route pair", () => {
    expect(studyPairTransitionTypes(PATHS.home, PATHS.notes)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.notes, PATHS.studySession)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.settings, PATHS.home)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.studySession, PATHS.notes)).toBeUndefined()
  })

  it("keeps the legacy shared-element name stable for compatibility", () => {
    expect(STUDY_STAGE_NAME.length).toBeGreaterThan(0)
    expect(STUDY_STAGE_NAME).not.toContain(" ")
  })
})
