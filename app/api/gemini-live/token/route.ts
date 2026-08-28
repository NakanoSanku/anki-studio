import { GEMINI_LIVE_MODEL } from "@/lib/gemini-live-settings"

export const dynamic = "force-dynamic"

const TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens"
const TOKEN_LIFETIME_MS = 30 * 60 * 1000
const NEW_SESSION_WINDOW_MS = 60 * 1000

let constraintsCapability: "unknown" | "supported" | "unsupported" = "unknown"

type TokenPayload = {
  name?: unknown
  error?: unknown
}

type TokenRequestBody = {
  uses: number
  expireTime: string
  newSessionExpireTime: string
  liveConnectConstraints?: {
    model: string
    config: {
      responseModalities: string[]
    }
  }
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

function isUnsupportedConstraint(message: string): boolean {
  return /liveConnectConstraints/i.test(message)
    && /(unknown name|cannot find field|invalid json payload)/i.test(message)
}

async function requestToken(apiKey: string, body: TokenRequestBody) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as TokenPayload | null
  return { response, payload }
}

export async function POST(request: Request) {
  let body: { apiKey?: unknown }
  try {
    body = (await request.json()) as { apiKey?: unknown }
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : ""
  if (!apiKey) return Response.json({ error: "Gemini API key is required" }, { status: 400 })
  if (apiKey.length < 16) return Response.json({ error: "The Gemini API key looks incomplete" }, { status: 400 })

  const now = Date.now()
  const expireTime = new Date(now + TOKEN_LIFETIME_MS).toISOString()
  const newSessionExpireTime = new Date(now + NEW_SESSION_WINDOW_MS).toISOString()
  const baseRequest: TokenRequestBody = {
    uses: 1,
    expireTime,
    newSessionExpireTime,
  }
  const constrainedRequest: TokenRequestBody = {
    ...baseRequest,
    liveConnectConstraints: {
      model: `models/${GEMINI_LIVE_MODEL}`,
      config: {
        responseModalities: ["AUDIO"],
      },
    },
  }

  try {
    let constrained = constraintsCapability !== "unsupported"
    let result = await requestToken(apiKey, constrained ? constrainedRequest : baseRequest)

    if (!result.response.ok && constrained) {
      const issue = responseError(result.payload)
      if (isUnsupportedConstraint(issue)) {
        // Some Gemini auth-token backends currently reject the constraint field
        // even though newer Live API documentation exposes it. Fall back to the
        // stable short-lived one-use token shape instead of breaking Voice Tutor.
        constraintsCapability = "unsupported"
        constrained = false
        result = await requestToken(apiKey, baseRequest)
      }
    }

    if (!result.response.ok) {
      const issue = responseError(result.payload)
      return Response.json(
        { error: issue },
        { status: result.response.status === 401 || result.response.status === 403 ? 401 : 502 }
      )
    }

    if (constrained && constraintsCapability === "unknown") {
      constraintsCapability = "supported"
    }

    const token = typeof result.payload?.name === "string" ? result.payload.name : ""
    if (!token) return Response.json({ error: "Gemini did not return a Live token" }, { status: 502 })

    return Response.json(
      {
        token,
        model: GEMINI_LIVE_MODEL,
        expireTime,
        constrained,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return Response.json({ error: "Unable to reach Gemini token service" }, { status: 502 })
  }
}
