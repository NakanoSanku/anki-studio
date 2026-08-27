import Link from "next/link"
import { ArrowLeft, ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"

// This page is a runtime destination for NextAuth failures.
export const dynamic = "force-dynamic"

export default function GoogleAuthErrorPage() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#fffaf5] px-4 py-[max(2rem,env(safe-area-inset-top))] dark:bg-[#13120f] sm:px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-20 top-[12%] size-56 rounded-[48%_52%_58%_42%/45%_48%_52%_55%] bg-[#ffd8df] opacity-80 dark:opacity-25" />
        <div className="absolute -right-16 bottom-[12%] size-52 rounded-[58%_42%_46%_54%/48%_56%_44%_52%] bg-[#ffe39a] opacity-80 dark:opacity-25" />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-[2.25rem] bg-white/92 p-5 shadow-[0_28px_74px_-46px_rgba(0,0,0,0.72)] backdrop-blur-xl dark:bg-white/[0.07] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#ffd8df] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]">
            google sign-in
          </span>
          <span className="flex size-11 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
            <ShieldX className="size-5" />
          </span>
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-[-0.055em] text-foreground sm:text-4xl">
          无法连接 Google 帐号
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
          请使用管理员允许的 Google 帐号重新授权。你的本机卡包、学习记录和编辑内容不会受到影响。
        </p>

        <div className="mt-6 rounded-[1.5rem] bg-[#dff1ff] p-4 text-sm leading-6 text-[#174f85] dark:bg-[#1e3b55] dark:text-[#dceeff]">
          返回同步设置后，可以重新登录 Google 帐号，或继续离线使用 Anki Studio。
        </div>

        <Button asChild className="mt-6 h-13 w-full rounded-full bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90">
          <Link href="/settings/sync">
            <ArrowLeft className="size-4" />
            返回同步设置
          </Link>
        </Button>
      </section>
    </main>
  )
}
