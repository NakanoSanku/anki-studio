import {
  getGoogleSession,
  hasGoogleDriveScope,
  hasGoogleSheetsScope,
  isAllowedGoogleSession,
  readGoogleOAuthConfiguration,
} from "@/lib/google-auth"
import firebaseConfig from "@/firebase-applet-config.json"

export const dynamic = "force-dynamic"

export async function GET() {
  const configuration = readGoogleOAuthConfiguration()
  const isFirebaseSetup = Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId)

  if (configuration.state !== "ready" && !isFirebaseSetup) {
    return Response.json({
      configured: false,
      authenticated: false,
      issue: configuration.issue,
    })
  }

  try {
    const session = await getGoogleSession()
    const allowedEmails = configuration.state === "ready" ? configuration.allowedEmails : []
    if (session && isAllowedGoogleSession(session, allowedEmails)) {
      return Response.json({
        configured: true,
        authenticated: true,
        sheetsAuthorized: Boolean(
          session?.googleAccessToken
          && !session.googleAccessError
          && hasGoogleSheetsScope(session.googleScope)
        ),
        driveAuthorized: Boolean(
          session?.googleAccessToken
          && !session.googleAccessError
          && hasGoogleDriveScope(session.googleScope)
        ),
        user: {
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? null,
          image: session?.user?.image ?? null,
        },
      })
    }

    return Response.json({
      configured: true,
      authenticated: false,
    })
  } catch (error) {
    console.error(JSON.stringify({ message: "Google account status failed", error: String(error) }))
    return Response.json({
      configured: true,
      authenticated: false,
    })
  }
}
