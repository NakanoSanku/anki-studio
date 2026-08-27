"use client"

import dynamic from "next/dynamic"

function StudioBootScreen() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#fffaf5] px-6 dark:bg-[#13120f]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-16 top-[18%] size-48 rounded-[48%_52%_58%_42%/45%_48%_52%_55%] bg-[#c8f889] opacity-75 blur-[0.2px] dark:opacity-30" />
        <div className="absolute -right-20 top-[28%] size-56 rounded-[58%_42%_46%_54%/48%_56%_44%_52%] bg-[#ffaaa0] opacity-70 dark:opacity-25" />
        <div className="absolute -bottom-20 left-[28%] size-52 rounded-[44%_56%_50%_50%/58%_42%_58%_42%] bg-[#9dceff] opacity-70 dark:opacity-25" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative flex size-24 items-center justify-center rounded-[46%_54%_58%_42%/48%_44%_56%_52%] bg-black text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.82)] dark:bg-white dark:text-black">
          <span className="anki-wordmark text-[23px]">anki</span>
          <span className="absolute left-6 top-6 size-2.5 rounded-full bg-[#ffe08d]" />
          <span className="absolute right-5 bottom-5 size-3 rounded-full bg-[#ff9bd6]" />
        </div>

        <h1 className="anki-wordmark mt-7 text-[34px] sm:text-[38px]">anki studio</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">正在准备你的学习空间</p>

        <div className="mt-8 flex items-center gap-2" aria-label="正在加载">
          {["bg-[#c8f889]", "bg-[#ff9bd6]", "bg-[#ffe08d]"].map((tone, index) => (
            <span
              key={tone}
              className={`size-2.5 animate-pulse rounded-full ${tone}`}
              style={{ animationDelay: `${index * 140}ms` }}
            />
          ))}
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
