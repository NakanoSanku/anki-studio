import { describe, expect, it } from "vitest"

import { createCard, createDefaultDeck, serializeDeck } from "./deck"
import { decodeImportBytes } from "./encoding"
import {
  applyTextImport,
  inspectImportFile,
  inspectImportText,
} from "./import-preview"

const current = {
  ...createDefaultDeck(),
  cards: [createCard(createDefaultDeck().fields, { Word: "keep", Translation: "保留" })],
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe("inspectImportText csv", () => {
  it("blocks empty headers and duplicate headers", () => {
    const empty = inspectImportText("bad.csv", decodeImportBytes(textBytes("Word,\nfoo,bar\n")), current)
    expect(empty.canImport).toBe(false)
    expect(empty.issues.some((item) => item.code === "empty-header")).toBe(true)

    const dup = inspectImportText("dup.csv", decodeImportBytes(textBytes("Word,Word\na,b\n")), current)
    expect(dup.canImport).toBe(false)
    expect(dup.issues.some((item) => item.code === "duplicate-header")).toBe(true)
  })

  it("blocks a file with only headers", () => {
    const preview = inspectImportText("empty.csv", decodeImportBytes(textBytes("Word,Translation\n")), current)
    expect(preview.canImport).toBe(false)
    expect(preview.issues.some((item) => item.code === "no-rows")).toBe(true)
  })

  it("warns about encoding, empty first fields, and duplicates then allows confirm", () => {
    const csv = "Word,Translation\n,空\nkeep,重复\nalpha,阿尔法\nalpha,又一次\n"
    const preview = inspectImportText("words.csv", decodeImportBytes(textBytes(csv)), current)
    expect(preview.canImport).toBe(true)
    expect(preview.emptyFirstField).toBe(1)
    expect(preview.duplicateInFile).toBe(1)
    expect(preview.duplicateInCurrent).toBe(1)
    expect(preview.issues.every((item) => item.level === "warning")).toBe(true)
  })

  it("blocks unclosed quotes", () => {
    const preview = inspectImportText("q.csv", decodeImportBytes(textBytes('Word,Translation\n"oops,1\n')), current)
    expect(preview.canImport).toBe(false)
    expect(preview.issues.some((item) => item.code === "unclosed-quote")).toBe(true)
  })
})

describe("inspectImportText json", () => {
  it("blocks invalid JSON and missing version", () => {
    const broken = inspectImportText("a.json", decodeImportBytes(textBytes("{")), current)
    expect(broken.canImport).toBe(false)
    expect(broken.issues[0]?.message).toMatch(/JSON/)

    const noVersion = inspectImportText("b.json", decodeImportBytes(textBytes('{"name":"x"}')), current)
    expect(noVersion.canImport).toBe(false)
  })

  it("accepts a valid deck JSON", () => {
    const deck = createDefaultDeck()
    const preview = inspectImportText("deck.json", decodeImportBytes(textBytes(serializeDeck(deck))), current)
    expect(preview.canImport).toBe(true)
    expect(preview.kind).toBe("json")
    expect(preview.cardCount).toBe(deck.cards.length)
    expect(preview.name).toBe(deck.name)
  })
})

describe("applyTextImport", () => {
  it("does not write until apply is called, then merges unique cards", () => {
    const csv = "Word,Translation\nkeep,跳过\nbeta,贝塔\n"
    const preview = inspectImportText("in.csv", decodeImportBytes(textBytes(csv)), current)
    expect(current.cards.map((card) => card.values.Word)).toEqual(["keep"])
    const merged = applyTextImport(preview, current, "merge")
    expect(merged.added).toBe(1)
    expect(merged.deck.cards.map((card) => card.values.Word)).toEqual(["keep", "beta"])
  })

  it("replaces cards for CSV replace mode", () => {
    const csv = "Word,Translation\ngamma,伽马\n"
    const preview = inspectImportText("in.csv", decodeImportBytes(textBytes(csv)), current)
    const replaced = applyTextImport(preview, current, "replace")
    expect(replaced.deck.cards).toHaveLength(1)
    expect(replaced.deck.cards[0]?.values.Word).toBe("gamma")
    expect(replaced.deck.name).toBe(current.name)
  })

  it("builds a new deck from CSV", () => {
    const csv = "Term,Meaning\nhello,你好\n"
    const preview = inspectImportText("travel.csv", decodeImportBytes(textBytes(csv)), current)
    const created = applyTextImport(preview, current, "new")
    expect(created.deck.name).toBe("travel")
    expect(created.deck.fields).toEqual(["Term", "Meaning"])
    expect(created.deck.cards[0]?.values.Term).toBe("hello")
  })

  it("refuses to apply a failed preview", () => {
    const preview = inspectImportText("bad.csv", decodeImportBytes(textBytes("Word,\n")), current)
    expect(() => applyTextImport(preview, current, "merge")).toThrow("校验未通过")
  })
})

describe("inspectImportFile", () => {
  it("reads a File and reports UTF-8 BOM", async () => {
    const content = new Uint8Array([0xef, 0xbb, 0xbf, ...textBytes("Word,Translation\nalpha,a\n")])
    const file = new File([content], "bom.csv", { type: "text/csv" })
    const preview = await inspectImportFile(file, current)
    expect(preview.encoding).toBe("utf-8-bom")
    expect(preview.canImport).toBe(true)
    expect(preview.cardCount).toBe(1)
  })
})
