import { describe, expect, it } from "vitest"

import {
  DEFAULT_GEMINI_LIVE_SETTINGS,
  GEMINI_LIVE_MODEL,
  isGoogleGeminiProvider,
  parseGeminiLiveSettings,
  resolveGeminiLiveSettings,
  validateGeminiLiveSettings,
} from "@/lib/gemini-live-settings"

describe("Gemini Live settings", () => {
  it("uses the recommended Live model and an empty key by default", () => {
    expect(GEMINI_LIVE_MODEL).toBe("gemini-3.1-flash-live-preview")
    expect(DEFAULT_GEMINI_LIVE_SETTINGS).toEqual({ apiKey: "" })
  })

  it("recognizes both native and OpenAI-compatible Google Gemini endpoints", () => {
    expect(isGoogleGeminiProvider("https://generativelanguage.googleapis.com/v1beta")).toBe(true)
    expect(isGoogleGeminiProvider("https://generativelanguage.googleapis.com/v1beta/openai")).toBe(true)
    expect(isGoogleGeminiProvider("https://api.openai.com/v1")).toBe(false)
  })

  it("reuses the AI provider key when the provider is Google Gemini", () => {
    expect(
      resolveGeminiLiveSettings(
        { apiKey: "live-key-long-enough" },
        {
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
          apiKey: "shared-gemini-key-long-enough",
          model: "gemini-3.1-flash-lite",
        }
      )
    ).toEqual({ apiKey: "shared-gemini-key-long-enough" })
  })

  it("keeps a separate Live key for non-Gemini OpenAI-compatible providers", () => {
    expect(
      resolveGeminiLiveSettings(
        { apiKey: "live-key-long-enough" },
        {
          baseURL: "https://api.openai.com/v1",
          apiKey: "openai-key-long-enough",
          model: "gpt-4o-mini",
        }
      )
    ).toEqual({ apiKey: "live-key-long-enough" })
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
