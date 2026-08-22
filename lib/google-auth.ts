import { getServerSession, type NextAuthOptions, type Profile, type Session } from "next-auth"
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
    return { state: "disabled", issue: "Google OAuth 尚未配置" }
  }

  const missing: string[] = []
  if (!clientId) missing.push("GOOGLE_CLIENT_ID")
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET")
  if (!authSecret) missing.push("AUTH_SECRET")
  if (allowedEmails.length === 0) missing.push("GOOGLE_ALLOWED_EMAILS")
  if (missing.length > 0) {
    return { state: "invalid", issue: `Google OAuth 缺少 ${missing.join("、")}` }
  }

  if (allowedEmails.some((email) => !EMAIL_PATTERN.test(email))) {
    return { state: "invalid", issue: "GOOGLE_ALLOWED_EMAILS 包含无效邮箱" }
  }

  return { state: "ready", clientId, clientSecret, authSecret, allowedEmails }
}

export function isAllowedGoogleProfile(
  profile: (Profile & { email_verified?: unknown }) | undefined,
  allowedEmails: readonly string[]
): boolean {
  const email = typeof profile?.email === "string" ? profile.email.toLowerCase() : ""
  return profile?.email_verified === true && allowedEmails.includes(email)
}

export function isAllowedGoogleSession(
  session: Session | null,
  allowedEmails: readonly string[]
): boolean {
  const email = session?.user?.email?.toLowerCase()
  return Boolean(email && allowedEmails.includes(email))
}

const startupConfiguration = readGoogleOAuthConfiguration()

export const authOptions: NextAuthOptions = {
  secret: startupConfiguration.state === "ready" ? startupConfiguration.authSecret : undefined,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: startupConfiguration.state === "ready"
    ? [
        GoogleProvider({
          clientId: startupConfiguration.clientId,
          clientSecret: startupConfiguration.clientSecret,
        }),
      ]
    : [],
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false
      const configuration = readGoogleOAuthConfiguration()
      return configuration.state === "ready"
        && isAllowedGoogleProfile(profile, configuration.allowedEmails)
    },
  },
}

export async function getGoogleSession(): Promise<Session | null> {
  return getServerSession(authOptions)
}
