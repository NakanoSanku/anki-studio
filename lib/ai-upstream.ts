export const AI_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

export function providerFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set("User-Agent", AI_FETCH_UA)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  return fetch(input, { ...init, headers, cache: "no-store" })
}

export function describeUpstreamError(input: {
  status: number
  body: string
  cfRay?: string | null
}): string {
  const raw = input.body.trim()
  if (raw) {
    try {
      const payload = JSON.parse(raw) as unknown
      const message = readJsonError(payload)
      if (message) return `HTTP ${input.status}：${message}`
    } catch {
      // HTML / plain text from a gateway
    }
  }

  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const blocked =
    Boolean(input.cfRay) ||
    /cloudflare|attention required|just a moment|sorry, you have been blocked|error 10\d\d/i.test(
      raw
    )
  if (blocked) {
    const ray = input.cfRay ? `，Ray ${input.cfRay}` : ""
    return `HTTP ${input.status}：中转站前的 Cloudflare 拦截了请求${ray}。Vercel 出口 IP 经常被拦，官方 API 不会`
  }

  if (text) return `HTTP ${input.status}：${text.slice(0, 180)}`
  return `HTTP ${input.status}`
}

function readJsonError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const error = (payload as { error?: unknown }).error
  if (typeof error === "string" && error.trim()) return error.trim()
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message.trim()
  }
  const message = (payload as { message?: unknown }).message
  return typeof message === "string" ? message.trim() : ""
}
