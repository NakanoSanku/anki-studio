import { type CardAiInput } from "@/lib/ai"
import { aiRouteError, runCardAi } from "@/lib/ai-run"

export const maxDuration = 60

export async function POST(request: Request) {
  let body: CardAiInput
  try {
    body = (await request.json()) as CardAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  try {
    return Response.json({ values: await runCardAi(body) })
  } catch (error) {
    return aiRouteError(error, "AI 调用失败")
  }
}
