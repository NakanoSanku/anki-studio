import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const source = readSource("components", "study-session.tsx")

describe("study session header chrome", () => {
  it("keeps exit, one progress indicator, and an always-visible edit action", () => {
    expect(source).toContain('aria-label="Exit study"')
    expect(source.match(/aria-label=\{`Completed \$\{completed\} of \$\{total\} cards`\}/g)).toHaveLength(1)
    expect(source).toContain('aria-label="Edit note"')
    expect(source).not.toContain("canEdit={revealed}")
    expect(source).not.toContain("{canEdit ? (")
  })

  it("does not ship duplicate session detail or fullscreen controls", () => {
    expect(source).not.toContain("requestFullscreen")
    expect(source).not.toContain("sm:hidden")
  })

  it("uses a short cross-fade for card faces instead of the old pop-layout slide", () => {
    expect(source).toContain('from "motion/react"')
    expect(source).toContain("cardMotionPose")
    expect(source).toContain('mode="sync"')
    expect(source).toContain("data-card-motion")
    expect(source).not.toContain('mode="popLayout"')
  })

  it("renders TTS controls at the template field position inside the card iframe", () => {
    expect(source).toContain("data-study-tts")
    expect(source).toContain('sandbox="allow-same-origin"')
    expect(source).toContain("getTtsClip")
    expect(source).toContain("playTtsAudio")
    expect(source).not.toContain("<TtsPlayButton")
    expect(source).not.toContain("ttsFieldsOnSide")
  })
})
