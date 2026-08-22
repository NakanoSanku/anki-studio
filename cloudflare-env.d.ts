declare global {
  interface CloudflareEnv {
    AUTH_SECRET?: string
    GOOGLE_ALLOWED_EMAILS?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    GOOGLE_SHEETS_SYNC_SECRET?: string
    GOOGLE_SHEETS_SYNC_URL?: string
    NEXTAUTH_URL?: string
    REQUIRE_ACCESS?: string
  }
}

export {}
