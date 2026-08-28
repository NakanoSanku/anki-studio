import { describe, expect, it } from "vitest"

import {
  hasAnkiPush,
  markNotesPushed,
  noteHash,
  planAnkiPush,
  templateHash,
  withAnkiIdentity,
} from "@/lib/anki-sync"
import { createCard, createDefaultDeck, serializeDeck, parseDeckJson } from "@/lib/deck"

const fields = ["Word", "Translation"]

function sampleDeck() {
  return {
    ...createDefaultDeck(),
    fields,
    fieldNotes: { Word: "", Translation: "" },
    fieldTts: {},
    front: "{{Word}}",
    back: "{{Translation}}",
    css: ".card{}",
    cards: [
      createCard(fields, { Word: "alpha", Translation: "一" }),
      createCard(fields, { Word: "beta", Translation: "二" }),
      createCard(fields, { Word: "", Translation: "空" }),
    ],
  }
}

describe("withAnkiIdentity", () => {
  it("keeps an existing identity", () => {
    const deck = { ...sampleDeck(), anki: { modelId: 11, deckId: 22, pushedTemplateHash: "aa" } }
    expect(withAnkiIdentity(deck)).toBe(deck)
  })

  it("assigns model and deck ids once", () => {
    const deck = sampleDeck()
    const first = withAnkiIdentity(deck)
    expect(first.anki?.modelId).toBeGreaterThan(0)
    expect(first.anki?.deckId).toBe(first.anki!.modelId + 1)
    expect(withAnkiIdentity(first)).toBe(first)
  })
})

describe("planAnkiPush", () => {
  it("treats unsynced non-empty cards as dirty and skips blanks", () => {
    const plan = planAnkiPush(sampleDeck())
    expect(plan.cards.map((card) => card.values.Word)).toEqual(["alpha", "beta"])
    expect(plan.templateChanged).toBe(true)
    expect(hasAnkiPush(plan)).toBe(true)
  })

  it("omits cards whose hash already matches", () => {
    const deck = sampleDeck()
    const hashed = {
      ...deck,
      cards: deck.cards.map((card) => ({ ...card, pushedHash: noteHash(deck, card) })),
    }
    const plan = planAnkiPush(hashed)
    expect(plan.cards).toHaveLength(0)
    expect(plan.templateChanged).toBe(true)
  })

  it("is idle when notes and template already match", () => {
    const deck = sampleDeck()
    const synced = {
      ...deck,
      anki: { modelId: 1, deckId: 2, pushedTemplateHash: templateHash(deck) },
      cards: deck.cards.map((card) => ({ ...card, pushedHash: noteHash(deck, card) })),
    }
    const plan = planAnkiPush(synced)
    expect(hasAnkiPush(plan)).toBe(false)
  })

  it("becomes dirty when a field value changes", () => {
    const deck = sampleDeck()
    const [first, ...rest] = deck.cards
    const synced = {
      ...deck,
      anki: { modelId: 1, deckId: 2, pushedTemplateHash: templateHash(deck) },
      cards: [
        { ...first, pushedHash: noteHash(deck, first) },
        ...rest.map((card) => ({ ...card, pushedHash: noteHash(deck, card) })),
      ],
    }
    const edited = {
      ...synced,
      cards: synced.cards.map((card) =>
        card.id === first.id ? { ...card, values: { ...card.values, Translation: "改" } } : card
      ),
    }
    const plan = planAnkiPush(edited)
    expect(plan.cards).toHaveLength(1)
    expect(plan.cards[0]?.id).toBe(first.id)
    expect(plan.templateChanged).toBe(false)
  })
})

describe("markNotesPushed", () => {
  it("stamps only cards that still match the exported hash", () => {
    const deck = withAnkiIdentity(sampleDeck())
    const plan = planAnkiPush(deck)
    const [first] = deck.cards
    const edited = {
      ...deck,
      cards: deck.cards.map((card) =>
        card.id === first.id ? { ...card, values: { ...card.values, Translation: "中途改了" } } : card
      ),
      front: "{{Word}}!",
    }
    const next = markNotesPushed(edited, {
      noteHashes: plan.noteHashes,
      templateHash: plan.templateHash,
      anki: deck.anki!,
    })
    expect(next.cards.find((card) => card.id === first.id)?.pushedHash).toBeUndefined()
    expect(next.cards.find((card) => card.values.Word === "beta")?.pushedHash).toBe(
      plan.noteHashes[deck.cards[1]!.id]
    )
    expect(next.anki?.pushedTemplateHash).toBeUndefined()
    expect(next.anki?.modelId).toBe(deck.anki?.modelId)
  })

  it("records the template hash when it still matches", () => {
    const deck = withAnkiIdentity(sampleDeck())
    const plan = planAnkiPush(deck)
    const next = markNotesPushed(deck, {
      noteHashes: plan.noteHashes,
      templateHash: plan.templateHash,
      anki: deck.anki!,
    })
    expect(next.anki?.pushedTemplateHash).toBe(plan.templateHash)
    expect(hasAnkiPush(planAnkiPush(next))).toBe(false)
  })
})

describe("parseDeckJson identity", () => {
  it("round-trips guid, pushedHash, and anki identity", () => {
    const base = sampleDeck()
    const card = { ...base.cards[0]!, guid: "abc123xyz0", pushedHash: "deadbeef" }
    const raw = serializeDeck({
      ...base,
      cards: [card],
      anki: { modelId: 11, deckId: 22, pushedTemplateHash: "cafe0001" },
    })
    const deck = parseDeckJson(raw)
    expect(deck.cards[0]?.guid).toBe("abc123xyz0")
    expect(deck.cards[0]?.pushedHash).toBe("deadbeef")
    expect(deck.anki).toEqual({ modelId: 11, deckId: 22, pushedTemplateHash: "cafe0001" })
  })

  it("assigns a guid when old JSON omitted it", () => {
    const raw = JSON.stringify({
      version: 1,
      name: "t",
      fields: ["Word"],
      front: "{{Word}}",
      back: "{{Word}}",
      css: "",
      cards: [{ id: "c1", values: { Word: "hi" } }],
    })
    const deck = parseDeckJson(raw)
    expect(deck.cards[0]?.guid.length).toBeGreaterThan(0)
    expect(deck.anki).toBeUndefined()
  })
})
