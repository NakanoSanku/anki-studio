import { parseCsvDetailed } from "./csv"
import {
  appendUniqueCards,
  cardKeyValue,
  createBlankDeck,
  createCard,
  dedupeCardsByFirstField,
  normalizeCardKey,
  parseDeckJson,
  remapCardValues,
  type Card,
  type Deck,
} from "./deck"
import {
  decodeImportBytes,
  looksLikeBinary,
  type DecodeResult,
  type ImportEncoding,
} from "./encoding"

export type ImportKind = "csv" | "json"
export const MAX_TEXT_PREVIEW_BYTES = 20 * 1024 * 1024

export function textImportSizeError(size: number): string | null {
  return size > MAX_TEXT_PREVIEW_BYTES ? "Import file is too large (20 MB limit)" : null
}
export type ImportMode = "merge" | "replace" | "new"

export type ImportIssue = {
  level: "error" | "warning"
  code: string
  message: string
}

export type ImportPreview = {
  kind: ImportKind
  filename: string
  encoding: ImportEncoding | "unknown"
  encodingLabel: string
  name: string
  fields: string[]
  rowCount: number
  cardCount: number
  emptyFirstField: number
  duplicateInFile: number
  duplicateInCurrent: number
  extraFields: string[]
  missingFields: string[]
  sample: Record<string, string>[]
  issues: ImportIssue[]
  canImport: boolean
  cards: Card[]
  deck?: Deck
}

export type ApplyImportResult = {
  deck: Deck
  added: number
  mode: ImportMode
}

export function filenameToDeckName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim() || "导入卡包"
}

export function isTextImportName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith(".csv") || lower.endsWith(".json")
}

function issue(level: ImportIssue["level"], code: string, message: string): ImportIssue {
  return { level, code, message }
}

function emptyPreview(
  kind: ImportKind,
  filename: string,
  message: string,
  extra?: Partial<ImportPreview>
): ImportPreview {
  const issues = [issue("error", "invalid", message), ...(extra?.issues ?? [])]
  return {
    kind,
    filename,
    encoding: extra?.encoding ?? "unknown",
    encodingLabel: extra?.encodingLabel ?? "未知",
    name: filenameToDeckName(filename),
    fields: extra?.fields ?? [],
    rowCount: extra?.rowCount ?? 0,
    cardCount: extra?.cardCount ?? 0,
    emptyFirstField: extra?.emptyFirstField ?? 0,
    duplicateInFile: extra?.duplicateInFile ?? 0,
    duplicateInCurrent: extra?.duplicateInCurrent ?? 0,
    extraFields: extra?.extraFields ?? [],
    missingFields: extra?.missingFields ?? [],
    sample: extra?.sample ?? [],
    issues,
    canImport: false,
    cards: extra?.cards ?? [],
    deck: extra?.deck,
  }
}

function fieldDiff(incoming: string[], current: string[]): { extraFields: string[]; missingFields: string[] } {
  const incomingSet = new Set(incoming)
  const currentSet = new Set(current)
  return {
    extraFields: incoming.filter((field) => !currentSet.has(field)),
    missingFields: current.filter((field) => !incomingSet.has(field)),
  }
}

function summarizeCards(
  cards: Card[],
  fields: string[],
  current: Deck
): Pick<ImportPreview, "emptyFirstField" | "duplicateInFile" | "duplicateInCurrent" | "cardCount"> {
  const seen = new Set<string>()
  let emptyFirstField = 0
  let duplicateInFile = 0
  let duplicateInCurrent = 0
  const currentKeys = new Set(
    current.cards.map((card) => cardKeyValue(card, current.fields)).filter(Boolean)
  )

  for (const card of cards) {
    const key = cardKeyValue(card, fields)
    if (!key) {
      emptyFirstField += 1
      continue
    }
    if (seen.has(key)) {
      duplicateInFile += 1
      continue
    }
    seen.add(key)
    const remapped = remapCardValues(card.values, fields, current.fields)
    const currentKey = normalizeCardKey(remapped[current.fields[0] ?? ""] ?? "")
    if (currentKey && currentKeys.has(currentKey)) {
      duplicateInCurrent += 1
    }
  }

  return {
    emptyFirstField,
    duplicateInFile,
    duplicateInCurrent,
    cardCount: cards.length,
  }
}

function withEncodingIssues(preview: ImportPreview, decoded: DecodeResult): ImportPreview {
  const issues = [
    ...decoded.warnings.map((message) => issue("warning", "encoding", message)),
    ...preview.issues,
  ]
  return {
    ...preview,
    encoding: decoded.encoding,
    encodingLabel: decoded.encodingLabel,
    issues,
    canImport: !issues.some((item) => item.level === "error"),
  }
}

function finishPreview(preview: Omit<ImportPreview, "canImport">): ImportPreview {
  return {
    ...preview,
    canImport: !preview.issues.some((item) => item.level === "error"),
  }
}

function inspectCsv(decoded: DecodeResult, filename: string, current: Deck): ImportPreview {
  const parsed = parseCsvDetailed(decoded.text)
  const issues: ImportIssue[] = decoded.warnings.map((message) => issue("warning", "encoding", message))

  if (parsed.unclosedQuote) {
    issues.push(issue("error", "unclosed-quote", "CSV 有未闭合的引号"))
  }
  if (parsed.rows.length === 0) {
    return withEncodingIssues(emptyPreview("csv", filename, "CSV 是空的", { issues }), decoded)
  }

  const fields = parsed.rows[0]!.map((header) => header.trim())
  if (fields.length === 0 || fields.some((field) => !field)) {
    issues.push(issue("error", "empty-header", "CSV 表头不能有空列"))
  }
  if (new Set(fields).size !== fields.length) {
    issues.push(issue("error", "duplicate-header", "CSV 表头字段不能重复"))
  }
  for (const field of fields) {
    if (field && /[\u0000-\u001f]/.test(field)) {
      issues.push(issue("error", "control-header", `字段名「${field}」含有非法控制字符`))
    }
    if (field.length > 64) {
      issues.push(issue("warning", "long-header", `字段名「${field.slice(0, 24)}…」过长`))
    }
  }

  const dataRows = parsed.rows.slice(1)
  if (dataRows.length === 0) {
    issues.push(issue("error", "no-rows", "CSV 没有数据行"))
  }

  let mismatched = 0
  const cards: Card[] = dataRows.map((row) => {
    if (row.length !== fields.length) mismatched += 1
    const values: Record<string, string> = {}
    fields.forEach((field, index) => {
      if (field) values[field] = row[index] ?? ""
    })
    return createCard(fields, values)
  })
  if (mismatched > 0) {
    issues.push(issue("warning", "column-count", `${mismatched} 行的列数与表头不一致`))
  }

  const { extraFields, missingFields } = fieldDiff(fields.filter(Boolean), current.fields)
  if (extraFields.length > 0) {
    issues.push(issue("warning", "extra-fields", `多出字段：${extraFields.join("、")}。合并到当前卡包时这些列会被忽略`))
  }
  if (missingFields.length > 0) {
    issues.push(issue("warning", "missing-fields", `缺少当前卡包字段：${missingFields.join("、")}`))
  }

  const stats = summarizeCards(cards, fields, current)
  if (stats.emptyFirstField > 0) {
    issues.push(issue("warning", "empty-key", `${stats.emptyFirstField} 行首字段为空，合并时不会写入`))
  }
  if (stats.duplicateInFile > 0) {
    issues.push(issue("warning", "dup-file", `文件内有 ${stats.duplicateInFile} 行与前面的首字段重复`))
  }
  if (stats.duplicateInCurrent > 0) {
    issues.push(issue("warning", "dup-current", `${stats.duplicateInCurrent} 行与当前卡包首字段重复，合并时会跳过`))
  }

  const sample = cards.slice(0, 5).map((card) => {
    const row: Record<string, string> = {}
    for (const field of fields.filter(Boolean)) {
      row[field] = card.values[field] ?? ""
    }
    return row
  })

  return finishPreview({
    kind: "csv",
    filename,
    encoding: decoded.encoding,
    encodingLabel: decoded.encodingLabel,
    name: filenameToDeckName(filename),
    fields: fields.filter(Boolean),
    rowCount: dataRows.length,
    ...stats,
    extraFields,
    missingFields,
    sample,
    issues,
    cards,
  })
}

function inspectJson(decoded: DecodeResult, filename: string, current: Deck): ImportPreview {
  const issues: ImportIssue[] = decoded.warnings.map((message) => issue("warning", "encoding", message))
  let deck: Deck
  try {
    deck = parseDeckJson(decoded.text)
  } catch (error) {
    return withEncodingIssues(
      emptyPreview("json", filename, error instanceof Error ? error.message : "JSON 无法解析", { issues }),
      decoded
    )
  }

  const { extraFields, missingFields } = fieldDiff(deck.fields, current.fields)
  if (extraFields.length > 0) {
    issues.push(issue("warning", "extra-fields", `多出字段：${extraFields.join("、")}。合并到当前卡包时这些列会被忽略`))
  }
  if (missingFields.length > 0) {
    issues.push(issue("warning", "missing-fields", `缺少当前卡包字段：${missingFields.join("、")}`))
  }
  if (deck.cards.length === 0) {
    issues.push(issue("warning", "no-cards", "JSON 卡包没有卡片"))
  }

  const stats = summarizeCards(deck.cards, deck.fields, current)
  if (stats.emptyFirstField > 0) {
    issues.push(issue("warning", "empty-key", `${stats.emptyFirstField} 张卡片首字段为空`))
  }
  if (stats.duplicateInFile > 0) {
    issues.push(issue("warning", "dup-file", `文件内有 ${stats.duplicateInFile} 张卡片首字段重复，已去重`))
  }
  if (stats.duplicateInCurrent > 0) {
    issues.push(issue("warning", "dup-current", `${stats.duplicateInCurrent} 张与当前卡包首字段重复，合并时会跳过`))
  }

  const sample = deck.cards.slice(0, 5).map((card) => {
    const row: Record<string, string> = {}
    for (const field of deck.fields) {
      row[field] = card.values[field] ?? ""
    }
    return row
  })

  return finishPreview({
    kind: "json",
    filename,
    encoding: decoded.encoding,
    encodingLabel: decoded.encodingLabel,
    name: deck.name,
    fields: deck.fields,
    rowCount: deck.cards.length,
    ...stats,
    extraFields,
    missingFields,
    sample,
    issues,
    cards: deck.cards,
    deck,
  })
}

export function inspectImportText(
  filename: string,
  decoded: DecodeResult,
  current: Deck
): ImportPreview {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".json")) return inspectJson(decoded, filename, current)
  if (lower.endsWith(".csv")) return inspectCsv(decoded, filename, current)
  throw new Error("只支持校验 .json 或 .csv")
}

export async function inspectImportFile(file: File, current: Deck): Promise<ImportPreview> {
  const lower = file.name.toLowerCase()
  const kind: ImportKind = lower.endsWith(".json") ? "json" : "csv"
  if (!lower.endsWith(".json") && !lower.endsWith(".csv")) {
    throw new Error("只支持校验 .json 或 .csv")
  }
  const sizeError = textImportSizeError(file.size)
  if (sizeError) return emptyPreview(kind, file.name, sizeError)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length === 0) {
    return emptyPreview(kind, file.name, "文件是空的")
  }
  if (looksLikeBinary(bytes)) {
    return emptyPreview(kind, file.name, "文件看起来是二进制，不是 CSV/JSON 文本")
  }

  try {
    return inspectImportText(file.name, decodeImportBytes(bytes), current)
  } catch (error) {
    return emptyPreview(kind, file.name, error instanceof Error ? error.message : "无法读取文件")
  }
}

function deckFromCsvPreview(preview: ImportPreview): Deck {
  const fields = preview.fields.length > 0 ? preview.fields : ["Word"]
  const base = createBlankDeck(preview.name)
  const first = fields[0] ?? "Word"
  return {
    ...base,
    name: preview.name,
    fields,
    fieldNotes: Object.fromEntries(fields.map((field) => [field, ""])),
    fieldTts: {},
    front: `<div class="word">{{${first}}}</div>`,
    back:
      `{{FrontSide}}\n<hr id="answer">\n` +
      fields
        .slice(1)
        .map((field) => `{{#${field}}}<div class="field">${field}：{{${field}}}</div>{{/${field}}}`)
        .join("\n"),
    cards: dedupeCardsByFirstField(preview.cards, fields),
  }
}

export function applyTextImport(
  preview: ImportPreview,
  current: Deck,
  mode: ImportMode
): ApplyImportResult {
  if (!preview.canImport) {
    throw new Error("校验未通过，不能导入")
  }

  if (mode === "new") {
    const deck = preview.kind === "json" && preview.deck ? preview.deck : deckFromCsvPreview(preview)
    return { deck, added: deck.cards.length, mode }
  }

  if (mode === "replace") {
    if (preview.kind === "json" && preview.deck) {
      return { deck: preview.deck, added: preview.deck.cards.length, mode }
    }
    const cards = preview.cards.map((card) =>
      createCard(current.fields, remapCardValues(card.values, preview.fields, current.fields))
    )
    const deck = {
      ...current,
      cards: dedupeCardsByFirstField(cards, current.fields),
    }
    return { deck, added: deck.cards.length, mode }
  }

  const cards = appendUniqueCards(current.cards, current.fields, preview.cards, preview.fields)
  return {
    deck: { ...current, cards },
    added: cards.length - current.cards.length,
    mode,
  }
}

export function defaultImportMode(kind: ImportKind): ImportMode {
  return kind === "json" ? "new" : "merge"
}
