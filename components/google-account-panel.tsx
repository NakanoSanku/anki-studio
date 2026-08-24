"use client"

import { useEffect, useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { Check, KeyRound, LoaderCircle, LogOut, ShieldAlert, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type AccountState =
  | { phase: "loading" }
  | { phase: "unconfigured"; issue: string }
  | { phase: "signed-out" }
  | { phase: "signed-in"; name: string | null; email: string; sheetsAuthorized: boolean }
  | { phase: "error"; issue: string }

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
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

  useEffect(() => {
    let cancelled = false
    void fetch("/api/auth/account", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as {
          configured?: boolean
          authenticated?: boolean
          sheetsAuthorized?: boolean
          issue?: string
          user?: { name?: string | null; email?: string | null }
        }
        if (cancelled) return
        if (!data.configured) {
          onReadyChange?.(undefined)
          setAccount({ phase: "unconfigured", issue: data.issue ?? "Google OAuth 尚未配置" })
        } else if (data.authenticated && data.user?.email) {
          onReadyChange?.(data.sheetsAuthorized === true)
          setAccount({
            phase: "signed-in",
            name: data.user.name ?? null,
            email: data.user.email,
            sheetsAuthorized: data.sheetsAuthorized === true,
          })
        } else if (response.ok) {
          onReadyChange?.(false)
          setAccount({ phase: "signed-out" })
        } else {
          onReadyChange?.(undefined)
          setAccount({ phase: "error", issue: data.issue ?? "无法读取 Google 帐号状态" })
        }
      })
      .catch(() => {
        if (!cancelled) {
          onReadyChange?.(undefined)
          setAccount({ phase: "error", issue: "无法读取 Google 帐号状态" })
        }
      })
    return () => {
      cancelled = true
    }
  }, [onReadyChange])

  const connect = async () => {
    setBusy(true)
    try {
      await signIn("google", { callbackUrl: "/settings/sync" })
    } catch {
      setAccount({ phase: "error", issue: "无法启动 Google 登录" })
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await signOut({ callbackUrl: "/settings/sync" })
    } catch {
      setAccount({ phase: "error", issue: "无法退出 Google 帐号" })
    } finally {
      setBusy(false)
    }
  }

  if (account.phase === "loading") {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-xl border border-border/70 bg-muted/25 text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        正在读取 Google 帐号…
      </div>
    )
  }

  if (account.phase === "unconfigured" || account.phase === "error") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Google 帐号暂不可连接</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{account.issue}</p>
        </div>
      </div>
    )
  }

  if (account.phase === "signed-in") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{account.name || "Google 帐号"}</p>
            {account.sheetsAuthorized ? (
              <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300">
                <Check className="size-3" />表格已授权
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-300">
                <KeyRound className="size-3" />需要表格权限
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!account.sheetsAuthorized ? (
            <Button type="button" disabled={busy} onClick={() => void connect()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              授权表格
            </Button>
          ) : null}
          <Button type="button" variant="outline" disabled={busy} onClick={() => void disconnect()}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            退出登录
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border/70">
        <GoogleMark />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">连接 Google 帐号</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          登录并授权后，可从 Google Picker 选择自己的表格；本机编辑和学习不受影响。
        </p>
      </div>
      <Button type="button" disabled={busy} onClick={() => void connect()}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <GoogleMark />}
        使用 Google 登录
      </Button>
    </div>
  )
}
