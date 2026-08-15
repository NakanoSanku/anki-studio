import { generateText } from "ai"

import { resolveLanguageModel } from "@/lib/ai-model"

export async function POST(request: Request) {
  let settings: unknown
  try {
    const body = (await request.json()) as { settings?: unknown }
    settings = body.settings
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  try {
    const { text } = await generateText({
      model: resolveLanguageModel(settings),
      prompt: "Reply with the single word OK.",
    })
    if (!text.trim()) {
      return Response.json({ error: "模型没有返回内容" }, { status: 502 })
    }
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "测试失败"
    return Response.json({ error: message }, { status: 502 })
  }
}
