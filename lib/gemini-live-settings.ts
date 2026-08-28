export type GeminiLiveSettings = {
  apiKey: string
}

export const GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview"
export const GEMINI_LIVE_SETTINGS_KEY = "anki-studio.gemini-live.v1"

export const DEFAULT_GEMINI_LIVE_SETTINGS: GeminiLiveSettings = {
  apiKey: "",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseGeminiLiveSettings(raw: unknown): GeminiLiveSettings {
  if (!isRecord(raw)) return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
  }
}

export function readGeminiLiveSettings(): GeminiLiveSettings {
  if (typeof window === "undefined") return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  try {
    const raw = localStorage.getItem(GEMINI_LIVE_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
    return parseGeminiLiveSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  }
}

export function writeGeminiLiveSettings(settings: GeminiLiveSettings) {
  localStorage.setItem(GEMINI_LIVE_SETTINGS_KEY, JSON.stringify({ apiKey: settings.apiKey.trim() }))
}

export function validateGeminiLiveSettings(settings: GeminiLiveSettings): string | null {
  const key = settings.apiKey.trim()
  if (!key) return "Enter a Gemini API key"
  if (key.length < 16) return "The Gemini API key looks incomplete"
  return null
}
