import NextAuth from "next-auth"

import { createGoogleAuthOptions } from "@/lib/google-auth"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ nextauth: string[] }>
}

const handler = (request: Request, context: RouteContext) => (
  NextAuth(createGoogleAuthOptions())(request, context)
)

export { handler as GET, handler as POST }
