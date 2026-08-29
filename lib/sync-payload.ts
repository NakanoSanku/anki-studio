import { parseDeckJson, type Deck } from "./deck"
import { defaultEditorState, parseEditorState, type EditorState } from "./editor-state"
import { isDeckId } from "./studio-store"
import type { PutDeckBody, RemoteDeckPayload, RemoteIndexEntry } from "./sync-types"
import { SyncRequestError } from "./sync-errors"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function positiveTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

export function parseRemoteDeckPayload(raw: unknown): RemoteDeckPayload {
  if (!isRecord(raw)) {
    throw new SyncRequestError("invalid_remote_deck_payload", "Invalid cloud deck payload")
  }
  const rev = Number(raw.rev)
  const updatedAt = Number(raw.updatedAt)
  if (!Number.isInteger(rev) || rev < 0) {
    throw new SyncRequestError("invalid_remote_deck_revision", "Invalid cloud deck revision")
  }

  const deletedAt = positiveTimestamp(raw.deletedAt)
  let deck: Deck | null = null
  if (raw.deck != null) {
    try {
      deck = parseDeckJson(JSON.stringify(raw.deck))
    } catch {
      throw new SyncRequestError("invalid_remote_deck_content", "Cloud deck content is invalid")
    }
  } else if (!deletedAt && rev !== 0) {
    throw new SyncRequestError("missing_remote_deck_content", "Cloud deck content is missing")
  }

  let editorState: EditorState | null = null
  if (raw.editorState != null && deck) {
    editorState = parseEditorState(JSON.stringify(raw.editorState), deck)
  }

  return {
    rev,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
    deletedAt,
    deck,
    editorState,
  }
}

export function parsePutBody(raw: unknown): PutDeckBody {
  if (!isRecord(raw)) {
    throw new SyncRequestError("invalid_request", "Invalid sync request")
  }
  const expectedRev = Number(raw.expectedRev)
  if (!Number.isInteger(expectedRev) || expectedRev < 0) {
    throw new SyncRequestError("invalid_expected_revision", "Invalid expected revision")
  }

  const deletedAt = positiveTimestamp(raw.deletedAt)
  let deck: Deck | null = null
  if (raw.deck != null) {
    try {
      deck = parseDeckJson(JSON.stringify(raw.deck))
    } catch {
      throw new SyncRequestError("invalid_deck_content", "Deck content is invalid")
    }
  }
  if (!deletedAt && !deck) {
    throw new SyncRequestError("missing_deck_content", "Deck content is missing")
  }

  let editorState: EditorState | null = null
  if (!deletedAt && deck) {
    editorState = raw.editorState == null
      ? defaultEditorState(deck)
      : parseEditorState(JSON.stringify(raw.editorState), deck)
  }

  return { expectedRev, deck, deletedAt, editorState }
}

export function parseRemoteIndex(raw: unknown): RemoteIndexEntry[] {
  if (!Array.isArray(raw)) {
    throw new SyncRequestError("invalid_remote_index", "Invalid cloud sync index")
  }
  return raw.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !isDeckId(entry.id)) {
      throw new SyncRequestError("invalid_remote_index_entry", "Cloud sync index contains an invalid deck")
    }
    const rev = Number(entry.rev)
    const updatedAt = Number(entry.updatedAt)
    const cardCount = Number(entry.cardCount)
    if (!Number.isInteger(rev) || rev < 0) {
      throw new SyncRequestError("invalid_remote_index_revision", "Invalid cloud sync index revision")
    }
    return {
      id: entry.id,
      rev,
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name : "Untitled deck",
      cardCount: Number.isFinite(cardCount) ? Math.max(0, Math.floor(cardCount)) : 0,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
      deletedAt: positiveTimestamp(entry.deletedAt),
    }
  })
}
