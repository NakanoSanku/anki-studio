import type { Deck } from "./deck"
import type { EditorState } from "./editor-state"

export type RemoteIndexEntry = {
  id: string
  rev: number
  name: string
  cardCount: number
  updatedAt: number
  deletedAt?: number | null
}

export type RemoteDeckPayload = {
  rev: number
  updatedAt: number
  deletedAt?: number | null
  deck: Deck | null
  editorState?: EditorState | null
}

export type PutDeckBody = {
  expectedRev: number
  deck: Deck | null
  editorState?: EditorState | null
  deletedAt?: number | null
}

export type PutDeckResult =
  | { ok: true; rev: number; updatedAt: number }
  | { ok: false; conflict: true; server: RemoteDeckPayload }

export type SyncStatus = {
  available: boolean
  reason?: string
  provider?: "google-sheets"
}

export type ConflictChoice = "local" | "remote" | "copy" | "defer"

export type SyncConflict = {
  id: string
  name: string
  localUpdatedAt: number
  localDeleted: boolean
  remoteRev: number
  remoteDeleted: boolean
  remoteName: string
}

export type SyncAction =
  | { type: "pull"; id: string }
  | { type: "push"; id: string }
  | { type: "apply-tombstone"; id: string; remoteRev: number; remoteUpdatedAt: number }
  | { type: "push-tombstone"; id: string }
  | { type: "conflict"; conflict: SyncConflict }

export type SyncSummary = {
  pulled: number
  pushed: number
  conflicts: number
  deferred: boolean
  unavailable?: string
  error?: string
}
