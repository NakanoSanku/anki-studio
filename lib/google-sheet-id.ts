const GOOGLE_SPREADSHEET_ID = /^[A-Za-z0-9_-]{10,200}$/

export const GOOGLE_SHEET_ID_HEADER = "x-anki-studio-google-sheet-id"

export function isGoogleSpreadsheetId(value: string): boolean {
  return GOOGLE_SPREADSHEET_ID.test(value)
}

export function parseGoogleSpreadsheetId(value: string): string | null {
  const input = value.trim()
  if (isGoogleSpreadsheetId(input)) return input

  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return null
  const match = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)/)
  const id = match?.[1] ?? ""
  return isGoogleSpreadsheetId(id) ? id : null
}

export function googleSpreadsheetUrl(id: string): string {
  if (!isGoogleSpreadsheetId(id)) throw new Error("Google Sheet ID 无效")
  return `https://docs.google.com/spreadsheets/d/${id}/edit`
}
