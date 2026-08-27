"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#fffaf5] px-5 py-10 text-foreground dark:bg-[#13120f]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-20 top-[10%] size-56 rounded-[48%_52%_59%_41%/46%_44%_56%_54%] bg-[#ffd8df]" />
        <div className="absolute -right-16 top-[22%] size-44 rounded-[55%_45%_44%_56%/52%_58%_42%_48%] bg-[#ffe08d]" />
        <div className="absolute -left-12 bottom-[4%] size-44 rounded-[46%_54%_58%_42%/56%_44%_56%_44%] bg-[#9dceff]" />
      </div>

      <section className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative flex size-32 items-center justify-center rounded-[46%_54%_58%_42%/48%_42%_58%_52%] bg-[#ffaaa0] shadow-[0_24px_58px_-38px_rgba(0,0,0,0.72)]">
          <span className="absolute left-8 top-9 size-3 rounded-full bg-black" />
          <span className="absolute right-8 top-9 size-3 rounded-full bg-black" />
          <span className="absolute bottom-8 h-3 w-9 rounded-t-full border-t-4 border-black" />
          <span className="text-3xl font-black text-black/0" aria-hidden="true">!</span>
        </div>

        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-foreground/40">
          something slipped
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.055em]">刚刚出了点问题</h1>
        <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-muted-foreground">
          可以先重新加载当前界面。如果问题持续出现，返回首页不会删除本机卡包和学习记录。
        </p>

        <div className="mt-7 grid w-full grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-13 rounded-full bg-white/80 font-black dark:bg-white/10"
            onClick={reset}
          >
            <RotateCcw className="size-4" />
            重试
          </Button>
          <Button asChild className="h-13 rounded-full bg-black font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90">
            <Link href="/">回首页</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
