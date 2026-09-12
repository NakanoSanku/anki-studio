import { getGoogleSession, isAllowedGoogleSession, readGoogleOAuthConfiguration, type GoogleSession } from "./google-auth"

export type AppAuthorization =
  | { ok: true; session: GoogleSession }
  | { ok: false; response: Response }

export async function getGoogleAppAuthorization(): Promise<AppAuthorization> {
  const configuration = readGoogleOAuthConfiguration()
  if (configuration.state !== "ready") {
    return { ok: false, response: Response.json({ error: configuration.issue, authRequired: true }, { status: 503 }) }
  }

  let session: GoogleSession | null = null
  try {
    session = await getGoogleSession()
  } catch {
    return { ok: false, response: Response.json({ error: "Google sign-in is temporarily unavailable", authRequired: true }, { status: 503 }) }
  }

  if (!session) {
    return { ok: false, response: Response.json({ error: "Sign in with an allowed Google account first", authRequired: true }, { status: 401 }) }
  }
  if (!isAllowedGoogleSession(session, configuration.allowedEmails)) {
    return { ok: false, response: Response.json({ error: "This Google account is not allowed to use Anki Studio", authRequired: true }, { status: 403 }) }
  }
  return { ok: true, session }
}
