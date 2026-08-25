import {
  createGoogleSheetsClient,
  GoogleSheetsApiError,
  SHEETS_QUOTA_USER_MESSAGE,
  type GoogleSheetsClient,
} from "./google-sheets-sync"
import {
  getGoogleSession,
  hasGoogleSheetsScope,
  isAllowedGoogleSession,
  readGoogleOAuthConfiguration,
  type GoogleSession,
} from "./google-auth"
import { GOOGLE_SHEET_ID_HEADER, isGoogleSpreadsheetId } from "./google-sheet-id"

type SessionResolver = () => Promise<GoogleSession | null>

type AuthorizationResult =
  | { ok: true; accessToken: string; session: GoogleSession }
  | { ok: false; response: Response }

export async function getGoogleSheetsAuthorization(
  resolveSession: SessionResolver = getGoogleSession
): Promise<AuthorizationResult> {
  const oauth = readGoogleOAuthConfiguration()
  if (oauth.state !== "ready") {
    return {
      ok: false,
      response: Response.json(
        { error: oauth.issue, available: false },
        { status: 503 }
      ),
    }
  }

  let session: GoogleSession | null
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
  if (
    session.googleAccessError
    || !session.googleAccessToken
    || !hasGoogleSheetsScope(session.googleScope)
  ) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "请重新连接 Google 帐号并授权表格访问",
          available: false,
          authRequired: true,
          reauthorize: true,
        },
        { status: 401 }
      ),
    }
  }
  return { ok: true, accessToken: session.googleAccessToken, session }
}

export async function getSyncEnv(
  request: Request,
  resolveSession: SessionResolver = getGoogleSession
): Promise<{ ok: true; client: GoogleSheetsClient } | { ok: false; response: Response }> {
  const authorization = await getGoogleSheetsAuthorization(resolveSession)
  if (!authorization.ok) return authorization

  const spreadsheetId = request.headers.get(GOOGLE_SHEET_ID_HEADER)?.trim() ?? ""
  if (!isGoogleSpreadsheetId(spreadsheetId)) {
    return {
      ok: false,
      response: Response.json(
        { error: "请先选择用于同步的 Google Sheet", available: false },
        { status: 400 }
      ),
    }
  }
  return {
    ok: true,
    client: createGoogleSheetsClient({
      spreadsheetId,
      accessToken: authorization.accessToken,
    }),
  }
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export function googleSheetsErrorResponse(error: unknown, fallback: string): Response {
  if (error instanceof GoogleSheetsApiError) {
    const quota = error.message === SHEETS_QUOTA_USER_MESSAGE
    const status = quota
      ? 429
      : [401, 403, 404, 503].includes(error.status) ? error.status : 502
    return Response.json({
      error: error.message,
      available: false,
      ...(status === 401 ? { authRequired: true, reauthorize: true } : {}),
    }, { status })
  }
  const message = error instanceof Error ? error.message : fallback
  if (
    message.includes("无效")
    || message.includes("缺少")
    || message.includes("太大")
    || message.includes("无法解析")
  ) {
    return jsonError(message, 400)
  }
  console.error(JSON.stringify({ message: fallback, error: message }))
  return jsonError(fallback, 500)
}
