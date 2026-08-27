import { describe, expect, it } from "vitest"

import { googleSpreadsheetUrl, parseGoogleSpreadsheetId } from "@/lib/google-sheet-id"

describe("Google Sheet references", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890"

  it("accepts both an edit link and a raw spreadsheet ID", () => {
    expect(parseGoogleSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id)
    expect(parseGoogleSpreadsheetId(`https://docs.google.com/spreadsheets/u/0/d/${id}/edit`)).toBe(id)
    expect(parseGoogleSpreadsheetId(`https://drive.google.com/open?id=${id}`)).toBe(id)
    expect(parseGoogleSpreadsheetId(`https://drive.google.com/file/d/${id}/view`)).toBe(id)
    expect(parseGoogleSpreadsheetId(
      `https://accounts.google.com/v3/signin/identifier?continue=${encodeURIComponent(
        `https://docs.google.com/spreadsheets/d/${id}/edit`
      )}`
    )).toBe(id)
    expect(parseGoogleSpreadsheetId(id)).toBe(id)
    expect(googleSpreadsheetUrl(id)).toBe(`https://docs.google.com/spreadsheets/d/${id}/edit`)
  })

  it("rejects lookalike hosts and published-sheet URLs", () => {
    expect(parseGoogleSpreadsheetId(`https://docs.google.com.example.com/spreadsheets/d/${id}/edit`)).toBeNull()
    expect(parseGoogleSpreadsheetId("https://docs.google.com/spreadsheets/d/e/2PACX-published/pubhtml")).toBeNull()
    expect(parseGoogleSpreadsheetId("https://drive.google.com/file/d/%E0%A4%A/view")).toBeNull()
  })
})
