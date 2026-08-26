import type { ReactNode } from "react"

import { StudioLoader } from "@/components/studio-loader"

// Keep the interactive studio routes in Vercel Functions during Next.js builds.
export const dynamic = "force-dynamic"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StudioLoader />
    </>
  )
}
