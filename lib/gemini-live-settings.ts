import { parseAiSettings, readAiSettings, writeAiSettings, type AiSettings } from "./ai-settings"
import { GEMINI_API_HOST } from "./ai-upstream"

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

export function isGoogleGeminiProvider(baseURL: string): boolean {
  try {
    return new URL(baseURL.trim()).hostname.toLowerCase() === GEMINI_API_HOST
  } catch {
    return false
  }
}

export function parseGeminiLiveSettings(raw: unknown): GeminiLiveSettings {
  if (!isRecord(raw)) return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
  }
}

export function resolveGeminiLiveSettings(liveRaw: unknown, aiRaw: unknown): GeminiLiveSettings {
  const live = parseGeminiLiveSettings(liveRaw)
  const ai = parseAiSettings(aiRaw)
  if (isGoogleGeminiProvider(ai.baseURL) && ai.apiKey.trim()) {
    return { apiKey: ai.apiKey.trim() }
  }
  return live
}

function readStoredGeminiLiveSettings(): GeminiLiveSettings {
  try {
    const raw = localStorage.getItem(GEMINI_LIVE_SETTINGS_KEY)
    return raw ? parseGeminiLiveSettings(JSON.parse(raw)) : { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  } catch {
    return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  }
}

export function readGeminiLiveSettings(): GeminiLiveSettings {
  if (typeof window === "undefined") return { ...DEFAULT_GEMINI_LIVE_SETTINGS }
  return resolveGeminiLiveSettings(readStoredGeminiLiveSettings(), readAiSettings())
}

export function writeGeminiLiveSettings(settings: GeminiLiveSettings) {
  const apiKey = settings.apiKey.trim()
  localStorage.setItem(GEMINI_LIVE_SETTINGS_KEY, JSON.stringify({ apiKey }))

  const ai: AiSettings = readAiSettings()
  if (isGoogleGeminiProvider(ai.baseURL) && ai.apiKey.trim() !== apiKey) {
    writeAiSettings({ ...ai, apiKey })
  }
}

export function validateGeminiLiveSettings(settings: GeminiLiveSettings): string | null {
  const key = settings.apiKey.trim()
  if (!key) return "Enter a Gemini API key"
  if (key.length < 16) return "The Gemini API key looks incomplete"
  return null
}
