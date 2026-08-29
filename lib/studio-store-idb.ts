import {
  sameDeckRecordSets,
  type DeckRecord,
  type LibraryMeta,
  type StudioStore,
  type SyncMeta,
} from "./studio-store"

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
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error ?? new Error("Unable to open the local database"))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Local database operation failed"))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Local database transaction failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("Local database transaction was aborted"))
  })
}

export function createIdbStore(): StudioStore {
  let dbPromise: Promise<IDBDatabase> | null = null
  const db = () => {
    if (!dbPromise) {
      dbPromise = openDb().catch((error) => {
        dbPromise = null
        throw error
      })
    }
    return dbPromise
  }

  return {
    async getMeta() {
      const conn = await db()
      const value = await requestToPromise(conn.transaction(KV, "readonly").objectStore(KV).get(META_KEY))
      return (value as LibraryMeta | undefined) ?? null
    },
    async setMeta(meta) {
      const conn = await db()
      const transaction = conn.transaction(KV, "readwrite")
      transaction.objectStore(KV).put(meta, META_KEY)
      await transactionDone(transaction)
    },
    async getRecord(id) {
      const conn = await db()
      const value = await requestToPromise(conn.transaction(DECKS, "readonly").objectStore(DECKS).get(id))
      return (value as DeckRecord | undefined) ?? null
    },
    async setRecord(record) {
      const conn = await db()
      const transaction = conn.transaction(DECKS, "readwrite")
      transaction.objectStore(DECKS).put(record)
      await transactionDone(transaction)
    },
    async updateRecord(id, update) {
      const conn = await db()
      const transaction = conn.transaction(DECKS, "readwrite")
      const objectStore = transaction.objectStore(DECKS)
      let next: DeckRecord | null = null
      let updateError: unknown = null
      const done = new Promise<DeckRecord | null>((resolve, reject) => {
        transaction.oncomplete = () => resolve(next)
        transaction.onerror = () => reject(transaction.error ?? new Error("Local database transaction failed"))
        transaction.onabort = () => reject(updateError ?? transaction.error ?? new Error("Local database transaction was aborted"))
      })
      const request = objectStore.get(id)
      request.onsuccess = () => {
        try {
const current = (request.result as DeckRecord | undefined) ?? null
next = update(current)
if (next) objectStore.put(next)
else if (current) objectStore.delete(id)
        } catch (error) {
updateError = error
transaction.abort()
        }
      }
      return done
    },
    async deleteRecord(id) {
      const conn = await db()
      const transaction = conn.transaction(DECKS, "readwrite")
      transaction.objectStore(DECKS).delete(id)
      await transactionDone(transaction)
    },
    async listRecords() {
      const conn = await db()
      const value = await requestToPromise(conn.transaction(DECKS, "readonly").objectStore(DECKS).getAll())
      return (value as DeckRecord[]) ?? []
    },
    async replaceRecordsIfUnchanged(expected, records, meta) {
      const conn = await db()
      const transaction = conn.transaction([DECKS, KV], "readwrite")
      const deckStore = transaction.objectStore(DECKS)
      const metaStore = transaction.objectStore(KV)
      let replaced = false
      let updateError: unknown = null
      const done = new Promise<boolean>((resolve, reject) => {
        transaction.oncomplete = () => resolve(replaced)
        transaction.onerror = () => reject(transaction.error ?? new Error("Local database transaction failed"))
        transaction.onabort = () => reject(updateError ?? transaction.error ?? new Error("Local database transaction was aborted"))
      })
      const request = deckStore.getAll()
      request.onsuccess = () => {
        try {
const current = (request.result as DeckRecord[]) ?? []
if (!sameDeckRecordSets(current, expected)) return
replaced = true
deckStore.clear()
for (const record of records) deckStore.put(record)
metaStore.put(meta, META_KEY)
        } catch (error) {
updateError = error
transaction.abort()
        }
      }
      return done
    },
    async getSyncMeta() {
      const conn = await db()
      const value = await requestToPromise(conn.transaction(KV, "readonly").objectStore(KV).get(SYNC_KEY))
      return (value as SyncMeta | undefined) ?? null
    },
    async setSyncMeta(meta) {
      const conn = await db()
      const transaction = conn.transaction(KV, "readwrite")
      transaction.objectStore(KV).put(meta, SYNC_KEY)
      await transactionDone(transaction)
    },
  }
}
