import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getSyncEnv } from "./sync-server"

afterEach(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "")
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "")
  vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "")
  vi.stubEnv("AUTH_SECRET", "")
  vi.stubEnv("NEXTAUTH_SECRET", "")
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

  it("requires a Google session when OAuth is configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret")
    vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "kate@example.com")
    vi.stubEnv("AUTH_SECRET", "a-long-random-session-secret")
    vi.stubEnv("GOOGLE_SHEETS_SYNC_URL", "https://script.google.com/macros/s/deployment-id/exec")
    vi.stubEnv("GOOGLE_SHEETS_SYNC_SECRET", "a-secret-that-is-long-enough")

    const result = await getSyncEnv(
      new Request("https://example.com/api/sync/status"),
      async () => null
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toMatchObject({ authRequired: true })
    }
  })

  it("allows only the configured Google account", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret")
    vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "kate@example.com")
    vi.stubEnv("AUTH_SECRET", "a-long-random-session-secret")
    vi.stubEnv("GOOGLE_SHEETS_SYNC_URL", "https://script.google.com/macros/s/deployment-id/exec")
    vi.stubEnv("GOOGLE_SHEETS_SYNC_SECRET", "a-secret-that-is-long-enough")

    const allowed = await getSyncEnv(
      new Request("https://example.com/api/sync/status"),
      async () => ({ expires: "soon", user: { email: "KATE@example.com" } })
    )
    const denied = await getSyncEnv(
      new Request("https://example.com/api/sync/status"),
      async () => ({ expires: "soon", user: { email: "other@example.com" } })
    )

    expect(allowed.ok).toBe(true)
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.response.status).toBe(403)
  })
})
