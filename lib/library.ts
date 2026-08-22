import {
  createBlankDeck,
  createCardId,
  createDefaultDeck,
  createNoteGuid,
  fsrsOf,
  parseDeckJson,
  serializeDeck,
  STORAGE_KEY,
  templatesOf,
  type Deck,
} from "./deck"
import { deleteEditorState } from "./editor-state"
import {
  getStudioStore,
  type DeckRecord,
  type LibraryMeta,
  type StudioStore,
} from "./studio-store"

export const LIBRARY_KEY = "anki-studio.library.v1"

export type LibraryEntry = {
  id: string
  name: string
  cardCount: number
  updatedAt: number
  rev: number
  dirty: boolean
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
    rev: 0,
    dirty: false,
  }
}

export function entryFromRecord(record: DeckRecord): LibraryEntry {
  return {
    id: record.id,
    name: record.deck.name.trim() || "未命名卡包",
    cardCount: record.deck.cards.length,
    updatedAt: record.updatedAt,
    rev: record.rev,
    dirty: record.dirty,
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
      rev: typeof item.rev === "number" && item.rev >= 0 ? item.rev : 0,
      dirty: Boolean(item.dirty),
    })
  }
  if (decks.length === 0) {
    throw new Error("卡包目录没有可用项")
  }

  const activeId = decks.some((entry) => entry.id === data.activeId) ? data.activeId : decks[0]!.id
  return { version: 1, activeId, decks }
}

export function libraryFrom(meta: LibraryMeta | null, records: DeckRecord[]): Library {
  const byId = new Map(records.map((record) => [record.id, record]))
  const order = meta?.order ?? records.map((record) => record.id)
  const decks: LibraryEntry[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const record = byId.get(id)
    if (!record || record.deletedAt || seen.has(id)) continue
    seen.add(id)
    decks.push(entryFromRecord(record))
  }
  for (const record of records) {
    if (record.deletedAt || seen.has(record.id)) continue
    seen.add(record.id)
    decks.push(entryFromRecord(record))
  }
  const activeId = decks.some((entry) => entry.id === meta?.activeId)
    ? meta!.activeId
    : decks[0]?.id ?? ""
  return { version: 1, activeId, decks }
}

export async function readLibrary(): Promise<Library> {
  const store = getStudioStore()
  return libraryFrom(await store.getMeta(), await store.listRecords())
}

async function markLocalEdits(store: StudioStore): Promise<void> {
  const sync = (await store.getSyncMeta()) ?? { hasSynced: false, hasLocalEdits: false }
  if (!sync.hasLocalEdits) {
    await store.setSyncMeta({ ...sync, hasLocalEdits: true })
  }
}

async function createFresh(
  deck: Deck,
  extra: { dirty: boolean; hasLocalEdits: boolean }
): Promise<LibrarySession> {
  const store = getStudioStore()
  const id = createDeckId()
  const now = Date.now()
  const record: DeckRecord = { id, deck, rev: 0, dirty: extra.dirty, updatedAt: now }
  const meta: LibraryMeta = { version: 1, activeId: id, order: [id] }
  await store.setRecord(record)
  await store.setMeta(meta)
  await store.setSyncMeta({ hasSynced: false, hasLocalEdits: extra.hasLocalEdits })
  return { library: libraryFrom(meta, [record]), deck }
}

async function migrateLegacy(): Promise<LibrarySession | null> {
  const store = getStudioStore()
  const storage = getStorage()
  if (!storage) return null

  const rawLib = storage.getItem(LIBRARY_KEY)
  if (rawLib) {
    try {
      const parsed = parseLibraryJson(rawLib)
      const records: DeckRecord[] = []
      const order: string[] = []
      for (const entry of parsed.decks) {
        const raw = storage.getItem(deckStorageKey(entry.id))
        if (!raw) continue
        try {
          const deck = parseDeckJson(raw)
          records.push({
            id: entry.id,
            deck,
            rev: 0,
            dirty: true,
            updatedAt: entry.updatedAt,
          })
          order.push(entry.id)
          storage.removeItem(deckStorageKey(entry.id))
        } catch {
          // skip broken deck
        }
      }
      if (records.length > 0) {
        const activeId = records.some((record) => record.id === parsed.activeId)
          ? parsed.activeId
          : records[0]!.id
        for (const record of records) {
          await store.setRecord(record)
        }
        await store.setMeta({ version: 1, activeId, order })
        await store.setSyncMeta({ hasSynced: false, hasLocalEdits: true })
        storage.removeItem(LIBRARY_KEY)
        storage.removeItem(STORAGE_KEY)
        const active = records.find((record) => record.id === activeId)!
        return { library: libraryFrom({ version: 1, activeId, order }, records), deck: active.deck }
      }
    } catch {
      // fall through
    }
  }

  const rawDeck = storage.getItem(STORAGE_KEY)
  if (!rawDeck) return null
  let deck: Deck
  try {
    deck = parseDeckJson(rawDeck)
  } catch {
    deck = createDefaultDeck()
  }
  storage.removeItem(STORAGE_KEY)
  return createFresh(deck, { dirty: true, hasLocalEdits: true })
}

let loadInflight: Promise<LibrarySession> | null = null

export async function loadLibrarySession(): Promise<LibrarySession> {
  if (loadInflight) return loadInflight
  loadInflight = loadLibrarySessionUncached()
  try {
    return await loadInflight
  } finally {
    loadInflight = null
  }
}

async function loadLibrarySessionUncached(): Promise<LibrarySession> {
  const store = getStudioStore()
  const rawRecords = await store.listRecords()
  const records: DeckRecord[] = []
  let upgraded = false
  for (const record of rawRecords) {
    try {
      const deck = parseDeckJson(serializeDeck(record.deck))
      const needsUpgrade =
        record.deck.version !== 2 ||
        !Array.isArray(record.deck.templates) ||
        !record.deck.fsrs
      const next = needsUpgrade
        ? { ...record, deck, dirty: true, updatedAt: Date.now() }
        : { ...record, deck }
      records.push(next)
      if (needsUpgrade) {
        upgraded = true
        await store.setRecord(next)
      }
    } catch {
      // Keep an unreadable record out of the visible library without deleting it.
    }
  }
  if (upgraded) await markLocalEdits(store)
  const visible = records.filter((record) => !record.deletedAt)
  if (visible.length > 0) {
    const meta = await store.getMeta()
    const library = libraryFrom(meta, records)
    const active = records.find((record) => record.id === library.activeId && !record.deletedAt)
    if (active) return { library, deck: active.deck }
  }

  const migrated = await migrateLegacy()
  if (migrated) return migrated

  return createFresh(createDefaultDeck(), { dirty: false, hasLocalEdits: false })
}

export async function persistActiveDeck(library: Library, deck: Deck): Promise<Library> {
  const store = getStudioStore()
  if (library.activeId === "pending") return library
  const current = await store.getRecord(library.activeId)
  if (!current || current.deletedAt) {
    return libraryFrom(await store.getMeta(), await store.listRecords())
  }
  const normalized = parseDeckJson(serializeDeck(deck))
  if (serializeDeck(current.deck) === serializeDeck(normalized)) {
    return libraryFrom(await store.getMeta(), await store.listRecords())
  }
  await store.setRecord({
    ...current,
    deck: normalized,
    dirty: true,
    updatedAt: Date.now(),
  })
  await markLocalEdits(store)
  return libraryFrom(await store.getMeta(), await store.listRecords())
}

function requireUsableLibrary(library: Library): void {
  if (library.activeId === "pending") {
    throw new Error("当前环境无法保存卡包")
  }
}

export async function switchLibraryDeck(
  library: Library,
  current: Deck,
  nextId: string
): Promise<LibrarySession> {
  requireUsableLibrary(library)
  await persistActiveDeck(library, current)
  const store = getStudioStore()
  if (nextId === library.activeId) {
    const record = await store.getRecord(nextId)
    return { library: await readLibrary(), deck: record?.deck ?? current }
  }
  const record = await store.getRecord(nextId)
  if (!record || record.deletedAt) {
    throw new Error("卡包不存在或已损坏")
  }
  const meta = await store.getMeta()
  if (!meta) throw new Error("卡包目录损坏")
  await store.setMeta({ ...meta, activeId: nextId })
  return { library: await readLibrary(), deck: record.deck }
}

export async function addLibraryDeck(
  library: Library,
  current: Deck,
  incoming: Deck
): Promise<LibrarySession> {
  requireUsableLibrary(library)
  await persistActiveDeck(library, current)
  const store = getStudioStore()
  const names = library.decks.map((entry) => entry.name)
  const deck: Deck = {
    ...incoming,
    name: uniqueDeckName(names, incoming.name),
  }
  const id = createDeckId()
  const record: DeckRecord = {
    id,
    deck,
    rev: 0,
    dirty: true,
    updatedAt: Date.now(),
  }
  await store.setRecord(record)
  const meta = await store.getMeta()
  if (!meta) throw new Error("卡包目录损坏")
  await store.setMeta({ version: 1, activeId: id, order: [...meta.order, id] })
  await markLocalEdits(store)
  return { library: await readLibrary(), deck }
}

export async function addInactiveDeckCopy(incoming: Deck, name: string): Promise<string> {
  const store = getStudioStore()
  const library = await readLibrary()
  const deck: Deck = {
    ...incoming,
    name: uniqueDeckName(library.decks.map((entry) => entry.name), name),
  }
  const id = createDeckId()
  await store.setRecord({
    id,
    deck,
    rev: 0,
    dirty: true,
    updatedAt: Date.now(),
  })
  const meta = await store.getMeta()
  if (!meta) throw new Error("卡包目录损坏")
  await store.setMeta({ ...meta, order: [...meta.order, id] })
  await markLocalEdits(store)
  return id
}

export async function createLibraryDeck(
  library: Library,
  current: Deck,
  name?: string
): Promise<LibrarySession> {
  const names = [...library.decks.map((entry) => entry.name), current.name]
  return addLibraryDeck(library, current, createBlankDeck(uniqueDeckName(names, name ?? "新卡包")))
}

export function cloneDeckAsCopy(deck: Deck, name: string): Deck {
  const templates = templatesOf(deck).map((template) => ({ ...template }))
  return {
    version: 2,
    name,
    fields: [...deck.fields],
    fieldNotes: { ...deck.fieldNotes },
    fieldTts: { ...deck.fieldTts },
    front: templates[0]!.front,
    back: templates[0]!.back,
    templates,
    css: deck.css,
    cards: deck.cards.map((card) => ({
      id: createCardId(),
      guid: createNoteGuid(),
      values: { ...card.values },
    })),
    fsrs: { ...fsrsOf(deck), cards: {} },
  }
}

export async function duplicateLibraryDeck(library: Library, current: Deck): Promise<LibrarySession> {
  const names = [...library.decks.map((entry) => entry.name), current.name]
  return addLibraryDeck(
    library,
    current,
    cloneDeckAsCopy(current, uniqueDeckName(names, `${current.name} 副本`))
  )
}

export async function deleteLibraryDeck(
  library: Library,
  current: Deck,
  id: string
): Promise<LibrarySession> {
  requireUsableLibrary(library)
  if (library.decks.length <= 1) {
    throw new Error("至少保留一个卡包")
  }
  await persistActiveDeck(library, current)
  const store = getStudioStore()
  const record = await store.getRecord(id)
  if (!record || record.deletedAt) {
    throw new Error("卡包不存在")
  }
  await store.setRecord({
    ...record,
    deletedAt: Date.now(),
    dirty: true,
    updatedAt: Date.now(),
  })
  deleteEditorState(id)
  await markLocalEdits(store)
  const meta = await store.getMeta()
  if (!meta) throw new Error("卡包目录损坏")
  const remaining = (await store.listRecords()).filter((item) => !item.deletedAt)
  const activeId = id === meta.activeId ? remaining[0]!.id : meta.activeId
  await store.setMeta({ ...meta, activeId })
  const nextLibrary = await readLibrary()
  const nextRecord =
    activeId === id ? remaining[0] : await store.getRecord(activeId)
  if (!nextRecord || nextRecord.deletedAt) {
    throw new Error("切换卡包失败")
  }
  return { library: nextLibrary, deck: nextRecord.deck }
}
