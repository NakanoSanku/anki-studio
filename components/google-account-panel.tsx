"use client"

import { useEffect, useRef, useState } from "react"
import { Check, KeyRound, LoaderCircle, LogOut, ShieldAlert, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatAuthError,
  getCachedAccessToken,
  getCachedGoogleUser,
  googleSignIn,
  googleSignOut,
  initFirebaseAuth,
  isFirebaseConfigured,
  subscribeAuth,
} from "@/lib/firebase-auth"

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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.93A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.35 2.62C7.19 7.7 9.4 5.94 12 5.94Z" />
    </svg>
  )
}

function getInitialAccountState(): AccountState {
  if (typeof window === "undefined") return { phase: "loading" }
  const user = getCachedGoogleUser()
  const token = getCachedAccessToken()
  if (user) {
    return {
      phase: "signed-in",
      name: user.name,
      email: user.email,
      image: user.image,
      sheetsAuthorized: Boolean(token),
      driveAuthorized: Boolean(token),
    }
  }
  return { phase: "loading" }
}

export function GoogleAccountPanel({
  onReadyChange,
}: {
  onReadyChange?: (ready: boolean | undefined) => void
}) {
  const [account, setAccount] = useState<AccountState>(getInitialAccountState)
  const [busy, setBusy] = useState(false)
  const onReadyChangeRef = useRef(onReadyChange)

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange
  }, [onReadyChange])

  useEffect(() => {
    let active = true

    const syncState = async () => {
      // 1. Check client-side cached user and token
      const user = getCachedGoogleUser()
      const token = getCachedAccessToken()
      if (user) {
        if (active) {
          onReadyChangeRef.current?.(Boolean(token))
          setAccount({
            phase: "signed-in",
            name: user.name,
            email: user.email,
            image: user.image,
            sheetsAuthorized: Boolean(token),
            driveAuthorized: Boolean(token),
          })
        }
        return
      }

      // If Firebase is configured, client popup auth is authoritative
      if (isFirebaseConfigured()) {
        const fbUser = getCurrentFirebaseUser()
        if (fbUser && fbUser.email) {
          if (active) {
            onReadyChangeRef.current?.(Boolean(token))
            setAccount({
              phase: "signed-in",
              name: fbUser.displayName ?? null,
              email: fbUser.email,
              image: fbUser.photoURL ?? null,
              sheetsAuthorized: Boolean(token),
              driveAuthorized: Boolean(token),
            })
          }
          return
        }
        if (active) {
          onReadyChangeRef.current?.(false)
          setAccount({ phase: "signed-out" })
        }
        return
      }

      // 2. Server-side NextAuth fallback (if Firebase not configured)
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

        if (!active) return

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
        if (!active) return
        onReadyChangeRef.current?.(undefined)
        setAccount({ phase: "error", issue: "无法读取 Google 帐号状态" })
      }
    }

    initFirebaseAuth(
      (fbUser, token) => {
        if (active && fbUser.email) {
          onReadyChangeRef.current?.(Boolean(token))
          setAccount({
            phase: "signed-in",
            name: fbUser.displayName ?? null,
            email: fbUser.email,
            image: fbUser.photoURL ?? null,
            sheetsAuthorized: Boolean(token),
            driveAuthorized: Boolean(token),
          })
        }
      },
      () => {
        if (active) void syncState()
      }
    )

    const unsubscribe = subscribeAuth(() => {
      if (active) void syncState()
    })

    void syncState()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const connect = async (options?: { redirect?: boolean }) => {
    setBusy(true)
    try {
      const res = await googleSignIn(options)
      const user = res.user || getCurrentFirebaseUser()
      const token = res.accessToken || getCachedAccessToken()
      if (user && user.email) {
        onReadyChangeRef.current?.(Boolean(token))
        setAccount({
          phase: "signed-in",
          name: user.displayName ?? null,
          email: user.email,
          image: user.photoURL ?? null,
          sheetsAuthorized: Boolean(token),
          driveAuthorized: Boolean(token),
        })
      }
    } catch (error) {
      console.error("Google sign-in error:", error)
      const issue = formatAuthError(error)
      setAccount({
        phase: "error",
        issue,
      })
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await googleSignOut()
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
      <div className="flex min-h-20 items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground backdrop-blur-xs">
        <LoaderCircle className="mr-2.5 size-4 animate-spin text-primary" />
        正在读取 Google 帐号状态…
      </div>
    )
  }

  if (account.phase === "unconfigured" || account.phase === "error") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-50/50 p-4 backdrop-blur-xs dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {account.phase === "unconfigured" ? "Google OAuth 尚未配置" : "登录提示"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{account.issue}</p>
          </div>
        </div>
        {account.phase === "error" ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-xl px-3 text-xs font-medium"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : null}
              重新尝试登录
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl px-3 text-xs font-medium"
              disabled={busy}
              onClick={() => void connect({ redirect: true })}
            >
              使用页面跳转登录 (重定向模式)
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  if (account.phase === "signed-in") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs sm:p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            {account.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.image}
                alt={account.name || "Google 头像"}
                className="size-10 rounded-full border border-border/80 object-cover shadow-xs sm:size-11"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-11">
                <UserRound className="size-5" />
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-emerald-500 sm:size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{account.name || "Google 帐号"}</p>
              {account.sheetsAuthorized ? (
                <Badge variant="outline" className="hidden shrink-0 border-emerald-500/30 bg-emerald-50/50 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 xs:inline-flex">
                  <Check className="mr-0.5 size-2.5" />已授权
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 border-amber-500/30 bg-amber-50/50 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <KeyRound className="mr-0.5 size-2.5" />未授权
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!account.sheetsAuthorized ? (
            <Button
              type="button"
              size="sm"
              className="h-8.5 rounded-xl px-2.5 text-xs font-medium"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5 sm:mr-1" />}
              <span className="hidden sm:inline">重新授权</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            disabled={busy}
            onClick={() => void disconnect()}
            title="退出登录"
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <LogOut className="size-3.5 sm:mr-1" />}
            <span className="hidden sm:inline">退出登录</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted/60 border border-border/60 shadow-xs">
          <GoogleMark />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Google 帐号云同步</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            连接后自动双向同步闪卡、模板与学习历史
          </p>
        </div>
      </div>
      <Button
        type="button"
        className="h-10 min-h-[42px] rounded-xl px-4 text-xs font-semibold shadow-xs"
        disabled={busy}
        onClick={() => void connect()}
      >
        {busy ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <span className="mr-2"><GoogleMark /></span>}
        使用 Google 登录
      </Button>
    </div>
  )
}

