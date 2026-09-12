import type { ReactNode } from "react"
import { AppAccessGuard } from "@/components/app-access-guard"
import { RoutePreloader } from "@/components/route-preloader"
import { StudioLoader } from "@/components/studio-loader"

export default async function AppLayout({ children }: { children: ReactNode }) {
  // proxy.ts authenticates every route in this group before rendering it.
  // Avoid decoding the same NextAuth JWT a second time on every navigation.
  return (
    <>
      <AppAccessGuard>{children}</AppAccessGuard>
      <StudioLoader />
      <RoutePreloader />
    </>
  )
}
