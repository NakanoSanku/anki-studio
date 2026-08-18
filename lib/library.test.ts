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
})

afterEach(() => {
  memory.clear()
})

describe("loadLibrarySession", () => {
  it("migrates the legacy single-deck key", () => {
    const legacy = createDefaultDeck()
    legacy.name = "旧卡包"
    memory.set(STORAGE_KEY, serializeDeck(legacy))
    const session = loadLibrarySession()
    expect(session.deck.name).toBe("旧卡包")
    expect(session.library.decks).toHaveLength(1)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(memory.get(LIBRARY_KEY)).toBeTruthy()
  })

  it("creates a default deck when nothing is stored", () => {
    const session = loadLibrarySession()
    expect(session.deck.name).toBe("单词本")
    expect(session.library.decks).toHaveLength(1)
  })
})

describe("library operations", () => {
  it("creates, switches, duplicates, and refuses to delete the last deck", () => {
    const first = loadLibrarySession()
    persistActiveDeck(first.library, first.deck)

    const created = createLibraryDeck(first.library, first.deck)
    expect(created.library.decks).toHaveLength(2)
    expect(created.deck.name).toBe("新卡包")
    expect(created.library.activeId).not.toBe(first.library.activeId)

    const switched = switchLibraryDeck(created.library, created.deck, first.library.activeId)
    expect(switched.deck.name).toBe(first.deck.name)

    const copied = duplicateLibraryDeck(switched.library, switched.deck)
    expect(copied.deck.name).toContain("副本")
    expect(copied.library.decks).toHaveLength(3)
    expect(copied.deck.cards[0]?.id).not.toBe(switched.deck.cards[0]?.id)

    expect(() => deleteLibraryDeck({ ...copied.library, decks: copied.library.decks.slice(0, 1) }, copied.deck, copied.library.activeId)).toThrow(
      "至少保留一个卡包"
    )

    writeEditorState(copied.library.activeId, {
      selectedId: copied.deck.cards[0]?.id ?? "",
      reviewed: [copied.deck.cards[0]?.id ?? ""],
      flagged: [],
    })
    expect(memory.get(editorStateKey(copied.library.activeId))).toBeTruthy()
    const deleted = deleteLibraryDeck(copied.library, copied.deck, copied.library.activeId)
    expect(deleted.library.decks).toHaveLength(2)
    expect(deleted.library.activeId).not.toBe(copied.library.activeId)
    expect(memory.get(editorStateKey(copied.library.activeId))).toBeUndefined()
  })

  it("imports a deck as a new library item", () => {
    const session = loadLibrarySession()
    const incoming = { ...createDefaultDeck(), name: "旅行词汇" }
    const added = addLibraryDeck(session.library, session.deck, incoming)
    expect(added.library.decks).toHaveLength(2)
    expect(added.deck.name).toBe("旅行词汇")
    expect(added.library.activeId).not.toBe(session.library.activeId)
  })
})
