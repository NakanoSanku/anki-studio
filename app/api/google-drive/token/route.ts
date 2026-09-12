import { getGoogleSheetsAuthorization } from "@/lib/sync-server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const authorization = await getGoogleSheetsAuthorization(request)
  if (!authorization.ok) return authorization.response

  return Response.json(
    { accessToken: authorization.accessToken },
    { headers: { "Cache-Control": "no-store" } }
  )
}
