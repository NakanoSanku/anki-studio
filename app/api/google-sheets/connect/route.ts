import { isGoogleSpreadsheetId } from "@/lib/google-sheet-id"
import { connectGoogleSheet, createGoogleSheetsClient } from "@/lib/google-sheets-sync"
import {
  getGoogleSheetsAuthorization,
  googleSheetsErrorResponse,
  jsonError,
} from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const authorization = await getGoogleSheetsAuthorization(request)
  if (!authorization.ok) return authorization.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON request", 400)
  }
  const spreadsheetId = body && typeof body === "object"
    ? (body as Record<string, unknown>).spreadsheetId
    : undefined
  if (typeof spreadsheetId !== "string" || !isGoogleSpreadsheetId(spreadsheetId)) {
    return jsonError("Invalid Google Sheet link", 400)
  }

  try {
    const sheet = await connectGoogleSheet(createGoogleSheetsClient({
      spreadsheetId,
      accessToken: authorization.accessToken,
    }))
    return Response.json({
      sheet: { id: sheet.id, name: sheet.title, url: sheet.url },
    })
  } catch (error) {
    return googleSheetsErrorResponse(error, "Unable to connect to this Google Sheet")
  }
}
