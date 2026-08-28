import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const source = readSource("components", "study-session.tsx")

describe("study session header chrome", () => {
  it("keeps exit, one progress indicator, and a back-side-only edit action", () => {
    expect(source).toContain('aria-label="Exit study"')
    expect(source.match(/aria-label=\{`Completed \$\{completed\} of \$\{total\} cards`\}/g)).toHaveLength(1)
    expect(source).toContain('aria-label="Edit note"')
    expect(source).toContain("canEdit={revealed}")
    expect(source).toContain("{canEdit ? (")
  })

  it("does not ship duplicate session detail or fullscreen controls", () => {
    expect(source).not.toContain("requestFullscreen")
    expect(source).not.toContain("sm:hidden")
  })

  it("drives card faces with motion/react instead of tw-animate utilities", () => {
    expect(source).toContain('from "motion/react"')
    expect(source).toContain("cardMotionPose")
    expect(source).toContain("data-card-motion")
    expect(source).not.toContain("motion-safe:animate-in")
  })
})
