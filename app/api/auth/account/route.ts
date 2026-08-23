import {
  getGoogleSession,
  hasGoogleSheetsScope,
  isAllowedGoogleSession,
  readGoogleOAuthConfiguration,
} from "@/lib/google-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const configuration = readGoogleOAuthConfiguration()
  if (configuration.state !== "ready") {
    return Response.json({
      configured: false,
      authenticated: false,
      issue: configuration.issue,
    })
  }

  try {
    const session = await getGoogleSession()
    if (!isAllowedGoogleSession(session, configuration.allowedEmails)) {
      return Response.json({ configured: true, authenticated: false })
    }
    return Response.json({
      configured: true,
      authenticated: true,
      sheetsAuthorized: Boolean(
        session?.googleAccessToken
        && !session.googleAccessError
        && hasGoogleSheetsScope(session.googleScope)
      ),
      user: {
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
      },
    })
  } catch (error) {
    console.error(JSON.stringify({ message: "Google account status failed", error: String(error) }))
    return Response.json(
      {
        configured: true,
        authenticated: false,
        issue: "Google 登录服务暂时不可用",
      },
      { status: 503 }
    )
  }
}
