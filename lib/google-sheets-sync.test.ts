import { describe, expect, it } from "vitest"

import { createDefaultDeck } from "./deck"
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

function createSheetsApi() {
  let sheetExists = false
  let hidden = false
  let frozenRowCount = 0
  let header: unknown[] = []
  const rows: unknown[][] = []
  let hasWritten = false
  const requests: Array<{ url: URL; init?: RequestInit }> = []

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    requests.push({ url, init })
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer short-lived-access-token")

    if (url.pathname.endsWith(":batchUpdate")) {
      const body = JSON.parse(String(init?.body)) as { requests?: Array<Record<string, unknown>> }
      const replies = (body.requests ?? []).map((request) => {
        if (request.addSheet) {
          sheetExists = true
          hidden = true
          frozenRowCount = 1
          return {
            addSheet: {
              properties: {
                sheetId: 7,
                title: "_anki_studio_sync",
                hidden,
                gridProperties: { frozenRowCount },
              },
            },
          }
        }
        if (request.updateSheetProperties) {
          hidden = true
          frozenRowCount = 1
        }
        if (request.createDeveloperMetadata) hasWritten = true
        const deletion = request.deleteDimension as {
          range?: { startIndex?: number; endIndex?: number }
        } | undefined
        if (deletion?.range) {
          const start = Math.max(0, Number(deletion.range.startIndex) - 1)
          const count = Number(deletion.range.endIndex) - Number(deletion.range.startIndex)
          rows.splice(start, count)
        }
        return {}
      })
      return Response.json({ replies })
    }

    const decodedPath = decodeURIComponent(url.pathname)
    if (decodedPath.includes("/values/")) {
      if (url.pathname.endsWith(":append")) {
        const body = JSON.parse(String(init?.body)) as { values?: unknown[][] }
        rows.push(...(body.values ?? []))
        return Response.json({ updates: { updatedRows: body.values?.length ?? 0 } })
      }
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as { values?: unknown[][] }
        header = body.values?.[0] ?? []
        return Response.json({ updatedRows: 1 })
      }
      if (decodedPath.includes("A1:K2")) {
        return Response.json({ values: rows.length > 0 ? [header, rows[0]] : [header] })
      }
      if (decodedPath.includes("A2:K")) return Response.json({ values: rows })
    }

    return Response.json({
      spreadsheetId: client.spreadsheetId,
      properties: { title: "Anki 云端卡包" },
      sheets: sheetExists ? [{
        properties: {
          sheetId: 7,
          title: "_anki_studio_sync",
          hidden,
          gridProperties: { frozenRowCount },
        },
      }] : [],
      developerMetadata: hasWritten
        ? [{ metadataKey: "anki_studio_has_data", metadataValue: "1" }]
        : [],
    })
  }

  return {
    fetchImpl: fetchImpl as typeof fetch,
    state: () => ({ sheetExists, hidden, frozenRowCount, header, rows, hasWritten, requests }),
  }
}

describe("Google Sheets API sync", () => {
  it("initializes a hidden sync sheet in a Picker-selected spreadsheet", async () => {
    const api = createSheetsApi()
    const result = await connectGoogleSheet(client, api.fetchImpl)

    expect(result).toMatchObject({
      id: "spreadsheet-1234567890",
      title: "Anki 云端卡包",
    })
    expect(api.state()).toMatchObject({
      sheetExists: true,
      hidden: true,
      frozenRowCount: 1,
    })
    expect(api.state().header).toHaveLength(11)
  })

  it("writes, reads, indexes, and conflict-checks a deck directly through Sheets API", async () => {
    const api = createSheetsApi()
    const deck = { ...createDefaultDeck(), name: "泰语" }

    const saved = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: 0,
      deck,
    }, api.fetchImpl)
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error("expected save to succeed")

    const payload = await getGoogleSheetsDeck(client, "remote-deck", api.fetchImpl)
    expect(payload).toMatchObject({ rev: saved.rev, deck: { name: "泰语" } })
    await expect(listGoogleSheetsIndex(client, api.fetchImpl)).resolves.toMatchObject([
      { id: "remote-deck", rev: saved.rev, name: "泰语", cardCount: 1 },
    ])

    const conflict = await putGoogleSheetsDeck(client, "remote-deck", {
      expectedRev: 0,
      deck,
    }, api.fetchImpl)
    expect(conflict).toMatchObject({ ok: false, conflict: true, server: { rev: saved.rev } })
    expect(api.state().hasWritten).toBe(true)
  })
})
