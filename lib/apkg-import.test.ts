import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { withAnkiIdentity } from "./anki-sync"
import { apkgImportWarnings, exportApkg, importApkg, importDeckFile, setSqlWasmPath } from "./apkg"
import { createCard, createDefaultDeck, serializeDeck } from "./deck"

setSqlWasmPath(join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"))

describe("apkgImportWarnings", () => {
  it("is silent when a package has one model, one template, and one deck", () => {
    expect(
      apkgImportWarnings({
        modelCount: 1,
        chosenModelName: "Vocabulary",
        templateCount: 1,
        chosenTemplateName: "Card 1",
        otherNotes: 0,
        namedDeckCount: 1,
        chosenDeckName: "单词本",
      })
    ).toEqual([])
  })

  it("reports leftover models, templates, notes, and decks", () => {
    expect(
      apkgImportWarnings({
        modelCount: 3,
        chosenModelName: "Vocabulary",
        templateCount: 2,
        chosenTemplateName: "Card 1",
        otherNotes: 8,
        namedDeckCount: 2,
        chosenDeckName: "单词本",
      })
    ).toEqual([
      "卡包有 3 个笔记模板，只导入了「Vocabulary」",
      "「Vocabulary」有 2 张卡模板，只用了「Card 1」",
      "另有 8 张卡片属于其他模板，未导入",
      "卡包有 2 个牌组，名称使用了「单词本」",
    ])
  })
})

describe("importDeckFile", () => {
  it("returns a deck and no warnings for JSON", async () => {
    const deck = createDefaultDeck()
    const file = new File([serializeDeck(deck)], "words.json", { type: "application/json" })
    const result = await importDeckFile(file, deck)
    expect(result.warnings).toEqual([])
    expect(result.deck.name).toBe(deck.name)
    expect(result.deck.cards).toHaveLength(deck.cards.length)
  })
})

describe("exportApkg incremental", () => {
  const fields = ["Word", "Translation"]

  function deckWithCards() {
    return withAnkiIdentity({
      ...createDefaultDeck(),
      name: "增量测试",
      fields,
      fieldNotes: { Word: "", Translation: "" },
      fieldTts: {},
      front: "{{Word}}",
      back: "{{Translation}}",
      css: ".card{}",
      cards: [
        createCard(fields, { Word: "alpha", Translation: "一" }),
        createCard(fields, { Word: "beta", Translation: "二" }),
      ],
      anki: { modelId: 111, deckId: 222 },
    })
  }

  it("writes only the requested notes and keeps guid plus Anki ids", async () => {
    const deck = deckWithCards()
    const [first] = deck.cards
    const blob = await exportApkg(deck, { cards: [first] })
    const result = await importApkg(await blob.arrayBuffer())
    expect(result.deck.cards).toHaveLength(1)
    expect(result.deck.cards[0]?.guid).toBe(first.guid)
    expect(result.deck.cards[0]?.values.Word).toBe("alpha")
    expect(result.deck.anki?.modelId).toBe(111)
    expect(result.deck.anki?.deckId).toBe(222)
  })

  it("can export a template-only package with no notes", async () => {
    const deck = deckWithCards()
    const blob = await exportApkg(deck, { cards: [] })
    const result = await importApkg(await blob.arrayBuffer())
    expect(result.deck.cards).toHaveLength(0)
    expect(result.deck.anki?.modelId).toBe(111)
    expect(result.deck.anki?.deckId).toBe(222)
    expect(result.deck.front).toContain("{{Word}}")
  })
})
