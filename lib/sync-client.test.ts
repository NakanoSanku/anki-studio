import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createDefaultDeck } from "./deck"
import { loadLibrarySession } from "./library"
import { applyConflictChoice, runSyncCycle } from "./sync-client"
import { isPristineStarterDeck } from "./sync-plan"
import { createMemoryStore, setStudioStore, type DeckRecord, type StudioStore } from "./studio-store"
import type { SyncTransport } from "./sync-transport"
import type { PutDeckBody, RemoteDeckPayload, RemoteIndexEntry } from "./sync-types"

function memoryTransport(init: {
  decks?: Record<string, RemoteDeckPayload>
}): SyncTransport & { decks: Record<string, RemoteDeckPayload> } {
  const decks = { ...(init.decks ?? {}) }
  return {
    decks,
    async status() {
      return { available: true, provider: "google-sheets" }
    },
    async index() {
      return Object.entries(decks).map(([id, payload]) => ({
        id,
        rev: payload.rev,
        name: payload.deck?.name ?? "未命名卡包",
        cardCount: payload.deck?.cards.length ?? 0,
        updatedAt: payload.updatedAt,
        deletedAt: payload.deletedAt,
      })) satisfies RemoteIndexEntry[]
    },
    async getDeck(id) {
      return decks[id] ?? null
    },
    async putDeck(id, body: PutDeckBody) {
      const current = decks[id]
      const currentRev = current?.rev ?? 0
      if (currentRev !== body.expectedRev) {
        return { ok: false, conflict: true, server: current ?? { rev: 0, updatedAt: 0, deck: null } }
      }
      const next: RemoteDeckPayload = {
        rev: currentRev + 1,
        updatedAt: 100,
        deletedAt: body.deletedAt,
        deck: body.deck,
        editorState: body.editorState,
      }
      decks[id] = next
      return { ok: true, rev: next.rev, updatedAt: next.updatedAt }
    },
  }
}

beforeEach(() => {
  setStudioStore(createMemoryStore())
})

afterEach(() => {
  setStudioStore(null)
})

describe("runSyncCycle", () => {
  it("replaces a pristine local starter with remote decks", async () => {
    const store = (await import("./studio-store")).getStudioStore()
    await loadLibrarySession()
    const remoteDeck = { ...createDefaultDeck(), name: "旅行" }
    const transport = memoryTransport({
      decks: {
        "remote-1": { rev: 2, updatedAt: 5, deck: remoteDeck },
      },
    })
    const summary = await runSyncCycle({
      store,
      transport,
      resolveConflict: async () => "defer",
    })
    expect(summary.pulled).toBe(1)
    const records = await store.listRecords()
    expect(records).toHaveLength(1)
    expect(records[0]?.deck.name).toBe("旅行")
    expect(records[0]?.rev).toBe(2)
    expect(isPristineStarterDeck(records[0]!.deck)).toBe(false)
  })

  it("pushes a dirty local deck", async () => {
    const { getStudioStore } = await import("./studio-store")
    const store = getStudioStore()
    const session = await loadLibrarySession()
    const edited = { ...session.deck, name: "本机改" }
    await store.setRecord({
      id: session.library.activeId,
      deck: edited,
      rev: 0,
      dirty: true,
      updatedAt: 1,
    })
    await store.setSyncMeta({ hasSynced: false, hasLocalEdits: true })
    const transport = memoryTransport({ decks: {} })
    const summary = await runSyncCycle({
      store,
      transport,
      resolveConflict: async () => "defer",
    })
    expect(summary.pushed).toBe(1)
    expect(transport.decks[session.library.activeId]?.deck?.name).toBe("本机改")
    const record = await store.getRecord(session.library.activeId)
    expect(record?.dirty).toBe(false)
    expect(record?.rev).toBe(1)
  })

  it("keeps local data when a conflict is deferred", async () => {
    const { getStudioStore } = await import("./studio-store")
    const store = getStudioStore()
    const session = await loadLibrarySession()
    const localDeck = { ...session.deck, name: "本机" }
    const remoteDeck = { ...createDefaultDeck(), name: "云端" }
    const record: DeckRecord = {
      id: session.library.activeId,
      deck: localDeck,
      rev: 1,
      dirty: true,
      updatedAt: 9,
    }
    await store.setRecord(record)
    await store.setSyncMeta({ hasSynced: true, hasLocalEdits: true })
    const transport = memoryTransport({
      decks: {
        [session.library.activeId]: { rev: 2, updatedAt: 10, deck: remoteDeck },
      },
    })
    const summary = await runSyncCycle({
      store,
      transport,
      resolveConflict: async () => "defer",
    })
    expect(summary.deferred).toBe(true)
    expect((await store.getRecord(session.library.activeId))?.deck.name).toBe("本机")
  })
})

describe("applyConflictChoice", () => {
  it("saves a local copy then applies remote", async () => {
    const store: StudioStore = createMemoryStore()
    setStudioStore(store)
    const session = await loadLibrarySession()
    const localDeck = { ...session.deck, name: "本机词汇" }
    await store.setRecord({
      id: session.library.activeId,
      deck: localDeck,
      rev: 1,
      dirty: true,
      updatedAt: 3,
    })
    const remoteDeck = { ...createDefaultDeck(), name: "云端词汇" }
    const transport = memoryTransport({
      decks: {
        [session.library.activeId]: { rev: 2, updatedAt: 4, deck: remoteDeck },
      },
    })
    await applyConflictChoice(store, transport, session.library.activeId, "copy")
    const records = await store.listRecords()
    const names = records.map((item) => item.deck.name).sort()
    expect(names.some((name) => name.includes("本机"))).toBe(true)
    expect(records.find((item) => item.id === session.library.activeId)?.deck.name).toBe("云端词汇")
  })
})
