import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { getGoogleAppAuthorization } from "@/lib/app-auth"
import { AppAccessGuard } from "@/components/app-access-guard"
import { RoutePreloader } from "@/components/route-preloader"
import { StudioLoader } from "@/components/studio-loader"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const authorization = await getGoogleAppAuthorization()
  if (!authorization.ok) {
    redirect(authorization.response.status === 403 ? "/login?error=AccessDenied" : authorization.response.status === 503 ? "/login?error=Configuration" : "/login")
  }
  return (
    <>
      <AppAccessGuard>{children}</AppAccessGuard>
      <StudioLoader />
      <RoutePreloader />
    </>
  )
}
