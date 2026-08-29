import { GEMINI_LIVE_MODEL } from "@/lib/gemini-live-settings"
import { createWindowRateLimiter, readJsonBodyWithLimit, RequestBodyTooLargeError, requestClientKey } from "@/lib/request-guard"

export const dynamic = "force-dynamic"

const TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens"
const TOKEN_LIFETIME_MS = 30 * 60 * 1000
const NEW_SESSION_WINDOW_MS = 60 * 1000
const MAX_BODY_BYTES = 4096
const UPSTREAM_TIMEOUT_MS = 15_000
const allowRequest = createWindowRateLimiter({ limit: 30, windowMs: 60_000 })

type TokenPayload = {
  name?: unknown
  error?: unknown
}

function responseError(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) return message.trim()
    }
  }
  return "Gemini rejected the API key or token request"
}

export async function POST(request: Request) {
  const rate = allowRequest(requestClientKey(request))
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many token requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    )
  }

  let body: { apiKey?: unknown }
  try {
    body = await readJsonBodyWithLimit<{ apiKey?: unknown }>(request, MAX_BODY_BYTES)
  } catch (error) {
    return Response.json(
      { error: error instanceof RequestBodyTooLargeError ? "Request body is too large" : "Invalid request" },
      { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }
    )
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : ""
  if (!apiKey) return Response.json({ error: "Gemini API key is required" }, { status: 400 })
  if (apiKey.length < 16) return Response.json({ error: "The Gemini API key looks incomplete" }, { status: 400 })

  const now = Date.now()
  const expireTime = new Date(now + TOKEN_LIFETIME_MS).toISOString()
  const newSessionExpireTime = new Date(now + NEW_SESSION_WINDOW_MS).toISOString()

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    const payload = await response.json().catch(() => null) as TokenPayload | null
    if (!response.ok) {
      const issue = responseError(payload)
      return Response.json(
        { error: issue },
        { status: response.status === 401 || response.status === 403 ? 401 : 502 }
      )
    }

    const token = typeof payload?.name === "string" ? payload.name : ""
    if (!token) return Response.json({ error: "Gemini did not return a Live token" }, { status: 502 })

    return Response.json(
      {
        token,
        model: GEMINI_LIVE_MODEL,
        expireTime,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return Response.json({ error: "Unable to reach Gemini token service" }, { status: 502 })
  }
}
