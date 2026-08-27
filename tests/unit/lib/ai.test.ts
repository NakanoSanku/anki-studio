import { describe, expect, it } from "vitest"

import { formatReferenceNotes, referenceValuesForComplete } from "@/lib/ai"

describe("formatReferenceNotes", () => {
  it("skips empty fields and numbers each note", () => {
    const text = formatReferenceNotes(
      ["Word", "Translation", "Example"],
      [
        { Word: "ephemeral", Translation: "短暂的", Example: "" },
        { Word: "durable", Translation: "", Example: "a durable fabric" },
      ]
    )
    expect(text).toContain("【1】")
    expect(text).toContain("【1】\nWord: ephemeral\nTranslation: 短暂的")
    expect(text).not.toContain("ephemeral\nTranslation: 短暂的\nExample:")
    expect(text).toContain("【2】")
    expect(text).toContain("Word: durable")
    expect(text).toContain("Example: a durable fabric")
  })

  it("returns empty when nothing is pinned", () => {
    expect(formatReferenceNotes(["Word"], [])).toBe("")
  })
})

describe("referenceValuesForComplete", () => {
  it("drops the note being completed", () => {
    const values = referenceValuesForComplete(
      [
        { id: "a", values: { Word: "alpha" } },
        { id: "b", values: { Word: "beta" } },
      ],
      "a"
    )
    expect(values).toEqual([{ Word: "beta" }])
  })
})
