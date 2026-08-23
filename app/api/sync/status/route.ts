import { getGoogleSheetsStatus } from "@/lib/google-sheets-sync"
import { getSyncEnv, googleSheetsErrorResponse } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  try {
    const sheet = await getGoogleSheetsStatus(ctx.client)
    return Response.json({
      available: true,
      provider: "google-sheets",
      sheet: { id: sheet.id, title: sheet.title, url: sheet.url },
    })
  } catch (error) {
    return googleSheetsErrorResponse(error, "无法连接 Google Sheets")
  }
}
