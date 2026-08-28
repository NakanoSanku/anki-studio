import type { ReactNode } from "react"

import { RoutePreloader } from "@/components/route-preloader"
import { StudioLoader } from "@/components/studio-loader"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StudioLoader />
      <RoutePreloader />
    </>
  )
}
