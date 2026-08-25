const GOOGLE_SPREADSHEET_ID = /^[A-Za-z0-9_-]{10,200}$/

export const GOOGLE_SHEET_ID_HEADER = "x-anki-studio-google-sheet-id"

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return ""
  }
}

export function isGoogleSpreadsheetId(value: string): boolean {
  return GOOGLE_SPREADSHEET_ID.test(value)
}

export function parseGoogleSpreadsheetId(value: string): string | null {
  const input = value.trim().replaceAll("&amp;", "&")
  if (isGoogleSpreadsheetId(input)) return input

  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  if (url.protocol !== "https:") return null

  const hostname = url.hostname.toLocaleLowerCase()
  const isDocsHost = hostname === "docs.google.com" || hostname === "www.docs.google.com"
  const isDriveHost = hostname === "drive.google.com" || hostname === "www.drive.google.com"

  if (isDocsHost) {
    const match = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([^/]+)/)
    const id = match?.[1] ? decodeUrlPart(match[1]) : ""
    if (isGoogleSpreadsheetId(id)) return id
  }

  if (isDriveHost) {
    const pathMatch = url.pathname.match(/^\/file\/d\/([^/]+)/)
    const id = pathMatch?.[1] ?? url.searchParams.get("id") ?? ""
    const decoded = decodeUrlPart(id)
    if (isGoogleSpreadsheetId(decoded)) return decoded
  }

  // Google sign-in and sharing links sometimes wrap the real Sheets URL in a
  // `continue`, `url`, or `redirect_uri` query parameter. Follow one level so
  // pasted links copied from those pages still resolve without accepting
  // arbitrary hosts.
  for (const key of ["continue", "url", "redirect_uri"]) {
    const nested = url.searchParams.get(key)
    if (!nested) continue
    const nestedId = parseGoogleSpreadsheetId(nested)
    if (nestedId) return nestedId
  }

  return null
}

export function googleSpreadsheetUrl(id: string): string {
  if (!isGoogleSpreadsheetId(id)) throw new Error("Google Sheet ID 无效")
  return `https://docs.google.com/spreadsheets/d/${id}/edit`
}
