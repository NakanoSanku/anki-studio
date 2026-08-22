import { afterEach, describe, expect, it, vi } from "vitest"

import { getSyncEnv } from "./sync-server"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("getSyncEnv", () => {
  it("reports an unconfigured runtime without loading Cloudflare-only packages", async () => {
    vi.stubEnv("GOOGLE_SHEETS_SYNC_URL", "")
    vi.stubEnv("GOOGLE_SHEETS_SYNC_SECRET", "")
    vi.stubEnv("REQUIRE_ACCESS", "0")

    const result = await getSyncEnv(new Request("https://example.com/api/sync/status"))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(503)
  })

  it("creates the same gateway from standard server environment variables", async () => {
    vi.stubEnv(
      "GOOGLE_SHEETS_SYNC_URL",
      "https://script.google.com/macros/s/deployment-id/exec"
    )
    vi.stubEnv("GOOGLE_SHEETS_SYNC_SECRET", "a-secret-that-is-long-enough")
    vi.stubEnv("REQUIRE_ACCESS", "0")

    const result = await getSyncEnv(new Request("https://example.com/api/sync/status"))

    expect(result).toMatchObject({
      ok: true,
      gateway: { secret: "a-secret-that-is-long-enough" },
    })
  })

  it("keeps Cloudflare Access enforcement when explicitly enabled", async () => {
    vi.stubEnv(
      "GOOGLE_SHEETS_SYNC_URL",
      "https://script.google.com/macros/s/deployment-id/exec"
    )
    vi.stubEnv("GOOGLE_SHEETS_SYNC_SECRET", "a-secret-that-is-long-enough")
    vi.stubEnv("REQUIRE_ACCESS", "1")

    const result = await getSyncEnv(new Request("https://example.com/api/sync/status"))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })
})
