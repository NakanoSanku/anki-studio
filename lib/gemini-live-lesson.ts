import { textFields, type Card, type Deck } from "@/lib/deck"
import { getStudyQueue } from "@/lib/fsrs"

export const MAX_TUTOR_CARDS = 20

export type TutorLessonCard = {
  id: string
  values: Record<string, string>
}

export type TutorLesson = {
  deckName: string
  fields: string[]
  cards: TutorLessonCard[]
  instruction: string
}

function hasStudyContent(card: Card, fields: string[]): boolean {
  return fields.some((field) => Boolean(card.values[field]?.trim()))
}

function compactValues(card: Card, fields: string[]): Record<string, string> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = card.values[field]?.trim() ?? ""
      return value ? [[field, value] as const] : []
    })
  )
}

export function selectTutorCards(
  deck: Deck,
  now = new Date(),
  limit = MAX_TUTOR_CARDS
): TutorLessonCard[] {
  const fields = textFields(deck)
  const byId = new Map(deck.cards.map((card) => [card.id, card]))
  const orderedIds: string[] = []
  const seen = new Set<string>()

  for (const item of getStudyQueue(deck, now)) {
    const id = item.note.id
    if (seen.has(id)) continue
    seen.add(id)
    orderedIds.push(id)
  }

  for (const card of deck.cards) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    orderedIds.push(card.id)
  }

  const cards: TutorLessonCard[] = []
  for (const id of orderedIds) {
    const card = byId.get(id)
    if (!card || !hasStudyContent(card, fields)) continue
    cards.push({ id: card.id, values: compactValues(card, fields) })
    if (cards.length >= Math.max(1, limit)) break
  }
  return cards
}

function lessonMaterial(cards: TutorLessonCard[]): string {
  return cards
    .map((card, index) => {
      const lines = Object.entries(card.values).map(([field, value]) => `${field}: ${value}`)
      return `Card ${index + 1}\n${lines.join("\n")}`
    })
    .join("\n\n")
}

export function buildTutorInstruction(deck: Deck, cards: TutorLessonCard[]): string {
  return `You are Anki Studio Voice Tutor, a proactive spoken learning coach.

Teach the learner from the supplied deck material. Lead the lesson yourself instead of waiting for the learner to choose an activity.

Teaching rules:
- Use retrieval practice. Ask before revealing an answer.
- Ask one question at a time and wait for the learner's response.
- Keep spoken turns short and natural, usually one or two sentences.
- Correct mistakes briefly. If the learner struggles, give a small hint, then explain the answer and revisit it later.
- Move through the cards automatically and vary recall, meaning, examples, and short usage questions when the material supports them.
- Infer the target language and the learner's support language from the deck values. Speak in the language that makes the lesson easiest to follow.
- Stay grounded in the supplied deck. Do not invent facts that contradict the card content.
- Do not mention internal card IDs or field names unless they are genuinely useful to the learner.
- Do not use Markdown or read formatting symbols aloud.
- Begin immediately with a very short greeting and the first useful question.

Deck: ${deck.name.trim() || "Untitled deck"}

Lesson cards:
${lessonMaterial(cards)}`
}

export function createTutorLesson(deck: Deck, now = new Date()): TutorLesson {
  const fields = textFields(deck)
  const cards = selectTutorCards(deck, now)
  return {
    deckName: deck.name.trim() || "Untitled deck",
    fields,
    cards,
    instruction: buildTutorInstruction(deck, cards),
  }
}
