"use client"

import dynamic from "next/dynamic"

function StudioBootScreen() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 top-[12%] size-72 rounded-full bg-energy/[0.08] blur-3xl" />
        <div className="absolute -right-32 bottom-[8%] size-80 rounded-full bg-foreground/[0.035] blur-3xl dark:bg-white/[0.04]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center" role="status" aria-live="polite">
        <div className="flex size-16 items-center justify-center rounded-[18px] bg-foreground text-background shadow-[0_20px_50px_-36px_rgba(0,0,0,0.72)]">
          <span className="relative text-[17px] font-semibold tracking-[-0.05em]">
            a
            <span className="absolute -right-2 -top-1 size-2 rounded-full bg-energy" aria-hidden="true" />
          </span>
        </div>

        <h1 className="anki-wordmark mt-6 text-[30px] sm:text-[34px]">anki studio</h1>
        <p className="mt-2 text-sm text-muted-foreground">正在准备学习空间</p>

        <div className="mt-8 h-1 w-24 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden="true">
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
