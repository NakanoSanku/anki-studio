import { describe, expect, it } from "vitest"

import {
  isAllowedGoogleProfile,
  isAllowedGoogleSession,
  parseAllowedGoogleEmails,
  readGoogleOAuthConfiguration,
} from "./google-auth"

describe("Google OAuth configuration", () => {
  it("stays disabled when no OAuth setting is present", () => {
    expect(readGoogleOAuthConfiguration({})).toEqual({
      state: "disabled",
      issue: "Google OAuth 尚未配置",
    })
  })

  it("requires a complete single-user configuration", () => {
    expect(readGoogleOAuthConfiguration({ GOOGLE_CLIENT_ID: "client-id" })).toEqual({
      state: "invalid",
      issue: "Google OAuth 缺少 GOOGLE_CLIENT_SECRET、AUTH_SECRET、GOOGLE_ALLOWED_EMAILS",
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
})
