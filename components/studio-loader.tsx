"use client"

import dynamic from "next/dynamic"

function StudioBootScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-xs flex-col items-center text-center" role="status" aria-live="polite">
        <div className="relative flex size-14 items-center justify-center rounded-[16px] bg-foreground text-background shadow-[0_18px_42px_-32px_rgba(0,0,0,0.7)]">
          <span className="text-[16px] font-semibold tracking-[-0.05em]">a</span>
          <span className="absolute right-3 top-3 size-2 rounded-full bg-energy" aria-hidden="true" />
        </div>

        <h1 className="anki-wordmark mt-5 text-[30px] sm:text-[34px]">anki studio</h1>
        <p className="mt-2 text-sm text-muted-foreground">Preparing your study space</p>

        <div className="mt-7 h-1 w-20 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden="true">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-energy" />
        </div>
      </div>
    </div>
  )
}

export const StudioLoader = dynamic(
  () => import("@/components/studio").then((mod) => mod.Studio),
  {
    ssr: false,
    loading: () => <StudioBootScreen />,
  }
)
