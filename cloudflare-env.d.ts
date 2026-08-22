declare global {
  interface CloudflareEnv {
    GOOGLE_SHEETS_SYNC_SECRET?: string
    GOOGLE_SHEETS_SYNC_URL?: string
    REQUIRE_ACCESS?: string
  }
}

export {}
