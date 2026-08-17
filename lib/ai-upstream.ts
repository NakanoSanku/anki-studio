import { extractModelIds, parseAiTransport, validateProviderEndpoint } from "./ai-settings"

export const AI_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

export type AiPlan = "server" | "browser" | "browser-then-server" | "server-then-browser"

const OFFICIAL_HOSTS = new Set([
  "api.openai.com",
  "openai.azure.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.mistral.ai",
])

export function providerFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (typeof window === "undefined") {
    headers.set("User-Agent", AI_FETCH_UA)
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  return fetch(input, { ...init, headers, cache: "no-store" })
}

export function isOfficialProvider(baseURL: string): boolean {
  try {
    const host = new URL(baseURL.trim()).hostname.toLowerCase()
    if (OFFICIAL_HOSTS.has(host)) return true
    return host.endsWith(".openai.com") || host.endsWith(".openai.azure.com")
  } catch {
    return false
  }
}

export function resolveAiPlan(
  settings: { baseURL: string; transport?: string },
  inBrowser = typeof window !== "undefined"
): AiPlan {
  const transport = parseAiTransport(settings.transport)
  if (!inBrowser) return "server"
  if (transport === "browser") return "browser"
  if (transport === "server") return "server"
  return isOfficialProvider(settings.baseURL) ? "server-then-browser" : "browser-then-server"
}

export function isCloudflareBlocked(error: string): boolean {
  return /cloudflare|\bcf-ray\b|cf-mitigated|ray [a-f0-9]+-[a-z]{3}|出口 IP 经常被拦|中转站前的 Cloudflare/i.test(
    error
  )
}

export function isBrowserNetworkError(error: string): boolean {
  return /failed to fetch|networkerror|load failed|failed to load|network request failed|\bcors\b|跨域/i.test(
    error
  )
}

export function shouldFallbackToBrowser(error: string): boolean {
  if (isCloudflareBlocked(error)) return true
  if (/请填写|参数无效|字段列表无效|生成数量|修改说明|接口地址|模型名称/.test(error)) {
    return false
  }
  if (/invalid api key|incorrect api key|unauthorized|HTTP 401/i.test(error)) return false
  return /HTTP 403|HTTP 502|HTTP 503|HTTP 504|Forbidden|Bad Gateway|Gateway Time-?out|error 10\d\d|just a moment|attention required|you have been blocked/i.test(
    error
  )
}

export function combineTransportErrors(first: unknown, second: unknown): Error {
  const a = errorMessage(first)
  const b = errorMessage(second)
  const blocked = isCloudflareBlocked(a) || isCloudflareBlocked(b) || /HTTP 403|HTTP 502/.test(`${a}\n${b}`)
  const cors = isBrowserNetworkError(a) || isBrowserNetworkError(b)
  if (blocked && cors) {
    return new Error(
      "Vercel 出口 IP 被 Cloudflare 拦截，浏览器直连也失败（中转站未开启跨域）。在中转站打开 CORS / 允许跨域，或关闭 Bot Fight 后把请求通道改成「经服务器」。"
    )
  }
  return new Error(b || a)
}

export async function runWithTransport<T>(
  settings: { baseURL: string; transport?: string },
  serverCall: () => Promise<T>,
  browserCall: () => Promise<T>
): Promise<{ value: T; via: "server" | "browser" }> {
  const plan = resolveAiPlan(settings)
  if (plan === "browser") {
    return { value: await browserCall(), via: "browser" }
  }
  if (plan === "server") {
    return { value: await serverCall(), via: "server" }
  }
  if (plan === "browser-then-server") {
    try {
      return { value: await browserCall(), via: "browser" }
    } catch (error) {
      if (!isBrowserNetworkError(errorMessage(error))) throw error
      try {
        return { value: await serverCall(), via: "server" }
      } catch (serverError) {
        throw combineTransportErrors(error, serverError)
      }
    }
  }

  try {
    return { value: await serverCall(), via: "server" }
  } catch (error) {
    if (typeof window === "undefined" || !shouldFallbackToBrowser(errorMessage(error))) {
      throw error
    }
    try {
      return { value: await browserCall(), via: "browser" }
    } catch (fallbackError) {
      throw combineTransportErrors(error, fallbackError)
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
      if (message) {
        const blocked = Boolean(input.cfRay) || isCloudflareBlocked(message)
        if (blocked) {
          const ray = input.cfRay ? `，Ray ${input.cfRay}` : ""
          return `HTTP ${input.status}：中转站前的 Cloudflare 拦截了请求${ray}。Vercel 出口 IP 经常被拦，官方 API 不会`
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
