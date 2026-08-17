import { type FieldAiInput } from "@/lib/ai"
import { aiRouteError, runFieldAi } from "@/lib/ai-run"

export const maxDuration = 60

export async function POST(request: Request) {
  let body: FieldAiInput
  try {
    body = (await request.json()) as FieldAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  try {
    return Response.json({ text: await runFieldAi(body) })
  } catch (error) {
    return aiRouteError(error, "AI 调用失败")
  }
}
