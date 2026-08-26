"use client"

import { useEffect, useRef, useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { Check, KeyRound, LoaderCircle, LogOut, ShieldAlert, Sparkles, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type AccountState =
  | { phase: "loading" }
  | { phase: "unconfigured"; issue: string }
  | { phase: "signed-out" }
  | {
      phase: "signed-in"
      name: string | null
      email: string
      image?: string | null
      sheetsAuthorized: boolean
      driveAuthorized: boolean
    }
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

export function GoogleAccountPanel({
  onReadyChange,
}: {
  onReadyChange?: (ready: boolean | undefined) => void
}) {
  const [account, setAccount] = useState<AccountState>({ phase: "loading" })
  const [busy, setBusy] = useState(false)
  const onReadyChangeRef = useRef(onReadyChange)

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange
  }, [onReadyChange])

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const response = await fetch("/api/auth/account", { cache: "no-store" })
        const data = await response.json().catch(() => null) as {
          configured?: boolean
          authenticated?: boolean
          sheetsAuthorized?: boolean
          driveAuthorized?: boolean
          issue?: string
          user?: { name?: string | null; email?: string | null; image?: string | null }
        } | null

        if (cancelled) return

        if (data?.authenticated && data.user?.email) {
          onReadyChangeRef.current?.(data.sheetsAuthorized === true)
          setAccount({
            phase: "signed-in",
            name: data.user.name ?? null,
            email: data.user.email,
            image: data.user.image ?? null,
            sheetsAuthorized: data.sheetsAuthorized === true,
            driveAuthorized: data.driveAuthorized === true,
          })
          return
        }

        if (data && !data.configured) {
          onReadyChangeRef.current?.(undefined)
          setAccount({ phase: "unconfigured", issue: data.issue ?? "Google OAuth 尚未配置" })
        } else {
          onReadyChangeRef.current?.(false)
          setAccount({ phase: "signed-out" })
        }
      } catch {
        if (cancelled) return
        onReadyChangeRef.current?.(undefined)
        setAccount({ phase: "error", issue: "无法读取 Google 帐号状态" })
      }
    }

    void refresh()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const connect = async () => {
    setBusy(true)
    try {
      await signIn("google", { callbackUrl: window.location.href })
    } catch (error) {
      console.error("NextAuth sign in error:", error)
      setAccount({ phase: "error", issue: "无法启动 Google 登录，请重试" })
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
      setAccount({ phase: "error", issue: "无法退出 Google 帐号" })
    } finally {
      setBusy(false)
    }
  }

  if (account.phase === "loading") {
    return (
      <div className="flex min-h-28 items-center justify-center rounded-[2rem] bg-[#dff1ff] p-5 text-sm font-bold text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]">
        <LoaderCircle className="mr-2.5 size-4 animate-spin" />
        正在读取 Google 帐号…
      </div>
    )
  }

  if (account.phase === "unconfigured" || account.phase === "error") {
    return (
      <div className="relative overflow-hidden rounded-[2rem] bg-[#ffe39a] p-5 text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]">
        <div className="pointer-events-none absolute -right-9 -top-9 size-28 rounded-[44%_56%_59%_41%/52%_45%_55%_48%] bg-[#ffc7b8] opacity-80 dark:bg-[#64362d]" aria-hidden="true" />
        <div className="relative z-10 flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[1.15rem] bg-white/55 dark:bg-black/15">
            <ShieldAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-45">google account</p>
            <h3 className="mt-1 text-lg font-black tracking-[-0.04em]">
              {account.phase === "unconfigured" ? "OAuth 尚未配置" : "登录遇到问题"}
            </h3>
            <p className="mt-1.5 text-xs font-semibold leading-5 opacity-60">{account.issue}</p>
          </div>
        </div>
        {account.phase === "error" ? (
          <Button
            type="button"
            className="mt-4 h-11 w-full bg-black text-xs font-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
            disabled={busy}
            onClick={() => void connect()}
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <GoogleMark />}
            重新尝试 Google 登录
          </Button>
        ) : null}
      </div>
    )
  }

  if (account.phase === "signed-in") {
    return (
      <div className="relative overflow-hidden rounded-[2rem] bg-[#d8f4aa] p-4 text-[#315f18] shadow-[0_20px_56px_-44px_rgba(0,0,0,0.7)] dark:bg-[#385528] dark:text-[#e4f8c5] sm:p-5">
        <div className="pointer-events-none absolute -right-10 -bottom-12 size-32 rounded-[55%_45%_48%_52%/46%_56%_44%_54%] bg-[#9dceff] opacity-75 dark:bg-[#244d74]" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="relative shrink-0">
            {account.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.image}
                alt={account.name || "Google 头像"}
                className="size-14 rounded-[1.3rem] border-4 border-white/65 object-cover shadow-sm dark:border-black/15"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-[1.3rem] bg-white/55 dark:bg-black/15">
                <UserRound className="size-6" />
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-black text-white ring-3 ring-[#d8f4aa] dark:bg-white dark:text-black dark:ring-[#385528]">
              <Check className="size-3" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-45">connected</p>
            <h3 className="mt-0.5 truncate text-xl font-black tracking-[-0.045em]">{account.name || "Google 帐号"}</h3>
            <p className="mt-0.5 truncate text-xs font-semibold opacity-55">{account.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className="border-0 bg-white/55 px-2.5 py-1 text-[9px] font-black text-current shadow-none dark:bg-black/15">
                {account.sheetsAuthorized ? <Check className="mr-1 size-2.5" /> : <KeyRound className="mr-1 size-2.5" />}
                Sheets {account.sheetsAuthorized ? "已授权" : "待授权"}
              </Badge>
              <Badge className="border-0 bg-white/55 px-2.5 py-1 text-[9px] font-black text-current shadow-none dark:bg-black/15">
                Drive {account.driveAuthorized ? "已授权" : "待授权"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          {!account.sheetsAuthorized ? (
            <Button
              type="button"
              className="h-11 bg-black text-xs font-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
              重新授权
            </Button>
          ) : (
            <div className="flex h-11 items-center justify-center rounded-full bg-white/45 text-xs font-black dark:bg-black/15">
              <Sparkles className="mr-1.5 size-3.5" />可以同步
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11 bg-white/45 text-xs font-black text-current hover:bg-white/70 hover:text-current dark:bg-black/15 dark:hover:bg-black/25"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
            退出帐号
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-[#dff1ff] p-5 text-[#174f85] shadow-[0_20px_56px_-44px_rgba(0,0,0,0.7)] dark:bg-[#244d74] dark:text-[#dceeff]">
      <div className="pointer-events-none absolute -right-8 -top-10 flex size-32 items-end justify-start rounded-[44%_56%_58%_42%/57%_43%_57%_43%] bg-[#ffe39a] p-7 dark:bg-[#68551f]" aria-hidden="true">
        <GoogleMark className="size-7" />
      </div>
      <div className="relative z-10 max-w-[72%]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-45">cloud account</p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.055em]">连接 Google</h3>
        <p className="mt-2 text-xs font-semibold leading-5 opacity-55">
          用你自己的 Google Drive 和 Sheets 保存卡包、模板和学习历史。
        </p>
      </div>
      <Button
        type="button"
        className="relative z-10 mt-5 h-12 w-full bg-black text-xs font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
        disabled={busy}
        onClick={() => void connect()}
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <GoogleMark />}
        使用 Google 登录
      </Button>
    </div>
  )
}
