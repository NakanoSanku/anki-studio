import { describe, expect, it } from "vitest"

import { readSource } from "../helpers/source"

const overview = readSource("components", "study-overview.tsx")
const settings = readSource("components", "settings-form.tsx")
const tutor = readSource("components", "ai-tutor.tsx")
const tokenRoute = readSource("app", "api", "gemini-live", "token", "route.ts")

describe("AI Voice Tutor", () => {
  it("keeps the entry simple and available from the home study screen", () => {
    expect(overview).toContain("AI Tutor")
    expect(overview).toContain("Start voice tutor")
    expect(overview).toContain("<AiTutor deck={deck}")
    expect(overview).not.toContain("Role-play")
    expect(overview).not.toContain("Pronunciation Coach")
  })

  it("keeps Gemini Live settings separate but on the existing AI settings screen", () => {
    expect(settings).toContain("<AiSettingsPanel />")
    expect(settings).toContain("<GeminiLiveSetup />")
  })

  it("mints a short-lived v1alpha token and uses the constrained Live endpoint", () => {
    expect(tokenRoute).toContain("/v1alpha/auth_tokens")
    expect(tokenRoute).toContain('"x-goog-api-key": apiKey')
    expect(tokenRoute).toContain("uses: 1")
    expect(tokenRoute).toContain('"Cache-Control": "no-store"')
    expect(tokenRoute).not.toContain("liveConnectConstraints")
    expect(tutor).toContain("v1alpha.GenerativeService.BidiGenerateContentConstrained")
    expect(tutor).toContain("?access_token=${encodeURIComponent(token)}")
    expect(tutor).not.toContain("?key=${")
    expect(tutor).not.toContain("v1beta.GenerativeService.BidiGenerateContentConstrained")
  })

  it("streams microphone PCM, receives every audio part, and clears playback on interruption", () => {
    expect(tutor).toContain('mimeType: `audio/pcm;rate=${INPUT_RATE}`')
    expect(tutor).toContain("inputAudioTranscription: {}")
    expect(tutor).toContain("outputAudioTranscription: {}")
    expect(tutor).toContain("realtimeInput")
    expect(tutor).toContain("content.modelTurn?.parts ?? []")
    expect(tutor).toContain("content.interrupted")
    expect(tutor).toContain("clearPlayback()")
    expect(tutor).toContain("OUTPUT_RATE = 24_000")
  })
})
