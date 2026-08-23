import { Buffer } from "node:buffer"

import { googleSpreadsheetUrl, isGoogleSpreadsheetId } from "./google-sheet-id"
import { parseRemoteDeckPayload, parseRemoteIndex } from "./sync-payload"
import type {
  PutDeckBody,
  PutDeckResult,
  RemoteDeckPayload,
  RemoteIndexEntry,
} from "./sync-types"

const SHEETS_API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets"
const DATA_SHEET_NAME = "_anki_studio_sync"
const HAS_WRITTEN_METADATA_KEY = "anki_studio_has_data"
const CHUNK_SIZE = 40_000
const HEADERS = [
  "deck_id",
  "revision",
  "updated_at",
  "deleted_at",
  "name",
  "card_count",
  "part_index",
  "part_count",
  "payload_base64",
  "schema_version",
  "version_id",
] as const

export const GOOGLE_SHEETS_SCHEMA_VERSION = 2
export const MAX_SYNC_PAYLOAD_BYTES = 8 * 1024 * 1024

export type GoogleSheetsClient = {
  spreadsheetId: string
  accessToken: string
}

export type GoogleSheetDetails = {
  id: string
  title: string
  url: string
}

type SheetProperties = {
  sheetId?: number
  title?: string
  hidden?: boolean
  gridProperties?: { frozenRowCount?: number }
}

type SpreadsheetMetadata = {
  spreadsheetId?: string
  properties?: { title?: string }
  sheets?: Array<{ properties?: SheetProperties }>
  developerMetadata?: Array<{
    metadataKey?: string
    metadataValue?: string
  }>
}

type BatchUpdateResponse = {
  replies?: Array<{ addSheet?: { properties?: SheetProperties } }>
}

type ValuesResponse = {
  values?: unknown[][]
}

type DataSheet = {
  sheetId: number
  title: string
}

type SyncRow = {
  rowNumber: number
  id: string
  revision: number
  updatedAt: number
  deletedAt: unknown
  name: string
  cardCount: number
  partIndex: number
  partCount: number
  payload: string
  schemaVersion: number
  versionId: string
}

type SyncVersion = {
  revision: number
  versionId: string
  rows: SyncRow[]
}

type GoogleErrorPayload = {
  error?: { message?: unknown }
}

export class GoogleSheetsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "GoogleSheetsApiError"
  }
}

export function createGoogleSheetsClient(input: {
  spreadsheetId: string
  accessToken: string
}): GoogleSheetsClient {
  if (!isGoogleSpreadsheetId(input.spreadsheetId)) {
    throw new Error("Google Sheet ID 无效")
  }
  if (!input.accessToken.trim()) throw new Error("Google 授权已失效")
  return {
    spreadsheetId: input.spreadsheetId,
    accessToken: input.accessToken.trim(),
  }
}

function apiMessage(status: number, payload: unknown): string {
  const message = payload && typeof payload === "object"
    ? (payload as GoogleErrorPayload).error?.message
    : undefined
  if (status === 401) return "Google 授权已失效，请重新连接帐号"
  if (status === 403) return "当前帐号无权访问这个 Google Sheet"
  if (status === 404) return "找不到这个 Google Sheet"
  return typeof message === "string" && message.trim()
    ? message.slice(0, 240)
    : `Google Sheets API 响应 ${status}`
}

async function sheetsRequest<T>(
  client: GoogleSheetsClient,
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  let response: Response
  try {
    response = await fetchImpl(
      `${SHEETS_API_ROOT}/${encodeURIComponent(client.spreadsheetId)}${path}`,
      {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${client.accessToken}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        cache: "no-store",
      }
    )
  } catch {
    throw new GoogleSheetsApiError("无法连接 Google Sheets", 503)
  }

  const data = await response.json().catch(() => null) as unknown
  if (!response.ok) throw new GoogleSheetsApiError(apiMessage(response.status, data), response.status)
  return (data ?? {}) as T
}

function quotedRange(range: string): string {
  return `'${DATA_SHEET_NAME}'!${range}`
}

async function readValues(
  client: GoogleSheetsClient,
  range: string,
  fetchImpl: typeof fetch
): Promise<unknown[][]> {
  const query = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" })
  const data = await sheetsRequest<ValuesResponse>(
    client,
    `/values/${encodeURIComponent(quotedRange(range))}?${query}`,
    {},
    fetchImpl
  )
  return Array.isArray(data.values) ? data.values : []
}

async function updateValues(
  client: GoogleSheetsClient,
  range: string,
  values: unknown[][],
  fetchImpl: typeof fetch
): Promise<void> {
  const query = new URLSearchParams({ valueInputOption: "RAW" })
  await sheetsRequest(
    client,
    `/values/${encodeURIComponent(quotedRange(range))}?${query}`,
    { method: "PUT", body: JSON.stringify({ values }) },
    fetchImpl
  )
}

async function appendValues(
  client: GoogleSheetsClient,
  values: unknown[][],
  fetchImpl: typeof fetch
): Promise<void> {
  const query = new URLSearchParams({
    insertDataOption: "INSERT_ROWS",
    valueInputOption: "RAW",
  })
  await sheetsRequest(
    client,
    `/values/${encodeURIComponent(quotedRange("A:K"))}:append?${query}`,
    { method: "POST", body: JSON.stringify({ values }) },
    fetchImpl
  )
}

async function batchUpdate(
  client: GoogleSheetsClient,
  requests: unknown[],
  fetchImpl: typeof fetch
): Promise<BatchUpdateResponse> {
  return sheetsRequest<BatchUpdateResponse>(
    client,
    ":batchUpdate",
    { method: "POST", body: JSON.stringify({ requests }) },
    fetchImpl
  )
}

async function readSpreadsheetMetadata(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch
): Promise<SpreadsheetMetadata> {
  const fields = [
    "spreadsheetId",
    "properties(title)",
    "sheets(properties(sheetId,title,hidden,gridProperties(frozenRowCount)))",
    "developerMetadata(metadataKey,metadataValue)",
  ].join(",")
  return sheetsRequest<SpreadsheetMetadata>(
    client,
    `?${new URLSearchParams({ fields })}`,
    {},
    fetchImpl
  )
}

function hasWrittenData(metadata: SpreadsheetMetadata): boolean {
  return (metadata.developerMetadata ?? []).some((item) => (
    item.metadataKey === HAS_WRITTEN_METADATA_KEY && item.metadataValue === "1"
  ))
}

function rowHasValue(row: unknown[] | undefined): boolean {
  return Boolean(row?.some((value) => value !== "" && value != null))
}

function headerMatches(row: unknown[]): boolean {
  return HEADERS.every((header, index) => row[index] === header)
}

async function ensureDataSheet(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch
): Promise<DataSheet> {
  const metadata = await readSpreadsheetMetadata(client, fetchImpl)
  const alreadyWritten = hasWrittenData(metadata)
  let properties = metadata.sheets?.find(
    (sheet) => sheet.properties?.title === DATA_SHEET_NAME
  )?.properties

  if (!properties) {
    if (alreadyWritten) {
      throw new Error("Google Sheet 同步工作表已被删除，请先从备份恢复")
    }
    const created = await batchUpdate(client, [{
      addSheet: {
        properties: {
          title: DATA_SHEET_NAME,
          hidden: true,
          gridProperties: {
            columnCount: HEADERS.length,
            frozenRowCount: 1,
            rowCount: 1000,
          },
        },
      },
    }], fetchImpl)
    properties = created.replies?.[0]?.addSheet?.properties
  }

  if (typeof properties?.sheetId !== "number") {
    throw new Error("Google Sheet 同步工作表初始化失败")
  }

  const preview = await readValues(client, "A1:K2", fetchImpl)
  const header = preview[0] ?? []
  if (!rowHasValue(header)) {
    if (alreadyWritten) {
      throw new Error("Google Sheet 同步表头已被清空，请先从备份恢复")
    }
    await updateValues(client, "A1:K1", [[...HEADERS]], fetchImpl)
  } else if (!headerMatches(header)) {
    throw new Error("Google Sheet 同步表结构不兼容")
  }

  if (alreadyWritten && !rowHasValue(preview[1])) {
    throw new Error("Google Sheet 同步数据已被清空，请先从备份恢复")
  }

  if (properties.hidden !== true || properties.gridProperties?.frozenRowCount !== 1) {
    await batchUpdate(client, [{
      updateSheetProperties: {
        properties: {
          sheetId: properties.sheetId,
          hidden: true,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: "hidden,gridProperties.frozenRowCount",
      },
    }], fetchImpl)
  }

  return {
    sheetId: properties.sheetId,
    title: metadata.properties?.title?.trim() || "Google Sheet",
  }
}

function positiveNumberOrNull(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

async function readRows(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch
): Promise<{ dataSheet: DataSheet; rows: SyncRow[] }> {
  const dataSheet = await ensureDataSheet(client, fetchImpl)
  const values = await readValues(client, "A2:K", fetchImpl)
  const rows: SyncRow[] = []
  values.forEach((valuesRow, index) => {
    if (!rowHasValue(valuesRow)) return
    const row: SyncRow = {
      rowNumber: index + 2,
      id: String(valuesRow[0] ?? ""),
      revision: Number(valuesRow[1]),
      updatedAt: Number(valuesRow[2]),
      deletedAt: valuesRow[3],
      name: String(valuesRow[4] ?? ""),
      cardCount: Number(valuesRow[5]),
      partIndex: Number(valuesRow[6]),
      partCount: Number(valuesRow[7]),
      payload: String(valuesRow[8] ?? ""),
      schemaVersion: Number(valuesRow[9]),
      versionId: String(valuesRow[10] ?? ""),
    }
    if (
      !/^[A-Za-z0-9_-]{6,80}$/.test(row.id)
      || !Number.isSafeInteger(row.revision)
      || row.revision <= 0
      || !Number.isFinite(row.updatedAt)
      || !Number.isInteger(row.partIndex)
      || row.partIndex < 0
      || !Number.isInteger(row.partCount)
      || row.partCount <= 0
      || !row.payload
      || row.schemaVersion !== GOOGLE_SHEETS_SCHEMA_VERSION
      || !/^[A-Za-z0-9_-]{16,80}$/.test(row.versionId)
    ) {
      throw new Error("Google Sheet 同步数据已损坏，请先从备份恢复")
    }
    rows.push(row)
  })
  return { dataSheet, rows }
}

function findCurrentVersion(rows: SyncRow[], id: string): SyncVersion | null {
  const matching = rows.filter((row) => row.id === id)
  if (matching.length === 0) return null
  const revision = matching.reduce((latest, row) => Math.max(latest, row.revision), 0)
  const byVersion = new Map<string, SyncRow[]>()
  for (const row of matching) {
    if (row.revision !== revision) continue
    byVersion.set(row.versionId, [...(byVersion.get(row.versionId) ?? []), row])
  }
  const winner = [...byVersion.entries()].sort((left, right) => {
    const leftUpdated = Math.max(...left[1].map((row) => row.updatedAt))
    const rightUpdated = Math.max(...right[1].map((row) => row.updatedAt))
    return rightUpdated - leftUpdated || right[0].localeCompare(left[0])
  })[0]
  return winner ? { revision, versionId: winner[0], rows: winner[1] } : null
}

function decodePayload(version: SyncVersion): RemoteDeckPayload {
  const rows = version.rows.slice().sort((left, right) => left.partIndex - right.partIndex)
  const partCount = rows.length > 0 ? rows[0]!.partCount : 0
  if (!partCount || rows.length !== partCount) {
    throw new Error("Google Sheet 中的卡包分块不完整")
  }
  rows.forEach((row, index) => {
    if (
      row.partIndex !== index
      || row.partCount !== partCount
      || row.schemaVersion !== GOOGLE_SHEETS_SCHEMA_VERSION
      || row.versionId !== version.versionId
    ) {
      throw new Error("Google Sheet 中的卡包分块无效")
    }
  })
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(rows.map((row) => row.payload).join(""), "base64url").toString("utf8"))
  } catch {
    throw new Error("Google Sheet 中的卡包内容无法解析")
  }
  const payload = parseRemoteDeckPayload(raw)
  if (payload.rev !== version.revision) {
    throw new Error("Google Sheet 中的卡包版本无效")
  }
  return payload
}

function chunk(value: string): string[] {
  const chunks: string[] = []
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE))
  }
  return chunks.length > 0 ? chunks : [""]
}

function nextRevision(currentRevision: number): number {
  const random = crypto.getRandomValues(new Uint16Array(1))[0]! & 0x07ff
  return Math.max(currentRevision + 1, Date.now() * 2048 + random)
}

async function markHasWrittenData(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch
): Promise<void> {
  const metadata = await readSpreadsheetMetadata(client, fetchImpl)
  if (hasWrittenData(metadata)) return
  await batchUpdate(client, [{
    createDeveloperMetadata: {
      developerMetadata: {
        location: { spreadsheet: true },
        metadataKey: HAS_WRITTEN_METADATA_KEY,
        metadataValue: "1",
        visibility: "DOCUMENT",
      },
    },
  }], fetchImpl)
}

function deletionRequests(sheetId: number, rowNumbers: number[]): unknown[] {
  if (rowNumbers.length === 0) return []
  const rows = [...new Set(rowNumbers)].sort((left, right) => right - left)
  const ranges: Array<{ start: number; end: number }> = []
  let end = rows[0]!
  let start = end
  for (let index = 1; index <= rows.length; index += 1) {
    const row = rows[index]
    if (row === start - 1) {
      start = row
      continue
    }
    ranges.push({ start, end })
    if (row != null) {
      start = row
      end = row
    }
  }
  return ranges.map((range) => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: range.start - 1,
        endIndex: range.end,
      },
    },
  }))
}

export async function connectGoogleSheet(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleSheetDetails> {
  const dataSheet = await ensureDataSheet(client, fetchImpl)
  return {
    id: client.spreadsheetId,
    title: dataSheet.title,
    url: googleSpreadsheetUrl(client.spreadsheetId),
  }
}

export async function getGoogleSheetsStatus(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleSheetDetails> {
  return connectGoogleSheet(client, fetchImpl)
}

export async function listGoogleSheetsIndex(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteIndexEntry[]> {
  const { rows } = await readRows(client, fetchImpl)
  const ids = [...new Set(rows.map((row) => row.id))]
  return parseRemoteIndex(ids.map((id) => {
    const current = findCurrentVersion(rows, id)
    if (!current) return null
    const first = current.rows[0]!
    return {
      id,
      rev: current.revision,
      name: first.name || "未命名卡包",
      cardCount: Math.max(0, first.cardCount || 0),
      updatedAt: Math.max(0, first.updatedAt || 0),
      deletedAt: positiveNumberOrNull(first.deletedAt),
    }
  }).filter((entry) => entry !== null))
}

export async function getGoogleSheetsDeck(
  client: GoogleSheetsClient,
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteDeckPayload | null> {
  const { rows } = await readRows(client, fetchImpl)
  const current = findCurrentVersion(rows, id)
  return current ? decodePayload(current) : null
}

export async function putGoogleSheetsDeck(
  client: GoogleSheetsClient,
  id: string,
  body: PutDeckBody,
  fetchImpl: typeof fetch = fetch
): Promise<PutDeckResult> {
  const { dataSheet, rows: allRows } = await readRows(client, fetchImpl)
  const current = findCurrentVersion(allRows, id)
  const currentPayload = current ? decodePayload(current) : null
  const currentRevision = currentPayload?.rev ?? 0
  if (currentRevision !== body.expectedRev) {
    return {
      ok: false,
      conflict: true,
      server: currentPayload ?? { rev: 0, updatedAt: 0, deletedAt: null, deck: null, editorState: null },
    }
  }

  const deletedAt = positiveNumberOrNull(body.deletedAt)
  const deck = body.deck ?? currentPayload?.deck ?? null
  if (!deletedAt && !deck) throw new Error("缺少卡包内容")

  const revision = nextRevision(currentRevision)
  const updatedAt = Date.now()
  const versionId = crypto.randomUUID()
  const payload: RemoteDeckPayload = {
    rev: revision,
    updatedAt,
    deletedAt,
    deck,
    editorState: deletedAt ? null : body.editorState ?? currentPayload?.editorState ?? null,
  }
  const json = JSON.stringify(payload)
  if (Buffer.byteLength(json, "utf8") > MAX_SYNC_PAYLOAD_BYTES) {
    throw new Error("卡包太大，无法同步")
  }
  const parts = chunk(Buffer.from(json, "utf8").toString("base64url"))
  const name = deck?.name.trim().slice(0, 200) || "未命名卡包"
  const cardCount = deck?.cards.length ?? 0
  const rows = parts.map((part, index) => [
    id,
    revision,
    updatedAt,
    deletedAt ?? "",
    name,
    cardCount,
    index,
    parts.length,
    part,
    GOOGLE_SHEETS_SCHEMA_VERSION,
    versionId,
  ])

  await appendValues(client, rows, fetchImpl)
  await markHasWrittenData(client, fetchImpl)

  const afterWrite = await readRows(client, fetchImpl)
  const winner = findCurrentVersion(afterWrite.rows, id)
  if (!winner || winner.versionId !== versionId) {
    return {
      ok: false,
      conflict: true,
      server: winner
        ? decodePayload(winner)
        : { rev: 0, updatedAt: 0, deletedAt: null, deck: null, editorState: null },
    }
  }

  const oldRows = allRows.filter((row) => row.id === id).map((row) => row.rowNumber)
  const requests = deletionRequests(dataSheet.sheetId, oldRows)
  if (requests.length > 0) {
    try {
      await batchUpdate(client, requests, fetchImpl)
    } catch (error) {
      console.error(JSON.stringify({
        message: "old Google Sheets sync chunks cleanup failed",
        error: String(error),
      }))
    }
  }

  return { ok: true, rev: revision, updatedAt }
}
