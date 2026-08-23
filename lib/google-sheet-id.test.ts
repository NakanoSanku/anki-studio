import { describe, expect, it } from "vitest"

import { googleSpreadsheetUrl, parseGoogleSpreadsheetId } from "./google-sheet-id"

describe("Google Sheet references", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890"

  it("accepts both an edit link and a raw spreadsheet ID", () => {
    expect(parseGoogleSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id)
    expect(parseGoogleSpreadsheetId(id)).toBe(id)
    expect(googleSpreadsheetUrl(id)).toBe(`https://docs.google.com/spreadsheets/d/${id}/edit`)
  })

  it("rejects lookalike hosts and published-sheet URLs", () => {
    expect(parseGoogleSpreadsheetId(`https://docs.google.com.example.com/spreadsheets/d/${id}/edit`)).toBeNull()
    expect(parseGoogleSpreadsheetId("https://docs.google.com/spreadsheets/d/e/2PACX-published/pubhtml")).toBeNull()
  })
})
