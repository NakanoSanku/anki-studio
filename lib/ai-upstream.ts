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
  return /cloudflare|\bcf-ray\b|cf-mitigated|ray [a-f0-9]+-[a-z]{3}|中转站前的 Cloudflare/i.test(error)
}

export function isBrowserNetworkError(error: string): boolean {
  return /failed to fetch|networkerror|load failed|failed to load|network request failed|\bcors\b|跨域/i.test(
    error
  )
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = "name" in error ? String(error.name) : ""
  const message = "message" in error ? String(error.message) : ""
  return name === "AbortError" || /the user aborted|operation was aborted|signal is aborted/i.test(message)
}

export async function withBrowserCorsHint<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (isAbortError(error)) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (isBrowserNetworkError(message)) {
      throw new Error("浏览器直连失败（中转站未开启跨域）。在中转站打开 CORS / 允许跨域后重试。")
    }
    throw error
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
      if (message) {
        const blocked = Boolean(input.cfRay) || isCloudflareBlocked(message)
        if (blocked) {
          const ray = input.cfRay ? `，Ray ${input.cfRay}` : ""
          return `HTTP ${input.status}：中转站前的 Cloudflare 拦截了请求${ray}`
        }
        return `HTTP ${input.status}：${message}`
      }
    } catch {
      // HTML / plain text from a gateway
    }
  }

  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const blocked =
    Boolean(input.cfRay) ||
    /cloudflare|attention required|just a moment|sorry, you have been blocked|error 10\d\d|cf-mitigated/i.test(
      raw
    )
  if (blocked) {
    const ray = input.cfRay ? `，Ray ${input.cfRay}` : ""
    return `HTTP ${input.status}：中转站前的 Cloudflare 拦截了请求${ray}`
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
