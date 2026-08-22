import { listGoogleSheetsIndex } from "@/lib/google-sheets-sync"
import { getSyncEnv, jsonError } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  try {
    const decks = await listGoogleSheetsIndex(ctx.gateway)
    return Response.json({ decks })
  } catch (error) {
    console.error(JSON.stringify({ message: "sync index failed", error: String(error) }))
    return jsonError("读取云端目录失败", 500)
  }
}
