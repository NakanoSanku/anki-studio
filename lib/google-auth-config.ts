type Environment = Record<string, string | undefined>

export type GoogleOAuthConfiguration =
  | { state: "disabled" | "invalid"; issue: string }
  | { state: "ready"; clientId: string; clientSecret: string; authSecret: string; allowedEmails: string[] }

export const GOOGLE_IDENTITY_SCOPE = "openid email profile"
export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
export const GOOGLE_PICKER_SCOPE = "https://www.googleapis.com/auth/drive.file"
export const GOOGLE_SYNC_SCOPE = `${GOOGLE_IDENTITY_SCOPE} ${GOOGLE_SHEETS_SCOPE} ${GOOGLE_PICKER_SCOPE}`
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseAllowedGoogleEmails(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))]
}

export function readGoogleOAuthConfiguration(environment: Environment = process.env): GoogleOAuthConfiguration {
  const clientId = environment.GOOGLE_CLIENT_ID?.trim() ?? ""
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim() ?? ""
  const authSecret = environment.AUTH_SECRET?.trim() || environment.NEXTAUTH_SECRET?.trim() || ""
  const allowedEmails = parseAllowedGoogleEmails(environment.GOOGLE_ALLOWED_EMAILS)
  if (!clientId && !clientSecret && !authSecret && !allowedEmails.length) {
    return { state: "disabled", issue: "Google sign-in has not been configured by the administrator." }
  }
  const missing = []
  if (!clientId) missing.push("GOOGLE_CLIENT_ID")
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET")
  if (!authSecret) missing.push("AUTH_SECRET")
  if (!allowedEmails.length) missing.push("GOOGLE_ALLOWED_EMAILS")
  if (missing.length) return { state: "invalid", issue: `Google sign-in is missing ${missing.join(", ")}.` }
  if (allowedEmails.some((email) => !EMAIL_PATTERN.test(email))) {
    return { state: "invalid", issue: "GOOGLE_ALLOWED_EMAILS contains an invalid email address." }
  }
  return { state: "ready", clientId, clientSecret, authSecret, allowedEmails }
}

export function isAllowedGoogleEmail(email: unknown, allowedEmails: readonly string[]): boolean {
  return typeof email === "string" && allowedEmails.length > 0 && allowedEmails.includes(email.trim().toLowerCase())
}

export function isAllowedGoogleIdentity(
  identity: { email?: unknown; googleProvider?: unknown; googleEmailVerified?: unknown } | null,
  allowedEmails: readonly string[]
): boolean {
  return identity?.googleProvider === "google"
    && identity.googleEmailVerified === true
    && isAllowedGoogleEmail(identity.email, allowedEmails)
}
