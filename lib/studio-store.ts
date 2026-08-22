import type { Deck } from "./deck"

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
  deleteRecord(id: string): Promise<void>
  listRecords(): Promise<DeckRecord[]>
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

export function createMemoryStore(seed?: {
  meta?: LibraryMeta | null
  records?: DeckRecord[]
  syncMeta?: SyncMeta | null
}): StudioStore {
  const records = new Map<string, DeckRecord>()
  for (const record of seed?.records ?? []) {
    records.set(record.id, cloneRecord(record))
  }
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
    async deleteRecord(id) {
      records.delete(id)
    },
    async listRecords() {
      return [...records.values()].map(cloneRecord)
    },
    async getSyncMeta() {
      return syncMeta ? { ...syncMeta } : null
    },
    async setSyncMeta(next) {
      syncMeta = { ...next }
    },
  }
}
