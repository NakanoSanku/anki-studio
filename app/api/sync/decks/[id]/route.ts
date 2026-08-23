import { getGoogleSheetsDeck, putGoogleSheetsDeck } from "@/lib/google-sheets-sync"
import { isDeckId } from "@/lib/studio-store"
import { parsePutBody } from "@/lib/sync-payload"
import { getSyncEnv, googleSheetsErrorResponse, jsonError } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  const { id } = await context.params
  if (!isDeckId(id)) return jsonError("卡包 id 无效", 400)
  try {
    const payload = await getGoogleSheetsDeck(ctx.client, id)
    if (!payload) return jsonError("云端没有这个卡包", 404)
    return Response.json(payload)
  } catch (error) {
    return googleSheetsErrorResponse(error, "读取云端卡包失败")
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  const { id } = await context.params
  if (!isDeckId(id)) return jsonError("卡包 id 无效", 400)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("请求无法解析", 400)
  }
  try {
    const parsed = parsePutBody(body)
    const result = await putGoogleSheetsDeck(ctx.client, id, parsed)
    if (!result.ok) {
      return Response.json({ error: "版本冲突", server: result.server }, { status: 409 })
    }
    return Response.json({ rev: result.rev, updatedAt: result.updatedAt })
  } catch (error) {
    return googleSheetsErrorResponse(error, "保存云端卡包失败")
  }
}
