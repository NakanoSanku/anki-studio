import { Buffer } from "node:buffer"

import { describe, expect, it } from "vitest"

import { createCard, createDefaultDeck } from "./deck"
import {
  connectGoogleSheet,
  createGoogleSheetsClient,
  getGoogleSheetsDeck,
  listGoogleSheetsIndex,
  putGoogleSheetsDeck,
} from "./google-sheets-sync"

const client = createGoogleSheetsClient({
  spreadsheetId: "spreadsheet-1234567890",
  accessToken: "short-lived-access-token",
})

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
]

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
]

type FakeSheet = {
  sheetId: number
  title: string
  hidden: boolean
  frozenRowCount: number
  values: unknown[][]
}

type FakeDeveloperMetadata = {
  metadataKey: string
  metadataValue: string
  location: { spreadsheet?: boolean; sheetId?: number }
}

function hasValue(row: unknown[] | undefined): boolean {
  return Boolean(row?.some((value) => value !== "" && value != null))
}

function compactValues(values: unknown[][]): unknown[][] {
  const rows = values.map((row) => {
    const next = [...row]
    while (next.length > 0 && (next.at(-1) === "" || next.at(-1) == null)) next.pop()
    return next
  })
  while (rows.length > 0 && !hasValue(rows.at(-1))) rows.pop()
  return rows
}

function columnNumber(value: string): number {
  return [...value].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0)
}

function parseA1(range: string): {
  startRow: number
  endRow?: number
  startColumn: number
  endColumn: number
} {
  const [startRaw, endRaw = startRaw] = range.split(":")
  const start = /^([A-Z]+)(\d+)?$/.exec(startRaw ?? "")
  const end = /^([A-Z]+)(\d+)?$/.exec(endRaw ?? "")
  if (!start || !end) throw new Error(`Unsupported fake range: ${range}`)
  return {
    startRow: Math.max(0, Number(start[2] ?? 1) - 1),
    endRow: end[2] ? Number(end[2]) : undefined,
    startColumn: columnNumber(start[1]!) - 1,
    endColumn: columnNumber(end[1]!),
  }
}

function parseValuesPath(pathname: string): {
  sheetTitle: string
  range: string
  append: boolean
} {
  const encoded = pathname.split("/values/")[1]
  if (!encoded) throw new Error(`Unsupported fake values path: ${pathname}`)
  const decoded = decodeURIComponent(encoded)
  const append = decoded.endsWith(":append")
  const reference = append ? decoded.slice(0, -":append".length) : decoded
  const separator = reference.lastIndexOf("!")
  const quotedTitle = reference.slice(0, separator)
  const range = reference.slice(separator + 1)
  const sheetTitle = quotedTitle.startsWith("'") && quotedTitle.endsWith("'")
    ? quotedTitle.slice(1, -1).replaceAll("''", "'")
    : quotedTitle
  return { sheetTitle, range, append }
}

function createSheetsApi(options: {
  legacyRows?: unknown[][]
  hasWritten?: boolean
  v3Deck?: { id: string; name: string }
} = {}) {
  const sheets = new Map<number, FakeSheet>()
  sheets.set(0, {
    sheetId: 0,
    title: "Sheet1",
    hidden: false,
    frozenRowCount: 0,
    values: [],
  })
  if (options.legacyRows) {
    sheets.set(7, {
      sheetId: 7,
      title: "_anki_studio_sync",
      hidden: true,
      frozenRowCount: 1,
      values: [[...DATA_HEADERS], ...options.legacyRows],
    })
  }
  if (options.v3Deck) {
    const deck = { ...createDefaultDeck(), name: options.v3Deck.name }
    const versionId = "v3-version-0000001"
    const payload = {
      rev: 42,
      updatedAt: 1_700_000_000_000,
      deletedAt: null,
      deck,
      editorState: null,
    }
    const dataSheetId = 8
    sheets.set(7, {
      sheetId: 7,
      title: "_anki_studio_sync",
      hidden: true,
      frozenRowCount: 1,
      values: [[...INDEX_HEADERS], [
        options.v3Deck.id,
        payload.rev,
        payload.updatedAt,
        "",
        deck.name,
        deck.cards.length,
        dataSheetId,
        deck.name,
        3,
        versionId,
      ]],
    })
    sheets.set(dataSheetId, {
      sheetId: dataSheetId,
      title: deck.name,
      hidden: false,
      frozenRowCount: 1,
      values: [[...DATA_HEADERS], [
        options.v3Deck.id,
        payload.rev,
        payload.updatedAt,
        "",
        deck.name,
        deck.cards.length,
        0,
        1,
        Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
        3,
        versionId,
      ]],
    })
  }
  const developerMetadata: FakeDeveloperMetadata[] = options.hasWritten
    ? [{
        metadataKey: "anki_studio_has_data",
        metadataValue: "1",
        location: { spreadsheet: true },
      }]
    : []
  if (options.v3Deck) {
    developerMetadata.push(
      {
        metadataKey: "anki_studio_has_data",
        metadataValue: "1",
        location: { spreadsheet: true },
      },
      {
        metadataKey: "anki_studio_deck_id",
        metadataValue: options.v3Deck.id,
        location: { sheetId: 8 },
      }
    )
  }
  const requests: Array<{ url: URL; init?: RequestInit }> = []

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    requests.push({ url, init })
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer short-lived-access-token")

    if (url.pathname.endsWith(":batchUpdate")) {
      const body = JSON.parse(String(init?.body)) as { requests?: Array<Record<string, unknown>> }
      const replies = (body.requests ?? []).map((request) => {
        const addSheet = request.addSheet as { properties?: Record<string, unknown> } | undefined
        if (addSheet) {
          const requested = addSheet.properties ?? {}
          const sheetId = typeof requested.sheetId === "number"
            ? requested.sheetId
            : Math.max(...sheets.keys()) + 1
          const grid = requested.gridProperties as { frozenRowCount?: number } | undefined
          const sheet: FakeSheet = {
            sheetId,
            title: String(requested.title ?? `Sheet${sheetId}`),
            hidden: Boolean(requested.hidden),
            frozenRowCount: Number(grid?.frozenRowCount ?? 0),
            values: [],
          }
          sheets.set(sheetId, sheet)
          return {
            addSheet: {
              properties: {
                sheetId,
                title: sheet.title,
                hidden: sheet.hidden,
                gridProperties: { frozenRowCount: sheet.frozenRowCount },
              },
            },
          }
        }

        const update = request.updateSheetProperties as {
          properties?: Record<string, unknown>
        } | undefined
        if (update?.properties) {
          const sheet = sheets.get(Number(update.properties.sheetId))
          if (!sheet) throw new Error("fake sheet missing")
          if (typeof update.properties.title === "string") sheet.title = update.properties.title
          if (typeof update.properties.hidden === "boolean") sheet.hidden = update.properties.hidden
          const grid = update.properties.gridProperties as { frozenRowCount?: number } | undefined
          if (typeof grid?.frozenRowCount === "number") sheet.frozenRowCount = grid.frozenRowCount
        }

        const createMetadata = request.createDeveloperMetadata as {
          developerMetadata?: FakeDeveloperMetadata
        } | undefined
        if (createMetadata?.developerMetadata) {
          developerMetadata.push(structuredClone(createMetadata.developerMetadata))
        }

        const deletion = request.deleteDimension as {
          range?: { sheetId?: number; startIndex?: number; endIndex?: number }
        } | undefined
        if (deletion?.range) {
          const sheet = sheets.get(Number(deletion.range.sheetId))
          if (!sheet) throw new Error("fake sheet missing")
          const start = Number(deletion.range.startIndex)
          const count = Number(deletion.range.endIndex) - start
          sheet.values.splice(start, count)
        }

        const deleteSheet = request.deleteSheet as { sheetId?: number } | undefined
        if (deleteSheet && typeof deleteSheet.sheetId === "number") {
          sheets.delete(deleteSheet.sheetId)
          for (let index = developerMetadata.length - 1; index >= 0; index -= 1) {
            if (developerMetadata[index]?.location.sheetId === deleteSheet.sheetId) {
              developerMetadata.splice(index, 1)
            }
          }
        }
        return {}
      })
      return Response.json({ replies })
    }

    if (url.pathname.includes("/values/")) {
      const reference = parseValuesPath(url.pathname)
      const sheet = [...sheets.values()].find((item) => item.title === reference.sheetTitle)
      if (!sheet) return Response.json({ error: { message: "sheet missing" } }, { status: 404 })
      const parsedRange = parseA1(reference.range)

      if (reference.append) {
        const body = JSON.parse(String(init?.body)) as { values?: unknown[][] }
        sheet.values.push(...structuredClone(body.values ?? []))
        return Response.json({ updates: { updatedRows: body.values?.length ?? 0 } })
      }

      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { values?: unknown[][] }
        for (const [rowOffset, incoming] of (body.values ?? []).entries()) {
          const rowIndex = parsedRange.startRow + rowOffset
          const current = [...(sheet.values[rowIndex] ?? [])]
          for (const [columnOffset, value] of incoming.entries()) {
            current[parsedRange.startColumn + columnOffset] = structuredClone(value)
          }
          sheet.values[rowIndex] = current
        }
        return Response.json({ updatedRows: body.values?.length ?? 0 })
      }

      const selected = sheet.values
        .slice(parsedRange.startRow, parsedRange.endRow)
        .map((row) => row.slice(parsedRange.startColumn, parsedRange.endColumn))
      const values = compactValues(selected)
      return Response.json(values.length > 0 ? { values } : {})
    }

    return Response.json({
      spreadsheetId: client.spreadsheetId,
      properties: { title: "Anki 云端卡包" },
      sheets: [...sheets.values()].map((sheet) => ({
        properties: {
          sheetId: sheet.sheetId,
          title: sheet.title,
          hidden: sheet.hidden,
          gridProperties: { frozenRowCount: sheet.frozenRowCount },
        },
      })),
      developerMetadata,
    })
  }

  return {
    fetchImpl: fetchImpl as typeof fetch,
    setValues: (sheetId: number, values: unknown[][]) => {
      const sheet = sheets.get(sheetId)
      if (!sheet) throw new Error("fake sheet missing")
      sheet.values = structuredClone(values)
    },
    removePreviewMetadata: (sheetId: number) => {
      for (let index = developerMetadata.length - 1; index >= 0; index -= 1) {
        if (
          developerMetadata[index]?.metadataKey === "anki_studio_preview_deck_id"
          && developerMetadata[index]?.location.sheetId === sheetId
        ) {
          developerMetadata.splice(index, 1)
        }
      }
    },
    state: () => ({
      sheets: [...sheets.values()].map((sheet) => structuredClone(sheet)),
      developerMetadata: structuredClone(developerMetadata),
      requests,
    }),
  }
}

function deckSheets(api: ReturnType<typeof createSheetsApi>): FakeSheet[] {
  const state = api.state()
  const ids = new Set(state.developerMetadata
    .filter((item) => item.metadataKey === "anki_studio_deck_id")
    .map((item) => item.location.sheetId))
  return state.sheets.filter((sheet) => ids.has(sheet.sheetId))
}

function previewSheets(api: ReturnType<typeof createSheetsApi>): FakeSheet[] {
  const state = api.state()
  const ids = new Set(state.developerMetadata
    .filter((item) => item.metadataKey === "anki_studio_preview_deck_id")
    .map((item) => item.location.sheetId))
  return state.sheets.filter((sheet) => ids.has(sheet.sheetId))
}

function legacyRow(id: string, name: string): unknown[] {
  const deck = { ...createDefaultDeck(), name }
  const payload = {
    rev: 42,
    updatedAt: 1_700_000_000_000,
    deletedAt: null,
    deck,
    editorState: null,
  }
  return [
    id,
    payload.rev,
    payload.updatedAt,
    "",
    name,
    deck.cards.length,
    0,
    1,
    Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
    2,
    "legacy-version-0001",
  ]
}

describe("Google Sheets API sync", () => {
  it("initializes a hidden v3 index in a Picker-selected spreadsheet", async () => {
    const api = createSheetsApi()
    const result = await connectGoogleSheet(client, api.fetchImpl)

    expect(result).toMatchObject({
      id: "spreadsheet-1234567890",
      title: "Anki 云端卡包",
    })
    const index = api.state().sheets.find((sheet) => sheet.title === "_anki_studio_sync")
    expect(index).toMatchObject({ hidden: true, frozenRowCount: 1 })
    expect(index?.values[0]).toHaveLength(10)
    expect(index?.values[0]).toContain("sheet_id")
  })

  it("backfills a readable preview for an existing v3 deck sheet", async () => {
    const api = createSheetsApi({ v3Deck: { id: "existing-deck", name: "单词本" } })

    await connectGoogleSheet(client, api.fetchImpl)

    expect(deckSheets(api)).toMatchObject([{
      sheetId: 8,
      title: "_anki_studio_data_existingdeck",
      hidden: true,
    }])
    expect(previewSheets(api)).toMatchObject([{
      title: "单词本",
      hidden: false,
    }])
    expect(previewSheets(api)[0]?.values[0]).toEqual([
      "__anki_studio_card_id",
      ...createDefaultDeck().fields,
    ])
    expect(previewSheets(api)[0]?.values[1]?.[0]).toEqual(expect.any(String))
  })

  it("stores multiple decks in separate, stably mapped sheets", async () => {
    const api = createSheetsApi()
    const firstDeck = { ...createDefaultDeck(), name: "泰语/日常" }
    const secondDeck = { ...createDefaultDeck(), name: "泰语/日常" }

    const first = await putGoogleSheetsDeck(client, "remote-deck-a", {
      expectedRev: 0,
      deck: firstDeck,
    }, api.fetchImpl)
    const second = await putGoogleSheetsDeck(client, "remote-deck-b", {
      expectedRev: 0,
      deck: secondDeck,
    }, api.fetchImpl)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)

    expect(deckSheets(api).map((sheet) => sheet.title).sort()).toEqual([
      "_anki_studio_data_remotedecka",
      "_anki_studio_data_remotedeckb",
    ])
    expect(previewSheets(api).map((sheet) => sheet.title).sort()).toEqual([
      "泰语 日常",
      "泰语 日常 (2)",
    ])
    expect(previewSheets(api)[0]?.values[0]).toEqual(["__anki_studio_card_id", ...firstDeck.fields])
    expect(previewSheets(api)[0]?.values[1]?.[0]).toBe(firstDeck.cards[0]?.id)
    await expect(listGoogleSheetsIndex(client, api.fetchImpl)).resolves.toMatchObject([
      { id: "remote-deck-a", name: "泰语/日常", cardCount: 1 },
      { id: "remote-deck-b", name: "泰语/日常", cardCount: 1 },
    ])
    await expect(getGoogleSheetsDeck(client, "remote-deck-a", api.fetchImpl)).resolves.toMatchObject({
      deck: { name: "泰语/日常" },
    })
    await expect(getGoogleSheetsDeck(client, "remote-deck-b", api.fetchImpl)).resolves.toMatchObject({
      deck: { name: "泰语/日常" },
    })
  })

  it("keeps only the latest payload and index row after each revision", async () => {
    const api = createSheetsApi()
    const initial = createDefaultDeck()
    const first = await putGoogleSheetsDeck(client, "history-deck", {
      expectedRev: 0,
      deck: initial,
    }, api.fetchImpl)
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error("expected first save to succeed")

    const nextDeck = {
      ...initial,
      cards: initial.cards.map((card) => ({
        ...card,
        values: { ...card.values, Word: "latest" },
      })),
    }
    const second = await putGoogleSheetsDeck(client, "history-deck", {
      expectedRev: first.rev,
      deck: nextDeck,
    }, api.fetchImpl)
    expect(second.ok).toBe(true)

    const dataSheet = deckSheets(api)[0]
    const dataValues = dataSheet?.values.filter(hasValue) ?? []
    expect(dataValues).toHaveLength(2)
    expect(dataValues[1]?.[1]).toBe(second.ok ? second.rev : -1)
    const indexSheet = api.state().sheets.find((sheet) => sheet.title === "_anki_studio_sync")
    const indexValues = indexSheet?.values.filter(hasValue) ?? []
    expect(indexValues).toHaveLength(2)
    expect(indexValues[1]?.[1]).toBe(second.ok ? second.rev : -1)
    expect(api.state().developerMetadata).toContainEqual(expect.objectContaining({
      metadataKey: "anki_studio_history_compacted",
      metadataValue: "1",
    }))
  })

  it("pulls edited, added, and deleted rows from an editable preview", async () => {
    const api = createSheetsApi()
    const source = createDefaultDeck()
    const second = createCard(source.fields, {
      Word: "second",
      Translation: "第二个",
    })
    const deck = { ...source, cards: [...source.cards, second] }
    const saved = await putGoogleSheetsDeck(client, "editable-deck", {
      expectedRev: 0,
      deck,
    }, api.fetchImpl)
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error("expected save to succeed")

    const preview = previewSheets(api)[0]
    if (!preview) throw new Error("expected preview sheet")
    api.setValues(preview.sheetId, [
      ["__anki_studio_card_id", ...deck.fields],
      [
        deck.cards[0]!.id,
        "edited from Sheets",
        ...deck.fields.slice(1).map((field) => deck.cards[0]!.values[field] ?? ""),
      ],
      ["", "new from Sheets", "", "新增", "", "", ""],
    ])

    const editedIndex = await listGoogleSheetsIndex(client, api.fetchImpl)
    expect(editedIndex).toMatchObject([{ id: "editable-deck", cardCount: 2 }])
    const editedRevision = editedIndex[0]?.rev ?? 0
    expect(editedRevision).toBeGreaterThan(saved.rev)
    await expect(getGoogleSheetsDeck(client, "editable-deck", api.fetchImpl)).resolves.toMatchObject({
      rev: editedRevision,
      deck: {
        cards: [
          { id: deck.cards[0]!.id, values: { Word: "edited from Sheets" } },
          { values: { Word: "new from Sheets", Translation: "新增" } },
        ],
      },
    })

    api.setValues(preview.sheetId, [
      ["__anki_studio_card_id", ...deck.fields],
      [
        deck.cards[0]!.id,
        "edited from Sheets",
        ...deck.fields.slice(1).map((field) => deck.cards[0]!.values[field] ?? ""),
      ],
    ])
    const deletedIndex = await listGoogleSheetsIndex(client, api.fetchImpl)
    expect(deletedIndex).toMatchObject([{ id: "editable-deck", cardCount: 1 }])
    const deletedRevision = deletedIndex[0]?.rev ?? 0
    expect(deletedRevision).toBeGreaterThan(editedRevision)
    await expect(getGoogleSheetsDeck(client, "editable-deck", api.fetchImpl)).resolves.toMatchObject({
      rev: deletedRevision,
      deck: { cards: [{ id: deck.cards[0]!.id }] },
    })
  })

  it("reuses an existing titled preview when its metadata is missing", async () => {
    const api = createSheetsApi()
    const deck = { ...createDefaultDeck(), name: "原有卡包" }
    const saved = await putGoogleSheetsDeck(client, "metadata-deck", {
      expectedRev: 0,
      deck,
    }, api.fetchImpl)
    expect(saved.ok).toBe(true)
    const preview = previewSheets(api)[0]
    if (!preview) throw new Error("expected preview sheet")
    api.removePreviewMetadata(preview.sheetId)

    const next = await putGoogleSheetsDeck(client, "metadata-deck", {
      expectedRev: saved.ok ? saved.rev : 0,
      deck: { ...deck, cards: deck.cards.map((card) => ({
        ...card,
        values: { ...card.values, Word: "从网站更新" },
      })) },
    }, api.fetchImpl)
    expect(next.ok).toBe(true)
    expect(previewSheets(api)).toHaveLength(1)
    expect(previewSheets(api)[0]?.title).toBe("原有卡包")
  })

  it("renames the existing mapped sheet and preserves optimistic conflicts", async () => {
    const api = createSheetsApi()
    const deck = { ...createDefaultDeck(), name: "Kate's Thai" }
    const saved = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: 0,
      deck,
    }, api.fetchImpl)
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error("expected save to succeed")
    const originalSheetId = deckSheets(api)[0]?.sheetId

    const renamed = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: saved.rev,
      deck: { ...deck, name: "泰语进阶" },
    }, api.fetchImpl)
    expect(renamed.ok).toBe(true)
    expect(deckSheets(api)).toMatchObject([{
      sheetId: originalSheetId,
      title: "_anki_studio_data_remotedeck",
    }])
    expect(previewSheets(api)).toMatchObject([{ title: "泰语进阶" }])

    const conflict = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: saved.rev,
      deck,
    }, api.fetchImpl)
    expect(conflict).toMatchObject({
      ok: false,
      conflict: true,
      server: { deck: { name: "泰语进阶" } },
    })
  })

  it("keeps a tombstone in the index and removes a deleted deck sheet", async () => {
    const api = createSheetsApi()
    const deck = { ...createDefaultDeck(), name: "待删除" }
    const saved = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: 0,
      deck,
    }, api.fetchImpl)
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error("expected save to succeed")

    const deletedAt = Date.now()
    const deleted = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: saved.rev,
      deck,
      deletedAt,
    }, api.fetchImpl)
    expect(deleted.ok).toBe(true)
    expect(deckSheets(api)).toHaveLength(0)
    await expect(listGoogleSheetsIndex(client, api.fetchImpl)).resolves.toMatchObject([
      { id: "remote-deck", deletedAt },
    ])
    await expect(getGoogleSheetsDeck(client, "remote-deck", api.fetchImpl)).resolves.toMatchObject({
      deletedAt,
      deck: null,
    })
  })

  it("migrates the legacy v2 hidden payload sheet without losing data", async () => {
    const api = createSheetsApi({
      legacyRows: [legacyRow("legacy-deck", "旧卡包")],
      hasWritten: true,
    })

    await expect(connectGoogleSheet(client, api.fetchImpl)).resolves.toMatchObject({
      title: "Anki 云端卡包",
    })
    const index = api.state().sheets.find((sheet) => sheet.title === "_anki_studio_sync")
    expect(index?.values[0]?.slice(0, 10)).toContain("sheet_id")
    expect(deckSheets(api)).toMatchObject([{ title: "_anki_studio_data_legacydeck" }])
    expect(previewSheets(api)).toMatchObject([{ title: "旧卡包" }])
    await expect(getGoogleSheetsDeck(client, "legacy-deck", api.fetchImpl)).resolves.toMatchObject({
      rev: 42,
      deck: { name: "旧卡包" },
    })
  })
})
