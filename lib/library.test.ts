import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createDefaultDeck, serializeDeck, STORAGE_KEY } from "./deck"
import { editorStateKey, writeEditorState } from "./editor-state"
import {
  addLibraryDeck,
  createLibraryDeck,
  deleteLibraryDeck,
  duplicateLibraryDeck,
  LIBRARY_KEY,
  loadLibrarySession,
  persistActiveDeck,
  switchLibraryDeck,
} from "./library"
import { createMemoryStore, getStudioStore, setStudioStore } from "./studio-store"

const memory = new Map<string, string>()

const storage = {
  getItem(key: string) {
    return memory.get(key) ?? null
  },
  setItem(key: string, value: string) {
    memory.set(key, value)
  },
  removeItem(key: string) {
    memory.delete(key)
  },
}

beforeEach(() => {
  memory.clear()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  })
  setStudioStore(createMemoryStore())
})

afterEach(() => {
  memory.clear()
  setStudioStore(null)
})

describe("loadLibrarySession", () => {
  it("migrates the legacy single-deck key", async () => {
    const legacy = createDefaultDeck()
    legacy.name = "旧卡包"
    memory.set(STORAGE_KEY, serializeDeck(legacy))
    const session = await loadLibrarySession()
    expect(session.deck.name).toBe("旧卡包")
    expect(session.library.decks).toHaveLength(1)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(session.library.decks[0]?.dirty).toBe(true)
  })

  it("creates a default deck when nothing is stored", async () => {
    const session = await loadLibrarySession()
    expect(session.deck.name).toBe("单词本")
    expect(session.library.decks).toHaveLength(1)
    expect(session.library.decks[0]?.dirty).toBe(false)
  })

  it("migrates the multi-deck localStorage library", async () => {
    const first = createDefaultDeck()
    first.name = "一号"
    const id = "deck-one-id"
    memory.set(LIBRARY_KEY, JSON.stringify({
      version: 1,
      activeId: id,
      decks: [{ id, name: "一号", cardCount: 1, updatedAt: 10 }],
    }))
    memory.set(`anki-studio.deck.${id}`, serializeDeck(first))
    const session = await loadLibrarySession()
    expect(session.deck.name).toBe("一号")
    expect(memory.get(LIBRARY_KEY)).toBeUndefined()
    expect(await getStudioStore().getRecord(id)).toBeTruthy()
  })
})

describe("library operations", () => {
  it("creates, switches, duplicates, and refuses to delete the last deck", async () => {
    const first = await loadLibrarySession()
    await persistActiveDeck(first.library, first.deck)

    const created = await createLibraryDeck(first.library, first.deck)
    expect(created.library.decks).toHaveLength(2)
    expect(created.deck.name).toBe("新卡包")
    expect(created.library.activeId).not.toBe(first.library.activeId)

    const switched = await switchLibraryDeck(created.library, created.deck, first.library.activeId)
    expect(switched.deck.name).toBe(first.deck.name)

    const copied = await duplicateLibraryDeck(switched.library, switched.deck)
    expect(copied.deck.name).toContain("副本")
    expect(copied.library.decks).toHaveLength(3)
    expect(copied.deck.cards[0]?.id).not.toBe(switched.deck.cards[0]?.id)

    await expect(
      deleteLibraryDeck(
        { ...copied.library, decks: copied.library.decks.slice(0, 1) },
        copied.deck,
        copied.library.activeId
      )
    ).rejects.toThrow("至少保留一个卡包")

    writeEditorState(copied.library.activeId, {
      selectedId: copied.deck.cards[0]?.id ?? "",
      reviewed: [copied.deck.cards[0]?.id ?? ""],
    })
    expect(memory.get(editorStateKey(copied.library.activeId))).toBeTruthy()
    const deleted = await deleteLibraryDeck(copied.library, copied.deck, copied.library.activeId)
    expect(deleted.library.decks).toHaveLength(2)
    expect(deleted.library.activeId).not.toBe(copied.library.activeId)
    expect(memory.get(editorStateKey(copied.library.activeId))).toBeUndefined()
    const tombstone = await getStudioStore().getRecord(copied.library.activeId)
    expect(tombstone?.deletedAt).toBeGreaterThan(0)
    expect(tombstone?.dirty).toBe(true)
  })

  it("imports a deck as a new library item", async () => {
    const session = await loadLibrarySession()
    const incoming = { ...createDefaultDeck(), name: "旅行词汇" }
    const added = await addLibraryDeck(session.library, session.deck, incoming)
    expect(added.library.decks).toHaveLength(2)
    expect(added.deck.name).toBe("旅行词汇")
    expect(added.library.activeId).not.toBe(session.library.activeId)
  })

  it("marks a changed deck dirty", async () => {
    const session = await loadLibrarySession()
    const edited = { ...session.deck, name: "改名" }
    const next = await persistActiveDeck(session.library, edited)
    expect(next.decks[0]?.dirty).toBe(true)
    expect(next.decks[0]?.name).toBe("改名")
  })
})
