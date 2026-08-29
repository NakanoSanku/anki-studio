import type {
  PutDeckBody,
  PutDeckResult,
  RemoteIndexEntry,
  SyncStatus,
  RemoteDeckPayload,
} from "./sync-types"
import { readGoogleSheetConnection } from "./google-sheet-connection"
import { GOOGLE_SHEET_ID_HEADER } from "./google-sheet-id"

export type SyncTransport = {
  status(): Promise<SyncStatus>
  index(): Promise<RemoteIndexEntry[]>
  getDeck(id: string): Promise<RemoteDeckPayload | null>
  putDeck(id: string, body: PutDeckBody): Promise<PutDeckResult>
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null)
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error
  }
  return fallback
}

export function createHttpTransport(fetchImpl: typeof fetch = fetch): SyncTransport {
  const request = (input: string, init: RequestInit = {}): Promise<Response> => {
    const connection = readGoogleSheetConnection()
    if (!connection) throw new Error("Choose a Google Sheet for sync first")
    const headers = new Headers(init.headers)
    headers.set(GOOGLE_SHEET_ID_HEADER, connection.id)
    return fetchImpl(input, {
      ...init,
      headers,
    })
  }

  return {
    async status() {
      if (!readGoogleSheetConnection()) {
        return { available: false, reason: "Choose a Google Sheet for sync first" }
      }
      const res = await request("/api/sync/status")
      const data = await readJson(res)
      if (res.status === 401) return { available: false, reason: errorMessage(data, "Connect your Google account first") }
      if (!res.ok) {
        return {
          available: false,
          reason: errorMessage(data, res.status === 503 ? "Google Sheets sync is not configured" : `Sync service error ${res.status}`),
        }
      }
      if (!data || typeof data !== "object") {
        return { available: false, reason: "Invalid sync service response" }
      }
      const status = data as { available?: unknown; provider?: unknown }
      return {
        available: status.available === true,
        provider: status.provider === "google-sheets" ? status.provider : undefined,
      }
    },
    async index() {
      const res = await request("/api/sync")
      const data = await readJson(res)
      if (res.status === 401) throw new Error(errorMessage(data, "Connect your Google account first"))
      if (res.status === 503) throw new Error(errorMessage(data, "Google Sheets sync is not configured"))
      if (!res.ok) throw new Error(errorMessage(data, `Couldn’t read the cloud index (${res.status})`))
      if (!data || typeof data !== "object" || !Array.isArray((data as { decks?: unknown }).decks)) {
        throw new Error("Invalid cloud index response")
      }
      return (data as { decks: RemoteIndexEntry[] }).decks
    },
    async getDeck(id) {
      const res = await request(`/api/sync/decks/${encodeURIComponent(id)}`)
      if (res.status === 404) return null
      const data = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(data, `Couldn’t read the cloud deck (${res.status})`))
      return data as RemoteDeckPayload
    },
    async putDeck(id, body) {
      const res = await request(`/api/sync/decks/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await readJson(res)
      if (res.status === 409 && data && typeof data === "object" && "server" in data) {
        return { ok: false, conflict: true, server: (data as { server: RemoteDeckPayload }).server }
      }
      if (!res.ok) throw new Error(errorMessage(data, `Couldn’t upload the deck (${res.status})`))
      const result = data as { rev?: number; updatedAt?: number }
      if (typeof result.rev !== "number") throw new Error("Cloud sync did not return a revision")
      return {
        ok: true,
        rev: result.rev,
        updatedAt: typeof result.updatedAt === "number" ? result.updatedAt : Date.now(),
      }
    },
  }
}
