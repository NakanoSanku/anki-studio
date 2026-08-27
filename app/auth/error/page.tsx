import Link from "next/link"
import { ArrowLeft, ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"

// This page is a runtime destination for NextAuth failures.
export const dynamic = "force-dynamic"

export default function GoogleAuthErrorPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-[max(2rem,env(safe-area-inset-top))] sm:px-6">
      <section className="w-full max-w-md rounded-[24px] border border-black/[0.07] bg-card p-5 shadow-[0_24px_64px_-48px_rgba(0,0,0,0.62)] dark:border-white/[0.1] sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Google sign-in
          </span>
          <span className="relative flex size-11 items-center justify-center rounded-[13px] bg-foreground text-background">
            <ShieldX className="size-5" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-energy" aria-hidden="true" />
          </span>
        </div>

        <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.045em] text-foreground sm:text-[34px]">
          Couldn’t connect your Google account
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Sign in again with a Google account that your administrator allows. Your local decks, edits, and study history are unchanged.
        </p>

        <div className="mt-5 rounded-[16px] border border-black/[0.055] bg-background/55 p-4 text-sm leading-6 text-muted-foreground dark:border-white/[0.07]">
          Return to Sync settings to sign in again, or keep using Anki Studio offline.
        </div>

        <Button asChild className="mt-6 h-12 w-full rounded-[14px]">
          <Link href="/settings/sync">
            <ArrowLeft className="size-4" />
            Back to Sync settings
          </Link>
        </Button>
      </section>
    </main>
  )
}
