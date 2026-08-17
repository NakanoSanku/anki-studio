import { parseAiSettings, validateProviderEndpoint } from "@/lib/ai-settings"
import { listProviderModels } from "@/lib/ai-upstream"

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

  try {
    return Response.json({ models: await listProviderModels(settings) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "拉取模型失败"
    return Response.json({ error: `拉取模型失败：${message}` }, { status: 502 })
  }
}
