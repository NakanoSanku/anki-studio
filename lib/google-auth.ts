import { getServerSession, type NextAuthOptions, type Profile, type Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import GoogleProvider from "next-auth/providers/google"

type Environment = Record<string, string | undefined>

export type GoogleOAuthConfiguration =
  | { state: "disabled"; issue: string }
  | { state: "invalid"; issue: string }
  | {
      state: "ready"
      clientId: string
      clientSecret: string
      authSecret: string
      allowedEmails: string[]
    }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
export const GOOGLE_PICKER_SCOPE = "https://www.googleapis.com/auth/drive.file"
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000
const GOOGLE_TOKEN_TIMEOUT_MS = 15_000

type GoogleToken = JWT & {
  googleAccessToken?: string
  googleRefreshToken?: string
  googleAccessTokenExpires?: number
  googleScope?: string
  googleAccessError?: "RefreshAccessTokenError"
}

export type GoogleSession = Session & {
  googleAccessToken?: string
  googleScope?: string
  googleAccessError?: "RefreshAccessTokenError"
}

type GoogleTokenResponse = {
  access_token?: unknown
  expires_in?: unknown
  refresh_token?: unknown
  scope?: unknown
}

export function parseAllowedGoogleEmails(raw: string | undefined): string[] {
  return [...new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )]
}

export function readGoogleOAuthConfiguration(
  environment: Environment = process.env
): GoogleOAuthConfiguration {
  const clientId = environment.GOOGLE_CLIENT_ID?.trim() ?? ""
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim() ?? ""
  const authSecret = environment.AUTH_SECRET?.trim()
    || environment.NEXTAUTH_SECRET?.trim()
    || ""
  const allowedEmails = parseAllowedGoogleEmails(environment.GOOGLE_ALLOWED_EMAILS)
  const hasAnySetting = Boolean(
    clientId || clientSecret || authSecret || environment.GOOGLE_ALLOWED_EMAILS?.trim()
  )

  if (!hasAnySetting) {
    return { state: "disabled", issue: "Google OAuth is not configured" }
  }

  const missing: string[] = []
  if (!clientId) missing.push("GOOGLE_CLIENT_ID")
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET")
  if (!authSecret) missing.push("AUTH_SECRET")
  if (missing.length > 0) {
    return { state: "invalid", issue: `Google OAuth is missing ${missing.join(", ")}` }
  }

  if (allowedEmails.length > 0 && allowedEmails.some((email) => !EMAIL_PATTERN.test(email))) {
    return { state: "invalid", issue: "GOOGLE_ALLOWED_EMAILS contains an invalid email address" }
  }

  return { state: "ready", clientId, clientSecret, authSecret, allowedEmails }
}

export function isAllowedGoogleProfile(
  profile: (Profile & { email_verified?: unknown }) | undefined,
  allowedEmails: readonly string[]
): boolean {
  const email = typeof profile?.email === "string" ? profile.email.toLowerCase() : ""
  if (!email) return false
  if (allowedEmails.length === 0) return true
  return (profile?.email_verified === true || profile?.email_verified === undefined) && allowedEmails.includes(email)
}

export function isAllowedGoogleSession(
  session: Session | null,
  allowedEmails: readonly string[]
): boolean {
  const email = session?.user?.email?.toLowerCase()
  if (!email) return false
  if (allowedEmails.length === 0) return true
  return allowedEmails.includes(email)
}

export function hasGoogleSheetsScope(scope: string | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(GOOGLE_SHEETS_SCOPE)
}

export function hasGoogleDriveScope(scope: string | undefined): boolean {
  return (scope ?? "").split(/\s+/).includes(GOOGLE_PICKER_SCOPE)
}

export async function refreshGoogleAccessToken(
  token: GoogleToken,
  configuration: GoogleOAuthConfiguration = readGoogleOAuthConfiguration(),
  fetchImpl: typeof fetch = fetch
): Promise<GoogleToken> {
  if (configuration.state !== "ready" || !token.googleRefreshToken) {
    return { ...token, googleAccessError: "RefreshAccessTokenError" }
  }

  try {
    const response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.googleRefreshToken,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_TOKEN_TIMEOUT_MS),
    })
    const data = await response.json() as GoogleTokenResponse
    if (!response.ok || typeof data.access_token !== "string") {
      throw new Error("Google access token refresh failed")
    }

    const expiresIn = Number(data.expires_in)
    return {
      ...token,
      googleAccessToken: data.access_token,
      googleAccessTokenExpires: Date.now()
        + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
      googleRefreshToken: typeof data.refresh_token === "string"
        ? data.refresh_token
        : token.googleRefreshToken,
      googleScope: typeof data.scope === "string" ? data.scope : token.googleScope,
      googleAccessError: undefined,
    }
  } catch {
    return { ...token, googleAccessError: "RefreshAccessTokenError" }
  }
}

export function createGoogleAuthOptions(
  environment: Environment = process.env
): NextAuthOptions {
  const configuration = readGoogleOAuthConfiguration(environment)

  return {
    secret: configuration.state === "ready" ? configuration.authSecret : undefined,
    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60,
    },
    providers: configuration.state === "ready"
      ? [
          GoogleProvider({
            clientId: configuration.clientId,
            clientSecret: configuration.clientSecret,
            authorization: {
              params: {
                access_type: "offline",
                include_granted_scopes: "true",
                prompt: "consent",
                scope: `openid email profile ${GOOGLE_SHEETS_SCOPE} ${GOOGLE_PICKER_SCOPE}`,
              },
            },
          }),
        ]
      : [],
    pages: {
      error: "/auth/error",
    },
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== "google") return false
        const currentConfiguration = readGoogleOAuthConfiguration(environment)
        return currentConfiguration.state === "ready"
          && isAllowedGoogleProfile(profile, currentConfiguration.allowedEmails)
      },
      async jwt({ token, account }) {
        const googleToken = token as GoogleToken
        if (account?.provider === "google") {
          return {
            ...googleToken,
            googleAccessToken: account.access_token,
            googleRefreshToken: account.refresh_token ?? googleToken.googleRefreshToken,
            googleAccessTokenExpires: typeof account.expires_at === "number"
              ? account.expires_at * 1000
              : Date.now() + 3600 * 1000,
            googleScope: account.scope,
            googleAccessError: undefined,
          }
        }

        if (
          googleToken.googleAccessToken
          && googleToken.googleAccessTokenExpires
          && Date.now() < googleToken.googleAccessTokenExpires - ACCESS_TOKEN_REFRESH_MARGIN_MS
        ) {
          return googleToken
        }

        if (googleToken.googleRefreshToken) {
          return refreshGoogleAccessToken(googleToken)
        }
        return googleToken.googleAccessToken
          ? { ...googleToken, googleAccessError: "RefreshAccessTokenError" }
          : googleToken
      },
      async session({ session, token }) {
        const googleSession = session as GoogleSession
        const googleToken = token as GoogleToken
        googleSession.googleAccessToken = googleToken.googleAccessToken
        googleSession.googleScope = googleToken.googleScope
        googleSession.googleAccessError = googleToken.googleAccessError
        return googleSession
      },
    },
  }
}

export async function getGoogleSession(): Promise<GoogleSession | null> {
  return getServerSession(createGoogleAuthOptions()) as Promise<GoogleSession | null>
}
