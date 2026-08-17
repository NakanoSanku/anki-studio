import { extractModelIds, validateProviderEndpoint } from "./ai-settings"

export const AI_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

export function providerFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (typeof window === "undefined") {
    headers.set("User-Agent", AI_FETCH_UA)
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  return fetch(input, { ...init, headers, cache: "no-store" })
}

export function isCloudflareBlocked(error: string): boolean {
  return /cloudflare|\bcf-ray\b|ray [a-f0-9]+-[a-z]{3}|出口 IP 经常被拦/i.test(error)
}

export async function withBrowserFallback<T>(
  serverCall: () => Promise<T>,
  browserCall: () => Promise<T>
): Promise<T> {
  try {
    return await serverCall()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (typeof window === "undefined" || !isCloudflareBlocked(message)) {
      throw error
    }
    try {
      return await browserCall()
    } catch (fallbackError) {
      const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      if (/failed to fetch|networkerror|cors|load failed|failed to load/i.test(fallback)) {
        throw new Error(
          "Vercel 被 Cloudflare 拦截，浏览器直连也失败（中转站可能没开跨域）。关闭中转站 Bot Fight，或在本地运行 Anki Studio"
        )
      }
      throw fallbackError
    }
  }
}

export async function listProviderModels(settings: { baseURL: string; apiKey: string }): Promise<string[]> {
  const invalid = validateProviderEndpoint(settings.baseURL)
  if (invalid) throw new Error(invalid)

  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/models`
  const headers: HeadersInit = { Accept: "application/json" }
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`
  }

  const response = await providerFetch(endpoint, { headers })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(
      describeUpstreamError({
        status: response.status,
        body,
        cfRay: response.headers.get("cf-ray"),
      })
    )
  }

  let payload: unknown = null
  try {
    payload = body ? JSON.parse(body) : null
  } catch {
    throw new Error("接口没有返回 JSON")
  }

  const models = extractModelIds(payload)
  if (models.length === 0) throw new Error("接口没有返回可用模型")
  return models
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
