import { describe, expect, it } from "vitest"

import { PATHS } from "@/lib/app-paths"
import { STUDY_STAGE_NAME, studyPairTransitionTypes } from "@/lib/study-transition"

describe("studyPairTransitionTypes", () => {
  it("tags home → session as forward and session → home as back", () => {
    const forward = studyPairTransitionTypes(PATHS.home, PATHS.studySession)
    const back = studyPairTransitionTypes(PATHS.studySession, PATHS.home)
    expect(forward).toBeDefined()
    expect(back).toBeDefined()
    expect(forward).not.toEqual(back)
    expect(forward![0]).toContain("forward")
    expect(back![0]).toContain("back")
  })

  it("does not tag any other route pair", () => {
    expect(studyPairTransitionTypes(PATHS.home, PATHS.notes)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.notes, PATHS.studySession)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.settings, PATHS.home)).toBeUndefined()
    expect(studyPairTransitionTypes(PATHS.studySession, PATHS.notes)).toBeUndefined()
  })

  it("exports a stable shared-element name", () => {
    expect(STUDY_STAGE_NAME.length).toBeGreaterThan(0)
    expect(STUDY_STAGE_NAME).not.toContain(" ")
  })
})
