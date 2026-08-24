"use client"

import type { ReactNode } from "react"

import { StudioLoader } from "@/components/studio-loader"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StudioLoader />
    </>
  )
}
