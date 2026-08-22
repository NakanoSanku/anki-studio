import type {
  PutDeckBody,
  PutDeckResult,
  RemoteIndexEntry,
  SyncStatus,
  RemoteDeckPayload,
} from "./sync-types"

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
  return {
    async status() {
      const res = await fetchImpl("/api/sync/status")
      const data = await readJson(res)
      if (res.status === 401) return { available: false, reason: errorMessage(data, "未登录") }
      if (!res.ok) {
        return {
          available: false,
          reason: errorMessage(data, res.status === 503 ? "Google Sheets 同步未配置" : `同步服务 ${res.status}`),
        }
      }
      if (!data || typeof data !== "object") {
        return { available: false, reason: "同步服务响应无效" }
      }
      const status = data as { available?: unknown; provider?: unknown }
      return {
        available: status.available === true,
        provider: status.provider === "google-sheets" ? status.provider : undefined,
      }
    },
    async index() {
      const res = await fetchImpl("/api/sync")
      const data = await readJson(res)
      if (res.status === 401) throw new Error("未登录")
      if (res.status === 503) throw new Error(errorMessage(data, "Google Sheets 同步未配置"))
      if (!res.ok) throw new Error(errorMessage(data, `读取云端目录失败 ${res.status}`))
      if (!data || typeof data !== "object" || !Array.isArray((data as { decks?: unknown }).decks)) {
        throw new Error("云端目录格式无效")
      }
      return (data as { decks: RemoteIndexEntry[] }).decks
    },
    async getDeck(id) {
      const res = await fetchImpl(`/api/sync/decks/${encodeURIComponent(id)}`)
      if (res.status === 404) return null
      const data = await readJson(res)
      if (!res.ok) throw new Error(errorMessage(data, `读取云端卡包失败 ${res.status}`))
      return data as RemoteDeckPayload
    },
    async putDeck(id, body) {
      const res = await fetchImpl(`/api/sync/decks/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await readJson(res)
      if (res.status === 409 && data && typeof data === "object" && "server" in data) {
        return { ok: false, conflict: true, server: (data as { server: RemoteDeckPayload }).server }
      }
      if (!res.ok) throw new Error(errorMessage(data, `上传卡包失败 ${res.status}`))
      const result = data as { rev?: number; updatedAt?: number }
      if (typeof result.rev !== "number") throw new Error("云端未返回版本")
      return {
        ok: true,
        rev: result.rev,
        updatedAt: typeof result.updatedAt === "number" ? result.updatedAt : Date.now(),
      }
    },
  }
}
