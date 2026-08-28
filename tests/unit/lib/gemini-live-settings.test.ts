import { describe, expect, it } from "vitest"

import {
  DEFAULT_GEMINI_LIVE_SETTINGS,
  GEMINI_LIVE_MODEL,
  parseGeminiLiveSettings,
  validateGeminiLiveSettings,
} from "@/lib/gemini-live-settings"

describe("Gemini Live settings", () => {
  it("uses the recommended Live model and an empty key by default", () => {
    expect(GEMINI_LIVE_MODEL).toBe("gemini-3.1-flash-live-preview")
    expect(DEFAULT_GEMINI_LIVE_SETTINGS).toEqual({ apiKey: "" })
  })

  it("parses only the API key from stored settings", () => {
    expect(parseGeminiLiveSettings({ apiKey: "AIza-test-key", ignored: "value" })).toEqual({
      apiKey: "AIza-test-key",
    })
    expect(parseGeminiLiveSettings(null)).toEqual(DEFAULT_GEMINI_LIVE_SETTINGS)
  })

  it("requires a plausible API key", () => {
    expect(validateGeminiLiveSettings({ apiKey: "" })).toBe("Enter a Gemini API key")
    expect(validateGeminiLiveSettings({ apiKey: "short" })).toBe("The Gemini API key looks incomplete")
    expect(validateGeminiLiveSettings({ apiKey: "AIzaSyExampleLongEnoughKey" })).toBeNull()
  })
})
