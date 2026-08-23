declare global {
  interface CloudflareEnv {
    AUTH_SECRET?: string
    GOOGLE_ALLOWED_EMAILS?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    GOOGLE_CLOUD_PROJECT_NUMBER?: string
    GOOGLE_PICKER_API_KEY?: string
    NEXTAUTH_URL?: string
  }
}

export {}
