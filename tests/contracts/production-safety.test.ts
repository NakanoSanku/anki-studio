import { describe, expect, it } from "vitest"
import { readSource } from "./helpers/source"

const studio = readSource("components", "studio.tsx")
const ttsRoute = readSource("app", "api", "tts", "route.ts")
const geminiRoute = readSource("app", "api", "gemini-live", "token", "route.ts")
const nextConfig = readSource("next.config.ts")

describe("production safety gates", () => {
  it("rechecks in-memory state after asynchronous store reloads", () => {
    expect(studio).toContain("reloadFromStore(isLocalStateCurrent)")
    expect(studio).toContain("if (!guard()) return false")
  })

  it("rate limits public server utility routes and times out upstream calls", () => {
    expect(ttsRoute).toContain("createWindowRateLimiter")
    expect(ttsRoute).toContain("AbortSignal.timeout")
    expect(geminiRoute).toContain("createWindowRateLimiter")
    expect(geminiRoute).toContain("AbortSignal.timeout")
  })

  it("ships restrictive browser permission headers without disabling the microphone", () => {
    expect(nextConfig).toContain("Permissions-Policy")
    expect(nextConfig).toContain("microphone=(self)")
    expect(nextConfig).toContain("camera=()")
  })
})
