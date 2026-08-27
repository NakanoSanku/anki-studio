import { describe, expect, it, vi } from "vitest"

import {
  createGoogleAuthOptions,
  hasGoogleSheetsScope,
  isAllowedGoogleProfile,
  isAllowedGoogleSession,
  parseAllowedGoogleEmails,
  readGoogleOAuthConfiguration,
  refreshGoogleAccessToken,
} from "@/lib/google-auth"

describe("Google OAuth configuration", () => {
  it("builds the Google provider from runtime secrets", () => {
    const options = createGoogleAuthOptions({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_ALLOWED_EMAILS: "kate@example.com",
      AUTH_SECRET: "session-secret",
    })

    expect(options.secret).toBe("session-secret")
    expect(options.providers).toHaveLength(1)
    expect(options.providers[0]).toMatchObject({ id: "google", name: "Google" })
  })

  it("stays disabled when no OAuth setting is present", () => {
    expect(readGoogleOAuthConfiguration({})).toEqual({
      state: "disabled",
      issue: "Google OAuth 尚未配置",
    })
  })

  it("requires a complete single-user configuration", () => {
    expect(readGoogleOAuthConfiguration({ GOOGLE_CLIENT_ID: "client-id" })).toEqual({
      state: "invalid",
      issue: "Google OAuth 缺少 GOOGLE_CLIENT_SECRET、AUTH_SECRET",
    })
  })

  it("normalizes and deduplicates the email allowlist", () => {
    expect(parseAllowedGoogleEmails("Kate@example.com, kate@example.com; other@example.com")).toEqual([
      "kate@example.com",
      "other@example.com",
    ])
  })

  it("accepts NEXTAUTH_SECRET as the session-secret alias", () => {
    expect(readGoogleOAuthConfiguration({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_ALLOWED_EMAILS: "kate@example.com",
      NEXTAUTH_SECRET: "session-secret",
    })).toMatchObject({ state: "ready", authSecret: "session-secret" })
  })

  it("accepts only verified profiles and sessions in the allowlist", () => {
    const allowed = ["kate@example.com"]
    expect(isAllowedGoogleProfile({ email: "KATE@example.com", email_verified: true }, allowed)).toBe(true)
    expect(isAllowedGoogleProfile({ email: "kate@example.com", email_verified: false }, allowed)).toBe(false)
    expect(isAllowedGoogleProfile({ email: "other@example.com", email_verified: true }, allowed)).toBe(false)
    expect(isAllowedGoogleSession({ expires: "soon", user: { email: "KATE@example.com" } }, allowed)).toBe(true)
    expect(isAllowedGoogleSession({ expires: "soon", user: { email: "other@example.com" } }, allowed)).toBe(false)
  })

  it("requires the full Google Sheets scope for pasted links", () => {
    expect(hasGoogleSheetsScope("openid https://www.googleapis.com/auth/spreadsheets email")).toBe(true)
    expect(hasGoogleSheetsScope("openid https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file")).toBe(true)
    expect(hasGoogleSheetsScope("openid https://www.googleapis.com/auth/drive.file email")).toBe(false)
    expect(hasGoogleSheetsScope("openid email profile")).toBe(false)
  })

  it("refreshes an expired Google access token without exposing the refresh token", async () => {
    const configuration = readGoogleOAuthConfiguration({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_ALLOWED_EMAILS: "kate@example.com",
      AUTH_SECRET: "session-secret",
    })
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(String(init?.body)).toContain("refresh_token=refresh-token")
      return Response.json({
        access_token: "new-access-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
      })
    }) as unknown as typeof fetch

    const result = await refreshGoogleAccessToken({
      googleAccessToken: "expired-token",
      googleRefreshToken: "refresh-token",
      googleAccessTokenExpires: 1,
    }, configuration, fetchImpl)

    expect(result).toMatchObject({
      googleAccessToken: "new-access-token",
      googleRefreshToken: "refresh-token",
      googleAccessError: undefined,
    })
  })
})
