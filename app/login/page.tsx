"use client"

import { useEffect, useState } from "react"
import { getSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"

import { safeAuthCallback } from "@/lib/auth-redirect"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return ""
    const reason = new URLSearchParams(window.location.search).get("error")
    return reason === "AccessDenied"
      ? "This Google account is not on the Anki Studio allowlist."
      : reason === "Configuration"
        ? "Google sign-in is not configured correctly. Contact the administrator."
        : ""
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("error") !== "OAuthCallback") return

    const callbackUrl = safeAuthCallback(params.get("callbackUrl") ?? "/")
    let cancelled = false
    void getSession().then((session) => {
      if (!cancelled && session?.user?.email) router.replace(callbackUrl)
    })

    return () => {
      cancelled = true
    }
  }, [router])

  const connect = async () => {
    setBusy(true)
    setError("")
    try {
      const params = new URLSearchParams(window.location.search)
      await signIn("google", {
        callbackUrl: safeAuthCallback(params.get("callbackUrl") ?? "/"),
      })
    } catch (cause) {
      setBusy(false)
      setError(cause instanceof Error ? cause.message : "Unable to start Google sign-in")
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-[max(2rem,env(safe-area-inset-top))] sm:px-6">
      <section className="w-full max-w-md rounded-[24px] border border-black/[0.07] bg-card p-5 shadow-[0_24px_64px_-48px_rgba(0,0,0,0.62)] dark:border-white/[0.1] sm:p-7">
        <div className="flex size-12 items-center justify-center rounded-[14px] bg-foreground text-background"><ShieldCheck className="size-5" /></div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Private workspace</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.045em] text-foreground sm:text-[34px]">Sign in to Anki Studio</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Only Google accounts on the administrator’s allowlist can use this workspace.</p>
        {error ? <p role="alert" className="mt-4 rounded-[12px] bg-destructive/8 px-3 py-2.5 text-xs font-medium text-destructive">{error}</p> : null}
        <Button type="button" className="mt-6 h-12 w-full" disabled={busy} onClick={() => void connect()}>{busy ? "Opening Google…" : "Continue with Google"}</Button>
      </section>
    </main>
  )
}
