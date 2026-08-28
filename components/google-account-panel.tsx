"use client"

import { useEffect, useRef, useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { Check, KeyRound, LoaderCircle, LogOut, ShieldAlert, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type AccountState =
  | { phase: "loading" }
  | { phase: "unconfigured"; issue: string }
  | { phase: "signed-out" }
  | { phase: "signed-in"; name: string | null; email: string; image?: string | null; sheetsAuthorized: boolean; driveAuthorized: boolean }
  | { phase: "error"; issue: string }

function GoogleMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} shrink-0`}>
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62C7.19 7.7 9.4 5.94 12 5.94Z" />
    </svg>
  )
}

export function GoogleAccountPanel({ onReadyChange }: { onReadyChange?: (ready: boolean | undefined) => void }) {
  const [account, setAccount] = useState<AccountState>({ phase: "loading" })
  const [busy, setBusy] = useState(false)
  const onReadyChangeRef = useRef(onReadyChange)

  useEffect(() => { onReadyChangeRef.current = onReadyChange }, [onReadyChange])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const response = await fetch("/api/auth/account", { cache: "no-store" })
        const data = await response.json().catch(() => null) as { configured?: boolean; authenticated?: boolean; sheetsAuthorized?: boolean; driveAuthorized?: boolean; issue?: string; user?: { name?: string | null; email?: string | null; image?: string | null } } | null
        if (cancelled) return
        if (data?.authenticated && data.user?.email) {
          onReadyChangeRef.current?.(data.sheetsAuthorized === true)
          setAccount({ phase: "signed-in", name: data.user.name ?? null, email: data.user.email, image: data.user.image ?? null, sheetsAuthorized: data.sheetsAuthorized === true, driveAuthorized: data.driveAuthorized === true })
          return
        }
        if (data && !data.configured) {
          onReadyChangeRef.current?.(undefined)
          setAccount({ phase: "unconfigured", issue: data.issue ?? "Google OAuth is not configured" })
        } else {
          onReadyChangeRef.current?.(false)
          setAccount({ phase: "signed-out" })
        }
      } catch {
        if (cancelled) return
        onReadyChangeRef.current?.(undefined)
        setAccount({ phase: "error", issue: "Unable to read Google account status" })
      }
    }
    void refresh()
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh() }
    document.addEventListener("visibilitychange", onVisibility)
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisibility) }
  }, [])

  const connect = async () => {
    setBusy(true)
    try {
      await signIn("google", { callbackUrl: window.location.href })
    } catch (error) {
      console.error("NextAuth sign in error:", error)
      setAccount({ phase: "error", issue: "Unable to start Google sign-in. Try again." })
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await signOut({ redirect: false })
      onReadyChangeRef.current?.(false)
      setAccount({ phase: "signed-out" })
    } catch {
      setAccount({ phase: "error", issue: "Unable to sign out of Google" })
    } finally {
      setBusy(false)
    }
  }

  if (account.phase === "loading") {
    return <div className="flex min-h-28 items-center justify-center rounded-[20px] border border-black/[0.065] bg-card p-5 text-sm font-medium text-muted-foreground dark:border-white/[0.09]"><LoaderCircle className="mr-2.5 size-4 animate-spin" />Loading Google account…</div>
  }

  if (account.phase === "unconfigured" || account.phase === "error") {
    return (
      <div className="rounded-[20px] border border-black/[0.065] bg-card p-5 dark:border-white/[0.09]">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted text-foreground"><ShieldAlert className="size-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Google account</p><h3 className="mt-1 text-lg font-semibold tracking-[-0.03em]">{account.phase === "unconfigured" ? "OAuth not configured" : "Sign-in problem"}</h3><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{account.issue}</p></div>
        </div>
        {account.phase === "error" ? <Button type="button" className="mt-4 h-11 w-full text-xs" disabled={busy} onClick={() => void connect()}>{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <GoogleMark />}Try Google sign-in again</Button> : null}
      </div>
    )
  }

  if (account.phase === "signed-in") {
    return (
      <div className="rounded-[20px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            {account.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.image} alt={account.name || "Google avatar"} className="size-13 rounded-[14px] object-cover" referrerPolicy="no-referrer" />
            ) : <span className="flex size-13 items-center justify-center rounded-[14px] bg-muted"><UserRound className="size-6" /></span>}
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-energy text-black ring-3 ring-card"><Check className="size-2.5" /></span>
          </div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Connected</p><h3 className="mt-1 truncate text-lg font-semibold tracking-[-0.03em]">{account.name || "Google account"}</h3><p className="mt-0.5 truncate text-xs text-muted-foreground">{account.email}</p><div className="mt-2 flex flex-wrap gap-1.5"><Badge className="border border-black/[0.06] bg-muted/55 px-2.5 py-1 text-[9px] font-medium text-foreground shadow-none dark:border-white/[0.08]">{account.sheetsAuthorized ? <Check className="mr-1 size-2.5" /> : <KeyRound className="mr-1 size-2.5" />}Sheets {account.sheetsAuthorized ? "authorized" : "needs access"}</Badge><Badge className="border border-black/[0.06] bg-muted/55 px-2.5 py-1 text-[9px] font-medium text-foreground shadow-none dark:border-white/[0.08]">Drive {account.driveAuthorized ? "authorized" : "needs access"}</Badge></div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {!account.sheetsAuthorized ? <Button type="button" className="h-11 text-xs" disabled={busy} onClick={() => void connect()}>{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}Reauthorize</Button> : <div className="flex h-11 items-center justify-center rounded-[14px] border border-energy/30 bg-energy/12 text-xs font-medium"><span className="mr-2 size-2 rounded-full bg-energy" />Ready to sync</div>}
          <Button type="button" variant="outline" className="h-11 text-xs" disabled={busy} onClick={() => void disconnect()}>{busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}Sign out</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-black/[0.065] bg-card p-5 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]">
      <div className="flex items-start gap-3.5"><span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted"><GoogleMark className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cloud account</p><h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Connect Google</h3><p className="mt-1.5 text-xs leading-5 text-muted-foreground">Use your own Google Drive and Sheets for decks, templates, and study history.</p></div></div>
      <Button type="button" className="mt-5 h-12 w-full text-xs" disabled={busy} onClick={() => void connect()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <GoogleMark />}Continue with Google</Button>
    </div>
  )
}
