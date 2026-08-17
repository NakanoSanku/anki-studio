import { extractModelIds, parseAiSettings, validateProviderEndpoint } from "@/lib/ai-settings"
import { describeUpstreamError, providerFetch } from "@/lib/ai-upstream"

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
    const response = await providerFetch(endpoint, { headers })
    const body = await response.text()
    if (!response.ok) {
      return Response.json(
        {
          error: `拉取模型失败：${describeUpstreamError({
            status: response.status,
            body,
            cfRay: response.headers.get("cf-ray"),
          })}`,
        },
        { status: 502 }
      )
    }

    let payload: unknown = null
    try {
      payload = body ? JSON.parse(body) : null
    } catch {
      return Response.json({ error: "接口没有返回 JSON" }, { status: 502 })
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
