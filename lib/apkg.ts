import JSZip from "jszip"
import type { Database, SqlJsStatic } from "sql.js"

import { csvToDeck } from "./csv"
import { noteHash, templateHash } from "./anki-sync"
import {
  createCard,
  DEFAULT_FSRS_STATE,
  decodeTtsMeta,
  dedupeCardsByFirstField,
  encodeTtsMeta,
  parseDeckJson,
  templatesOf,
  ttsOf,
  type CardTemplate,
  type Card,
  type Deck,
} from "./deck"
import { cacheSet, getTtsClip, listTtsJobs, parseTtsFilename, resolveTtsFieldValue } from "./tts"

const FIELD_SEP = "\x1f"
export const MAX_TEXT_IMPORT_BYTES = 20 * 1024 * 1024
export const MAX_ANKI_PACKAGE_BYTES = 128 * 1024 * 1024
const MAX_ANKI_COLLECTION_BYTES = 64 * 1024 * 1024
const MAX_ANKI_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
const MAX_ANKI_ZIP_ENTRIES = 20_000
const MAX_TTS_MEDIA_BYTES = 16 * 1024 * 1024

type SizedZipObject = JSZip.JSZipObject & {
  _data?: { uncompressedSize?: number }
}

function declaredZipSize(file: JSZip.JSZipObject | null): number | null {
  const value = Number((file as SizedZipObject | null)?._data?.uncompressedSize)
  return Number.isFinite(value) && value >= 0 ? value : null
}

export function importFileSizeError(name: string, size: number): string | null {
  const lower = name.toLowerCase()
  const maximum = lower.endsWith(".apkg") || lower.endsWith(".colpkg")
    ? MAX_ANKI_PACKAGE_BYTES
    : MAX_TEXT_IMPORT_BYTES
  return size > maximum ? `Import file is too large (${Math.ceil(maximum / 1024 / 1024)} MB limit)` : null
}
const SCHEMA_SQL = `
CREATE TABLE col (
    id              integer primary key,
    crt             integer not null,
    mod             integer not null,
    scm             integer not null,
    ver             integer not null,
    dty             integer not null,
    usn             integer not null,
    ls              integer not null,
    conf            text not null,
    models          text not null,
    decks           text not null,
    dconf           text not null,
    tags            text not null
);
CREATE TABLE notes (
    id              integer primary key,
    guid            text not null,
    mid             integer not null,
    mod             integer not null,
    usn             integer not null,
    tags            text not null,
    flds            text not null,
    sfld            integer not null,
    csum            integer not null,
    flags           integer not null,
    data            text not null
);
CREATE TABLE cards (
    id              integer primary key,
    nid             integer not null,
    did             integer not null,
    ord             integer not null,
    mod             integer not null,
    usn             integer not null,
    type            integer not null,
    queue           integer not null,
    due             integer not null,
    ivl             integer not null,
    factor          integer not null,
    reps            integer not null,
    lapses          integer not null,
    left            integer not null,
    odue            integer not null,
    odid            integer not null,
    flags           integer not null,
    data            text not null
);
CREATE TABLE revlog (
    id              integer primary key,
    cid             integer not null,
    usn             integer not null,
    ease            integer not null,
    ivl             integer not null,
    lastIvl         integer not null,
    factor          integer not null,
    time            integer not null,
    type            integer not null
);
CREATE TABLE graves (
    usn             integer not null,
    oid             integer not null,
    type            integer not null
);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`

let sqlPromise: Promise<SqlJsStatic> | null = null
let sqlWasmPath = "/sql-wasm.wasm"

export function setSqlWasmPath(path: string) {
  sqlWasmPath = path
  sqlPromise = null
}

async function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const wasmPath = sqlWasmPath
    sqlPromise = import("sql.js").then((mod) => {
      const initSqlJs = mod.default
      return initSqlJs({ locateFile: () => wasmPath })
    })
  }
  return sqlPromise
}

async function sha1Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-1", bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function stripHtmlMedia(value: string): string {
  return value
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
}

async function fieldChecksum(value: string): Promise<number> {
  const hex = await sha1Hex(stripHtmlMedia(value))
  return Number.parseInt(hex.slice(0, 8), 16)
}

function guid(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10)
}

type AnkiField = { name?: string; ord?: number; description?: string }
type AnkiTmpl = { qfmt?: string; afmt?: string; name?: string; ord?: number }
type AnkiModel = {
  id?: number
  name?: string
  css?: string
  flds?: AnkiField[]
  tmpls?: AnkiTmpl[]
  type?: number
}
type AnkiDeck = { id?: number; name?: string; dyn?: number }

function asModels(raw: string): Record<string, AnkiModel> {
  const parsed = JSON.parse(raw) as unknown
  if (typeof parsed !== "object" || parsed === null) return {}
  return parsed as Record<string, AnkiModel>
}

function asDecks(raw: string): Record<string, AnkiDeck> {
  const parsed = JSON.parse(raw) as unknown
  if (typeof parsed !== "object" || parsed === null) return {}
  return parsed as Record<string, AnkiDeck>
}

export async function exportApkg(
  deck: Deck,
  options?: {
    cards?: Card[]
    onProgress?: (done: number, total: number) => void
    signal?: AbortSignal
  }
): Promise<Blob> {
  const cards = options?.cards ?? deck.cards
  const jobs = await listTtsJobs(deck, cards)
  const mediaFiles = new Map<string, Uint8Array>()
  const media: Record<string, string> = {}
  for (let i = 0; i < jobs.length; i += 1) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }
    const job = jobs[i]
    const clip = await getTtsClip({ ...job, signal: options?.signal })
    const index = String(i)
    media[index] = job.filename
    mediaFiles.set(index, new Uint8Array(await clip.blob.arrayBuffer()))
    options?.onProgress?.(i + 1, jobs.length)
  }
  if (jobs.length === 0) options?.onProgress?.(0, 0)

  const SQL = await loadSql()
  const db = new SQL.Database()
  db.run(SCHEMA_SQL)

  const now = Date.now()
  const nowSec = Math.floor(now / 1000)
  const modelId = deck.anki?.modelId && deck.anki.modelId > 0 ? deck.anki.modelId : now
  const deckId = deck.anki?.deckId && deck.anki.deckId > 0 ? deck.anki.deckId : now + 1
  const modelName = `${deck.name} 模板`
  const fieldTts = ttsOf(deck)
  const cardTemplates = templatesOf(deck)

  const flds = deck.fields.map((name, ord) => ({
    name,
    ord,
    sticky: false,
    rtl: false,
    font: "Arial",
    size: 20,
    description: fieldTts[name] ? encodeTtsMeta(fieldTts[name]) : "",
    plainText: false,
    collapsed: false,
    excludeFromSearch: false,
  }))

  const models = {
    [modelId]: {
      id: modelId,
      name: modelName,
      type: 0,
      mod: nowSec,
      usn: -1,
      sortf: 0,
      did: deckId,
      tmpls: cardTemplates.map((template, ord) =>
        ({
          name: template.name,
          ord,
          qfmt: template.front,
          afmt: template.back,
          bqfmt: "",
          bafmt: "",
          did: null,
          bfont: "",
          bsize: 0,
        })
      ),
      flds,
      css: deck.css,
      latexPre:
        "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
      latexPost: "\\end{document}",
      latexsvg: false,
      req: cardTemplates.map((_, ord) => [ord, "any", [0]]),
      tags: [],
      vers: [],
    },
  }

  const decks = {
    "1": {
      id: 1,
      name: "Default",
      collapsed: false,
      browserCollapsed: false,
      desc: "",
      dyn: 0,
      conf: 1,
      extendNew: 10,
      extendRev: 50,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      usn: 0,
      mod: nowSec,
    },
    [deckId]: {
      id: deckId,
      name: deck.name,
      collapsed: false,
      browserCollapsed: false,
      desc: "",
      dyn: 0,
      conf: 1,
      extendNew: 10,
      extendRev: 50,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      usn: -1,
      mod: nowSec,
    },
  }

  const conf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [deckId],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: deckId,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: String(modelId),
    collapseTime: 1200,
  }

  const dconf = {
    "1": {
      id: 1,
      name: "Default",
      mod: 0,
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: true,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 7],
        order: 1,
        perDay: 20,
      },
      rev: {
        bury: true,
        ease4: 1.3,
        ivlFct: 1,
        maxIvl: 36500,
        perDay: 200,
        fuzz: 0.05,
        minSpace: 1,
      },
      lapse: {
        delays: [10],
        leechAction: 0,
        leechFails: 8,
        minInt: 1,
        mult: 0,
      },
    },
  }

  db.run(
    `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      1,
      nowSec,
      now,
      now,
      11,
      0,
      0,
      0,
      JSON.stringify(conf),
      JSON.stringify(models),
      JSON.stringify(decks),
      JSON.stringify(dconf),
      "{}",
    ]
  )

  const insertNote = db.prepare(
    `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertCard = db.prepare(
    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i]
    const noteId = now + 10 + i * (cardTemplates.length + 1)
    const fieldValues = await Promise.all(
      deck.fields.map((field) => {
        const tts = fieldTts[field]
        if (tts) return resolveTtsFieldValue(tts, card.values)
        return card.values[field] ?? ""
      })
    )
    const fldsText = fieldValues.join(FIELD_SEP)
    const sfld = fieldValues[0] ?? ""
    const csum = await fieldChecksum(sfld)

    insertNote.run([
      noteId,
      card.guid || guid(),
      modelId,
      nowSec,
      -1,
      "",
      fldsText,
      sfld,
      csum,
      0,
      "",
    ])
    for (let ord = 0; ord < cardTemplates.length; ord += 1) {
      insertCard.run([
        noteId + ord + 1,
        noteId,
        deckId,
        ord,
        nowSec,
        -1,
        0,
        0,
        i * cardTemplates.length + ord + 1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
      ])
    }
  }

  insertNote.free()
  insertCard.free()

  const exported = db.export()
  db.close()

  const zip = new JSZip()
  zip.file("collection.anki2", exported)
  zip.file("media", JSON.stringify(media))
  for (const [index, bytes] of mediaFiles) {
    zip.file(index, bytes)
  }
  return zip.generateAsync({ type: "blob" })
}

function pickModel(
  models: Record<string, AnkiModel>,
  noteCounts: Map<string, number>
): AnkiModel | null {
  const entries = Object.values(models).filter((model) => model && Array.isArray(model.flds))
  if (entries.length === 0) return null

  const withNotes = entries
    .filter((model) => (noteCounts.get(String(model.id)) ?? 0) > 0)
    .sort((a, b) => (noteCounts.get(String(b.id)) ?? 0) - (noteCounts.get(String(a.id)) ?? 0))

  return withNotes[0] ?? entries.find((model) => model.type !== 1) ?? entries[0]
}

function pickNamedDeck(decks: Record<string, AnkiDeck>): AnkiDeck | undefined {
  return Object.values(decks).find(
    (deck) => deck && deck.dyn !== 1 && deck.name && deck.name !== "Default"
  )
}

export type ImportResult = {
  deck: Deck
  warnings: string[]
}

export function apkgImportWarnings(input: {
  modelCount: number
  chosenModelName: string
  templateCount: number
  chosenTemplateName: string
  otherNotes: number
  namedDeckCount: number
  chosenDeckName: string
  allTemplatesImported?: boolean
}): string[] {
  const warnings: string[] = []
  if (input.modelCount > 1) {
    warnings.push(`卡包有 ${input.modelCount} 个笔记模板，只导入了「${input.chosenModelName}」`)
  }
  if (input.templateCount > 1 && !input.allTemplatesImported) {
    warnings.push(
      `「${input.chosenModelName}」有 ${input.templateCount} 张卡模板，只用了「${input.chosenTemplateName}」`
    )
  }
  if (input.otherNotes > 0) {
    warnings.push(`另有 ${input.otherNotes} 张卡片属于其他模板，未导入`)
  }
  if (input.namedDeckCount > 1) {
    warnings.push(`卡包有 ${input.namedDeckCount} 个牌组，名称使用了「${input.chosenDeckName}」`)
  }
  return warnings
}

export async function importApkg(buffer: ArrayBuffer): Promise<ImportResult> {
  if (buffer.byteLength > MAX_ANKI_PACKAGE_BYTES) {
    throw new Error("Anki package is too large to import")
  }
  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.values(zip.files)
  if (entries.length > MAX_ANKI_ZIP_ENTRIES) {
    throw new Error("Anki package contains too many files")
  }
  let declaredTotal = 0
  for (const entry of entries) {
    const size = declaredZipSize(entry)
    if (size == null) continue
    declaredTotal += size
    if (declaredTotal > MAX_ANKI_UNCOMPRESSED_BYTES) {
      throw new Error("Anki package expands beyond the safe import limit")
    }
  }

  const colFile = zip.file("collection.anki2") ?? zip.file("collection.anki21")
  if (!colFile) {
    throw new Error("卡包里没有 collection 数据库")
  }
  const declaredCollectionSize = declaredZipSize(colFile)
  if (declaredCollectionSize != null && declaredCollectionSize > MAX_ANKI_COLLECTION_BYTES) {
    throw new Error("Anki collection database is too large to import")
  }

  const SQL = await loadSql()
  const bytes = await colFile.async("uint8array")
  const db: Database = new SQL.Database(bytes)

  const col = db.exec("SELECT models, decks FROM col LIMIT 1")
  if (!col[0]?.values[0]) {
    db.close()
    throw new Error("卡包数据库是空的")
  }

  const models = asModels(String(col[0].values[0][0]))
  const decks = asDecks(String(col[0].values[0][1]))

  const notes = db.exec("SELECT mid, flds, guid FROM notes")
  const noteRows = notes[0]?.values ?? []
  const noteCounts = new Map<string, number>()
  for (const row of noteRows) {
    const mid = String(row[0])
    noteCounts.set(mid, (noteCounts.get(mid) ?? 0) + 1)
  }

  const model = pickModel(models, noteCounts)
  if (!model?.flds?.length) {
    db.close()
    throw new Error("卡包里没有可用的笔记模板")
  }

  const sortedFlds = [...model.flds].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
  const fields = sortedFlds.map((field, index) => field.name?.trim() || `字段${index + 1}`)
  const importedTts = Object.fromEntries(
    sortedFlds.flatMap((field, index) => {
      const name = fields[index]
      const tts = decodeTtsMeta(field.description)
      return name && tts ? [[name, tts] as const] : []
    })
  )
  const fieldTts = ttsOf({ fields, fieldTts: importedTts })

  const sortedTmpls = [...(model.tmpls ?? [])].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
  const tmpl = sortedTmpls[0]
  const templates: CardTemplate[] =
    sortedTmpls.length > 0
      ? sortedTmpls.map((item, index) => ({
          id: `card-${index + 1}`,
          name: item.name?.trim() || `卡片 ${index + 1}`,
          front: item.qfmt ?? `{{${fields[0]}}}`,
          back: item.afmt ?? "{{FrontSide}}",
        }))
      : [
          {
            id: "card-1",
            name: "卡片 1",
            front: `{{${fields[0]}}}`,
            back: "{{FrontSide}}",
          },
        ]
  const mid = String(model.id)
  const modelEntries = Object.values(models).filter((item) => item && Array.isArray(item.flds))
  const namedDecks = Object.values(decks).filter(
    (item) => item && item.dyn !== 1 && item.name && item.name !== "Default"
  )
  const importedRows = noteRows.filter((row) => String(row[0]) === mid)
  const cards = importedRows.map((row) => {
    const parts = String(row[1] ?? "").split(FIELD_SEP)
    const values: Record<string, string> = {}
    fields.forEach((field, index) => {
      values[field] = fieldTts[field] ? "" : (parts[index] ?? "")
    })
    const guid = typeof row[2] === "string" && row[2].trim() ? row[2].trim() : undefined
    return { ...createCard(fields, values), ...(guid ? { guid } : {}) }
  })
  const namedDeck = pickNamedDeck(decks)
  const deckName = namedDeck?.name ?? "导入卡包"
  const warnings = apkgImportWarnings({
    modelCount: modelEntries.length,
    chosenModelName: model.name?.trim() || "未命名模板",
    templateCount: sortedTmpls.length,
    chosenTemplateName: tmpl?.name?.trim() || "Card 1",
    otherNotes: noteRows.length - importedRows.length,
    namedDeckCount: namedDecks.length,
    chosenDeckName: deckName,
    allTemplatesImported: true,
  })

  db.close()

  const mediaFile = zip.file("media")
  if (mediaFile) {
    try {
      const raw = JSON.parse(await mediaFile.async("string")) as unknown
      if (raw && typeof raw === "object") {
        for (const [index, filename] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof filename !== "string") continue
          const parsed = parseTtsFilename(filename)
          const bin = zip.file(index)
          if (!parsed || !bin) continue
          const mediaSize = declaredZipSize(bin)
          if (mediaSize != null && mediaSize > MAX_TTS_MEDIA_BYTES) {
            throw new Error("Anki package contains an oversized TTS media file")
          }
          await cacheSet(parsed.id, await bin.async("arraybuffer"))
        }
      }
    } catch {
      // ignore broken media map
    }
  }

  const importedDeck: Deck = {
    version: 2,
    name: deckName,
    fields,
    fieldNotes: Object.fromEntries(fields.map((field) => [field, ""])),
    fieldTts,
    front: templates[0]!.front,
    back: templates[0]!.back,
    templates,
    css: model.css ?? "",
    cards: dedupeCardsByFirstField(cards, fields),
    fsrs: { ...DEFAULT_FSRS_STATE, cards: {} },
  }
  const modelId = typeof model.id === "number" && model.id > 0 ? model.id : Date.now()
  const deckId = typeof namedDeck?.id === "number" && namedDeck.id > 0 ? namedDeck.id : Date.now() + 1

  return {
    deck: {
      ...importedDeck,
      anki: {
        modelId,
        deckId,
        pushedTemplateHash: templateHash(importedDeck),
      },
      cards: importedDeck.cards.map((card) => ({
        ...card,
        pushedHash: noteHash(importedDeck, card),
      })),
    },
    warnings,
  }
}

export async function importDeckFile(file: File, current: Deck): Promise<ImportResult> {
  const sizeError = importFileSizeError(file.name, file.size)
  if (sizeError) throw new Error(sizeError)
  const name = file.name.toLowerCase()
  if (name.endsWith(".json")) {
    return { deck: parseDeckJson(await file.text()), warnings: [] }
  }
  if (name.endsWith(".csv")) {
    return { deck: csvToDeck(await file.text(), current), warnings: [] }
  }
  if (name.endsWith(".apkg") || name.endsWith(".colpkg")) {
    return importApkg(await file.arrayBuffer())
  }
  throw new Error("只支持 .json、.csv、.apkg 或 .colpkg")
}
