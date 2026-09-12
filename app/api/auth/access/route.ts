import { getGoogleAppAuthorization } from "@/lib/app-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const authorization = await getGoogleAppAuthorization()
  if (!authorization.ok) return authorization.response
  return Response.json({ authenticated: true, email: authorization.session.user?.email ?? null }, { headers: { "Cache-Control": "no-store" } })
}
