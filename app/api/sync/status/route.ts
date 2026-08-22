import { getGoogleSheetsStatus } from "@/lib/google-sheets-sync"
import { getSyncEnv } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  try {
    await getGoogleSheetsStatus(ctx.gateway)
    return Response.json({
      available: true,
      provider: "google-sheets",
    })
  } catch (error) {
    console.error(JSON.stringify({ message: "sync status failed", error: String(error) }))
    return Response.json(
      { error: "无法连接 Google Sheets", available: false },
      { status: 503 }
    )
  }
}
