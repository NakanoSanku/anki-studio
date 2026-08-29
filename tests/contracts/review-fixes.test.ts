import { describe, expect, it } from "vitest"

import { readSource } from "./helpers/source"

const sheets = readSource("lib", "google-sheets-sync.ts")
const syncServer = readSource("lib", "sync-server.ts")
const syncPayload = readSource("lib", "sync-payload.ts")
const syncClient = readSource("lib", "sync-client.ts")
const syncErrors = readSource("lib", "sync-errors.ts")
const studio = readSource("components", "studio.tsx")
const home = readSource("components", "study-overview.tsx")
const readme = readSource("README.md")
const routes = [
  readSource("app", "api", "sync", "route.ts"),
  readSource("app", "api", "sync", "status", "route.ts"),
  readSource("app", "api", "sync", "sheets", "route.ts"),
  readSource("app", "api", "sync", "decks", "[id]", "route.ts"),
  readSource("app", "api", "google-sheets", "connect", "route.ts"),
  readSource("app", "api", "google-sheets", "create", "route.ts"),
  readSource("app", "api", "google-sheets", "list", "route.ts"),
]

describe("code review fixes", () => {
  it("returns Google Sheets additions and edits to pending review", () => {
    expect(sheets).toContain("createPendingCard")
    expect(sheets).toContain("const changed = !current ||")
    expect(sheets).toContain('reviewStatus: "pending"')
  })

  it("does not silently swallow authoritative preview parse failures", () => {
    expect(sheets).toContain("previewResultsByDeck")
    expect(sheets).toContain("if (taggedResult?.error) throw taggedResult.error")
    expect(sheets).toContain("if (parseError) throw parseError")
  })

  it("sizes preview reads from the actual field count", () => {
    expect(sheets).toContain('return `A1:${columnName(deck.fields.length + 1)}`')
    expect(sheets).not.toContain('PREVIEW_READ_RANGE = "A1:Z"')
  })

  it("keeps JSON as a full project backup while published exports stay approval-gated", () => {
    expect(studio).toContain('new Blob([serializeDeck(deck)], { type: "application/json" })')
    expect(studio).toContain("deckToCsv(exportDeck)")
    expect(studio).toContain("serializeDeck(approvedDeck(deck))")
  })

  it("uses typed sync request errors instead of language-dependent status inference", () => {
    expect(syncErrors).toContain("class SyncRequestError")
    expect(syncServer).toContain("error instanceof SyncRequestError")
    expect(syncPayload).toContain('"missing_deck_content"')
  })

  it("keeps sync user-facing boundaries in English", () => {
    const combined = [syncPayload, syncClient, ...routes].join("\n")
    expect(combined).not.toMatch(/[\u3400-\u9fff]/)
    expect(sheets.replace('"序号"', "")).not.toMatch(/[\u3400-\u9fff]/)
  })

  it("does not pluralize the invariant done label", () => {
    expect(home).toContain('${stats.reviewedToday} done')
    expect(home).not.toContain('countLabel(stats.reviewedToday, "done")')
  })

  it("documents payload compaction instead of retained revision history", () => {
    expect(readme).toContain("old payload revisions are compacted after a successful write")
    expect(readme).not.toContain("full deck state and revision history")
  })
})
