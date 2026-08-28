import { describe, expect, it } from "vitest"

import { createCard, createDefaultDeck } from "@/lib/deck"
import {
  MAX_TUTOR_CARDS,
  createTutorLesson,
  selectTutorCards,
} from "@/lib/gemini-live-lesson"

describe("Gemini Live lesson selection", () => {
  it("limits a lesson to twenty useful cards and skips empty notes", () => {
    const base = createDefaultDeck()
    const fields = ["Word", "Translation"]
    const cards = [
      createCard(fields),
      ...Array.from({ length: 25 }, (_, index) =>
        createCard(fields, { Word: `word-${index + 1}`, Translation: `meaning-${index + 1}` })
      ),
    ]
    const deck = {
      ...base,
      fields,
      fieldNotes: { Word: "", Translation: "" },
      fieldTts: {},
      cards,
      fsrs: undefined,
    }

    const selected = selectTutorCards(deck)
    expect(selected).toHaveLength(MAX_TUTOR_CARDS)
    expect(selected.every((card) => Boolean(card.values.Word || card.values.Translation))).toBe(true)
    expect(selected.some((card) => Object.keys(card.values).length === 0)).toBe(false)
  })

  it("builds a proactive retrieval lesson grounded in the active deck", () => {
    const base = createDefaultDeck()
    const deck = {
      ...base,
      name: "Thai essentials",
      fields: ["Word", "Translation"],
      fieldNotes: { Word: "", Translation: "" },
      fieldTts: {},
      cards: [createCard(["Word", "Translation"], { Word: "หลัง", Translation: "behind / after" })],
      fsrs: undefined,
    }

    const lesson = createTutorLesson(deck)
    expect(lesson.deckName).toBe("Thai essentials")
    expect(lesson.cards).toHaveLength(1)
    expect(lesson.instruction).toContain("You are Anki Studio Voice Tutor")
    expect(lesson.instruction).toContain("Use retrieval practice")
    expect(lesson.instruction).toContain("Ask one question at a time")
    expect(lesson.instruction).toContain("Thai essentials")
    expect(lesson.instruction).toContain("หลัง")
    expect(lesson.instruction).toContain("behind / after")
  })
})
