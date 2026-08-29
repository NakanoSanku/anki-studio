import { createGoogleSpreadsheet } from "@/lib/google-sheets-sync"
import {
  getGoogleSheetsAuthorization,
  googleSheetsErrorResponse,
} from "@/lib/sync-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const authorization = await getGoogleSheetsAuthorization(request)
  if (!authorization.ok) return authorization.response

  let title = "Anki Studio · Flashcard Sync"
  try {
    const body = await request.json().catch(() => ({})) as { title?: unknown }
    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim()
    }
  } catch {
    // default title
  }

  try {
    const sheet = await createGoogleSpreadsheet(authorization.accessToken, title)
    return Response.json({
      sheet: { id: sheet.id, name: sheet.title, url: sheet.url },
    })
  } catch (error) {
    return googleSheetsErrorResponse(error, "Unable to create a spreadsheet in Google Drive")
  }
}
