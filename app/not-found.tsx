import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#fffaf5] px-5 py-10 text-foreground dark:bg-[#13120f]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-20 top-[8%] size-56 rounded-[45%_55%_60%_40%/50%_43%_57%_50%] bg-[#c8f889]" />
        <div className="absolute -right-20 top-[18%] size-52 rounded-[57%_43%_45%_55%/44%_58%_42%_56%] bg-[#ffaaa0]" />
        <div className="absolute -left-16 bottom-[5%] size-48 rounded-[54%_46%_42%_58%/58%_46%_54%_42%] bg-[#9dceff]" />
        <div className="absolute -right-14 bottom-[8%] size-44 rounded-[44%_56%_60%_40%/52%_58%_42%_48%] bg-[#ffe08d]" />
      </div>

      <section className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative flex size-40 items-center justify-center rounded-[42%_58%_52%_48%/48%_42%_58%_52%] bg-black text-white shadow-[0_28px_70px_-38px_rgba(0,0,0,0.85)] dark:bg-white dark:text-black">
          <span className="text-5xl font-black tracking-[-0.08em]">404</span>
          <span className="absolute left-9 top-9 size-3 rounded-full bg-[#ff9bd6]" />
          <span className="absolute right-9 top-9 size-3 rounded-full bg-[#70b2f6]" />
        </div>

        <p className="mt-7 text-[10px] font-black uppercase tracking-[0.22em] text-foreground/40">
          lost card
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.055em]">这张卡片不在这里</h1>
        <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-muted-foreground">
          页面可能已经移动，或者链接写错了。你的本机卡包和学习进度不会受到影响。
        </p>

        <Button asChild className="mt-7 h-14 w-full rounded-full bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90">
          <Link href="/">返回 Anki Studio</Link>
        </Button>
      </section>
    </main>
  )
}
