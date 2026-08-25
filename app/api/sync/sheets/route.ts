import { listSpreadsheetInventory } from "@/lib/google-sheets-sync"
import { getSyncEnv, googleSheetsErrorResponse } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  try {
    const inventory = await listSpreadsheetInventory(ctx.client)
    return Response.json(inventory)
  } catch (error) {
    return googleSheetsErrorResponse(error, "无法读取表格工作表")
  }
}
