import { describe, expect, it } from "vitest"

import {
  addCardTemplate,
  createDefaultDeck,
  fsrsOf,
  parseDeckJson,
  serializeDeck,
  templatesOf,
} from "./deck"
import { Rating, getStudyQueue, getStudyStats, reviewStudyItem } from "./fsrs"

const now = new Date("2026-08-22T08:00:00.000Z")

function deckWithCards(count: number) {
  const deck = createDefaultDeck()
  const source = deck.cards[0]!
  return {
    ...deck,
    cards: Array.from({ length: count }, (_, index) => ({
      ...source,
      id: `note-${index + 1}`,
      guid: `guid-${index + 1}`,
      values: { ...source.values, Word: `word-${index + 1}` },
    })),
  }
}

describe("FSRS study flow", () => {
  it("normalizes synced retention precision for form controls", () => {
    const deck = createDefaultDeck()
    expect(
      fsrsOf({
        ...deck,
        fsrs: { ...fsrsOf(deck), requestRetention: 0.8999999761581421 },
      }).requestRetention
    ).toBe(0.9)
  })

  it("creates one schedulable card for every note and template", () => {
    const deck = addCardTemplate(createDefaultDeck())
    const queue = getStudyQueue(deck, now)
    expect(templatesOf(deck)).toHaveLength(2)
    expect(queue).toHaveLength(2)
    expect(queue.every((item) => item.isNew)).toBe(true)
  })

  it("limits the actionable queue even when every card is currently due", () => {
    const deck = deckWithCards(248)
    expect(getStudyStats(deck, now).dueNow).toBe(248)
    expect(getStudyQueue(deck, now)).toHaveLength(20)
  })

  it("keeps review and new-card counts within the same actionable queue", () => {
    const deck = deckWithCards(25)
    const first = getStudyQueue(deck, now)[0]!
    const reviewed = reviewStudyItem(deck, first, Rating.Again, now)
    const later = new Date(now.getTime() + 2 * 60_000)
    const queue = getStudyQueue(reviewed, later)

    expect(queue).toHaveLength(20)
    expect(queue.filter((item) => item.isNew)).toHaveLength(19)
    expect(queue.filter((item) => !item.isNew)).toHaveLength(1)
  })

  it("persists a rating and removes the reviewed card from the immediate queue", () => {
    const deck = createDefaultDeck()
    const item = getStudyQueue(deck, now)[0]!
    const reviewed = reviewStudyItem(deck, item, Rating.Good, now)
    const stats = getStudyStats(reviewed, now)
    expect(stats.learned).toBe(1)
    expect(stats.reviewedToday).toBe(1)
    expect(getStudyQueue(reviewed, now)).toHaveLength(0)

    const roundTrip = parseDeckJson(serializeDeck(reviewed))
    expect(getStudyStats(roundTrip, now).reviewedToday).toBe(1)
  })
})

describe("V1 deck migration", () => {
  it("upgrades one legacy front/back pair into a stable primary template", () => {
    const migrated = parseDeckJson(
      JSON.stringify({
        version: 1,
        name: "旧卡包",
        fields: ["Front", "Back"],
        fieldNotes: {},
        fieldTts: {},
        front: "{{Front}}",
        back: "{{Back}}",
        css: ".card {}",
        cards: [{ id: "note-1", guid: "legacy-guid", values: { Front: "Q", Back: "A" } }],
      })
    )
    expect(migrated.version).toBe(2)
    expect(templatesOf(migrated)).toEqual([
      { id: "card-1", name: "卡片 1", front: "{{Front}}", back: "{{Back}}" },
    ])
    expect(migrated.fsrs?.cards).toEqual({})
  })
})
