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
    <main className="grid min-h-[100dvh] place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-[24px] border border-black/[0.07] bg-card p-6 text-center shadow-[0_24px_64px_-48px_rgba(0,0,0,0.62)] dark:border-white/[0.1]">
        <div className="relative mx-auto flex size-14 items-center justify-center rounded-[16px] bg-foreground text-background">
          <span className="text-xl font-semibold">!</span>
          <span className="absolute right-3 top-3 size-2 rounded-full bg-energy" aria-hidden="true" />
        </div>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.045em]">We hit a problem</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Try this screen again first. If the problem continues, returning home will not remove your local decks or study history.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button type="button" variant="outline" className="h-12 rounded-[14px]" onClick={reset}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button asChild className="h-12 rounded-[14px]">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
