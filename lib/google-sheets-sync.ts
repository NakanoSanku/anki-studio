import { parseRemoteDeckPayload, parseRemoteIndex } from "./sync-payload"
import type {
  PutDeckBody,
  PutDeckResult,
  RemoteDeckPayload,
  RemoteIndexEntry,
} from "./sync-types"

export const GOOGLE_SHEETS_SCHEMA_VERSION = 1
export const MAX_SYNC_PAYLOAD_BYTES = 8 * 1024 * 1024

export type GoogleSheetsSyncGateway = {
  url: string
  secret: string
}

type ScriptResponse = Record<string, unknown> & {
  ok?: unknown
  error?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function createGoogleSheetsSyncGateway(input: {
  url: string
  secret: string
}): GoogleSheetsSyncGateway {
  let url: URL
  try {
    url = new URL(input.url)
  } catch {
    throw new Error("Google Sheets 同步地址无效")
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "script.google.com" ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
  ) {
    throw new Error("Google Sheets 同步地址必须是 Apps Script 的 /exec 地址")
  }
  if (input.secret.trim().length < 24) throw new Error("Google Sheets 同步密钥无效")
  return { url: url.toString(), secret: input.secret.trim() }
}

async function callGoogleSheets(
  gateway: GoogleSheetsSyncGateway,
  action: "status" | "index" | "get" | "put",
  input: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch
): Promise<ScriptResponse> {
  let response: Response
  try {
    response = await fetchImpl(gateway.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ action, secret: gateway.secret, ...input }),
      cache: "no-store",
      redirect: "follow",
    })
  } catch {
    throw new Error("无法连接 Google Sheets")
  }

  const raw = await response.text()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error("Google Sheets 网关没有返回 JSON，请检查 Web App 的访问权限")
  }
  if (!response.ok) throw new Error(`Google Sheets 网关响应 ${response.status}`)
  if (!isRecord(data)) throw new Error("Google Sheets 网关响应无效")
  if (data.ok !== true) {
    throw new Error(typeof data.error === "string" ? data.error : "Google Sheets 操作失败")
  }
  return data
}

export async function getGoogleSheetsStatus(
  gateway: GoogleSheetsSyncGateway,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const data = await callGoogleSheets(gateway, "status", {}, fetchImpl)
  if (data.schemaVersion !== GOOGLE_SHEETS_SCHEMA_VERSION) {
    throw new Error("Google Sheets 同步表版本不兼容")
  }
}

export async function listGoogleSheetsIndex(
  gateway: GoogleSheetsSyncGateway,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteIndexEntry[]> {
  const data = await callGoogleSheets(gateway, "index", {}, fetchImpl)
  return parseRemoteIndex(data.decks)
}

export async function getGoogleSheetsDeck(
  gateway: GoogleSheetsSyncGateway,
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteDeckPayload | null> {
  const data = await callGoogleSheets(gateway, "get", { id }, fetchImpl)
  return data.payload == null ? null : parseRemoteDeckPayload(data.payload)
}

export async function putGoogleSheetsDeck(
  gateway: GoogleSheetsSyncGateway,
  id: string,
  body: PutDeckBody,
  fetchImpl: typeof fetch = fetch
): Promise<PutDeckResult> {
  const encoded = JSON.stringify(body)
  if (new TextEncoder().encode(encoded).byteLength > MAX_SYNC_PAYLOAD_BYTES) {
    throw new Error("卡包太大，无法同步")
  }
  const data = await callGoogleSheets(gateway, "put", { id, body }, fetchImpl)
  if (!isRecord(data.result)) throw new Error("Google Sheets 未返回保存结果")
  const result = data.result
  if (result.ok === false && result.conflict === true) {
    return { ok: false, conflict: true, server: parseRemoteDeckPayload(result.server) }
  }
  const rev = Number(result.rev)
  const updatedAt = Number(result.updatedAt)
  if (result.ok !== true || !Number.isInteger(rev) || rev < 1 || !Number.isFinite(updatedAt)) {
    throw new Error("Google Sheets 未返回有效版本")
  }
  return { ok: true, rev, updatedAt }
}
