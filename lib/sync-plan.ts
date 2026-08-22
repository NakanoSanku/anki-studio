import {
  createDefaultDeck,
  DEFAULT_BACK,
  DEFAULT_CSS,
  DEFAULT_FIELDS,
  DEFAULT_FRONT,
  type Deck,
} from "./deck"
import type { DeckRecord, SyncMeta } from "./studio-store"
import type { RemoteIndexEntry, SyncAction, SyncConflict } from "./sync-types"

export function isPristineStarterDeck(deck: Deck): boolean {
  if (deck.name !== "单词本") return false
  if (deck.cards.length !== 1) return false
  if (deck.front !== DEFAULT_FRONT || deck.back !== DEFAULT_BACK || deck.css !== DEFAULT_CSS) {
    return false
  }
  if (deck.fields.length !== DEFAULT_FIELDS.length) return false
  if (deck.fields.some((field, index) => field !== DEFAULT_FIELDS[index])) return false
  const card = deck.cards[0]
  return card?.values.Word === "ephemeral" && card.values.Translation === "短暂的；转瞬即逝的"
}

export function isPristineLocalLibrary(records: DeckRecord[], sync: SyncMeta | null): boolean {
  if (sync?.hasLocalEdits || sync?.hasSynced) return false
  const visible = records.filter((record) => !record.deletedAt)
  if (visible.length !== 1) return false
  const record = visible[0]!
  if (record.dirty || record.rev !== 0) return false
  return isPristineStarterDeck(record.deck)
}

export function remoteHasVisibleDecks(remote: RemoteIndexEntry[]): boolean {
  return remote.some((entry) => !entry.deletedAt)
}

function conflictOf(
  local: DeckRecord,
  remote: Pick<RemoteIndexEntry, "rev" | "name" | "deletedAt">
): SyncConflict {
  return {
    id: local.id,
    name: local.deck.name.trim() || "未命名卡包",
    localUpdatedAt: local.updatedAt,
    localDeleted: Boolean(local.deletedAt),
    remoteRev: remote.rev,
    remoteDeleted: Boolean(remote.deletedAt),
    remoteName: remote.name.trim() || "未命名卡包",
  }
}

export function planSync(local: DeckRecord[], remote: RemoteIndexEntry[]): SyncAction[] {
  const localById = new Map(local.map((record) => [record.id, record]))
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]))
  const ids = new Set([...localById.keys(), ...remoteById.keys()])
  const actions: SyncAction[] = []

  for (const id of ids) {
    const record = localById.get(id)
    const entry = remoteById.get(id)

    if (!record && entry) {
      if (!entry.deletedAt) actions.push({ type: "pull", id })
      continue
    }

    if (record && !entry) {
      if (record.dirty) {
        actions.push(record.deletedAt ? { type: "push-tombstone", id } : { type: "push", id })
      } else if (record.rev > 0) {
        actions.push({
          type: "apply-tombstone",
          id,
          remoteRev: record.rev,
          remoteUpdatedAt: record.updatedAt,
        })
      }
      continue
    }

    if (!record || !entry) continue

    if (record.deletedAt && entry.deletedAt) {
      if (record.dirty && record.rev === entry.rev) {
        actions.push({ type: "push-tombstone", id })
      }
      continue
    }

    if (record.deletedAt && !entry.deletedAt) {
      if (record.rev < entry.rev) {
        actions.push({ type: "conflict", conflict: conflictOf(record, entry) })
      } else {
        actions.push({ type: "push-tombstone", id })
      }
      continue
    }

    if (!record.deletedAt && entry.deletedAt) {
      if (record.dirty) {
        actions.push({ type: "conflict", conflict: conflictOf(record, entry) })
      } else {
        actions.push({
          type: "apply-tombstone",
          id,
          remoteRev: entry.rev,
          remoteUpdatedAt: entry.updatedAt,
        })
      }
      continue
    }

    if (record.dirty && entry.rev > record.rev) {
      actions.push({ type: "conflict", conflict: conflictOf(record, entry) })
    } else if (record.dirty && entry.rev === record.rev) {
      actions.push({ type: "push", id })
    } else if (!record.dirty && entry.rev > record.rev) {
      actions.push({ type: "pull", id })
    }
  }

  return actions
}

export function defaultStarterDeck(): Deck {
  return createDefaultDeck()
}
