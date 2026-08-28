import { describe, expect, it } from "vitest"

import { createCard } from "@/lib/deck"
import { shouldDiscardNoteOnLeave, withoutDiscardedNote } from "@/lib/empty-note"

const fields = ["Word", "Translation"]

describe("shouldDiscardNoteOnLeave", () => {
  it("deletes only an empty note created this visit", () => {
    const empty = createCard(fields)
    const filled = createCard(fields, { Word: "alpha" })
    expect(shouldDiscardNoteOnLeave(empty, fields, true)).toBe(true)
    expect(shouldDiscardNoteOnLeave(empty, fields, false)).toBe(false)
    expect(shouldDiscardNoteOnLeave(filled, fields, true)).toBe(false)
    expect(shouldDiscardNoteOnLeave(undefined, fields, true)).toBe(false)
  })

  it("treats whitespace-only first field as empty", () => {
    const blank = createCard(fields, { Word: "   ", Translation: "x" })
    expect(shouldDiscardNoteOnLeave(blank, fields, true)).toBe(true)
  })
})

describe("withoutDiscardedNote", () => {
  it("removes only the discarded id", () => {
    const keep = createCard(fields, { Word: "keep" })
    const drop = createCard(fields)
    expect(withoutDiscardedNote([keep, drop], drop.id).map((card) => card.id)).toEqual([keep.id])
  })
})
