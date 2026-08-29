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
import { SyncRequestError } from "./sync-errors"

type SessionResolver = () => Promise<GoogleSession | null>

type AuthorizationResult =
  | { ok: true; accessToken: string; session?: GoogleSession }
  | { ok: false; response: Response }

export async function getGoogleSheetsAuthorization(
  request?: Request,
  resolveSession: SessionResolver = getGoogleSession
): Promise<AuthorizationResult> {
  // 1. Check Bearer token in request Authorization header (if provided directly)
  const authHeader = request?.headers.get("authorization")?.trim()
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim()
    if (bearerToken) {
      return { ok: true, accessToken: bearerToken }
    }
  }

  // 2. Check NextAuth server session
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

  let session: GoogleSession | null = null
  try {
    session = await resolveSession()
  } catch (error) {
    console.error(JSON.stringify({ message: "Google session validation failed", error: String(error) }))
    return {
      ok: false,
      response: Response.json(
        { error: "Google sign-in is temporarily unavailable", available: false },
        { status: 503 }
      ),
    }
  }

  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "Connect your Google account first", available: false, authRequired: true },
        { status: 401 }
      ),
    }
  }

  if (!isAllowedGoogleSession(session, oauth.allowedEmails)) {
    return {
      ok: false,
      response: Response.json(
        { error: "This Google account is not allowed to access sync data", available: false },
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
          error: "Reconnect your Google account and grant Google Sheets access",
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
  const authorization = await getGoogleSheetsAuthorization(request, resolveSession)
  if (!authorization.ok) return authorization

  const spreadsheetId = request.headers.get(GOOGLE_SHEET_ID_HEADER)?.trim() ?? ""
  if (!isGoogleSpreadsheetId(spreadsheetId)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Choose a Google Sheet for sync first", available: false },
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
  if (error instanceof SyncRequestError) {
    return Response.json(
      { error: error.message, code: error.code, available: false },
      { status: error.status }
    )
  }
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
  if (/invalid|missing|too large|could not be parsed|corrupt|incompatible|duplicate/i.test(message)) {
    return jsonError(message, 400)
  }
  console.error(JSON.stringify({ message: fallback, error: message }))
  return jsonError(fallback, 500)
}
