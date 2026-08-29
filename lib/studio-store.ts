import { serializeDeck, type Deck } from "./deck"

export type DeckRecord = {
  id: string
  deck: Deck
  rev: number
  dirty: boolean
  updatedAt: number
  deletedAt?: number
}

export type LibraryMeta = {
  version: 1
  activeId: string
  order: string[]
}

export type SyncMeta = {
  hasSynced: boolean
  hasLocalEdits: boolean
  lastSyncAt?: number
  lastError?: string
}

export type StudioStore = {
  getMeta(): Promise<LibraryMeta | null>
  setMeta(meta: LibraryMeta): Promise<void>
  getRecord(id: string): Promise<DeckRecord | null>
  setRecord(record: DeckRecord): Promise<void>
  updateRecord(
    id: string,
    update: (current: DeckRecord | null) => DeckRecord | null
  ): Promise<DeckRecord | null>
  deleteRecord(id: string): Promise<void>
  listRecords(): Promise<DeckRecord[]>
  replaceRecordsIfUnchanged(
    expected: DeckRecord[],
    records: DeckRecord[],
    meta: LibraryMeta
  ): Promise<boolean>
  getSyncMeta(): Promise<SyncMeta | null>
  setSyncMeta(meta: SyncMeta): Promise<void>
}

let store: StudioStore | null = null

export function setStudioStore(next: StudioStore | null): void {
  store = next
}

export function getStudioStore(): StudioStore {
  if (!store) throw new Error("本机存储未初始化")
  return store
}

export function hasStudioStore(): boolean {
  return store !== null
}

export function isDeckId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{6,80}$/.test(id)
}

export function cloneRecord(record: DeckRecord): DeckRecord {
  return {
    id: record.id,
    deck: record.deck,
    rev: record.rev,
    dirty: record.dirty,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  }
}

export function sameDeckRecord(
  left: DeckRecord | null | undefined,
  right: DeckRecord | null | undefined
): boolean {
  if (!left || !right) return left == null && right == null
  return left.id === right.id
    && left.rev === right.rev
    && left.dirty === right.dirty
    && left.updatedAt === right.updatedAt
    && left.deletedAt === right.deletedAt
    && serializeDeck(left.deck) === serializeDeck(right.deck)
}

export function sameDeckRecordSets(left: DeckRecord[], right: DeckRecord[]): boolean {
  if (left.length !== right.length) return false
  const leftSorted = [...left].sort((a, b) => a.id.localeCompare(b.id))
  const rightSorted = [...right].sort((a, b) => a.id.localeCompare(b.id))
  return leftSorted.every((record, index) => sameDeckRecord(record, rightSorted[index]))
}

export function createMemoryStore(seed?: {
  meta?: LibraryMeta | null
  records?: DeckRecord[]
  syncMeta?: SyncMeta | null
}): StudioStore {
  const records = new Map<string, DeckRecord>()
  for (const record of seed?.records ?? []) records.set(record.id, cloneRecord(record))
  let meta = seed?.meta ? { ...seed.meta, order: [...seed.meta.order] } : null
  let syncMeta = seed?.syncMeta ? { ...seed.syncMeta } : null

  return {
    async getMeta() {
      return meta ? { ...meta, order: [...meta.order] } : null
    },
    async setMeta(next) {
      meta = { ...next, order: [...next.order] }
    },
    async getRecord(id) {
      const record = records.get(id)
      return record ? cloneRecord(record) : null
    },
    async setRecord(record) {
      records.set(record.id, cloneRecord(record))
    },
    async updateRecord(id, update) {
      const current = records.get(id)
      const next = update(current ? cloneRecord(current) : null)
      if (next) records.set(id, cloneRecord(next))
      else records.delete(id)
      return next ? cloneRecord(next) : null
    },
    async deleteRecord(id) {
      records.delete(id)
    },
    async listRecords() {
      return [...records.values()].map(cloneRecord)
    },
    async replaceRecordsIfUnchanged(expected, nextRecords, nextMeta) {
      if (!sameDeckRecordSets([...records.values()], expected)) return false
      records.clear()
      for (const record of nextRecords) records.set(record.id, cloneRecord(record))
      meta = { ...nextMeta, order: [...nextMeta.order] }
      return true
    },
    async getSyncMeta() {
      return syncMeta ? { ...syncMeta } : null
    },
    async setSyncMeta(next) {
      syncMeta = { ...next }
    },
  }
}
