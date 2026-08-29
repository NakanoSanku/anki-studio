import { listGoogleSheetsIndex } from "@/lib/google-sheets-sync"
import { getSyncEnv, googleSheetsErrorResponse } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const ctx = await getSyncEnv(request)
  if (!ctx.ok) return ctx.response
  try {
    const decks = await listGoogleSheetsIndex(ctx.client)
    return Response.json({ decks })
  } catch (error) {
    return googleSheetsErrorResponse(error, "Couldn’t read the cloud index")
  }
}
