import { extractModelIds, validateProviderEndpoint } from "./ai-settings"

export const AI_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
export const AI_REQUEST_TIMEOUT_MS = 90_000

export function providerFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (typeof window === "undefined") {
    headers.set("User-Agent", AI_FETCH_UA)
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json")
  return fetch(input, { ...init, headers, cache: "no-store" })
}

export async function withProviderTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
  timeoutMs = AI_REQUEST_TIMEOUT_MS
): Promise<T> {
  if (externalSignal?.aborted) {
    throw externalSignal.reason instanceof Error
      ? externalSignal.reason
      : new DOMException("Aborted", "AbortError")
  }

  const controller = new AbortController()
  let timedOut = false
  const onExternalAbort = () => controller.abort(externalSignal?.reason)
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, Math.max(1, timeoutMs))

  try {
    return await work(controller.signal)
  } catch (error) {
    if (timedOut && !externalSignal?.aborted) {
      throw new Error("AI request timed out. Try again.")
    }
    throw error
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener("abort", onExternalAbort)
  }
}

export function isCloudflareBlocked(error: string): boolean {
  return /cloudflare|\bcf-ray\b|cf-mitigated|ray [a-f0-9]+-[a-z]{3}|Cloudflare blocked/i.test(error)
}

export function isBrowserNetworkError(error: string): boolean {
  return /failed to fetch|networkerror|load failed|failed to load|network request failed|\bcors\b|cross-origin/i.test(error)
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
      throw new Error("The browser could not reach the AI provider. Enable CORS on the provider endpoint and try again.")
    }
    throw error
  }
}

export async function listProviderModels(settings: { baseURL: string; apiKey: string }): Promise<string[]> {
  const invalid = validateProviderEndpoint(settings.baseURL)
  if (invalid) throw new Error(invalid)

  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/models`
  const headers: HeadersInit = { Accept: "application/json" }
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`

  return withProviderTimeout(async (signal) => {
    const response = await providerFetch(endpoint, { headers, signal })
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
      throw new Error("The provider did not return JSON")
    }

    const models = extractModelIds(payload)
    if (models.length === 0) throw new Error("The provider did not return any available models")
    return models
  })
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
          const ray = input.cfRay ? ` · Ray ${input.cfRay}` : ""
          return `HTTP ${input.status}: Cloudflare blocked the provider request${ray}`
        }
        return `HTTP ${input.status}: ${message}`
      }
    } catch {
      // HTML / plain text from a gateway
    }
  }

  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const blocked = Boolean(input.cfRay)
    || /cloudflare|attention required|just a moment|sorry, you have been blocked|error 10\d\d|cf-mitigated/i.test(raw)
  if (blocked) {
    const ray = input.cfRay ? ` · Ray ${input.cfRay}` : ""
    return `HTTP ${input.status}: Cloudflare blocked the provider request${ray}`
  }
  if (text) return `HTTP ${input.status}: ${text.slice(0, 180)}`
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
