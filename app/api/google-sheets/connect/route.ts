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
    return jsonError("请求无法解析", 400)
  }
  const spreadsheetId = body && typeof body === "object"
    ? (body as Record<string, unknown>).spreadsheetId
    : undefined
  if (typeof spreadsheetId !== "string" || !isGoogleSpreadsheetId(spreadsheetId)) {
    return jsonError("Google Sheet 链接无效", 400)
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
    return googleSheetsErrorResponse(error, "无法连接这个 Google Sheet")
  }
}
