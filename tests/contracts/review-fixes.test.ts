import { describe, expect, it } from "vitest"

import { readSource } from "./ui/helpers/source"

const sheets = readSource("lib", "google-sheets-sync.ts")
const syncServer = readSource("lib", "sync-server.ts")
const studio = readSource("components", "studio.tsx")
const home = readSource("components", "study-overview.tsx")

describe("code review fixes", () => {
  it("returns Google Sheets additions and edits to pending review", () => {
    expect(sheets).toContain("createPendingCard")
    expect(sheets).toContain("const changed = !current ||")
    expect(sheets).toContain('reviewStatus: "pending"')
    expect(sheets).not.toContain("const card = current ?? createCard(deck.fields)")
  })

  it("keeps JSON as a full project backup while published exports stay approval-gated", () => {
    expect(studio).toContain('new Blob([serializeDeck(deck)], { type: "application/json" })')
    expect(studio).toContain("const exportDeck = approvedDeck(deck)")
    expect(studio).toContain("deckToCsv(exportDeck)")
    expect(studio).toContain("serializeDeck(approvedDeck(deck))")
  })

  it("keeps sync errors English while retaining the legacy preview header", () => {
    expect(sheets.replace('"序号"', "")).not.toMatch(/[\u3400-\u9fff]/)
    expect(syncServer).not.toMatch(/[\u3400-\u9fff]/)
  })

  it("does not pluralize the invariant done label", () => {
    expect(home).toContain('`${stats.reviewedToday} done`')
    expect(home).not.toContain('countLabel(stats.reviewedToday, "done")')
  })
})
