import {
  createGoogleSheetsSyncGateway,
  type GoogleSheetsSyncGateway,
} from "./google-sheets-sync"
import {
  getGoogleSession,
  isAllowedGoogleSession,
  readGoogleOAuthConfiguration,
} from "./google-auth"

type SessionResolver = typeof getGoogleSession

export async function getSyncEnv(
  request: Request,
  resolveSession: SessionResolver = getGoogleSession
): Promise<{ ok: true; gateway: GoogleSheetsSyncGateway } | { ok: false; response: Response }> {
  const oauth = readGoogleOAuthConfiguration()
  if (oauth.state === "invalid") {
    return {
      ok: false,
      response: Response.json(
        { error: oauth.issue, available: false },
        { status: 503 }
      ),
    }
  }

  if (oauth.state === "ready") {
    let session
    try {
      session = await resolveSession()
    } catch (error) {
      console.error(JSON.stringify({ message: "Google session validation failed", error: String(error) }))
      return {
        ok: false,
        response: Response.json(
          { error: "Google 登录服务暂时不可用", available: false },
          { status: 503 }
        ),
      }
    }
    if (!session) {
      return {
        ok: false,
        response: Response.json(
          { error: "请先连接 Google 帐号", available: false, authRequired: true },
          { status: 401 }
        ),
      }
    }
    if (!isAllowedGoogleSession(session, oauth.allowedEmails)) {
      return {
        ok: false,
        response: Response.json(
          { error: "当前 Google 帐号无权访问同步数据", available: false },
          { status: 403 }
        ),
      }
    }
  } else if (process.env.REQUIRE_ACCESS === "1" && !request.headers.get("cf-access-jwt-assertion")) {
    return { ok: false, response: Response.json({ error: "未登录" }, { status: 401 }) }
  }

  try {
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
