import { parseDeckJson, type Deck } from "./deck"
import { defaultEditorState, parseEditorState, type EditorState } from "./editor-state"
import { isDeckId } from "./studio-store"
import type { PutDeckBody, RemoteDeckPayload, RemoteIndexEntry } from "./sync-types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function positiveTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

export function parseRemoteDeckPayload(raw: unknown): RemoteDeckPayload {
  if (!isRecord(raw)) throw new Error("云端卡包格式无效")
  const rev = Number(raw.rev)
  const updatedAt = Number(raw.updatedAt)
  if (!Number.isInteger(rev) || rev < 0) throw new Error("云端卡包版本无效")

  const deletedAt = positiveTimestamp(raw.deletedAt)
  let deck: Deck | null = null
  if (raw.deck != null) {
    deck = parseDeckJson(JSON.stringify(raw.deck))
  } else if (!deletedAt && rev !== 0) {
    throw new Error("云端卡包缺少内容")
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
  if (!isRecord(raw)) throw new Error("请求无效")
  const expectedRev = Number(raw.expectedRev)
  if (!Number.isInteger(expectedRev) || expectedRev < 0) throw new Error("版本无效")

  const deletedAt = positiveTimestamp(raw.deletedAt)
  const deck = raw.deck == null ? null : parseDeckJson(JSON.stringify(raw.deck))
  if (!deletedAt && !deck) throw new Error("缺少卡包内容")

  let editorState: EditorState | null = null
  if (!deletedAt && deck) {
    editorState = raw.editorState == null
      ? defaultEditorState(deck)
      : parseEditorState(JSON.stringify(raw.editorState), deck)
  }

  return { expectedRev, deck, deletedAt, editorState }
}

export function parseRemoteIndex(raw: unknown): RemoteIndexEntry[] {
  if (!Array.isArray(raw)) throw new Error("云端目录格式无效")
  return raw.map((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !isDeckId(entry.id)) {
      throw new Error("云端目录包含无效卡包")
    }
    const rev = Number(entry.rev)
    const updatedAt = Number(entry.updatedAt)
    const cardCount = Number(entry.cardCount)
    if (!Number.isInteger(rev) || rev < 0) throw new Error("云端目录版本无效")
    return {
      id: entry.id,
      rev,
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name : "未命名卡包",
      cardCount: Number.isFinite(cardCount) ? Math.max(0, Math.floor(cardCount)) : 0,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
      deletedAt: positiveTimestamp(entry.deletedAt),
    }
  })
}
