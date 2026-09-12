// Only application-relative destinations are accepted, including after OAuth.
export function safeAuthCallback(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/"
  const url = new URL(value, "https://anki.invalid")
  if (url.origin !== "https://anki.invalid" || /^\/(login|auth|api)(\/|$)/.test(url.pathname)) return "/"
  return `${url.pathname}${url.search}${url.hash}`
}
