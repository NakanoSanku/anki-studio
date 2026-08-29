import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const overview = readSource("components", "study-overview.tsx")

describe("home dashboard", () => {
  it("fits the primary home content inside the viewport above the tab bar", () => {
    expect(overview).toContain("h-[calc(100dvh-12.75rem)]")
    expect(overview).toContain("min-[390px]:h-[calc(100dvh-13rem)]")
    expect(overview).toContain("sm:h-[calc(100dvh-14rem)]")
    expect(overview).toContain("overflow-hidden")
  })

  it("keeps one study summary and removes repeated dashboard cards", () => {
    expect(overview).toContain('>Ready</p>')
    expect(overview).toContain("Start studying")
    expect(overview).not.toContain("Today’s study")
    expect(overview).not.toContain("Current deck")
    expect(overview).not.toContain("Practice with your deck")
    expect(overview).not.toContain("Less friction. One clear rhythm.")
    expect(overview).not.toContain("progress}%")
  })

  it("keeps secondary actions compact and approval-aware", () => {
    expect(overview).toContain("Voice tutor")
    expect(overview).toContain("New note")
    expect(overview).toContain("approvedDeck(deck)")
    expect(overview).toContain("waiting for approval")
  })
})
