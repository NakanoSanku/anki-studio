import { describe, expect, it } from "vitest"

import { createCard } from "./deck"
import {
  defaultEditorState,
  markReviewed,
  markUnreviewed,
  matchesReviewFilter,
  parseEditorState,
  pruneEditorState,
} from "./editor-state"

const fields = ["Word", "Translation"]
const cards = [
  createCard(fields, { Word: "alpha" }),
  createCard(fields, { Word: "beta" }),
  createCard(fields, { Word: "gamma" }),
]

describe("parseEditorState", () => {
  it("restores a still-valid cursor", () => {
    const state = parseEditorState(
      JSON.stringify({ selectedId: cards[1]!.id, reviewed: [cards[0]!.id], flagged: [cards[2]!.id] }),
      { cards }
    )
    expect(state.selectedId).toBe(cards[1]!.id)
    expect(state.reviewed).toEqual([cards[0]!.id])
    expect(state).not.toHaveProperty("flagged")
  })

  it("falls back to the first unreviewed card when the cursor is gone", () => {
    const state = parseEditorState(
      JSON.stringify({ selectedId: "missing", reviewed: [cards[0]!.id] }),
      { cards }
    )
    expect(state.selectedId).toBe(cards[1]!.id)
  })
})

describe("pruneEditorState", () => {
  it("drops ids that no longer exist", () => {
    const state = pruneEditorState(
      {
        selectedId: cards[0]!.id,
        reviewed: [cards[0]!.id, "gone"],
      },
      [cards[1]!]
    )
    expect(state).toEqual({
      selectedId: cards[1]!.id,
      reviewed: [],
    })
  })
})

describe("review helpers", () => {
  it("marks reviewed and filters unreviewed cards", () => {
    const start = defaultEditorState({ cards })
    const reviewed = markReviewed(start, cards[0]!.id)
    expect(matchesReviewFilter(cards[0]!, reviewed, "unreviewed")).toBe(false)
    expect(matchesReviewFilter(cards[1]!, reviewed, "unreviewed")).toBe(true)
  })

  it("returns an edited card to the unreviewed queue", () => {
    const reviewed = markReviewed(defaultEditorState({ cards }), cards[0]!.id)
    const pending = markUnreviewed(reviewed, cards[0]!.id)
    expect(pending.reviewed).not.toContain(cards[0]!.id)
    expect(matchesReviewFilter(cards[0]!, pending, "unreviewed")).toBe(true)
  })
})
