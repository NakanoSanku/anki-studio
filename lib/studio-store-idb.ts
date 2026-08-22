import type { DeckRecord, LibraryMeta, StudioStore, SyncMeta } from "./studio-store"

const DB_NAME = "anki-studio.data.v1"
const DB_VERSION = 1
const KV = "kv"
const DECKS = "decks"
const META_KEY = "library"
const SYNC_KEY = "sync-meta"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV)
      if (!db.objectStoreNames.contains(DECKS)) db.createObjectStore(DECKS, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("无法打开本机数据库"))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("本机数据库操作失败"))
  })
}

export function createIdbStore(): StudioStore {
  let dbPromise: Promise<IDBDatabase> | null = null

  const db = () => {
    if (!dbPromise) dbPromise = openDb()
    return dbPromise
  }

  return {
    async getMeta() {
      const conn = await db()
      const value = await requestToPromise(
        conn.transaction(KV, "readonly").objectStore(KV).get(META_KEY)
      )
      return (value as LibraryMeta | undefined) ?? null
    },
    async setMeta(meta) {
      const conn = await db()
      await requestToPromise(conn.transaction(KV, "readwrite").objectStore(KV).put(meta, META_KEY))
    },
    async getRecord(id) {
      const conn = await db()
      const value = await requestToPromise(
        conn.transaction(DECKS, "readonly").objectStore(DECKS).get(id)
      )
      return (value as DeckRecord | undefined) ?? null
    },
    async setRecord(record) {
      const conn = await db()
      await requestToPromise(conn.transaction(DECKS, "readwrite").objectStore(DECKS).put(record))
    },
    async deleteRecord(id) {
      const conn = await db()
      await requestToPromise(conn.transaction(DECKS, "readwrite").objectStore(DECKS).delete(id))
    },
    async listRecords() {
      const conn = await db()
      const value = await requestToPromise(
        conn.transaction(DECKS, "readonly").objectStore(DECKS).getAll()
      )
      return (value as DeckRecord[]) ?? []
    },
    async getSyncMeta() {
      const conn = await db()
      const value = await requestToPromise(
        conn.transaction(KV, "readonly").objectStore(KV).get(SYNC_KEY)
      )
      return (value as SyncMeta | undefined) ?? null
    },
    async setSyncMeta(meta) {
      const conn = await db()
      await requestToPromise(conn.transaction(KV, "readwrite").objectStore(KV).put(meta, SYNC_KEY))
    },
  }
}
