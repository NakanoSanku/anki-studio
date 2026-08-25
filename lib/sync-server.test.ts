import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GOOGLE_SHEET_ID_HEADER } from "./google-sheet-id"
import { getSyncEnv } from "./sync-server"

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

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

function request(withSpreadsheet = true): Request {
  return new Request("https://example.com/api/sync/status", {
    headers: withSpreadsheet
      ? { [GOOGLE_SHEET_ID_HEADER]: "spreadsheet-1234567890" }
      : undefined,
  })
}

function configureOAuth() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id")
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret")
  vi.stubEnv("GOOGLE_ALLOWED_EMAILS", "kate@example.com")
  vi.stubEnv("AUTH_SECRET", "a-long-random-session-secret")
}

describe("getSyncEnv", () => {
  it("requires Google OAuth because Sheets API uses the user's token", async () => {
    const result = await getSyncEnv(request())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(503)
  })

  it("requires a Google session", async () => {
    configureOAuth()
    const result = await getSyncEnv(request(), async () => null)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toMatchObject({ authRequired: true })
    }
  })

  it("requires Google Sheets authorization on the session", async () => {
    configureOAuth()
    const result = await getSyncEnv(request(), async () => ({
      expires: "soon",
      user: { email: "kate@example.com" },
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toMatchObject({ reauthorize: true })
    }
  })

  it("requires a selected spreadsheet on every sync request", async () => {
    configureOAuth()
    const result = await getSyncEnv(request(false), async () => ({
      expires: "soon",
      user: { email: "kate@example.com" },
      googleAccessToken: "access-token",
      googleScope: SHEETS_SCOPE,
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it("creates a direct Sheets client for the allowed account and selected file", async () => {
    configureOAuth()
    const result = await getSyncEnv(request(), async () => ({
      expires: "soon",
      user: { email: "KATE@example.com" },
      googleAccessToken: "access-token",
      googleScope: `openid email ${SHEETS_SCOPE}`,
    }))

    expect(result).toMatchObject({
      ok: true,
      client: {
        spreadsheetId: "spreadsheet-1234567890",
        accessToken: "access-token",
      },
    })
  })

  it("denies an account outside the allowlist", async () => {
    configureOAuth()
    const result = await getSyncEnv(request(), async () => ({
      expires: "soon",
      user: { email: "other@example.com" },
      googleAccessToken: "access-token",
      googleScope: SHEETS_SCOPE,
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })
})
