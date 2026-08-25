import type { Card, Deck } from "./deck"

export const EDITOR_STATE_KEY_PREFIX = "anki-studio.editor."

export type ReviewFilter = "all" | "unreviewed"

export type EditorState = {
  selectedId: string
  reviewed: string[]
  referenceIds: string[]
}

export function editorStateKey(deckId: string): string {
  return `${EDITOR_STATE_KEY_PREFIX}${deckId}`
}

function uniqueIds(ids: string[], allowed?: Set<string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    if (allowed && !allowed.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function defaultEditorState(deck: Pick<Deck, "cards">): EditorState {
  return {
    selectedId: deck.cards[0]?.id ?? "",
    reviewed: [],
    referenceIds: [],
  }
}

export function pruneEditorState(state: EditorState, cards: Card[]): EditorState {
  const allowed = new Set(cards.map((card) => card.id))
  const reviewed = uniqueIds(state.reviewed ?? [], allowed)
  const referenceIds = uniqueIds(state.referenceIds ?? [], allowed)
  const selectedId = allowed.has(state.selectedId)
    ? state.selectedId
    : cards.find((card) => !reviewed.includes(card.id))?.id ?? cards[0]?.id ?? ""
  return { selectedId, reviewed, referenceIds }
}

export function parseEditorState(raw: string, deck: Pick<Deck, "cards">): EditorState {
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== "object") return defaultEditorState(deck)
    const record = data as Record<string, unknown>
    const selectedId = typeof record.selectedId === "string" ? record.selectedId : ""
    const reviewed = Array.isArray(record.reviewed)
      ? record.reviewed.filter((id): id is string => typeof id === "string")
      : []
    const referenceIds = Array.isArray(record.referenceIds)
      ? record.referenceIds.filter((id): id is string => typeof id === "string")
      : []
    return pruneEditorState({ selectedId, reviewed, referenceIds }, deck.cards)
  } catch {
    return defaultEditorState(deck)
  }
}

export function readEditorState(deckId: string, deck: Pick<Deck, "cards">): EditorState {
  if (!deckId || deckId === "pending") return defaultEditorState(deck)
  try {
    const raw = globalThis.localStorage?.getItem(editorStateKey(deckId))
    if (!raw) return defaultEditorState(deck)
    return parseEditorState(raw, deck)
  } catch {
    return defaultEditorState(deck)
  }
}

export function writeEditorState(deckId: string, state: EditorState, cards?: Card[]): void {
  if (!deckId || deckId === "pending") return
  try {
    const next = cards ? pruneEditorState(state, cards) : state
    globalThis.localStorage?.setItem(editorStateKey(deckId), JSON.stringify(next))
  } catch {
    // ignore quota / private mode
  }
}

export function deleteEditorState(deckId: string): void {
  try {
    globalThis.localStorage?.removeItem(editorStateKey(deckId))
  } catch {
    // ignore
  }
}

export function toggleReference(state: EditorState, id: string): EditorState {
  if (!id) return state
  if (state.referenceIds.includes(id)) {
    return { ...state, referenceIds: state.referenceIds.filter((item) => item !== id) }
  }
  return { ...state, referenceIds: [...state.referenceIds, id] }
}

export function markReviewed(state: EditorState, id: string): EditorState {
  if (!id || state.reviewed.includes(id)) return state
  return { ...state, reviewed: [...state.reviewed, id] }
}

export function markUnreviewed(state: EditorState, id: string): EditorState {
  if (!id || !state.reviewed.includes(id)) return state
  return { ...state, reviewed: state.reviewed.filter((reviewedId) => reviewedId !== id) }
}

export function matchesReviewFilter(card: Card, state: EditorState, filter: ReviewFilter): boolean {
  if (filter === "unreviewed") return !state.reviewed.includes(card.id)
  return true
}
