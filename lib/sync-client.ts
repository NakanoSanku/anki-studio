import { parseDeckJson } from "./deck"
import {
  defaultEditorState,
  deleteEditorState,
  pruneEditorState,
  readEditorState,
  writeEditorState,
  type EditorState,
} from "./editor-state"
import { addInactiveDeckCopy, cloneDeckAsCopy, libraryFrom } from "./library"
import { isPristineLocalLibrary, planSync, remoteHasVisibleDecks } from "./sync-plan"
import {
  sameDeckRecord,
  type DeckRecord,
  type LibraryMeta,
  type StudioStore,
} from "./studio-store"
import type { SyncTransport } from "./sync-transport"
import type { ConflictChoice, RemoteDeckPayload, SyncConflict, SyncSummary } from "./sync-types"

export type SyncCycleInput = {
  store: StudioStore
  transport: SyncTransport
  resolveConflict: (conflict: SyncConflict) => Promise<ConflictChoice>
  isLocalStateCurrent?: () => boolean
}

type PreparedPayload = { record: DeckRecord; editor: EditorState }

function parseLivePayload(id: string, payload: RemoteDeckPayload): PreparedPayload {
  if (!payload.deck) throw new Error("Cloud deck payload is empty")
  let deck
  try {
    deck = parseDeckJson(JSON.stringify(payload.deck))
  } catch {
    throw new Error("Cloud deck content is invalid")
  }
  return {
    record: { id, deck, rev: payload.rev, dirty: false, updatedAt: payload.updatedAt, deletedAt: undefined },
    editor: payload.editorState ? pruneEditorState(payload.editorState, deck.cards) : defaultEditorState(deck),
  }
}

function sameOptionalRecord(current: DeckRecord | null, expected: DeckRecord | null): boolean {
  return current === null || expected === null ? current === expected : sameDeckRecord(current, expected)
}

async function applyPayloadIfUnchanged(store: StudioStore, id: string, payload: RemoteDeckPayload, expected: DeckRecord | null): Promise<boolean> {
  if (payload.deletedAt) {
    let applied = false
    await store.updateRecord(id, (current) => {
      if (!sameOptionalRecord(current, expected)) return current
      applied = true
      if (!current) return null
      return { ...current, rev: payload.rev, dirty: false, updatedAt: payload.updatedAt, deletedAt: payload.deletedAt ?? Date.now() }
    })
    if (applied) deleteEditorState(id)
    return applied
  }
  const prepared = parseLivePayload(id, payload)
  let applied = false
  await store.updateRecord(id, (current) => {
    if (!sameOptionalRecord(current, expected)) return current
    applied = true
    return prepared.record
  })
  if (applied) writeEditorState(id, prepared.editor, prepared.record.deck.cards)
  return applied
}

async function applyTombstoneIfUnchanged(store: StudioStore, id: string, remoteRev: number, remoteUpdatedAt: number, expected: DeckRecord | null): Promise<boolean> {
  let applied = false
  await store.updateRecord(id, (current) => {
    if (!sameOptionalRecord(current, expected)) return current
    applied = true
    if (!current) return null
    return { ...current, rev: remoteRev, dirty: false, updatedAt: remoteUpdatedAt || Date.now(), deletedAt: current.deletedAt ?? Date.now() }
  })
  if (applied) deleteEditorState(id)
  return applied
}

async function finalizePush(store: StudioStore, id: string, sent: DeckRecord, result: { rev: number; updatedAt: number }, deletedAt: number | null, localStateCurrent: () => boolean): Promise<boolean> {
  let changed = !localStateCurrent()
  await store.updateRecord(id, (current) => {
    if (!current) { changed = true; return null }
    if (!sameDeckRecord(current, sent)) {
      changed = true
      return { ...current, rev: Math.max(current.rev, result.rev), dirty: true }
    }
    if (changed) return { ...current, rev: result.rev, dirty: true, deletedAt: deletedAt ?? current.deletedAt }
    return { ...sent, rev: result.rev, dirty: false, updatedAt: result.updatedAt, deletedAt: deletedAt ?? undefined }
  })
  return changed
}

async function pushRecord(store: StudioStore, transport: SyncTransport, id: string, tombstone: boolean, localStateCurrent: () => boolean): Promise<{ status: "ok"; localChanged: boolean } | { status: "conflict"; server: RemoteDeckPayload }> {
  const record = await store.getRecord(id)
  if (!record) return { status: "ok", localChanged: false }
  const deletedAt = tombstone || record.deletedAt ? record.deletedAt ?? Date.now() : null
  const result = await transport.putDeck(id, { expectedRev: record.rev, deck: record.deck, deletedAt, editorState: deletedAt ? null : readEditorState(id, record.deck) })
  if (!result.ok) return { status: "conflict", server: result.server }
  return { status: "ok", localChanged: await finalizePush(store, id, record, result, deletedAt, localStateCurrent) }
}

async function replaceWithRemote(store: StudioStore, transport: SyncTransport, remoteIds: string[], expectedLocal: DeckRecord[], localStateCurrent: () => boolean): Promise<{ pulled: number; deferred: boolean }> {
  const payloads = await Promise.all(remoteIds.map(async (id) => ({ id, payload: await transport.getDeck(id) })))
  if (!localStateCurrent()) return { pulled: 0, deferred: true }
  const prepared: Array<{ id: string; data: PreparedPayload }> = []
  for (const { id, payload } of payloads) {
    if (!payload) throw new Error("A cloud deck disappeared while the library was being loaded. Sync again.")
    if (payload.deletedAt) continue
    prepared.push({ id, data: parseLivePayload(id, payload) })
  }
  if (prepared.length === 0) return { pulled: 0, deferred: true }
  const order = prepared.map((item) => item.id)
  const meta: LibraryMeta = { version: 1, activeId: order[0]!, order }
  const replaced = await store.replaceRecordsIfUnchanged(expectedLocal, prepared.map((item) => item.data.record), meta)
  if (!replaced) return { pulled: 0, deferred: true }
  for (const item of prepared) writeEditorState(item.id, item.data.editor, item.data.record.deck.cards)
  for (const local of expectedLocal) if (!order.includes(local.id)) deleteEditorState(local.id)
  return { pulled: prepared.length, deferred: false }
}

export async function runSyncCycle(input: SyncCycleInput): Promise<SyncSummary> {
  const { store, transport, resolveConflict } = input
  const localStateCurrent = input.isLocalStateCurrent ?? (() => true)
  const summary: SyncSummary = { pulled: 0, pushed: 0, conflicts: 0, deferred: false }
  const status = await transport.status()
  if (!status.available) {
    summary.unavailable = status.reason ?? "Cloud sync unavailable"
    await store.setSyncMeta({ ...((await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }), lastError: summary.unavailable })
    return summary
  }
  try {
    const remote = await transport.index()
    const local = await store.listRecords()
    const sync = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }
    if (isPristineLocalLibrary(local, sync) && remoteHasVisibleDecks(remote)) {
      const replaced = await replaceWithRemote(store, transport, remote.filter((entry) => !entry.deletedAt).map((entry) => entry.id), local, localStateCurrent)
      summary.pulled = replaced.pulled
      summary.deferred = replaced.deferred
    } else {
      const actions = planSync(local, remote)
      for (const action of actions) {
        if (!localStateCurrent()) { summary.deferred = true; break }
        if (action.type === "pull") {
const baseline = await store.getRecord(action.id)
const payload = await transport.getDeck(action.id)
if (!payload) continue
if (!localStateCurrent() || !(await applyPayloadIfUnchanged(store, action.id, payload, baseline))) { summary.deferred = true; break }
const meta = await store.getMeta()
if (meta && !meta.order.includes(action.id)) await store.setMeta({ ...meta, order: [...meta.order, action.id] })
summary.pulled += 1
continue
        }
        if (action.type === "apply-tombstone") {
const baseline = await store.getRecord(action.id)
if (!(await applyTombstoneIfUnchanged(store, action.id, action.remoteRev, action.remoteUpdatedAt, baseline))) { summary.deferred = true; break }
summary.pulled += 1
continue
        }
        if (action.type === "push" || action.type === "push-tombstone") {
const pushed = await pushRecord(store, transport, action.id, action.type === "push-tombstone", localStateCurrent)
if (pushed.status === "conflict") {
  summary.conflicts += 1
  const record = await store.getRecord(action.id)
  const choice = await resolveConflict({ id: action.id, name: record?.deck.name ?? "Untitled deck", localUpdatedAt: record?.updatedAt ?? Date.now(), localDeleted: Boolean(record?.deletedAt), remoteRev: pushed.server.rev, remoteDeleted: Boolean(pushed.server.deletedAt), remoteName: pushed.server.deck?.name ?? "Untitled deck" })
  if (choice === "defer" || !(await applyConflictChoice(store, transport, action.id, choice))) { summary.deferred = true; break }
} else {
  summary.pushed += 1
  if (pushed.localChanged) { summary.deferred = true; break }
}
continue
        }
        summary.conflicts += 1
        const choice = await resolveConflict(action.conflict)
        if (choice === "defer" || !(await applyConflictChoice(store, transport, action.conflict.id, choice))) { summary.deferred = true; break }
      }
    }
    const meta = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }
    await store.setSyncMeta({ ...meta, hasSynced: true, lastSyncAt: Date.now(), lastError: summary.deferred ? meta.lastError : undefined })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    summary.error = message
    const meta = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }
    await store.setSyncMeta({ ...meta, lastError: message })
  }
  return summary
}

export async function applyConflictChoice(store: StudioStore, transport: SyncTransport, id: string, choice: Exclude<ConflictChoice, "defer">): Promise<boolean> {
  const local = await store.getRecord(id)
  if (!local) return true
  if (choice === "copy") {
    const remote = await transport.getDeck(id)
    if (!remote) return false
    const current = await store.getRecord(id)
    if (!current || !sameDeckRecord(current, local)) return false
    await addInactiveDeckCopy(cloneDeckAsCopy(local.deck, `${local.deck.name} (local copy)`), `${local.deck.name} (local copy)`)
    return applyPayloadIfUnchanged(store, id, remote, local)
  }
  if (choice === "remote") {
    const remote = await transport.getDeck(id)
    if (!remote) return false
    return applyPayloadIfUnchanged(store, id, remote, local)
  }
  const remote = await transport.getDeck(id)
  let expectedRev = remote?.rev ?? local.rev
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await transport.putDeck(id, { expectedRev, deck: local.deck, deletedAt: local.deletedAt ?? null, editorState: local.deletedAt ? null : readEditorState(id, local.deck) })
    if (result.ok) return !(await finalizePush(store, id, local, result, local.deletedAt ?? null, () => true))
    expectedRev = result.server.rev
  }
  throw new Error("Couldn’t overwrite the cloud deck. Try syncing again.")
}

export async function dirtyCount(store: StudioStore): Promise<number> {
  const records = await store.listRecords()
  return records.filter((record) => record.dirty).length
}

export async function currentLibrary(store: StudioStore) {
  return libraryFrom(await store.getMeta(), await store.listRecords())
}
