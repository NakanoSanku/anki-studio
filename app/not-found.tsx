import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-[24px] border border-black/[0.07] bg-card p-6 text-center shadow-[0_24px_64px_-48px_rgba(0,0,0,0.62)] dark:border-white/[0.1]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-foreground text-background">
          <span className="font-mono text-sm font-semibold">404</span>
        </div>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Page not found
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.045em]">This card isn’t here</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page may have moved or the link may be incorrect. Your local decks and study progress are safe.
        </p>

        <Button asChild className="mt-6 h-12 w-full rounded-[14px]">
          <Link href="/">Back to Anki Studio</Link>
        </Button>
      </section>
    </main>
  )
}
