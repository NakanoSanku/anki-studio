import { type TemplateAiInput } from "@/lib/ai"
import { aiRouteError, runTemplateAi } from "@/lib/ai-run"

export const maxDuration = 60

export async function POST(request: Request) {
  let body: TemplateAiInput
  try {
    body = (await request.json()) as TemplateAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  try {
    return Response.json(await runTemplateAi(body))
  } catch (error) {
    return aiRouteError(error, "模板生成失败")
  }
}
