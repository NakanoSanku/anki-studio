import { extractModelIds, parseAiSettings, validateProviderEndpoint } from "@/lib/ai-settings"

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const error = (payload as { error?: unknown }).error
  if (typeof error === "string" && error.trim()) return error
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim()) return message
  }
  return fallback
}

export async function POST(request: Request) {
  let settingsRaw: unknown
  try {
    const body = (await request.json()) as { settings?: unknown }
    settingsRaw = body.settings
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  const settings = parseAiSettings(settingsRaw)
  const error = validateProviderEndpoint(settings.baseURL)
  if (error) {
    return Response.json({ error }, { status: 400 })
  }

  const endpoint = `${settings.baseURL.trim().replace(/\/$/, "")}/models`
  const headers: HeadersInit = { Accept: "application/json" }
  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`
  }

  try {
    const response = await fetch(endpoint, { headers })
    const payload = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      return Response.json(
        { error: `拉取模型失败：${readErrorMessage(payload, `HTTP ${response.status}`)}` },
        { status: 502 }
      )
    }

    const models = extractModelIds(payload)
    if (models.length === 0) {
      return Response.json({ error: "接口没有返回可用模型" }, { status: 502 })
    }
    return Response.json({ models })
  } catch (error) {
    const message = error instanceof Error ? error.message : "拉取模型失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
