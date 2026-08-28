import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const globals = readSource("app", "globals.css")
const appShell = readSource("components", "app-shell.tsx")
const studyOverview = readSource("components", "study-overview.tsx")
const settingsOverview = readSource("components", "settings-overview.tsx")

describe("editorial calm-momentum design", () => {
  it("uses one restrained signal accent on top of neutral surfaces", () => {
    expect(globals).toContain("--color-signal: var(--signal)")
    expect(globals).toContain("--signal: oklch(0.72 0.17 264)")
    expect(globals).toContain("--energy: var(--signal)")
    expect(globals).toContain("border: 1px solid color-mix(in oklab, var(--foreground) 7%, transparent)")
  })

  it("keeps primary navigation light instead of using a black active tile", () => {
    expect(appShell).toContain('selected\n                        ? "bg-accent text-foreground"')
    expect(appShell).toContain('selected && "text-signal"')
    expect(appShell).not.toContain('selected\n                        ? "bg-foreground text-background"')
  })

  it("keeps Study and Settings content-led rather than decorative", () => {
    expect(studyOverview).toContain("Focus on what’s due.")
    expect(studyOverview).toContain("border border-foreground/[0.07] bg-card/94")
    expect(studyOverview).not.toContain("rounded-[28px] bg-foreground text-background")
    expect(settingsOverview).toContain("Make the system yours.")
    expect(settingsOverview).toContain("bg-card/84")
  })
})
