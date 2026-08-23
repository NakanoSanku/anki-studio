import {
  googleSpreadsheetUrl,
  isGoogleSpreadsheetId,
} from "./google-sheet-id"

export const GOOGLE_SHEET_CONNECTION_KEY = "anki-studio:google-sheet:v1"
export const GOOGLE_SHEET_CONNECTION_EVENT = "anki-studio:google-sheet-change"

export type GoogleSheetConnection = {
  id: string
  name: string
  url: string
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage
}

export function readGoogleSheetConnection(
  storage: Pick<Storage, "getItem"> | null = browserStorage()
): GoogleSheetConnection | null {
  if (!storage) return null
  try {
    const value = JSON.parse(storage.getItem(GOOGLE_SHEET_CONNECTION_KEY) ?? "null") as unknown
    if (!value || typeof value !== "object") return null
    const record = value as Record<string, unknown>
    if (typeof record.id !== "string" || !isGoogleSpreadsheetId(record.id)) return null
    return {
      id: record.id,
      name: typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : "Google Sheet",
      url: googleSpreadsheetUrl(record.id),
    }
  } catch {
    return null
  }
}

export function readGoogleSheetConnectionSnapshot(): string | null {
  return browserStorage()?.getItem(GOOGLE_SHEET_CONNECTION_KEY) ?? null
}

export function subscribeGoogleSheetConnection(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined
  const onStorage = (event: StorageEvent) => {
    if (event.key === GOOGLE_SHEET_CONNECTION_KEY) onChange()
  }
  window.addEventListener(GOOGLE_SHEET_CONNECTION_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(GOOGLE_SHEET_CONNECTION_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function writeGoogleSheetConnection(connection: GoogleSheetConnection): void {
  if (!isGoogleSpreadsheetId(connection.id)) throw new Error("Google Sheet ID 无效")
  const storage = browserStorage()
  if (!storage) return
  storage.setItem(GOOGLE_SHEET_CONNECTION_KEY, JSON.stringify({
    id: connection.id,
    name: connection.name.trim() || "Google Sheet",
    url: googleSpreadsheetUrl(connection.id),
  }))
  window.dispatchEvent(new Event(GOOGLE_SHEET_CONNECTION_EVENT))
}

export function clearGoogleSheetConnection(): void {
  const storage = browserStorage()
  if (!storage) return
  storage.removeItem(GOOGLE_SHEET_CONNECTION_KEY)
  window.dispatchEvent(new Event(GOOGLE_SHEET_CONNECTION_EVENT))
}
