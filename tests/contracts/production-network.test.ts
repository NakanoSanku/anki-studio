import { describe, expect, it } from "vitest"
import { readSource } from "./helpers/source"

const sheets = readSource("lib", "google-sheets-sync.ts")
const auth = readSource("lib", "google-auth.ts")
const syncRoute = readSource("app", "api", "sync", "decks", "[id]", "route.ts")
const ttsRoute = readSource("app", "api", "tts", "route.ts")
const geminiRoute = readSource("app", "api", "gemini-live", "token", "route.ts")
const nextConfig = readSource("next.config.ts")
const deckTools = readSource("components", "deck-tools-panel.tsx")

 describe("production network and data boundaries", () => {
  it("bounds external Google calls", () => {
    expect(sheets).toContain("SHEETS_REQUEST_TIMEOUT_MS")
    expect(sheets).toContain("AbortSignal.timeout(SHEETS_REQUEST_TIMEOUT_MS)")
    expect(auth).toContain("AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS)")
  })

  it("streams bounded JSON bodies instead of trusting Content-Length", () => {
    expect(syncRoute).toContain("readJsonBodyWithLimit")
    expect(ttsRoute).toContain("readJsonBodyWithLimit")
    expect(geminiRoute).toContain("readJsonBodyWithLimit")
  })

  it("marks every API response no-store by default", () => {
    expect(nextConfig).toContain('source: "/api/:path*"')
    expect(nextConfig).toContain('"no-store, max-age=0"')
  })

  it("describes JSON export as an active-deck backup", () => {
    expect(deckTools).toContain("JSON · current deck backup")
    expect(deckTools).not.toContain("full project backup")
  })
})
