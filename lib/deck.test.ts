import { describe, expect, it } from "vitest"

import {
  appendUniqueCards,
  createCard,
  createDefaultDeck,
  dedupeCardsByFirstField,
  findDuplicateCard,
  mergeCardAiValues,
  mergeGeneratedCards,
  parseDeckJson,
  serializeDeck,
  setCardField,
  tryAddField,
  type Card,
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

function testDeck(cards: Card[]) {
  return {
    ...createDefaultDeck(),
    fields,
    fieldNotes: { Word: "", Translation: "" },
    fieldTts: {},
    cards,
  }
}

describe("setCardField", () => {
  it("merges one field without wiping siblings written earlier", () => {
    const item = card("alpha")
    const first = setCardField(testDeck([item]), item.id, "Translation", "一")
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = setCardField(first.deck, item.id, "Word", "beta")
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.deck.cards[0]?.values).toEqual({ Word: "beta", Translation: "一" })
  })

  it("rejects a first-field clash against the latest cards", () => {
    const alpha = card("alpha", "一")
    const beta = card("beta")
    const result = setCardField(testDeck([alpha, beta]), beta.id, "Word", "alpha")
    expect(result).toEqual({ ok: false, error: "已存在卡片「alpha」" })
  })
})

describe("tryAddField", () => {
  it("adds the chosen name and note without changing existing values", () => {
    const result = tryAddField(testDeck([card("alpha", "一")]), {
      name: "PartOfSpeech",
      note: "词性，只填写常用缩写",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.fields).toEqual(["Word", "Translation", "PartOfSpeech"])
    expect(result.deck.fieldNotes?.PartOfSpeech).toBe("词性，只填写常用缩写")
    expect(result.deck.cards[0]?.values).toEqual({
      Word: "alpha",
      Translation: "一",
      PartOfSpeech: "",
    })
  })

  it("rejects empty and duplicate field names before changing the deck", () => {
    const deck = testDeck([card("alpha")])
    expect(tryAddField(deck, { name: "   " })).toEqual({
      ok: false,
      error: "字段名不能为空",
    })
    expect(tryAddField(deck, { name: "Word" })).toEqual({
      ok: false,
      error: "字段「Word」已存在",
    })
  })
})

describe("mergeCardAiValues", () => {
  it("complete only fills empty fields on the latest card", () => {
    const item = card("alpha")
    const typed = setCardField(testDeck([item]), item.id, "Translation", "用户已填")
    expect(typed.ok).toBe(true)
    if (!typed.ok) return
    const result = mergeCardAiValues(
      typed.deck,
      item.id,
      { Word: "alpha", Translation: "AI 想覆盖" }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.cards[0]?.values.Translation).toBe("用户已填")
  })

  it("fills empty sibling fields without changing existing values", () => {
    const item = card("alpha")
    const extra = { ...item, values: { ...item.values, Extra: "keep" } }
    const deck = {
      ...testDeck([extra]),
      fields: [...fields, "Extra"],
      fieldNotes: { Word: "", Translation: "", Extra: "" },
    }
    const result = mergeCardAiValues(
      deck,
      extra.id,
      { Word: "beta", Translation: "AI 译文", Extra: "AI 想覆盖" }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.cards[0]?.values).toEqual({
      Word: "alpha",
      Translation: "AI 译文",
      Extra: "keep",
    })
  })
})

describe("mergeGeneratedCards", () => {
  it("keeps earlier generated cards when a later batch is merged", () => {
    const existing = card("alpha")
    const first = mergeGeneratedCards(testDeck([existing]), [card("beta")])
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = mergeGeneratedCards(first.deck, [card("beta"), card("gamma")])
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.deck.cards.map((item) => item.values.Word)).toEqual(["alpha", "beta", "gamma"])
  })

  it("inserts a batch after the current card", () => {
    const alpha = card("alpha")
    const gamma = card("gamma")
    const result = mergeGeneratedCards(testDeck([alpha, gamma]), [card("beta")], alpha.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.cards.map((item) => item.values.Word)).toEqual(["alpha", "beta", "gamma"])
  })
})
