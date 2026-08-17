import { describe, expect, it } from "vitest"

import {
  appendUniqueCards,
  createCard,
  createDefaultDeck,
  dedupeCardsByFirstField,
  findDuplicateCard,
  parseDeckJson,
  serializeDeck,
} from "./deck"

const fields = ["Word", "Translation"]

function card(word: string, translation = "") {
  return createCard(fields, { Word: word, Translation: translation })
}

describe("dedupeCardsByFirstField", () => {
  it("keeps every card whose first field is empty", () => {
    const cards = [card(""), card(""), card("alpha")]
    const next = dedupeCardsByFirstField(cards, fields)
    expect(next).toHaveLength(3)
    expect(next.filter((item) => item.values.Word === "")).toHaveLength(2)
  })

  it("drops later cards that share a non-empty first field", () => {
    const first = card("Alpha", "one")
    const dup = card("alpha", "two")
    const other = card("beta", "three")
    const next = dedupeCardsByFirstField([first, dup, other], fields)
    expect(next.map((item) => item.values.Translation)).toEqual(["one", "three"])
  })
})

describe("createCard", () => {
  it("assigns a stable note guid", () => {
    const item = card("alpha")
    expect(item.guid).toMatch(/^[0-9a-z]+$/i)
    expect(item.guid.length).toBeGreaterThanOrEqual(8)
  })
})

describe("parseDeckJson", () => {
  it("keeps multiple empty cards when reading a saved deck", () => {
    const raw = serializeDeck({
      ...createDefaultDeck(),
      fields,
      fieldNotes: { Word: "", Translation: "" },
      fieldTts: {},
      cards: [card(""), card(""), card("keep")],
    })
    const deck = parseDeckJson(raw)
    expect(deck.cards).toHaveLength(3)
    expect(deck.cards.filter((item) => item.values.Word === "")).toHaveLength(2)
  })

  it("still collapses duplicate non-empty first fields", () => {
    const raw = serializeDeck({
      ...createDefaultDeck(),
      fields,
      fieldNotes: { Word: "", Translation: "" },
      fieldTts: {},
      cards: [card("Same", "a"), card("same", "b")],
    })
    const deck = parseDeckJson(raw)
    expect(deck.cards).toHaveLength(1)
    expect(deck.cards[0]?.values.Translation).toBe("a")
  })
})

describe("findDuplicateCard", () => {
  it("does not treat an empty first field as a duplicate", () => {
    const cards = [card(""), card("alpha")]
    expect(findDuplicateCard(cards, fields, "")).toBeUndefined()
    expect(findDuplicateCard(cards, fields, "alpha")?.values.Word).toBe("alpha")
  })
})

describe("appendUniqueCards", () => {
  it("skips incoming cards with an empty first field", () => {
    const current = [card("alpha")]
    const incoming = [card(""), card("beta"), card("alpha")]
    const next = appendUniqueCards(current, fields, incoming, fields)
    expect(next.map((item) => item.values.Word)).toEqual(["alpha", "beta"])
  })
})
