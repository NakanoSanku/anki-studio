import {
  createBlankDeck,
  createCardId,
  createDefaultDeck,
  createNoteGuid,
  parseDeckJson,
  serializeDeck,
  STORAGE_KEY,
  type Deck,
} from "./deck"
import { deleteEditorState } from "./editor-state"

export const LIBRARY_KEY = "anki-studio.library.v1"

export type LibraryEntry = {
  id: string
  name: string
  cardCount: number
  updatedAt: number
}

export type Library = {
  version: 1
  activeId: string
  decks: LibraryEntry[]
}

export type LibrarySession = {
  library: Library
  deck: Deck
}

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage
    return storage ?? null
  } catch {
    return null
  }
}

export function createDeckId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function deckStorageKey(id: string): string {
  return `anki-studio.deck.${id}`
}

export function uniqueDeckName(names: string[], base = "新卡包"): string {
  const trimmed = base.trim() || "新卡包"
  if (!names.includes(trimmed)) return trimmed
  let n = 2
  while (names.includes(`${trimmed} ${n}`)) n += 1
  return `${trimmed} ${n}`
}

export function entryFromDeck(id: string, deck: Deck, updatedAt = Date.now()): LibraryEntry {
  return {
    id,
    name: deck.name.trim() || "未命名卡包",
    cardCount: deck.cards.length,
    updatedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseLibraryJson(raw: string): Library {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("卡包目录无法解析")
  }
  if (!isRecord(data) || data.version !== 1) {
    throw new Error("卡包目录版本无效")
  }
  if (typeof data.activeId !== "string" || !data.activeId) {
    throw new Error("卡包目录缺少当前卡包")
  }
  if (!Array.isArray(data.decks) || data.decks.length === 0) {
    throw new Error("卡包目录是空的")
  }

  const decks: LibraryEntry[] = []
  const seen = new Set<string>()
  for (const item of data.decks) {
    if (!isRecord(item)) continue
    if (typeof item.id !== "string" || !item.id || seen.has(item.id)) continue
    if (typeof item.name !== "string") continue
    seen.add(item.id)
    decks.push({
      id: item.id,
      name: item.name.trim() || "未命名卡包",
      cardCount: typeof item.cardCount === "number" && item.cardCount >= 0 ? item.cardCount : 0,
      updatedAt: typeof item.updatedAt === "number" && item.updatedAt > 0 ? item.updatedAt : Date.now(),
    })
  }
  if (decks.length === 0) {
    throw new Error("卡包目录没有可用项")
  }

  const activeId = decks.some((entry) => entry.id === data.activeId) ? data.activeId : decks[0]!.id
  return { version: 1, activeId, decks }
}

function writeLibrary(storage: StorageLike, library: Library): void {
  storage.setItem(LIBRARY_KEY, JSON.stringify(library))
}

export function readStoredLibraryDeck(id: string): Deck | null {
  const storage = getStorage()
  if (!storage) return null
  const raw = storage.getItem(deckStorageKey(id))
  if (!raw) return null
  try {
    return parseDeckJson(raw)
  } catch {
    return null
  }
}

export function writeStoredLibraryDeck(id: string, deck: Deck): void {
  const storage = getStorage()
  if (!storage) return
  storage.setItem(deckStorageKey(id), serializeDeck(deck))
}

function createSession(storage: StorageLike, deck: Deck): LibrarySession {
  const id = createDeckId()
  const library: Library = {
    version: 1,
    activeId: id,
    decks: [entryFromDeck(id, deck)],
  }
  storage.setItem(deckStorageKey(id), serializeDeck(deck))
  writeLibrary(storage, library)
  return { library, deck }
}

function migrateLegacy(storage: StorageLike): LibrarySession | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  let deck: Deck
  try {
    deck = parseDeckJson(raw)
  } catch {
    deck = createDefaultDeck()
  }
  const session = createSession(storage, deck)
  storage.removeItem(STORAGE_KEY)
  return session
}

function recoverLibrary(storage: StorageLike, parsed: Library): LibrarySession | null {
  const usable: LibraryEntry[] = []
  const decks = new Map<string, Deck>()
  for (const entry of parsed.decks) {
    const deck = readStoredLibraryDeck(entry.id)
    if (!deck) continue
    decks.set(entry.id, deck)
    usable.push(entryFromDeck(entry.id, deck, entry.updatedAt))
  }
  if (usable.length === 0) return null
  const activeId = usable.some((entry) => entry.id === parsed.activeId) ? parsed.activeId : usable[0]!.id
  const library: Library = { version: 1, activeId, decks: usable }
  writeLibrary(storage, library)
  return { library, deck: decks.get(activeId)! }
}

export function loadLibrarySession(): LibrarySession {
  const storage = getStorage()
  if (!storage) {
    const deck = createDefaultDeck()
    return {
      library: {
        version: 1,
        activeId: "pending",
        decks: [entryFromDeck("pending", deck)],
      },
      deck,
    }
  }

  const raw = storage.getItem(LIBRARY_KEY)
  if (raw) {
    try {
      const recovered = recoverLibrary(storage, parseLibraryJson(raw))
      if (recovered) return recovered
    } catch {
      // fall through
    }
  }

  const migrated = migrateLegacy(storage)
  if (migrated) return migrated

  return createSession(storage, createDefaultDeck())
}

export function persistActiveDeck(library: Library, deck: Deck): Library {
  const storage = getStorage()
  if (!storage || library.activeId === "pending") return library
  writeStoredLibraryDeck(library.activeId, deck)
  const next: Library = {
    ...library,
    decks: library.decks.map((entry) =>
      entry.id === library.activeId ? entryFromDeck(entry.id, deck) : entry
    ),
  }
  writeLibrary(storage, next)
  return next
}

function requireUsableLibrary(library: Library): void {
  if (library.activeId === "pending") {
    throw new Error("当前环境无法保存卡包")
  }
}

export function switchLibraryDeck(library: Library, current: Deck, nextId: string): LibrarySession {
  requireUsableLibrary(library)
  if (nextId === library.activeId) {
    return { library: persistActiveDeck(library, current), deck: current }
  }
  persistActiveDeck(library, current)
  const deck = readStoredLibraryDeck(nextId)
  if (!deck) {
    throw new Error("卡包不存在或已损坏")
  }
  const next: Library = { ...library, activeId: nextId }
  const storage = getStorage()
  if (storage) writeLibrary(storage, next)
  return { library: next, deck }
}

export function addLibraryDeck(library: Library, current: Deck, incoming: Deck): LibrarySession {
  requireUsableLibrary(library)
  persistActiveDeck(library, current)
  const names = library.decks.map((entry) => entry.name)
  const deck: Deck = {
    ...incoming,
    name: uniqueDeckName(names, incoming.name),
  }
  const id = createDeckId()
  writeStoredLibraryDeck(id, deck)
  const next: Library = {
    version: 1,
    activeId: id,
    decks: [...library.decks, entryFromDeck(id, deck)],
  }
  const storage = getStorage()
  if (storage) writeLibrary(storage, next)
  return { library: next, deck }
}

export function createLibraryDeck(library: Library, current: Deck, name?: string): LibrarySession {
  const names = [...library.decks.map((entry) => entry.name), current.name]
  return addLibraryDeck(library, current, createBlankDeck(uniqueDeckName(names, name ?? "新卡包")))
}

export function cloneDeckAsCopy(deck: Deck, name: string): Deck {
  return {
    version: 1,
    name,
    fields: [...deck.fields],
    fieldNotes: { ...deck.fieldNotes },
    fieldTts: { ...deck.fieldTts },
    front: deck.front,
    back: deck.back,
    css: deck.css,
    cards: deck.cards.map((card) => ({
      id: createCardId(),
      guid: createNoteGuid(),
      values: { ...card.values },
    })),
  }
}

export function duplicateLibraryDeck(library: Library, current: Deck): LibrarySession {
  const names = [...library.decks.map((entry) => entry.name), current.name]
  return addLibraryDeck(library, current, cloneDeckAsCopy(current, uniqueDeckName(names, `${current.name} 副本`)))
}

export function deleteLibraryDeck(library: Library, current: Deck, id: string): LibrarySession {
  requireUsableLibrary(library)
  if (library.decks.length <= 1) {
    throw new Error("至少保留一个卡包")
  }
  persistActiveDeck(library, current)
  const remaining = library.decks.filter((entry) => entry.id !== id)
  if (remaining.length === library.decks.length) {
    throw new Error("卡包不存在")
  }
  const storage = getStorage()
  storage?.removeItem(deckStorageKey(id))
  deleteEditorState(id)
  const activeId = id === library.activeId ? remaining[0]!.id : library.activeId
  const next: Library = { version: 1, activeId, decks: remaining }
  if (storage) writeLibrary(storage, next)
  const deck = activeId === library.activeId ? current : readStoredLibraryDeck(activeId)
  if (!deck) {
    throw new Error("切换卡包失败")
  }
  return { library: next, deck }
}
