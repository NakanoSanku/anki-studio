import {
  createGoogleSheetsSyncGateway,
  type GoogleSheetsSyncGateway,
} from "./google-sheets-sync"

export async function getSyncEnv(
  request: Request
): Promise<{ ok: true; gateway: GoogleSheetsSyncGateway } | { ok: false; response: Response }> {
  try {
    if (process.env.REQUIRE_ACCESS === "1" && !request.headers.get("cf-access-jwt-assertion")) {
      return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) }
    }
    const url = process.env.GOOGLE_SHEETS_SYNC_URL
    const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET
    if (!url || !secret) {
      return {
        ok: false,
        response: Response.json(
          { error: "Google Sheets 同步未配置", available: false },
          { status: 503 }
        ),
      }
    }
    return {
      ok: true,
      gateway: createGoogleSheetsSyncGateway({
        url,
        secret,
      }),
    }
  } catch (error) {
    console.error(JSON.stringify({ message: "sync configuration failed", error: String(error) }))
    return {
      ok: false,
      response: Response.json(
        { error: "Google Sheets 同步配置无效", available: false },
        { status: 503 }
      ),
    }
  }
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}
