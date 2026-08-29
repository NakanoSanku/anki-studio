import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const editor = readSource("components", "card-editor.tsx")
const studio = readSource("components", "studio.tsx")
const study = readSource("components", "study-overview.tsx")
const deck = readSource("lib", "deck.ts")
const fsrs = readSource("lib", "fsrs.ts")

describe("review approval gate contracts", () => {
  it("stores review approval in the card instead of relying on editor state", () => {
    expect(deck).toContain('reviewStatus?: CardReviewStatus')
    expect(editor).toContain("pushDeck(approveCard(deckRef.current, currentId))")
    expect(editor).toContain("pushDeck(markCardPending(deckRef.current, currentId))")
    expect(editor).toContain("deck.cards.filter(isCardApproved).length")
  })

  it("makes authored and AI-generated notes pending until review", () => {
    expect(editor).toContain("createPendingCard(current.fields)")
    expect(editor).toContain("generated.map((values) => createPendingCard(fields, values))")
    expect(studio).toContain("createPendingCard(deck.fields)")
    expect(deck).toContain('withCardReviewStatus({ ...item, values: { ...item.values, [field]: value } }, "pending")')
  })

  it("gates study and voice tutor to approved notes", () => {
    expect(fsrs).toContain("!isCardApproved(note) || isCardEmpty")
    expect(study).toContain("const studyDeck = approvedDeck(deck)")
    expect(study).toContain("<AiTutor deck={studyDeck}")
  })

  it("gates JSON, CSV, and APKG exports to approved notes", () => {
    expect(studio).toContain("const exportDeck = approvedDeck(deck)")
    expect(studio).toContain("deckToCsv(exportDeck)")
    expect(studio).toContain("serializeDeck(approvedDeck(deck))")
  })
})
