import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const appShell = readSource("components", "app-shell.tsx")
const settingsForm = readSource("components", "settings-form.tsx")
const overview = readSource("components", "study-overview.tsx")
const aiSettings = readSource("lib", "ai-settings.ts")

describe("mobile hierarchy and language", () => {
  it("does not repeat settings page titles inside redundant intro cards", () => {
    expect(settingsForm).not.toContain("function SectionIntro")
    expect(settingsForm).not.toContain("<SectionIntro")
  })

  it("gives the home wordmark stronger hierarchy", () => {
    expect(appShell).toContain('home ? "h-[80px]')
    expect(appShell).toContain('text-[25px] min-[390px]:text-[27px] sm:text-[29px]')
  })

  it("uses English copy for the primary study experience", () => {
    expect(overview).toContain("Today's study")
    expect(overview).toContain("Start studying")
    expect(overview).toContain("New note")
  })

  it("ships English default AI prompts", () => {
    expect(aiSettings).toContain("You help users create Anki vocabulary cards")
    expect(aiSettings).toContain("Generate {{count}} unique vocabulary cards")
  })
})
