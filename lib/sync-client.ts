import { parseDeckJson } from "./deck"
import {
  defaultEditorState,
  pruneEditorState,
  readEditorState,
  writeEditorState,
} from "./editor-state"
import { addInactiveDeckCopy, cloneDeckAsCopy, libraryFrom } from "./library"
import { isPristineLocalLibrary, planSync, remoteHasVisibleDecks } from "./sync-plan"
import type { StudioStore } from "./studio-store"
import type { SyncTransport } from "./sync-transport"
import type {
  ConflictChoice,
  RemoteDeckPayload,
  SyncConflict,
  SyncSummary,
} from "./sync-types"

export type SyncCycleInput = {
  store: StudioStore
  transport: SyncTransport
  resolveConflict: (conflict: SyncConflict) => Promise<ConflictChoice>
}

async function applyPayload(
  store: StudioStore,
  id: string,
  payload: RemoteDeckPayload
): Promise<void> {
  const existing = await store.getRecord(id)
  if (payload.deletedAt) {
    if (existing) {
      await store.setRecord({
        ...existing,
        rev: payload.rev,
        dirty: false,
        updatedAt: payload.updatedAt,
        deletedAt: payload.deletedAt,
      })
    }
    return
  }
  if (!payload.deck) throw new Error("云端卡包是空的")
  const deck = parseDeckJson(JSON.stringify(payload.deck))
  await store.setRecord({
    id,
    deck,
    rev: payload.rev,
    dirty: false,
    updatedAt: payload.updatedAt,
    deletedAt: undefined,
  })
  const editor = payload.editorState
    ? pruneEditorState(payload.editorState, deck.cards)
    : defaultEditorState(deck)
  writeEditorState(id, editor, deck.cards)
}

async function ensureInOrder(store: StudioStore, id: string): Promise<void> {
  const meta = await store.getMeta()
  if (!meta) return
  if (meta.order.includes(id)) return
  await store.setMeta({ ...meta, order: [...meta.order, id] })
}

async function applyTombstone(
  store: StudioStore,
  id: string,
  remoteRev: number,
  remoteUpdatedAt: number
): Promise<void> {
  const existing = await store.getRecord(id)
  if (!existing) return
  await store.setRecord({
    ...existing,
    rev: remoteRev,
    dirty: false,
    updatedAt: remoteUpdatedAt || Date.now(),
    deletedAt: existing.deletedAt ?? Date.now(),
  })
}

async function pushRecord(
  store: StudioStore,
  transport: SyncTransport,
  id: string,
  tombstone: boolean
): Promise<{ status: "ok" } | { status: "conflict"; server: RemoteDeckPayload }> {
  const record = await store.getRecord(id)
  if (!record) return { status: "ok" }
  const deletedAt = tombstone || record.deletedAt ? record.deletedAt ?? Date.now() : null
  const result = await transport.putDeck(id, {
    expectedRev: record.rev,
    deck: record.deck,
    deletedAt,
    editorState: deletedAt ? null : readEditorState(id, record.deck),
  })
  if (!result.ok) {
    return { status: "conflict", server: result.server }
  }
  await store.setRecord({
    ...record,
    rev: result.rev,
    dirty: false,
    updatedAt: result.updatedAt,
    deletedAt: deletedAt ?? undefined,
  })
  return { status: "ok" }
}

async function replaceWithRemote(
  store: StudioStore,
  transport: SyncTransport,
  remoteIds: string[]
): Promise<number> {
  const local = await store.listRecords()
  for (const record of local) {
    await store.deleteRecord(record.id)
  }
  let pulled = 0
  const order: string[] = []
  for (const id of remoteIds) {
    const payload = await transport.getDeck(id)
    if (!payload || payload.deletedAt || !payload.deck) continue
    await applyPayload(store, id, payload)
    order.push(id)
    pulled += 1
  }
  if (order.length === 0) return 0
  await store.setMeta({ version: 1, activeId: order[0]!, order })
  return pulled
}

export async function runSyncCycle(input: SyncCycleInput): Promise<SyncSummary> {
  const { store, transport, resolveConflict } = input
  const summary: SyncSummary = { pulled: 0, pushed: 0, conflicts: 0, deferred: false }

  const status = await transport.status()
  if (!status.available) {
    summary.unavailable = status.reason ?? "云同步不可用"
    await store.setSyncMeta({
      ...((await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }),
      lastError: summary.unavailable,
    })
    return summary
  }

  try {
    const remote = await transport.index()
    const local = await store.listRecords()
    const sync = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }

    if (isPristineLocalLibrary(local, sync) && remoteHasVisibleDecks(remote)) {
      const pulled = await replaceWithRemote(
        store,
        transport,
        remote.filter((entry) => !entry.deletedAt).map((entry) => entry.id)
      )
      summary.pulled = pulled
    } else {
      const actions = planSync(local, remote)
      for (const action of actions) {
        if (action.type === "pull") {
          const payload = await transport.getDeck(action.id)
          if (!payload) continue
          await applyPayload(store, action.id, payload)
          await ensureInOrder(store, action.id)
          summary.pulled += 1
          continue
        }
        if (action.type === "apply-tombstone") {
          await applyTombstone(store, action.id, action.remoteRev, action.remoteUpdatedAt)
          summary.pulled += 1
          continue
        }
        if (action.type === "push" || action.type === "push-tombstone") {
          const pushed = await pushRecord(store, transport, action.id, action.type === "push-tombstone")
          if (pushed.status === "conflict") {
            summary.conflicts += 1
            const record = await store.getRecord(action.id)
            const choice = await resolveConflict({
              id: action.id,
              name: record?.deck.name ?? "未命名卡包",
              localUpdatedAt: record?.updatedAt ?? Date.now(),
              localDeleted: Boolean(record?.deletedAt),
              remoteRev: pushed.server.rev,
              remoteDeleted: Boolean(pushed.server.deletedAt),
              remoteName: pushed.server.deck?.name ?? "未命名卡包",
            })
            if (choice === "defer") {
              summary.deferred = true
              break
            }
            await applyConflictChoice(store, transport, action.id, choice)
          } else {
            summary.pushed += 1
          }
          continue
        }

        summary.conflicts += 1
        const choice = await resolveConflict(action.conflict)
        if (choice === "defer") {
          summary.deferred = true
          break
        }
        await applyConflictChoice(store, transport, action.conflict.id, choice)
      }
    }

    const meta = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }
    await store.setSyncMeta({
      ...meta,
      hasSynced: true,
      lastSyncAt: Date.now(),
      lastError: summary.deferred ? meta.lastError : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败"
    summary.error = message
    const meta = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }
    await store.setSyncMeta({ ...meta, lastError: message })
  }

  return summary
}

export async function applyConflictChoice(
  store: StudioStore,
  transport: SyncTransport,
  id: string,
  choice: Exclude<ConflictChoice, "defer">
): Promise<void> {
  const local = await store.getRecord(id)
  if (!local) return

  if (choice === "copy") {
    await addInactiveDeckCopy(cloneDeckAsCopy(local.deck, `${local.deck.name} 本机`), `${local.deck.name} 本机`)
    const remote = await transport.getDeck(id)
    if (remote) await applyPayload(store, id, remote)
    return
  }

  if (choice === "remote") {
    const remote = await transport.getDeck(id)
    if (remote) await applyPayload(store, id, remote)
    return
  }

  const remote = await transport.getDeck(id)
  let expectedRev = remote?.rev ?? local.rev
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await transport.putDeck(id, {
      expectedRev,
      deck: local.deck,
      deletedAt: local.deletedAt ?? null,
      editorState: local.deletedAt ? null : readEditorState(id, local.deck),
    })
    if (result.ok) {
      await store.setRecord({
        ...local,
        rev: result.rev,
        dirty: false,
        updatedAt: result.updatedAt,
      })
      return
    }
    expectedRev = result.server.rev
  }
  throw new Error("覆盖云端失败，请稍后再同步")
}

export async function dirtyCount(store: StudioStore): Promise<number> {
  const records = await store.listRecords()
  return records.filter((record) => record.dirty).length
}

export async function currentLibrary(store: StudioStore) {
  return libraryFrom(await store.getMeta(), await store.listRecords())
}
