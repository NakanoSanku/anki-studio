import { getToken } from "next-auth/jwt"
import { NextResponse, type NextRequest } from "next/server"

import { isAllowedGoogleIdentity, readGoogleOAuthConfiguration } from "@/lib/google-auth-config"

function loginRedirect(request: NextRequest, error?: string) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  url.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`)
  if (error) url.searchParams.set("error", error)
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const configuration = readGoogleOAuthConfiguration()
  if (configuration.state !== "ready") return loginRedirect(request, "Configuration")

  const token = await getToken({
    req: request,
    secret: configuration.authSecret,
    secureCookie: request.nextUrl.protocol === "https:" || process.env.VERCEL === "1",
  })
  if (!isAllowedGoogleIdentity(token as { email?: unknown; googleProvider?: unknown; googleEmailVerified?: unknown } | null, configuration.allowedEmails)) {
    return loginRedirect(request, token ? "AccessDenied" : undefined)
  }

  const response = NextResponse.next()
  response.headers.set("Cache-Control", "private, no-store, max-age=0")
  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|_next/webpack-hmr|auth|login|sw.js|manifest.webmanifest|icon.svg|icon-maskable.svg|apple-icon).*)"],
}
