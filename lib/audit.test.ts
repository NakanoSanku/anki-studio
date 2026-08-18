import { describe, expect, it } from "vitest"

import {
  applyAuditResults,
  chunkItems,
  formatAuditCards,
  mergeAuditValues,
  resolveAuditCard,
  selectAuditTargets,
} from "./audit"
import { createCard, createDefaultDeck, type Card } from "./deck"

const fields = ["Word", "Translation", "Example"]

function card(word: string, translation = "", example = ""): Card {
  return createCard(fields, { Word: word, Translation: translation, Example: example })
}

function deckWith(cards: Card[]) {
  return {
    ...createDefaultDeck(),
    fields,
    fieldNotes: { Word: "", Translation: "", Example: "" },
    fieldTts: {},
    cards,
  }
}

describe("chunkItems", () => {
  it("splits a list into fixed-size groups", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe("selectAuditTargets", () => {
  it("skips empty keys and respects unreviewed scope and limit", () => {
    const alpha = card("alpha", "一")
    const empty = card("", "空")
    const beta = card("beta", "二")
    const gamma = card("gamma", "三")
    const selected = selectAuditTargets([alpha, empty, beta, gamma], fields, {
      scope: "unreviewed",
      visibleIds: [alpha.id, empty.id, beta.id, gamma.id],
      review: { reviewed: [alpha.id], flagged: [] },
      limit: 1,
    })
    expect(selected.map((item) => item.values.Word)).toEqual(["beta"])
  })
})

describe("formatAuditCards", () => {
  it("includes id and field values", () => {
    const item = card("alpha", "一")
    const text = formatAuditCards([item], fields)
    expect(text).toContain(`id: ${item.id}`)
    expect(text).toContain("Word: alpha")
    expect(text).toContain("Translation: 一")
  })
})

describe("resolveAuditCard", () => {
  it("matches by id first, then first field", () => {
    const alpha = card("alpha", "一")
    const beta = card("beta", "二")
    expect(resolveAuditCard([alpha, beta], fields, { id: beta.id, values: {} })?.id).toBe(beta.id)
    expect(
      resolveAuditCard([alpha, beta], fields, { id: "missing", values: { Word: "alpha" } })?.id
    ).toBe(alpha.id)
  })
})

describe("mergeAuditValues", () => {
  it("only writes non-empty generated fields", () => {
    const item = card("alpha", "旧译", "old example")
    const result = mergeAuditValues(deckWith([item]), item.id, {
      Word: "alpha",
      Translation: "新译",
      Example: "",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.deck.cards[0]?.values).toEqual({
      Word: "alpha",
      Translation: "新译",
      Example: "old example",
    })
  })
})

describe("applyAuditResults", () => {
  it("applies matching cards and ignores outsiders", () => {
    const alpha = card("alpha", "一")
    const beta = card("beta", "二")
    const result = applyAuditResults(deckWith([alpha, beta]), [alpha], [
      { id: alpha.id, values: { Translation: "新译" } },
      { id: beta.id, values: { Translation: "不该写" } },
    ])
    expect(result.applied).toEqual([alpha.id])
    expect(result.deck.cards[0]?.values.Translation).toBe("新译")
    expect(result.deck.cards[1]?.values.Translation).toBe("二")
  })
})
