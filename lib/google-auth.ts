import { getServerSession, type NextAuthOptions, type Profile, type Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import GoogleProvider from "next-auth/providers/google"

import { safeAuthCallback } from "./auth-redirect"
import {
  GOOGLE_IDENTITY_SCOPE,
  GOOGLE_SHEETS_SCOPE,
  GOOGLE_PICKER_SCOPE,
  isAllowedGoogleEmail,
  isAllowedGoogleIdentity,
  readGoogleOAuthConfiguration,
  type GoogleOAuthConfiguration,
} from "./google-auth-config"
export { GOOGLE_SHEETS_SCOPE, GOOGLE_PICKER_SCOPE, parseAllowedGoogleEmails, readGoogleOAuthConfiguration } from "./google-auth-config"
export type { GoogleOAuthConfiguration } from "./google-auth-config"

type Environment = Record<string, string | undefined>

const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000
const GOOGLE_TOKEN_TIMEOUT_MS = 15_000

type GoogleToken = JWT & {
  googleProvider?: "google"
  googleEmailVerified?: boolean
  googleAccessToken?: string
  googleRefreshToken?: string
  googleAccessTokenExpires?: number
  googleScope?: string
  googleAccessError?: "RefreshAccessTokenError"
}

export type GoogleSession = Session & {
  googleProvider?: "google"
  googleEmailVerified?: boolean
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

export function isAllowedGoogleProfile(
  profile: (Profile & { email_verified?: unknown }) | undefined,
  allowedEmails: readonly string[]
): boolean {
  return profile?.email_verified === true && isAllowedGoogleEmail(profile.email, allowedEmails)
}

export function isAllowedGoogleSession(
  session: GoogleSession | null,
  allowedEmails: readonly string[]
): boolean {
  return isAllowedGoogleIdentity({
    email: session?.user?.email,
    googleProvider: session?.googleProvider,
    googleEmailVerified: session?.googleEmailVerified,
  }, allowedEmails)
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
                prompt: "select_account",
                scope: GOOGLE_IDENTITY_SCOPE,
              },
            },
          }),
        ]
      : [],
    pages: {
      signIn: "/login",
      error: "/auth/error",
    },
    callbacks: {
      async redirect({ url, baseUrl }) {
        if (url.startsWith("/")) return `${baseUrl}${safeAuthCallback(url)}`
        try {
          return new URL(url).origin === baseUrl ? url : baseUrl
        } catch {
          return baseUrl
        }
      },
      async signIn({ account, profile }) {
        if (account?.provider !== "google") return false
        const currentConfiguration = readGoogleOAuthConfiguration(environment)
        return currentConfiguration.state === "ready"
          && isAllowedGoogleProfile(profile, currentConfiguration.allowedEmails)
      },
      async jwt({ token, account, profile }) {
        const googleToken = token as GoogleToken
        if (account?.provider === "google") {
          return {
            ...googleToken,
            googleProvider: "google",
            googleEmailVerified: (profile as (Profile & { email_verified?: unknown }) | undefined)?.email_verified === true,
            googleAccessToken: account.access_token,
            googleRefreshToken: account.refresh_token ?? (googleToken.sub === profile?.sub ? googleToken.googleRefreshToken : undefined),
            googleAccessTokenExpires: typeof account.expires_at === "number"
              ? account.expires_at * 1000
              : Date.now() + 3600 * 1000,
            googleScope: account.scope,
            googleAccessError: undefined,
          }
        }

        const currentConfiguration = readGoogleOAuthConfiguration(environment)
        if (currentConfiguration.state !== "ready" || !isAllowedGoogleIdentity(googleToken, currentConfiguration.allowedEmails)) {
          return { ...googleToken, googleAccessToken: undefined, googleRefreshToken: undefined, googleScope: undefined }
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
        googleSession.googleProvider = googleToken.googleProvider
        googleSession.googleEmailVerified = googleToken.googleEmailVerified
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
