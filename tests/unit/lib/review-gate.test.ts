import { describe, expect, it } from "vitest"

import {
  approveCard,
  approvedDeck,
  createCard,
  createDefaultDeck,
  createPendingCard,
  isCardApproved,
  mergeGeneratedCards,
  parseDeckJson,
  serializeDeck,
  setCardField,
} from "@/lib/deck"
import { getStudyQueue } from "@/lib/fsrs"
import { parseRemoteDeckPayload } from "@/lib/sync-payload"

const now = new Date("2026-08-29T03:00:00.000Z")

describe("review approval gate", () => {
  it("treats legacy notes without review metadata as approved", () => {
    const deck = createDefaultDeck()
    const raw = JSON.parse(serializeDeck(deck))
    delete raw.cards[0].reviewStatus
    const migrated = parseDeckJson(JSON.stringify(raw))
    expect(isCardApproved(migrated.cards[0]!)).toBe(true)
  })

  it("keeps new generated notes pending through dedupe/merge", () => {
    const deck = createDefaultDeck()
    const incoming = createPendingCard(deck.fields, { Word: "pending-word" })
    const result = mergeGeneratedCards(deck, [incoming], deck.cards[0]!.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const pending = result.deck.cards.find((card) => card.values.Word === "pending-word")!
    expect(isCardApproved(pending)).toBe(false)
  })

  it("returns edited notes to pending and approval restores them", () => {
    const deck = createDefaultDeck()
    const id = deck.cards[0]!.id
    const edited = setCardField(deck, id, "Translation", "updated")
    expect(edited.ok).toBe(true)
    if (!edited.ok) return
    expect(isCardApproved(edited.deck.cards[0]!)).toBe(false)
    expect(isCardApproved(approveCard(edited.deck, id).cards[0]!)).toBe(true)
  })

  it("excludes pending notes and their schedules from the approved deck and study queue", () => {
    const base = createDefaultDeck()
    const pending = createPendingCard(base.fields, { Word: "draft" })
    const deck = { ...base, cards: [...base.cards, pending] }
    expect(getStudyQueue(deck, now).some((item) => item.note.id === pending.id)).toBe(false)
    const exported = approvedDeck(deck)
    expect(exported.cards.map((card) => card.id)).not.toContain(pending.id)
  })

  it("round-trips pending status through the cloud payload", () => {
    const deck = createDefaultDeck()
    deck.cards = [createCard(deck.fields, { Word: "approved" }), createPendingCard(deck.fields, { Word: "draft" })]
    const payload = parseRemoteDeckPayload({ rev: 1, updatedAt: Date.now(), deck })
    expect(payload.deck?.cards.map(isCardApproved)).toEqual([true, false])
  })
})
