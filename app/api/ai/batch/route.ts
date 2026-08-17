import { type BatchAiInput } from "@/lib/ai"
import { aiRouteError, runBatchAi } from "@/lib/ai-run"

export const maxDuration = 60

export async function POST(request: Request) {
  let body: BatchAiInput
  try {
    body = (await request.json()) as BatchAiInput
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  try {
    return Response.json({ cards: await runBatchAi(body) })
  } catch (error) {
    return aiRouteError(error, "批量生成失败")
  }
}
