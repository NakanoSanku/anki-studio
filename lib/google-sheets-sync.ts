import { Buffer } from "node:buffer"

import {
  createPendingCard,
  cardKeyValue,
  fsrsOf,
  isTtsField,
  type Card,
  type Deck,
} from "./deck"
import { googleSpreadsheetUrl, isGoogleSpreadsheetId } from "./google-sheet-id"
import { parseRemoteDeckPayload, parseRemoteIndex } from "./sync-payload"
import type {
  PutDeckBody,
  PutDeckResult,
  RemoteDeckPayload,
  RemoteIndexEntry,
  SpreadsheetInventory,
  SpreadsheetSheetKind,
  SpreadsheetSheetPreview,
} from "./sync-types"

export type {
  SpreadsheetDeckGroup,
  SpreadsheetInventory,
  SpreadsheetSheetKind,
  SpreadsheetSheetPreview,
} from "./sync-types"

const SHEETS_API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets"
const INDEX_SHEET_NAME = "_anki_studio_sync"
const HAS_WRITTEN_METADATA_KEY = "anki_studio_has_data"
const HISTORY_COMPACTED_METADATA_KEY = "anki_studio_history_compacted"
const HISTORY_COMPACTED_SCHEMA_VERSION = "1"
const DECK_SHEET_METADATA_KEY = "anki_studio_deck_id"
const PREVIEW_SHEET_METADATA_KEY = "anki_studio_preview_deck_id"
const PREVIEW_SCHEMA_METADATA_KEY = "anki_studio_preview_schema"
const PREVIEW_SCHEMA_VERSION = "2"
const LEGACY_SCHEMA_VERSION = 2
const CHUNK_SIZE = 40_000
const PREVIEW_CELL_LIMIT = 50_000
const PREVIEW_ID_HEADER = "__anki_studio_card_id"
const DATA_HEADERS = [
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
const INDEX_HEADERS = [
  "deck_id",
  "revision",
  "updated_at",
  "deleted_at",
  "name",
  "card_count",
  "sheet_id",
  "sheet_title",
  "schema_version",
  "version_id",
] as const

export const GOOGLE_SHEETS_SCHEMA_VERSION = 3
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

type DeveloperMetadata = {
  metadataId?: number
  metadataKey?: string
  metadataValue?: string
  location?: { sheetId?: number; spreadsheet?: boolean }
}

type SpreadsheetMetadata = {
  spreadsheetId?: string
  properties?: { title?: string }
  sheets?: Array<{
    properties?: SheetProperties
    developerMetadata?: DeveloperMetadata[]
  }>
  developerMetadata?: DeveloperMetadata[]
}

type BatchUpdateResponse = {
  replies?: Array<{ addSheet?: { properties?: SheetProperties } }>
}

type ValuesResponse = {
  values?: unknown[][]
}

type SyncIndexSheet = {
  sheetId: number
  title: string
}

type DeckDataSheet = {
  sheetId: number
  title: string
}

type DeckPreviewSheet = {
  sheetId: number
  title: string
}

type SyncStorage = {
  indexSheet: SyncIndexSheet
  metadata: SpreadsheetMetadata
}

type SyncRow = {
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

type IndexRow = {
  id: string
  revision: number
  updatedAt: number
  deletedAt: number | null
  name: string
  cardCount: number
  sheetId: number | null
  sheetTitle: string
  schemaVersion: number
  versionId: string
}

type IndexVersion = {
  revision: number
  versionId: string
  row: IndexRow
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

export const SHEETS_QUOTA_USER_MESSAGE = "Google Sheets is being read too frequently. Try again shortly."
export const SHEETS_QUOTA_RETRY_DELAYS_MS = [400, 800]

type SheetsSession = {
  metadata: SpreadsheetMetadata | null
  sleep: (ms: number) => Promise<void>
  indexGrid: unknown[][] | null
}

export function isSheetsQuotaError(status: number, payload: unknown): boolean {
  if (status === 429) return true
  if (status !== 403) return false
  const message = payload && typeof payload === "object"
    ? (payload as GoogleErrorPayload).error?.message
    : undefined
  return typeof message === "string" && /quota exceeded|rate limit exceeded/i.test(message)
}

function googleErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const message = (payload as GoogleErrorPayload).error?.message
  return typeof message === "string" && message.trim() ? message : undefined
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSheetsSession(sleep: (ms: number) => Promise<void> = defaultSleep): SheetsSession {
  return { metadata: null, sleep, indexGrid: null }
}

export function createGoogleSheetsClient(input: {
  spreadsheetId: string
  accessToken: string
}): GoogleSheetsClient {
  if (!isGoogleSpreadsheetId(input.spreadsheetId)) {
    throw new Error("Invalid Google Sheet ID")
  }
  if (!input.accessToken.trim()) throw new Error("Google authorization has expired")
  return {
    spreadsheetId: input.spreadsheetId,
    accessToken: input.accessToken.trim(),
  }
}

function apiMessage(status: number, payload: unknown): string {
  if (isSheetsQuotaError(status, payload)) return SHEETS_QUOTA_USER_MESSAGE
  const message = googleErrorMessage(payload)
  if (status === 401) return "Google authorization has expired. Reconnect your account."
  if (status === 403) {
    return message
      ? `Your Google account cannot access this Sheet: ${message.slice(0, 180)}`
      : "Your Google account cannot access this Sheet"
  }
  if (status === 404) return "Google Sheet not found"
  return message ? message.slice(0, 240) : `Google Sheets API returned ${status}`
}

async function sheetsRequest<T>(
  client: GoogleSheetsClient,
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
  session?: SheetsSession | null
): Promise<T> {
  const sleep = session?.sleep ?? defaultSleep
  const attempts = SHEETS_QUOTA_RETRY_DELAYS_MS.length + 1
  let lastError: GoogleSheetsApiError | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
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
      throw new GoogleSheetsApiError("Unable to connect to Google Sheets", 503)
    }

    const data = await response.json().catch(() => null) as unknown
    if (response.ok) return (data ?? {}) as T

    lastError = new GoogleSheetsApiError(apiMessage(response.status, data), response.status)
    const retryDelay = SHEETS_QUOTA_RETRY_DELAYS_MS[attempt]
    if (retryDelay == null || !isSheetsQuotaError(response.status, data)) throw lastError
    await sleep(retryDelay)
  }

  throw lastError ?? new GoogleSheetsApiError("Unable to connect to Google Sheets", 503)
}

function quotedRange(sheetTitle: string, range: string): string {
  return `'${sheetTitle.replaceAll("'", "''")}'!${range}`
}

async function readValues(
  client: GoogleSheetsClient,
  sheetTitle: string,
  range: string,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<unknown[][]> {
  const query = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" })
  const data = await sheetsRequest<ValuesResponse>(
    client,
    `/values/${encodeURIComponent(quotedRange(sheetTitle, range))}?${query}`,
    {},
    fetchImpl,
    session
  )
  return Array.isArray(data.values) ? data.values : []
}

const BATCH_GET_RANGE_LIMIT = 80

async function readValuesMany(
  client: GoogleSheetsClient,
  queries: Array<{ sheetTitle: string; range: string }>,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<unknown[][][]> {
  if (queries.length === 0) return []
  if (queries.length === 1) {
    return [await readValues(client, queries[0]!.sheetTitle, queries[0]!.range, fetchImpl, session)]
  }

  const results: unknown[][][] = []
  for (let offset = 0; offset < queries.length; offset += BATCH_GET_RANGE_LIMIT) {
    const chunk = queries.slice(offset, offset + BATCH_GET_RANGE_LIMIT)
    const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" })
    for (const query of chunk) params.append("ranges", quotedRange(query.sheetTitle, query.range))
    const data = await sheetsRequest<{ valueRanges?: Array<{ values?: unknown[][] }> }>(
      client,
      `/values:batchGet?${params}`,
      {},
      fetchImpl,
      session
    )
    const ranges = Array.isArray(data.valueRanges) ? data.valueRanges : []
    for (let index = 0; index < chunk.length; index += 1) {
      const values = ranges[index]?.values
      results.push(Array.isArray(values) ? values : [])
    }
  }
  return results
}

async function updateValues(
  client: GoogleSheetsClient,
  sheetTitle: string,
  range: string,
  values: unknown[][],
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<void> {
  const query = new URLSearchParams({ valueInputOption: "RAW" })
  await sheetsRequest(
    client,
    `/values/${encodeURIComponent(quotedRange(sheetTitle, range))}?${query}`,
    { method: "PUT", body: JSON.stringify({ values }) },
    fetchImpl,
    session
  )
}

async function appendValues(
  client: GoogleSheetsClient,
  sheetTitle: string,
  range: string,
  values: unknown[][],
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<void> {
  const query = new URLSearchParams({
    insertDataOption: "INSERT_ROWS",
    valueInputOption: "RAW",
  })
  await sheetsRequest(
    client,
    `/values/${encodeURIComponent(quotedRange(sheetTitle, range))}:append?${query}`,
    { method: "POST", body: JSON.stringify({ values }) },
    fetchImpl,
    session
  )
}

async function batchUpdate(
  client: GoogleSheetsClient,
  requests: unknown[],
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<BatchUpdateResponse> {
  return sheetsRequest<BatchUpdateResponse>(
    client,
    ":batchUpdate",
    { method: "POST", body: JSON.stringify({ requests }) },
    fetchImpl,
    session
  )
}

async function readSpreadsheetMetadata(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<SpreadsheetMetadata> {
  if (session?.metadata) return session.metadata
  const fields = [
    "spreadsheetId",
    "properties(title)",
    "sheets(properties(sheetId,title,hidden,gridProperties(frozenRowCount)),developerMetadata(metadataId,metadataKey,metadataValue,location(sheetId,spreadsheet)))",
    "developerMetadata(metadataId,metadataKey,metadataValue,location(sheetId,spreadsheet))",
  ].join(",")
  const metadata = await sheetsRequest<SpreadsheetMetadata>(
    client,
    `?${new URLSearchParams({ fields })}`,
    {},
    fetchImpl,
    session
  )
  if (session) session.metadata = metadata
  return metadata
}

function allDeveloperMetadata(metadata: SpreadsheetMetadata): DeveloperMetadata[] {
  const list: DeveloperMetadata[] = [...(metadata.developerMetadata ?? [])]
  for (const sheet of metadata.sheets ?? []) {
    if (sheet.developerMetadata) {
      list.push(...sheet.developerMetadata)
    }
  }
  return list
}

function hasWrittenData(metadata: SpreadsheetMetadata): boolean {
  return allDeveloperMetadata(metadata).some((item) => (
    item.metadataKey === HAS_WRITTEN_METADATA_KEY && item.metadataValue === "1"
  ))
}

function hasHistoryCompacted(metadata: SpreadsheetMetadata): boolean {
  return allDeveloperMetadata(metadata).some((item) => (
    item.metadataKey === HISTORY_COMPACTED_METADATA_KEY
    && item.metadataValue === HISTORY_COMPACTED_SCHEMA_VERSION
  ))
}

function hasPreviewSchema(metadata: SpreadsheetMetadata): boolean {
  return allDeveloperMetadata(metadata).some((item) => (
    item.metadataKey === PREVIEW_SCHEMA_METADATA_KEY
    && item.metadataValue === PREVIEW_SCHEMA_VERSION
  ))
}

function rowHasValue(row: unknown[] | undefined): boolean {
  return Boolean(row?.some((value) => value !== "" && value != null))
}

function headerMatches(row: unknown[], headers: readonly string[]): boolean {
  return headers.every((header, index) => row[index] === header)
    && !row.slice(headers.length).some((value) => value !== "" && value != null)
}

function sheetProperties(metadata: SpreadsheetMetadata): SheetProperties[] {
  return (metadata.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter((properties): properties is SheetProperties => Boolean(properties))
}

function findSheetById(metadata: SpreadsheetMetadata, sheetId: number): SheetProperties | undefined {
  return sheetProperties(metadata).find((properties) => properties.sheetId === sheetId)
}

function deckIdForSheet(metadata: SpreadsheetMetadata, sheetId: number): string | null {
  const value = allDeveloperMetadata(metadata).find((item) => (
    item.metadataKey === DECK_SHEET_METADATA_KEY && item.location?.sheetId === sheetId
  ))?.metadataValue
  return typeof value === "string" && value ? value : null
}

function previewDeckIdForSheet(metadata: SpreadsheetMetadata, sheetId: number): string | null {
  const value = allDeveloperMetadata(metadata).find((item) => (
    item.metadataKey === PREVIEW_SHEET_METADATA_KEY && item.location?.sheetId === sheetId
  ))?.metadataValue
  return typeof value === "string" && value ? value : null
}

function findTaggedDeckSheet(metadata: SpreadsheetMetadata, deckId: string): SheetProperties | undefined {
  const sheetId = allDeveloperMetadata(metadata).find((item) => (
    item.metadataKey === DECK_SHEET_METADATA_KEY && item.metadataValue === deckId
  ))?.location?.sheetId
  return typeof sheetId === "number" ? findSheetById(metadata, sheetId) : undefined
}

function sheetKind(
  metadata: SpreadsheetMetadata,
  properties: SheetProperties
): { kind: SpreadsheetSheetKind; deckId: string | null } {
  if (properties.title === INDEX_SHEET_NAME) return { kind: "index", deckId: null }
  if (typeof properties.sheetId !== "number") return { kind: "other", deckId: null }
  const dataDeckId = deckIdForSheet(metadata, properties.sheetId)
  if (dataDeckId) return { kind: "data", deckId: dataDeckId }
  const previewDeckId = previewDeckIdForSheet(metadata, properties.sheetId)
  if (previewDeckId) return { kind: "preview", deckId: previewDeckId }
  return { kind: "other", deckId: null }
}

function spreadsheetInventoryFromMetadata(
  metadata: SpreadsheetMetadata,
  spreadsheetId: string,
  indexRows: IndexRow[] = []
): SpreadsheetInventory {
  const activeIndexDecks = new Map<string, { name: string; sheetId?: number }>()
  const uniqueIndexIds = [...new Set(indexRows.map((row) => row.id))]
  for (const id of uniqueIndexIds) {
    const current = findCurrentIndexVersion(indexRows, id)
    if (current && !current.row.deletedAt) {
      activeIndexDecks.set(id, {
        name: current.row.name || "Untitled deck",
        sheetId: current.row.sheetId ?? undefined,
      })
    }
  }

  const sheets: SpreadsheetSheetPreview[] = []
  for (const properties of sheetProperties(metadata)) {
    if (typeof properties.sheetId !== "number" || !properties.title) continue
    let { kind, deckId } = sheetKind(metadata, properties)

    if (!deckId && kind === "other") {
      const dataMatch = /^_anki_studio_data_(.+)$/.exec(properties.title)
      if (dataMatch) {
        kind = "data"
        deckId = dataMatch[1]
      } else if (activeIndexDecks.size > 0) {
        for (const [id, info] of activeIndexDecks.entries()) {
          if (info.sheetId === properties.sheetId) {
            kind = "data"
            deckId = id
            break
          }
          if (properties.title === info.name) {
            kind = "preview"
            deckId = id
            break
          }
        }
      }
    }

    sheets.push({
      sheetId: properties.sheetId,
      title: properties.title,
      hidden: properties.hidden === true,
      kind,
      deckId,
    })
  }

  const names = new Map<string, string>()
  for (const [id, info] of activeIndexDecks.entries()) {
    names.set(id, info.name)
  }
  for (const sheet of sheets) {
    if (sheet.kind === "preview" && sheet.deckId && sheet.title.trim()) {
      names.set(sheet.deckId, sheet.title.trim())
    }
  }

  const allDeckIds = new Set<string>()
  for (const sheet of sheets) {
    if (sheet.deckId) allDeckIds.add(sheet.deckId)
  }
  for (const id of activeIndexDecks.keys()) {
    allDeckIds.add(id)
  }

  const decks = [...allDeckIds]
    .map((deckId) => ({
      deckId,
      name: names.get(deckId) || "Untitled deck",
      sheets: sheets.filter((sheet) => sheet.deckId === deckId),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))

  return {
    spreadsheetId,
    title: metadata.properties?.title?.trim() || "Google Sheet",
    url: googleSpreadsheetUrl(spreadsheetId),
    sheetCount: sheets.length,
    decks,
    unassigned: sheets.filter((sheet) => !sheet.deckId),
  }
}

function findTaggedDeckPreviewSheet(
  metadata: SpreadsheetMetadata,
  deckId: string
): SheetProperties | undefined {
  const sheetId = allDeveloperMetadata(metadata).find((item) => (
    item.metadataKey === PREVIEW_SHEET_METADATA_KEY && item.metadataValue === deckId
  ))?.location?.sheetId
  return typeof sheetId === "number" ? findSheetById(metadata, sheetId) : undefined
}

function addLocalSheetMetadata(
  metadata: SpreadsheetMetadata,
  properties: SheetProperties,
  deckId?: string
): void {
  metadata.sheets = [...(metadata.sheets ?? []), { properties }]
  if (deckId && typeof properties.sheetId === "number") {
    metadata.developerMetadata = [
      ...(metadata.developerMetadata ?? []),
      {
        metadataKey: DECK_SHEET_METADATA_KEY,
        metadataValue: deckId,
        location: { sheetId: properties.sheetId },
      },
    ]
  }
}

function addLocalPreviewSheetMetadata(
  metadata: SpreadsheetMetadata,
  properties: SheetProperties,
  deckId?: string
): void {
  metadata.sheets = [...(metadata.sheets ?? []), { properties }]
  if (deckId && typeof properties.sheetId === "number") {
    metadata.developerMetadata = [
      ...(metadata.developerMetadata ?? []),
      {
        metadataKey: PREVIEW_SHEET_METADATA_KEY,
        metadataValue: deckId,
        location: { sheetId: properties.sheetId },
      },
    ]
  }
}

function positiveNumberOrNull(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function parseSyncRows(
  values: unknown[][],
  expectedSchemaVersion: number
): SyncRow[] {
  const rows: SyncRow[] = []
  values.forEach((valuesRow) => {
    if (!rowHasValue(valuesRow)) return
    const row: SyncRow = {
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
      || row.schemaVersion !== expectedSchemaVersion
      || !/^[A-Za-z0-9_-]{16,80}$/.test(row.versionId)
    ) {
      throw new Error("Google Sheet sync data is corrupted. Restore from a backup before syncing.")
    }
    rows.push(row)
  })
  return rows
}

function parseIndexRows(values: unknown[][]): IndexRow[] {
  const rows: IndexRow[] = []
  values.forEach((valuesRow) => {
    if (!rowHasValue(valuesRow)) return
    const deletedAt = positiveNumberOrNull(valuesRow[3])
    const sheetIdValue = valuesRow[6]
    const sheetId = sheetIdValue === "" || sheetIdValue == null
      ? null
      : Number(sheetIdValue)
    const row: IndexRow = {
      id: String(valuesRow[0] ?? ""),
      revision: Number(valuesRow[1]),
      updatedAt: Number(valuesRow[2]),
      deletedAt,
      name: String(valuesRow[4] ?? ""),
      cardCount: Number(valuesRow[5]),
      sheetId,
      sheetTitle: String(valuesRow[7] ?? ""),
      schemaVersion: Number(valuesRow[8]),
      versionId: String(valuesRow[9] ?? ""),
    }
    if (
      !/^[A-Za-z0-9_-]{6,80}$/.test(row.id)
      || !Number.isSafeInteger(row.revision)
      || row.revision <= 0
      || !Number.isFinite(row.updatedAt)
      || !Number.isFinite(row.cardCount)
      || row.cardCount < 0
      || (!deletedAt && (!Number.isInteger(sheetId) || sheetId == null || sheetId < 0))
      || row.schemaVersion !== GOOGLE_SHEETS_SCHEMA_VERSION
      || !/^[A-Za-z0-9_-]{16,80}$/.test(row.versionId)
    ) {
      throw new Error("Google Sheet sync index is corrupted. Restore from a backup before syncing.")
    }
    rows.push(row)
  })
  return rows
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

function findExactVersion(
  rows: SyncRow[],
  id: string,
  revision: number,
  versionId: string
): SyncVersion | null {
  const matching = rows.filter((row) => (
    row.id === id && row.revision === revision && row.versionId === versionId
  ))
  return matching.length > 0 ? { revision, versionId, rows: matching } : null
}

function findCurrentIndexVersion(rows: IndexRow[], id: string): IndexVersion | null {
  const winner = rows
    .filter((row) => row.id === id)
    .sort((left, right) => (
      right.revision - left.revision
      || right.updatedAt - left.updatedAt
      || right.versionId.localeCompare(left.versionId)
    ))[0]
  return winner ? { revision: winner.revision, versionId: winner.versionId, row: winner } : null
}

function decodePayload(version: SyncVersion, expectedSchemaVersion: number): RemoteDeckPayload {
  const rows = version.rows.slice().sort((left, right) => left.partIndex - right.partIndex)
  const partCount = rows.length > 0 ? rows[0]!.partCount : 0
  if (!partCount || rows.length !== partCount) {
    throw new Error("Google Sheet deck payload is incomplete")
  }
  rows.forEach((row, index) => {
    if (
      row.partIndex !== index
      || row.partCount !== partCount
      || row.schemaVersion !== expectedSchemaVersion
      || row.versionId !== version.versionId
    ) {
      throw new Error("Google Sheet deck payload chunks are invalid")
    }
  })
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(rows.map((row) => row.payload).join(""), "base64url").toString("utf8"))
  } catch {
    throw new Error("Google Sheet deck payload could not be parsed")
  }
  const payload = parseRemoteDeckPayload(raw)
  if (payload.rev !== version.revision) {
    throw new Error("Google Sheet deck revision is invalid")
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

function dataRowsForPayload(
  id: string,
  payload: RemoteDeckPayload,
  versionId: string
): unknown[][] {
  const json = JSON.stringify(payload)
  if (Buffer.byteLength(json, "utf8") > MAX_SYNC_PAYLOAD_BYTES) {
    throw new Error("Deck is too large to sync")
  }
  const parts = chunk(Buffer.from(json, "utf8").toString("base64url"))
  const name = payload.deck?.name.trim().slice(0, 200) || "Untitled deck"
  const cardCount = payload.deck?.cards.length ?? 0
  return parts.map((part, index) => [
    id,
    payload.rev,
    payload.updatedAt,
    payload.deletedAt ?? "",
    name,
    cardCount,
    index,
    parts.length,
    part,
    GOOGLE_SHEETS_SCHEMA_VERSION,
    versionId,
  ])
}

function indexValues(row: IndexRow): unknown[] {
  return [
    row.id,
    row.revision,
    row.updatedAt,
    row.deletedAt ?? "",
    row.name,
    row.cardCount,
    row.sheetId ?? "",
    row.sheetTitle,
    row.schemaVersion,
    row.versionId,
  ]
}

function tombstonePayload(row: IndexRow): RemoteDeckPayload {
  return {
    rev: row.revision,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deck: null,
    editorState: null,
  }
}

function sanitizedSheetTitle(value: string): string {
  const title = value
    .normalize("NFKC")
    .replace(/[\\/?*\[\]:\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return (title || "Untitled deck").slice(0, 100)
}

function uniqueSheetTitle(
  requested: string,
  metadata: SpreadsheetMetadata,
  excludeSheetId?: number
): string {
  const base = sanitizedSheetTitle(requested)
  const used = new Set(sheetProperties(metadata)
    .filter((sheet) => sheet.sheetId !== excludeSheetId)
    .map((sheet) => (sheet.title ?? "").normalize("NFKC").toLocaleLowerCase()))
  if (!used.has(base.toLocaleLowerCase())) return base
  for (let index = 2; index < 10_000; index += 1) {
    const suffix = ` (${index})`
    const candidate = `${base.slice(0, 100 - suffix.length).trimEnd()}${suffix}`
    if (!used.has(candidate.toLocaleLowerCase())) return candidate
  }
  throw new Error("No available worksheet name remains for this deck")
}

function previewTitleMatches(title: string, deckName: string): boolean {
  const base = sanitizedSheetTitle(deckName).normalize("NFKC").toLocaleLowerCase()
  const normalized = title.normalize("NFKC").toLocaleLowerCase()
  if (normalized === base) return true
  const suffix = normalized.slice(base.length)
  return normalized.startsWith(`${base} (`) && /^ \([2-9][0-9]*\)$/.test(suffix)
}

function previewSheetCandidates(
  metadata: SpreadsheetMetadata,
  deckId: string,
  deckName: string
): SheetProperties[] {
  const tagged = findTaggedDeckPreviewSheet(metadata, deckId)
  const titled = sheetProperties(metadata).filter((properties) => {
    const taggedDeckId = typeof properties.sheetId === "number"
      ? previewDeckIdForSheet(metadata, properties.sheetId)
      : null
    return Boolean(
      properties.title
      && properties.hidden !== true
      && previewTitleMatches(properties.title, deckName)
      && (!taggedDeckId || taggedDeckId === deckId)
    )
  })
  const candidates: SheetProperties[] = []
  for (const properties of [tagged, ...titled]) {
    if (!properties || typeof properties.sheetId !== "number" || !properties.title) continue
    if (candidates.some((candidate) => candidate.sheetId === properties.sheetId)) continue
    candidates.push(properties)
  }
  return candidates
}

function columnName(column: number): string {
  let current = Math.max(1, Math.floor(column))
  let result = ""
  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

function previewReadRange(deck: Pick<Deck, "fields">): string {
  return `A1:${columnName(deck.fields.length + 1)}`
}

function internalDeckSheetTitle(deckId: string): string {
  const suffix = deckId.replace(/[^A-Za-z0-9]/g, "").slice(0, 24) || "deck"
  return `_anki_studio_data_${suffix}`
}

function previewHeaders(deck: Pick<Deck, "fields">): string[] {
  return [PREVIEW_ID_HEADER, ...deck.fields]
}

function previewCell(value: string): string {
  const normalized = value.replaceAll("\u2063", "")
  return normalized.length > PREVIEW_CELL_LIMIT
    ? `${normalized.slice(0, PREVIEW_CELL_LIMIT - 1)}…`
    : normalized
}

function previewValues(deck: Deck): unknown[][] {
  const headers = previewHeaders(deck)
  return [
    headers,
    ...deck.cards.map((card) => [
      card.id,
      ...deck.fields.map((field) => previewCell(card.values[field] ?? "")),
    ]),
  ]
}

function previewText(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}

function previewRows(deck: Deck): unknown[][] {
  return previewValues(deck).slice(1)
}

function samePreviewRows(left: unknown[][], right: unknown[][]): boolean {
  if (left.length !== right.length) return false
  return left.every((row, rowIndex) => {
    const other = right[rowIndex]
    if (!other || row.length !== other.length) return false
    return row.every((value, columnIndex) => value === other[columnIndex])
  })
}

function deckFromPreviewRows(deck: Deck, rows: unknown[][]): Deck {
  const existing = new Map(deck.cards.map((card) => [card.id, card]))
  const usedIds = new Set<string>()
  const usedKeys = new Set<string>()
  const cards: Card[] = []

  for (const row of rows) {
    const id = previewText(row[0]).trim()
    const rowValues = row.slice(1)
    const hasFieldValue = rowValues.some((value) => previewText(value) !== "")
    if (!id && !hasFieldValue) continue

    const current = id && !usedIds.has(id) ? existing.get(id) : undefined
    const card = current ?? createPendingCard(deck.fields)
    const values = { ...card.values }
    for (const [index, field] of deck.fields.entries()) {
      if (isTtsField(deck, field)) {
        values[field] = ""
        continue
      }
      values[field] = previewText(rowValues[index])
    }
    const changed = !current || deck.fields.some((field) => values[field] !== (current.values[field] ?? ""))
    const nextCard: Card = changed
      ? { ...card, reviewStatus: "pending", values }
      : { ...card, values }
    const key = cardKeyValue(nextCard, deck.fields)
    if (key && usedKeys.has(key)) {
      throw new Error(`Preview contains a duplicate key field “${values[deck.fields[0] ?? ""] ?? ""}”`)
    }
    if (key) usedKeys.add(key)
    cards.push(nextCard)
    usedIds.add(card.id)
  }

  const validIds = new Set(cards.map((card) => card.id))
  const fsrs = fsrsOf(deck)
  return {
    ...deck,
    cards,
    fsrs: {
      ...fsrs,
      cards: Object.fromEntries(
        Object.entries(fsrs.cards).filter(([, item]) => validIds.has(item.noteId))
      ),
    },
  }
}

function randomSheetId(metadata: SpreadsheetMetadata): number {
  const used = new Set(sheetProperties(metadata)
    .map((sheet) => sheet.sheetId)
    .filter((id): id is number => typeof id === "number"))
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff
    if (!used.has(id)) return id
  }
  throw new Error("Unable to generate a Google Sheet worksheet ID")
}

async function markHasWrittenData(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  fetchImpl: typeof fetch
): Promise<void> {
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
  metadata.developerMetadata = [
    ...(metadata.developerMetadata ?? []),
    {
      metadataKey: HAS_WRITTEN_METADATA_KEY,
      metadataValue: "1",
      location: { spreadsheet: true },
    },
  ]
}

async function markHistoryCompacted(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  fetchImpl: typeof fetch
): Promise<void> {
  if (hasHistoryCompacted(metadata)) return
  await batchUpdate(client, [{
    createDeveloperMetadata: {
      developerMetadata: {
        location: { spreadsheet: true },
        metadataKey: HISTORY_COMPACTED_METADATA_KEY,
        metadataValue: HISTORY_COMPACTED_SCHEMA_VERSION,
        visibility: "DOCUMENT",
      },
    },
  }], fetchImpl)
  metadata.developerMetadata = [
    ...(metadata.developerMetadata ?? []),
    {
      metadataKey: HISTORY_COMPACTED_METADATA_KEY,
      metadataValue: HISTORY_COMPACTED_SCHEMA_VERSION,
      location: { spreadsheet: true },
    },
  ]
}

async function markPreviewSchema(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  fetchImpl: typeof fetch
): Promise<void> {
  if (hasPreviewSchema(metadata)) return
  await batchUpdate(client, [{
    createDeveloperMetadata: {
      developerMetadata: {
        location: { spreadsheet: true },
        metadataKey: PREVIEW_SCHEMA_METADATA_KEY,
        metadataValue: PREVIEW_SCHEMA_VERSION,
        visibility: "DOCUMENT",
      },
    },
  }], fetchImpl)
  metadata.developerMetadata = [
    ...(metadata.developerMetadata ?? []),
    {
      metadataKey: PREVIEW_SCHEMA_METADATA_KEY,
      metadataValue: PREVIEW_SCHEMA_VERSION,
      location: { spreadsheet: true },
    },
  ]
}

async function ensureIndexProperties(
  client: GoogleSheetsClient,
  properties: SheetProperties,
  fetchImpl: typeof fetch
): Promise<void> {
  if (typeof properties.sheetId !== "number") {
    throw new Error("Google Sheet sync index could not be initialized")
  }
  if (properties.hidden === true && properties.gridProperties?.frozenRowCount === 1) return
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
  properties.hidden = true
  properties.gridProperties = { ...properties.gridProperties, frozenRowCount: 1 }
}

async function createDeckSheet(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  deckId: string,
  _requestedTitle: string,
  fetchImpl: typeof fetch
): Promise<DeckDataSheet> {
  const sheetId = randomSheetId(metadata)
  const title = uniqueSheetTitle(internalDeckSheetTitle(deckId), metadata)
  await batchUpdate(client, [
    {
      addSheet: {
        properties: {
          sheetId,
          title,
          hidden: true,
          gridProperties: {
            columnCount: DATA_HEADERS.length,
            frozenRowCount: 1,
            rowCount: 1000,
          },
        },
      },
    },
    {
      createDeveloperMetadata: {
        developerMetadata: {
          location: { sheetId },
          metadataKey: DECK_SHEET_METADATA_KEY,
          metadataValue: deckId,
          visibility: "DOCUMENT",
        },
      },
    },
  ], fetchImpl)
  const properties: SheetProperties = {
    sheetId,
    title,
    hidden: true,
    gridProperties: { frozenRowCount: 1 },
  }
  addLocalSheetMetadata(metadata, properties, deckId)
  await updateValues(client, title, "A1:K1", [[...DATA_HEADERS]], fetchImpl)
  return { sheetId, title }
}

async function ensureDeckSheet(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  deckId: string,
  deckName: string,
  preferredSheetId: number | null,
  fetchImpl: typeof fetch
): Promise<DeckDataSheet> {
  let properties = preferredSheetId == null
    ? undefined
    : findSheetById(metadata, preferredSheetId)
  properties ??= findTaggedDeckSheet(metadata, deckId)

  if (!properties) {
    if (preferredSheetId != null) {
      throw new Error(`The worksheet for deck “${deckName || "Untitled deck"}” was deleted. Restore it from a backup before syncing.`)
    }
    return createDeckSheet(client, metadata, deckId, deckName, fetchImpl)
  }
  if (typeof properties.sheetId !== "number" || !properties.title) {
    throw new Error("Google Sheet deck worksheet is invalid")
  }

  const taggedDeckId = deckIdForSheet(metadata, properties.sheetId)
  if (taggedDeckId && taggedDeckId !== deckId) {
    throw new Error("Google Sheet deck worksheet mapping conflicts with another deck")
  }

  const batchRequests: unknown[] = []
  if (!taggedDeckId) {
    batchRequests.push({
      createDeveloperMetadata: {
        developerMetadata: {
          location: { sheetId: properties.sheetId },
          metadataKey: DECK_SHEET_METADATA_KEY,
          metadataValue: deckId,
          visibility: "DOCUMENT",
        },
      },
    })
    metadata.developerMetadata = [
      ...(metadata.developerMetadata ?? []),
      {
        metadataKey: DECK_SHEET_METADATA_KEY,
        metadataValue: deckId,
        location: { sheetId: properties.sheetId },
      },
    ]
  }

  const dataTitle = uniqueSheetTitle(
    internalDeckSheetTitle(deckId),
    metadata,
    properties.sheetId
  )
  const needTitle = properties.title !== dataTitle
  const needProps = properties.hidden !== true || properties.gridProperties?.frozenRowCount !== 1
  if (needTitle || needProps) {
    batchRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: properties.sheetId,
          ...(needTitle ? { title: dataTitle } : {}),
          ...(needProps ? { hidden: true, gridProperties: { frozenRowCount: 1 } } : {}),
        },
        fields: [
          ...(needTitle ? ["title"] : []),
          ...(needProps ? ["hidden", "gridProperties.frozenRowCount"] : []),
        ].join(","),
      },
    })
    properties.title = dataTitle
    properties.hidden = true
    properties.gridProperties = { ...properties.gridProperties, frozenRowCount: 1 }
  }

  if (batchRequests.length > 0) {
    await batchUpdate(client, batchRequests, fetchImpl)
  }

  if (!hasWrittenData(metadata) || !taggedDeckId) {
    const preview = await readValues(client, properties.title, "A1:K1", fetchImpl)
    const header = preview[0] ?? []
    if (!rowHasValue(header)) {
      await updateValues(client, properties.title, "A1:K1", [[...DATA_HEADERS]], fetchImpl)
    } else if (!headerMatches(header, DATA_HEADERS)) {
      throw new Error(`Deck worksheet “${properties.title}” has an incompatible structure`)
    }
  }

  return { sheetId: properties.sheetId, title: properties.title }
}

async function tagDeckPreviewSheet(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  sheetId: number,
  deckId: string,
  fetchImpl: typeof fetch
): Promise<void> {
  if (previewDeckIdForSheet(metadata, sheetId) === deckId) return
  await batchUpdate(client, [{
    createDeveloperMetadata: {
      developerMetadata: {
        location: { sheetId },
        metadataKey: PREVIEW_SHEET_METADATA_KEY,
        metadataValue: deckId,
        visibility: "DOCUMENT",
      },
    },
  }], fetchImpl)
  metadata.developerMetadata = [
    ...(metadata.developerMetadata ?? []),
    {
      metadataKey: PREVIEW_SHEET_METADATA_KEY,
      metadataValue: deckId,
      location: { sheetId },
    },
  ]
}

async function createDeckPreviewSheet(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  deckId: string,
  deck: Deck,
  fetchImpl: typeof fetch
): Promise<DeckPreviewSheet> {
  const sheetId = randomSheetId(metadata)
  const headers = previewHeaders(deck)
  const title = uniqueSheetTitle(deck.name, metadata)
  await batchUpdate(client, [
    {
      addSheet: {
        properties: {
          sheetId,
          title,
          hidden: false,
          gridProperties: {
            columnCount: Math.max(headers.length, 10),
            frozenRowCount: 1,
            rowCount: Math.max(1000, deck.cards.length + 1),
          },
        },
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: 1,
        },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    },
    {
      createDeveloperMetadata: {
        developerMetadata: {
          location: { sheetId },
          metadataKey: PREVIEW_SHEET_METADATA_KEY,
          metadataValue: deckId,
          visibility: "DOCUMENT",
        },
      },
    },
  ], fetchImpl)
  const properties: SheetProperties = {
    sheetId,
    title,
    hidden: false,
    gridProperties: { frozenRowCount: 1 },
  }
  addLocalPreviewSheetMetadata(metadata, properties)
  metadata.developerMetadata = [
    ...(metadata.developerMetadata ?? []),
    {
      metadataKey: PREVIEW_SHEET_METADATA_KEY,
      metadataValue: deckId,
      location: { sheetId },
    },
  ]
  return { sheetId, title }
}

async function replaceDeckPreview(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  deckId: string,
  deck: Deck,
  fetchImpl: typeof fetch,
  preferredSheetId?: number
): Promise<DeckPreviewSheet> {
  const properties = (typeof preferredSheetId === "number"
    ? findSheetById(metadata, preferredSheetId)
    : undefined) ?? previewSheetCandidates(metadata, deckId, deck.name)[0]
  if (!properties) {
    return createDeckPreviewSheet(client, metadata, deckId, deck, fetchImpl)
  }
  if (typeof properties.sheetId !== "number" || !properties.title) {
    throw new Error("Google Sheet deck preview worksheet is invalid")
  }

  const taggedDeckId = previewDeckIdForSheet(metadata, properties.sheetId)
  if (taggedDeckId && taggedDeckId !== deckId) {
    throw new Error("Google Sheet deck preview worksheet mapping conflicts with another deck")
  }

  const batchRequests: unknown[] = []
  if (!taggedDeckId) {
    batchRequests.push({
      createDeveloperMetadata: {
        developerMetadata: {
          location: { sheetId: properties.sheetId },
          metadataKey: PREVIEW_SHEET_METADATA_KEY,
          metadataValue: deckId,
          visibility: "DOCUMENT",
        },
      },
    })
    metadata.developerMetadata = [
      ...(metadata.developerMetadata ?? []),
      {
        metadataKey: PREVIEW_SHEET_METADATA_KEY,
        metadataValue: deckId,
        location: { sheetId: properties.sheetId },
      },
    ]
  }

  const title = uniqueSheetTitle(deck.name, metadata, properties.sheetId)
  const needTitle = properties.title !== title
  const needProps = properties.hidden === true || properties.gridProperties?.frozenRowCount !== 1
  if (needTitle || needProps) {
    batchRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: properties.sheetId,
          ...(needTitle ? { title } : {}),
          ...(needProps ? { hidden: false, gridProperties: { frozenRowCount: 1 } } : {}),
        },
        fields: [
          ...(needTitle ? ["title"] : []),
          ...(needProps ? ["hidden", "gridProperties.frozenRowCount"] : []),
        ].join(","),
      },
    })
    properties.title = title
    properties.hidden = false
    properties.gridProperties = { ...properties.gridProperties, frozenRowCount: 1 }
  }

  batchRequests.push({
    updateDimensionProperties: {
      range: {
        sheetId: properties.sheetId,
        dimension: "COLUMNS",
        startIndex: 0,
        endIndex: 1,
      },
      properties: { hiddenByUser: true },
      fields: "hiddenByUser",
    },
  })

  if (batchRequests.length > 0) {
    await batchUpdate(client, batchRequests, fetchImpl)
  }

  return { sheetId: properties.sheetId, title: properties.title }
}

async function writeDeckPreview(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  deckId: string,
  deck: Deck,
  fetchImpl: typeof fetch,
  preferredSheetId?: number
): Promise<void> {
  const previewSheet = await replaceDeckPreview(
    client,
    metadata,
    deckId,
    deck,
    fetchImpl,
    preferredSheetId
  )
  await writeDeckPreviewValues(client, previewSheet, deck, fetchImpl)

  const mirrors = previewSheetCandidates(metadata, deckId, deck.name)
    .filter((properties) => properties.sheetId !== previewSheet.sheetId)
  for (const properties of mirrors) {
    if (typeof properties.sheetId !== "number" || !properties.title) continue
    try {
      await writeDeckPreviewValues(
        client,
        { sheetId: properties.sheetId, title: properties.title },
        deck,
        fetchImpl
      )
    } catch (error) {
      console.error(JSON.stringify({
        message: "Google Sheets duplicate deck preview update failed",
        error: String(error),
      }))
    }
  }
}

async function writeDeckPreviewValues(
  client: GoogleSheetsClient,
  previewSheet: DeckPreviewSheet,
  deck: Deck,
  fetchImpl: typeof fetch
): Promise<void> {
  const rows = previewValues(deck)
  const existingRows = await readValues(client, previewSheet.title, "A1:A", fetchImpl)
  const width = Math.max(
    rows.reduce((maximum, row) => Math.max(maximum, row.length), 0),
    deck.fields.length + 1,
    1
  )
  const height = Math.max(rows.length, existingRows.length, 1)
  const values = Array.from({ length: height }, (_, rowIndex) => (
    Array.from({ length: width }, (_, columnIndex) => rows[rowIndex]?.[columnIndex] ?? "")
  ))
  await updateValues(
    client,
    previewSheet.title,
    `A1:${columnName(width)}${height}`,
    values,
    fetchImpl
  )
}

function parsePreviewValues(
  deck: Deck,
  properties: SheetProperties,
  values: unknown[][]
): Deck {
  const header = values[0] ?? []
  const currentHeader = previewHeaders(deck)
  const legacyHeader = ["序号", ...deck.fields]
  if (headerMatches(header, currentHeader)) {
    return deckFromPreviewRows(deck, values.slice(1).filter(rowHasValue))
  }
  if (headerMatches(header, legacyHeader)) {
    const rows = values
      .slice(1)
      .filter(rowHasValue)
      .map((row, index) => [deck.cards[index]?.id ?? "", ...row.slice(1)])
    return deckFromPreviewRows(deck, rows)
  }
  throw new Error(`Deck preview worksheet “${properties.title}” has a modified header. Restore it before syncing.`)
}

function selectParsedPreview(
  metadata: SpreadsheetMetadata,
  deckId: string,
  deck: Deck,
  parsed: Array<{ properties: SheetProperties; deck: Deck }>
): { properties: SheetProperties; deck: Deck } {
  const taggedId = findTaggedDeckPreviewSheet(metadata, deckId)?.sheetId
  const tagged = typeof taggedId === "number"
    ? parsed.find((item) => item.properties.sheetId === taggedId)
    : undefined
  const changed = parsed.find((item) => !samePreviewRows(previewRows(deck), previewRows(item.deck)))
  const exact = parsed.find((item) => item.properties.title === sanitizedSheetTitle(deck.name))
  return tagged && !samePreviewRows(previewRows(deck), previewRows(tagged.deck))
    ? tagged
    : changed ?? exact ?? tagged ?? parsed[0]!
}

function dataSheetForIndex(
  metadata: SpreadsheetMetadata,
  current: IndexVersion
): DeckDataSheet | null {
  if (current.row.sheetId == null) return null
  const properties = findSheetById(metadata, current.row.sheetId)
    ?? findTaggedDeckSheet(metadata, current.row.id)
  if (typeof properties?.sheetId !== "number" || !properties.title) return null
  return { sheetId: properties.sheetId, title: properties.title }
}

async function replaceSheetData(
  client: GoogleSheetsClient,
  dataSheet: DeckDataSheet,
  rows: unknown[][],
  fetchImpl: typeof fetch
): Promise<void> {
  const existing = await readValues(client, dataSheet.title, "A1:K", fetchImpl)
  const rowCount = Math.max(existing.length, rows.length + 1, 1)
  const values: unknown[][] = [
    [...DATA_HEADERS],
    ...rows,
    ...Array.from({ length: rowCount - rows.length - 1 }, () => Array(DATA_HEADERS.length).fill("")),
  ]
  await updateValues(client, dataSheet.title, `A1:K${rowCount}`, values, fetchImpl)
}

function latestIndexRows(rows: IndexRow[]): IndexRow[] {
  const ids = [...new Set(rows.map((row) => row.id))]
  return ids
    .map((id) => findCurrentIndexVersion(rows, id)?.row ?? null)
    .filter((row): row is IndexRow => row !== null)
}

async function compactIndexSheet(
  client: GoogleSheetsClient,
  storage: SyncStorage,
  rows: IndexRow[],
  fetchImpl: typeof fetch,
  session?: SheetsSession | null,
  knownRowCount?: number
): Promise<void> {
  const current = latestIndexRows(rows)
  const rowCount = Math.max(knownRowCount ?? rows.length + 1, current.length + 1, 1)
  const values: unknown[][] = [
    [...INDEX_HEADERS],
    ...current.map((row) => indexValues(row)),
    ...Array.from({
      length: rowCount - current.length - 1,
    }, () => Array(INDEX_HEADERS.length).fill("")),
  ]
  await updateValues(
    client,
    storage.indexSheet.title,
    `A1:J${rowCount}`,
    values,
    fetchImpl,
    session
  )
}

async function compactSyncHistory(
  client: GoogleSheetsClient,
  storage: SyncStorage,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null,
  knownRows?: IndexRow[]
): Promise<void> {
  const rows = knownRows ?? parseIndexRows(
    await readValues(client, storage.indexSheet.title, "A2:J", fetchImpl, session)
  )
  const currentRows = latestIndexRows(rows)

  // The payload sheets only need a one-time migration, but the index receives
  // a new optimistic row on every write. Keep that directory compact on every
  // pass as well, including spreadsheets already carrying the marker.
  if (hasHistoryCompacted(storage.metadata)) {
    if (rows.length === currentRows.length) return
    await compactIndexSheet(client, storage, currentRows, fetchImpl, session, rows.length + 1)
    return
  }

  const compactedRows: IndexRow[] = []

  for (const current of currentRows) {
    if (current.deletedAt || current.sheetId == null) {
      compactedRows.push(current)
      continue
    }

    const dataSheet = await ensureDeckSheet(
      client,
      storage.metadata,
      current.id,
      current.name,
      current.sheetId,
      fetchImpl
    )
    const dataRows = await readDeckRows(client, dataSheet, fetchImpl)
    const version = findExactVersion(dataRows, current.id, current.revision, current.versionId)
    if (!version) {
      throw new Error(`Deck worksheet “${dataSheet.title}” is missing the revision referenced by the sync index`)
    }
    const payload = decodePayload(version, GOOGLE_SHEETS_SCHEMA_VERSION)
    await replaceSheetData(
      client,
      dataSheet,
      dataRowsForPayload(current.id, payload, current.versionId),
      fetchImpl
    )
    compactedRows.push({
      ...current,
      name: payload.deck?.name.trim().slice(0, 200) || current.name || "Untitled deck",
      cardCount: payload.deck?.cards.length ?? current.cardCount,
      sheetId: dataSheet.sheetId,
      sheetTitle: dataSheet.title,
    })
  }

  await compactIndexSheet(client, storage, compactedRows, fetchImpl, session, rows.length + 1)
  await markHistoryCompacted(client, storage.metadata, fetchImpl)
}

async function migrateLegacyStorage(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  indexProperties: SheetProperties,
  fetchImpl: typeof fetch
): Promise<SyncStorage> {
  if (typeof indexProperties.sheetId !== "number" || !indexProperties.title) {
    throw new Error("Legacy Google Sheet sync worksheet is invalid")
  }
  const legacyValues = await readValues(client, indexProperties.title, "A2:K", fetchImpl)
  const legacyRows = parseSyncRows(legacyValues, LEGACY_SCHEMA_VERSION)
  const ids = [...new Set(legacyRows.map((row) => row.id))]
  const migratedRows: unknown[][] = []

  for (const id of ids) {
    const current = findCurrentVersion(legacyRows, id)
    if (!current) continue
    const payload = decodePayload(current, LEGACY_SCHEMA_VERSION)
    const first = current.rows[0]!
    const deletedAt = positiveNumberOrNull(payload.deletedAt)
    let dataSheet: DeckDataSheet | null = null
    if (!deletedAt) {
      if (!payload.deck) throw new Error("Legacy Google Sheet deck payload is missing")
      dataSheet = await ensureDeckSheet(
        client,
        metadata,
        id,
        payload.deck.name,
        null,
        fetchImpl
      )
      await replaceSheetData(
        client,
        dataSheet,
        dataRowsForPayload(id, payload, current.versionId),
        fetchImpl
      )
      await writeDeckPreview(client, metadata, id, payload.deck, fetchImpl)
    }
    migratedRows.push(indexValues({
      id,
      revision: current.revision,
      updatedAt: payload.updatedAt,
      deletedAt,
      name: payload.deck?.name.trim().slice(0, 200) || first.name || "Untitled deck",
      cardCount: payload.deck?.cards.length ?? Math.max(0, first.cardCount || 0),
      sheetId: dataSheet?.sheetId ?? null,
      sheetTitle: dataSheet?.title ?? "",
      schemaVersion: GOOGLE_SHEETS_SCHEMA_VERSION,
      versionId: current.versionId,
    }))
  }

  const rowCount = Math.max(legacyValues.length + 1, migratedRows.length + 1, 1)
  const replacement: unknown[][] = [
    [...INDEX_HEADERS, ""],
    ...migratedRows.map((row) => [...row, ""]),
    ...Array.from({ length: rowCount - migratedRows.length - 1 }, () => Array(DATA_HEADERS.length).fill("")),
  ]
  await updateValues(client, indexProperties.title, `A1:K${rowCount}`, replacement, fetchImpl)
  await ensureIndexProperties(client, indexProperties, fetchImpl)
  if (ids.length > 0) await markHasWrittenData(client, metadata, fetchImpl)
  await markPreviewSchema(client, metadata, fetchImpl)
  return {
    indexSheet: { sheetId: indexProperties.sheetId, title: indexProperties.title },
    metadata,
  }
}

async function ensureSyncStorage(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<SyncStorage> {
  const metadata = await readSpreadsheetMetadata(client, fetchImpl, session)
  const alreadyWritten = hasWrittenData(metadata)
  let properties = sheetProperties(metadata).find((sheet) => sheet.title === INDEX_SHEET_NAME)

  if (!properties) {
    if (alreadyWritten) {
      throw new Error("Google Sheet sync index was deleted. Restore from a backup before syncing.")
    }
    const created = await batchUpdate(client, [{
      addSheet: {
        properties: {
          title: INDEX_SHEET_NAME,
          hidden: true,
          gridProperties: {
            columnCount: DATA_HEADERS.length,
            frozenRowCount: 1,
            rowCount: 1000,
          },
        },
      },
    }], fetchImpl, session)
    properties = created.replies?.[0]?.addSheet?.properties
    if (properties) addLocalSheetMetadata(metadata, properties)
  }

  if (typeof properties?.sheetId !== "number" || !properties.title) {
    throw new Error("Google Sheet sync index could not be initialized")
  }

  const grid = session?.indexGrid ?? await readValues(client, properties.title, "A1:K", fetchImpl, session)
  if (session) session.indexGrid = grid
  const header = grid[0] ?? []
  if (!rowHasValue(header)) {
    if (alreadyWritten) {
      throw new Error("Google Sheet sync index header was cleared. Restore from a backup before syncing.")
    }
    await updateValues(client, properties.title, "A1:J1", [[...INDEX_HEADERS]], fetchImpl, session)
    if (session) session.indexGrid = [[...INDEX_HEADERS]]
  } else if (headerMatches(header, DATA_HEADERS)) {
    return migrateLegacyStorage(client, metadata, properties, fetchImpl)
  } else if (!headerMatches(header, INDEX_HEADERS)) {
    throw new Error("Google Sheet sync index has an incompatible structure")
  }

  if (alreadyWritten && !rowHasValue(grid[1])) {
    throw new Error("Google Sheet sync index was cleared. Restore from a backup before syncing.")
  }
  await ensureIndexProperties(client, properties, fetchImpl)
  return {
    indexSheet: { sheetId: properties.sheetId, title: properties.title },
    metadata,
  }
}

async function readIndexState(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<{ storage: SyncStorage; rows: IndexRow[] }> {
  const storage = await ensureSyncStorage(client, fetchImpl, session)
  const grid = session?.indexGrid ?? await readValues(client, storage.indexSheet.title, "A1:K", fetchImpl, session)
  if (session) session.indexGrid = grid
  return { storage, rows: parseIndexRows(grid.slice(1)) }
}

async function readDeckRows(
  client: GoogleSheetsClient,
  dataSheet: DeckDataSheet,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<SyncRow[]> {
  const values = await readValues(client, dataSheet.title, "A2:K", fetchImpl, session)
  return parseSyncRows(values, GOOGLE_SHEETS_SCHEMA_VERSION)
}

async function ensureExistingDeckPreviews(
  client: GoogleSheetsClient,
  storage: SyncStorage,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<void> {
  if (hasPreviewSchema(storage.metadata)) return

  const values = await readValues(client, storage.indexSheet.title, "A2:J", fetchImpl, session)
  const rows = parseIndexRows(values)
  const ids = [...new Set(rows.map((row) => row.id))]
  for (const id of ids) {
    const current = findCurrentIndexVersion(rows, id)
    if (!current || current.row.deletedAt || current.row.sheetId == null) continue
    const dataSheet = await ensureDeckSheet(
      client,
      storage.metadata,
      id,
      current.row.name,
      current.row.sheetId,
      fetchImpl
    )
    const dataRows = await readDeckRows(client, dataSheet, fetchImpl, session)
    const version = findExactVersion(dataRows, id, current.revision, current.versionId)
    if (!version) {
      throw new Error(`Deck worksheet “${dataSheet.title}” is missing the revision referenced by the sync index`)
    }
    const payload = decodePayload(version, GOOGLE_SHEETS_SCHEMA_VERSION)
    if (payload.deck) await writeDeckPreview(client, storage.metadata, id, payload.deck, fetchImpl)
  }
  await markPreviewSchema(client, storage.metadata, fetchImpl)
}

async function materializePreviewEdits(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<void> {
  const storage = await ensureSyncStorage(client, fetchImpl, session)
  await ensureExistingDeckPreviews(client, storage, fetchImpl, session)
  const { rows } = await readIndexState(client, fetchImpl, session)
  const currents = [...new Set(rows.map((row) => row.id))]
    .map((id) => findCurrentIndexVersion(rows, id))
    .filter((current): current is IndexVersion => (
      Boolean(current && !current.row.deletedAt && current.row.sheetId != null)
    ))

  const dataQueries = currents.map((current) => ({
    current,
    dataSheet: dataSheetForIndex(storage.metadata, current),
  }))
  const readable = dataQueries.filter((item): item is typeof item & { dataSheet: DeckDataSheet } => (
    item.dataSheet != null
  ))
  const dataValues = await readValuesMany(
    client,
    readable.map((item) => ({ sheetTitle: item.dataSheet.title, range: "A2:K" })),
    fetchImpl,
    session
  )

  const loaded: Array<{
    current: IndexVersion
    payload: RemoteDeckPayload
  }> = []
  readable.forEach((item, index) => {
    const dataRows = parseSyncRows(dataValues[index] ?? [], GOOGLE_SHEETS_SCHEMA_VERSION)
    const version = findExactVersion(
      dataRows,
      item.current.row.id,
      item.current.revision,
      item.current.versionId
    )
    if (!version) {
      throw new Error(`Deck worksheet “${item.dataSheet.title}” is missing the revision referenced by the sync index`)
    }
    loaded.push({
      current: item.current,
      payload: decodePayload(version, GOOGLE_SHEETS_SCHEMA_VERSION),
    })
  })
  for (const item of dataQueries) {
    if (item.dataSheet) continue
    const payload = await payloadForIndexVersion(client, storage.metadata, item.current, fetchImpl, session)
    loaded.push({ current: item.current, payload })
  }

  const payloadById = new Map(loaded.map((item) => [item.current.row.id, item.payload]))
  const previewJobs = loaded.flatMap((item) => {
    const deck = item.payload.deck
    if (!deck) return []
    return previewSheetCandidates(storage.metadata, item.current.row.id, deck.name)
      .filter((properties) => properties.title)
      .map((properties) => ({
        current: item.current,
        properties,
        sheetTitle: properties.title!,
        range: previewReadRange(deck),
      }))
  })
  const previewValues = await readValuesMany(
    client,
    previewJobs.map((job) => ({ sheetTitle: job.sheetTitle, range: job.range })),
    fetchImpl,
    session
  )

  type PreviewParseResult = {
    properties: SheetProperties
    deck: Deck | null
    error: Error | null
  }
  const previewResultsByDeck = new Map<string, PreviewParseResult[]>()
  previewJobs.forEach((job, index) => {
    const deck = payloadById.get(job.current.row.id)?.deck
    if (!deck) return
    const list = previewResultsByDeck.get(job.current.row.id) ?? []
    try {
      list.push({
        properties: job.properties,
        deck: parsePreviewValues(deck, job.properties, previewValues[index] ?? []),
        error: null,
      })
    } catch (error) {
      list.push({
        properties: job.properties,
        deck: null,
        error: error instanceof Error ? error : new Error("Unable to parse deck preview worksheet"),
      })
    }
    previewResultsByDeck.set(job.current.row.id, list)
  })

  for (const item of loaded) {
    if (!item.payload.deck) continue
    const results = previewResultsByDeck.get(item.current.row.id) ?? []
    const taggedId = findTaggedDeckPreviewSheet(storage.metadata, item.current.row.id)?.sheetId
    const taggedResult = typeof taggedId === "number"
      ? results.find((result) => result.properties.sheetId === taggedId)
      : undefined
    if (taggedResult?.error) throw taggedResult.error

    const parsed = results.flatMap((result) => (
      result.deck ? [{ properties: result.properties, deck: result.deck }] : []
    ))
    if (parsed.length === 0) {
      const parseError = results.find((result) => result.error)?.error
      if (parseError) throw parseError
      await writeDeckPreview(client, storage.metadata, item.current.row.id, item.payload.deck, fetchImpl)
      continue
    }

    const selected = selectParsedPreview(storage.metadata, item.current.row.id, item.payload.deck, parsed)
    if (typeof selected.properties.sheetId === "number") {
      await tagDeckPreviewSheet(client, storage.metadata, selected.properties.sheetId, item.current.row.id, fetchImpl)
    }
    if (samePreviewRows(previewRows(item.payload.deck), previewRows(selected.deck))) continue

    const result = await putGoogleSheetsDeck(client, item.current.row.id, {
      expectedRev: item.current.revision,
      deck: selected.deck,
      editorState: item.payload.editorState,
    }, fetchImpl, session)
    if (result.ok && selected.properties.sheetId != null) {
      await writeDeckPreview(
        client,
        storage.metadata,
        item.current.row.id,
        selected.deck,
        fetchImpl,
        selected.properties.sheetId
      )
    }
  }
}

async function payloadForIndexVersion(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  current: IndexVersion,
  fetchImpl: typeof fetch,
  session?: SheetsSession | null
): Promise<RemoteDeckPayload> {
  if (current.row.deletedAt) return tombstonePayload(current.row)
  if (current.row.sheetId == null) {
    throw new Error("Google Sheet sync index is missing the deck worksheet")
  }
  const dataSheet = await ensureDeckSheet(
    client,
    metadata,
    current.row.id,
    current.row.name,
    current.row.sheetId,
    fetchImpl
  )
  const rows = await readDeckRows(client, dataSheet, fetchImpl, session)
  const version = findExactVersion(rows, current.row.id, current.revision, current.versionId)
  if (!version) throw new Error(`Deck worksheet “${dataSheet.title}” is missing the revision referenced by the sync index`)
  return decodePayload(version, GOOGLE_SHEETS_SCHEMA_VERSION)
}

async function deleteDeckSheet(
  client: GoogleSheetsClient,
  metadata: SpreadsheetMetadata,
  dataSheet: DeckDataSheet,
  fetchImpl: typeof fetch
): Promise<void> {
  const otherVisibleSheet = sheetProperties(metadata).some((sheet) => (
    sheet.sheetId !== dataSheet.sheetId && sheet.hidden !== true
  ))
  const requests: unknown[] = []
  if (!otherVisibleSheet) {
    requests.push({
      addSheet: {
        properties: {
          title: uniqueSheetTitle("Anki Studio", metadata, dataSheet.sheetId),
          hidden: false,
        },
      },
    })
  }
  requests.push({ deleteSheet: { sheetId: dataSheet.sheetId } })
  await batchUpdate(client, requests, fetchImpl)
}

export async function createGoogleSpreadsheet(
  accessToken: string,
  title: string = "Anki Studio · Flashcard Sync",
  fetchImpl: typeof fetch = fetch
): Promise<GoogleSheetDetails> {
  const response = await fetchImpl(SHEETS_API_ROOT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: title.trim() || "Anki Studio · Flashcard Sync",
      },
    }),
  })
  const data = await response.json().catch(() => null) as unknown
  if (
    !response.ok
    || !data
    || typeof data !== "object"
    || typeof (data as { spreadsheetId?: unknown }).spreadsheetId !== "string"
  ) {
    const errorMsg = data && typeof data === "object" && "error" in data && typeof (data as { error?: { message?: unknown } }).error?.message === "string"
      ? (data as { error: { message: string } }).error.message
      : "Failed to create Google Sheet"
    throw new GoogleSheetsApiError(errorMsg, response.status)
  }
  const spreadsheetId = (data as { spreadsheetId: string }).spreadsheetId
  const client = createGoogleSheetsClient({ spreadsheetId, accessToken })
  return connectGoogleSheet(client, fetchImpl)
}

export async function connectGoogleSheet(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleSheetDetails> {
  const session = createSheetsSession()
  const storage = await ensureSyncStorage(client, fetchImpl, session)
  await ensureExistingDeckPreviews(client, storage, fetchImpl, session)
  // Older versions appended every revision forever. Compact that legacy data
  // once when the spreadsheet is connected; future writes compact themselves.
  try {
    await compactSyncHistory(client, storage, fetchImpl, session)
  } catch (error) {
    // A maintenance failure must not make an otherwise readable spreadsheet
    // impossible to connect. The next sync retries the cleanup.
    console.error(JSON.stringify({
      message: "Google Sheets history migration failed",
      error: String(error),
    }))
  }
  return {
    id: client.spreadsheetId,
    title: storage.metadata.properties?.title?.trim() || "Google Sheet",
    url: googleSpreadsheetUrl(client.spreadsheetId),
  }
}

export async function getGoogleSheetsStatus(
  client: GoogleSheetsClient
): Promise<GoogleSheetDetails> {
  return {
    id: client.spreadsheetId,
    title: "Google Sheet",
    url: googleSpreadsheetUrl(client.spreadsheetId),
  }
}

export async function listSpreadsheetInventory(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch = fetch
): Promise<SpreadsheetInventory> {
  const session = createSheetsSession()
  const metadata = await readSpreadsheetMetadata(client, fetchImpl, session)
  const devMeta = allDeveloperMetadata(metadata)
  const hasMetaDecks = devMeta.some((item) => (
    item.metadataKey === DECK_SHEET_METADATA_KEY || item.metadataKey === PREVIEW_SHEET_METADATA_KEY
  ))

  let indexRows: IndexRow[] = []
  if (!hasMetaDecks && sheetProperties(metadata).some((s) => s.title === INDEX_SHEET_NAME)) {
    try {
      const grid = session.indexGrid ?? await readValues(client, INDEX_SHEET_NAME, "A1:K", fetchImpl, session)
      session.indexGrid = grid
      indexRows = parseIndexRows(grid.slice(1))
    } catch {
      // index read fallback error ignored
    }
  }

  return spreadsheetInventoryFromMetadata(metadata, client.spreadsheetId, indexRows)
}

export async function listGoogleSheetsIndex(
  client: GoogleSheetsClient,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteIndexEntry[]> {
  const session = createSheetsSession()
  await materializePreviewEdits(client, fetchImpl, session)
  const { storage, rows } = await readIndexState(client, fetchImpl, session)
  try {
    await compactSyncHistory(client, storage, fetchImpl, session, rows)
  } catch (error) {
    console.error(JSON.stringify({
      message: "Google Sheets sync history maintenance failed",
      error: String(error),
    }))
  }
  const ids = [...new Set(rows.map((row) => row.id))]
  return parseRemoteIndex(ids.map((id) => {
    const current = findCurrentIndexVersion(rows, id)
    if (!current) return null
    return {
      id,
      rev: current.revision,
      name: current.row.name || "Untitled deck",
      cardCount: Math.max(0, current.row.cardCount || 0),
      updatedAt: Math.max(0, current.row.updatedAt || 0),
      deletedAt: current.row.deletedAt,
    }
  }).filter((entry) => entry !== null))
}

export async function getGoogleSheetsDeck(
  client: GoogleSheetsClient,
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteDeckPayload | null> {
  const session = createSheetsSession()
  const { storage, rows } = await readIndexState(client, fetchImpl, session)
  const current = findCurrentIndexVersion(rows, id)
  return current
    ? payloadForIndexVersion(client, storage.metadata, current, fetchImpl, session)
    : null
}

export async function putGoogleSheetsDeck(
  client: GoogleSheetsClient,
  id: string,
  body: PutDeckBody,
  fetchImpl: typeof fetch = fetch,
  session: SheetsSession | null = null
): Promise<PutDeckResult> {
  const active = session ?? createSheetsSession()
  const { storage, rows: indexRows } = await readIndexState(client, fetchImpl, active)
  const current = findCurrentIndexVersion(indexRows, id)
  const currentPayload = current
    ? await payloadForIndexVersion(client, storage.metadata, current, fetchImpl, active)
    : null
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
  if (!deletedAt && !deck) throw new Error("Deck content is missing")

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
  const name = deck?.name.trim().slice(0, 200) || current?.row.name || "Untitled deck"
  const cardCount = deck?.cards.length ?? current?.row.cardCount ?? 0
  let dataSheet: DeckDataSheet | null = null
  let previewReady = Boolean(deletedAt)
  const existingPreviewSheetId = currentPayload?.deck
    ? previewSheetCandidates(storage.metadata, id, currentPayload.deck.name)[0]?.sheetId
    : undefined

  if (!deletedAt) {
    dataSheet = await ensureDeckSheet(
      client,
      storage.metadata,
      id,
      name,
      current?.row.sheetId ?? null,
      fetchImpl
    )
    await appendValues(
      client,
      dataSheet.title,
      "A:K",
      dataRowsForPayload(id, payload, versionId),
      fetchImpl
    )
  }

  if (active) active.indexGrid = null
  await appendValues(client, storage.indexSheet.title, "A:J", [[
    ...indexValues({
      id,
      revision,
      updatedAt,
      deletedAt,
      name,
      cardCount,
      sheetId: dataSheet?.sheetId ?? null,
      sheetTitle: dataSheet?.title ?? "",
      schemaVersion: GOOGLE_SHEETS_SCHEMA_VERSION,
      versionId,
    }),
  ]], fetchImpl)
  await markHasWrittenData(client, storage.metadata, fetchImpl)

  const afterWriteValues = await readValues(
    client,
    storage.indexSheet.title,
    "A2:J",
    fetchImpl,
    active
  )
  const afterWriteRows = parseIndexRows(afterWriteValues)
  const winner = findCurrentIndexVersion(afterWriteRows, id)
  if (!winner || winner.versionId !== versionId) {
    return {
      ok: false,
      conflict: true,
      server: winner
        ? await payloadForIndexVersion(client, storage.metadata, winner, fetchImpl, active)
        : { rev: 0, updatedAt: 0, deletedAt: null, deck: null, editorState: null },
    }
  }

  if (dataSheet) {
    const writtenRows = await readDeckRows(client, dataSheet, fetchImpl, active)
    const writtenVersion = findExactVersion(writtenRows, id, revision, versionId)
    if (!writtenVersion) throw new Error("Google Sheet deck write is incomplete")
    decodePayload(writtenVersion, GOOGLE_SHEETS_SCHEMA_VERSION)
    try {
      // The append above makes optimistic concurrent writes safe. Once this
      // version wins, replace the payload history with the single current
      // version so old revisions are no longer retained in Drive.
      await replaceSheetData(
        client,
        dataSheet,
        dataRowsForPayload(id, payload, versionId),
        fetchImpl
      )
    } catch (error) {
      console.error(JSON.stringify({
        message: "Google Sheets deck history compaction failed",
        error: String(error),
      }))
    }
    try {
      await writeDeckPreview(
        client,
        storage.metadata,
        id,
        deck!,
        fetchImpl,
        existingPreviewSheetId
      )
      previewReady = true
    } catch (error) {
      console.error(JSON.stringify({
        message: "Google Sheets deck preview update failed",
        error: String(error),
      }))
    }
  } else if (current?.row.sheetId != null) {
    const properties = findSheetById(storage.metadata, current.row.sheetId)
    if (typeof properties?.sheetId === "number" && properties.title) {
      try {
        await deleteDeckSheet(
          client,
          storage.metadata,
          { sheetId: properties.sheetId, title: properties.title },
          fetchImpl
        )
      } catch (error) {
        console.error(JSON.stringify({
          message: "deleted Google Sheets deck sheet cleanup failed",
          error: String(error),
        }))
      }
    }
    const previewProperties = findTaggedDeckPreviewSheet(storage.metadata, id)
    if (typeof previewProperties?.sheetId === "number" && previewProperties.title) {
      try {
        await deleteDeckSheet(client, storage.metadata, {
          sheetId: previewProperties.sheetId,
          title: previewProperties.title,
        }, fetchImpl)
      } catch (error) {
        console.error(JSON.stringify({
          message: "deleted Google Sheets deck preview cleanup failed",
          error: String(error),
        }))
      }
    }
  }

  try {
    await compactSyncHistory(client, storage, fetchImpl, active, afterWriteRows)
  } catch (error) {
    // Compaction is storage maintenance, not part of the optimistic write.
    // Keep the valid latest revision usable and retry maintenance next time.
    console.error(JSON.stringify({
      message: "Google Sheets sync history maintenance failed",
      error: String(error),
    }))
  }

  if (previewReady) await markPreviewSchema(client, storage.metadata, fetchImpl)

  return { ok: true, rev: revision, updatedAt }
}
