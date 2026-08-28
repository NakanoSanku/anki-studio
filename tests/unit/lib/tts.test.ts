import { afterEach, describe, expect, it, vi } from "vitest"

import { sha1Hex, ttsClipId } from "@/lib/tts"

const encoder = new TextEncoder()

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TTS clip hashing", () => {
  it("matches standard SHA-1 vectors in the JavaScript fallback", () => {
    expect(sha1Hex(encoder.encode(""))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709")
    expect(sha1Hex(encoder.encode("abc"))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d")
    expect(sha1Hex(encoder.encode("th|1|สวัสดี"))).toBe("a943f097bd72be3916fd7e6a0f5fcdf162a72bc7")
  })

  it("keeps the existing deterministic TTS filename hash", async () => {
    await expect(ttsClipId("en", false, "hello")).resolves.toBe("59430a156c93370600988700883822eec3f5aff5")
  })

  it("works when Web Crypto exists without SubtleCrypto", async () => {
    vi.stubGlobal("crypto", {})
    await expect(ttsClipId("en", false, "hello")).resolves.toBe("59430a156c93370600988700883822eec3f5aff5")
  })

  it("falls back when SubtleCrypto rejects digest", async () => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async () => {
          throw new Error("digest unavailable")
        },
      },
    })
    await expect(ttsClipId("en", false, "hello")).resolves.toBe("59430a156c93370600988700883822eec3f5aff5")
  })
})
