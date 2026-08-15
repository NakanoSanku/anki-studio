"use client"

import dynamic from "next/dynamic"

export const StudioLoader = dynamic(
  () => import("@/components/studio").then((mod) => mod.Studio),
  {
    ssr: false,
    loading: () => <div className="min-h-[100dvh] bg-[#f4f1ea]" />,
  }
)
