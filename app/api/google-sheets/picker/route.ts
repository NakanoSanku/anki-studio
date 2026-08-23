import { readGooglePickerConfiguration } from "@/lib/google-picker-config"
import { getGoogleSheetsAuthorization } from "@/lib/sync-server"

export const dynamic = "force-dynamic"

export async function GET() {
  const authorization = await getGoogleSheetsAuthorization()
  if (!authorization.ok) return authorization.response

  const picker = readGooglePickerConfiguration()
  if (picker.state !== "ready") {
    return Response.json({ error: picker.issue, available: false }, { status: 503 })
  }

  return Response.json({
    accessToken: authorization.accessToken,
    developerKey: picker.developerKey,
    appId: picker.appId,
  })
}
