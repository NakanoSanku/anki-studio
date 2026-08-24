import { isCardEmpty, type Card } from "./deck"

export function shouldDiscardNoteOnLeave(
  card: Card | undefined,
  fields: string[],
  createdInSession: boolean
): boolean {
  if (!createdInSession || !card) return false
  return isCardEmpty(card, fields)
}

export function withoutDiscardedNote<T extends { id: string }>(
  cards: T[],
  discardedId: string
): T[] {
  return cards.filter((card) => card.id !== discardedId)
}
