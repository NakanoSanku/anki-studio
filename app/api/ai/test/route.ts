import { aiRouteError, runTestAi } from "@/lib/ai-run"

export const maxDuration = 60

export async function POST(request: Request) {
  let settings: unknown
  try {
    const body = (await request.json()) as { settings?: unknown }
    settings = body.settings
  } catch {
    return Response.json({ error: "请求无效" }, { status: 400 })
  }

  try {
    await runTestAi(settings)
    return Response.json({ ok: true })
  } catch (error) {
    return aiRouteError(error, "测试失败")
  }
}
