"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Cloud,
  CloudOff,
  FileText,
  LoaderCircle,
  Settings2,
} from "lucide-react"

import {
  PATHS,
  PRIMARY_NAV,
  SETTINGS_ROWS,
  noteIdFromPath,
  primaryNavActive,
  tabBarVisible,
} from "@/lib/app-paths"
import { cn } from "@/lib/utils"

const NAV_ICONS = {
  study: BookOpen,
  notes: FileText,
  settings: Settings2,
} as const

type AppShellProps = {
  dueCount: number
  dirtyCount: number
  syncing: boolean
  syncUnavailable?: string
  deckName: string
  status?: string
  lockViewport?: boolean
  activePath?: string
  onSync: () => void
  onDeckClick: () => void
  onBack?: () => void
  children: ReactNode
}

const SYNC_ICON_DURATION_S = 0.15

function SyncIcon({ syncing, syncUnavailable }: { syncing: boolean; syncUnavailable?: string }) {
  const state = syncing ? "syncing" : syncUnavailable ? "unavailable" : "idle"
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={state}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: SYNC_ICON_DURATION_S }}
        className="flex"
      >
        {syncing ? (
          <LoaderCircle className="size-[18px] animate-spin" />
        ) : syncUnavailable ? (
          <CloudOff className="size-[18px] text-amber-300" />
        ) : (
          <Cloud className="size-[18px]" />
        )}
      </motion.span>
    </AnimatePresence>
  )
}

function headerMeta(pathname: string): { backHref?: string; title: string; showDeck: boolean } {
  if (pathname === PATHS.home || pathname === PATHS.notes) return { title: "", showDeck: true }
  if (noteIdFromPath(pathname)) return { backHref: PATHS.notes, title: "编辑笔记", showDeck: false }
  if (pathname === PATHS.settings) return { title: "设置", showDeck: false }
  if (pathname === PATHS.settingsTemplates) return { backHref: PATHS.settingsDeck, title: "模板", showDeck: false }
  if (pathname === PATHS.settingsDeck) return { backHref: PATHS.settings, title: "卡包", showDeck: false }
  const row = SETTINGS_ROWS.find((item) => item.href === pathname)
  if (row) return { backHref: PATHS.settings, title: row.label, showDeck: false }
  return { title: "", showDeck: false }
}

export function AppShell({
  dueCount,
  dirtyCount,
  syncing,
  syncUnavailable,
  deckName,
  status,
  lockViewport = false,
  activePath,
  onSync,
  onDeckClick,
  onBack,
  children,
}: AppShellProps) {
  const routerPathname = usePathname() ?? PATHS.home
  const pathname = activePath ?? routerPathname
  const router = useRouter()
  const showTabBar = tabBarVisible(pathname)
  const session = pathname === PATHS.studySession
  const lock = lockViewport || pathname === PATHS.notes || Boolean(noteIdFromPath(pathname))
  const header = headerMeta(pathname)
  const name = deckName.trim() || "未命名卡包"

  useEffect(() => {
    if (!lock) return
    const html = document.documentElement
    const { body } = document
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousOverscroll = body.style.overscrollBehavior
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"
    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousOverscroll
    }
  }, [lock])

  return (
    <div
      data-testid={lock ? "notes-shell" : undefined}
      className={cn(
        "flex flex-col bg-background text-foreground",
        lock ? "fixed inset-0 overflow-hidden overscroll-none" : "min-h-[100dvh]"
      )}
    >
      <AnimatePresence initial={false}>
        {status ? (
          <motion.div
            key="status-toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] mx-auto w-fit max-w-[min(30rem,calc(100vw-2rem))] rounded-full bg-foreground px-4 py-2.5 text-center text-xs font-semibold text-background shadow-xl"
          >
            {status}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!session ? (
        <header
          className={cn(
            "z-30 bg-background/88 pt-[env(safe-area-inset-top)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/76",
            lock ? "shrink-0" : "sticky top-0"
          )}
          aria-label="应用顶栏"
        >
          <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center gap-2 px-4 sm:h-20 sm:px-6">
            {header.backHref ? (
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-[0_10px_28px_-18px_rgba(0,0,0,0.5)] ring-1 ring-black/5 transition-transform active:scale-95 dark:ring-white/10"
                aria-label="返回"
                onClick={() => {
                  if (onBack) onBack()
                  else if (header.backHref) router.push(header.backHref)
                }}
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : null}

            {header.title ? (
              <h1 className="min-w-0 flex-1 text-[21px] font-black tracking-[-0.035em]">{header.title}</h1>
            ) : null}

            {header.showDeck ? (
              <button
                type="button"
                className="group flex min-w-0 flex-1 items-center text-left"
                onClick={onDeckClick}
              >
                <div className="min-w-0">
                  <span className="anki-wordmark block text-[22px] sm:text-[24px]">anki studio</span>
                  <span className="mt-1 flex max-w-[70vw] items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="truncate">{name}</span>
                    <ChevronDown className="size-3.5 shrink-0 transition-transform group-active:translate-y-0.5" />
                  </span>
                </div>
              </button>
            ) : null}

            {pathname === PATHS.notes || pathname === PATHS.home ? (
              <button
                type="button"
                className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[0_12px_26px_-16px_rgba(0,0,0,0.72)] transition-transform active:scale-95 disabled:opacity-60"
                disabled={syncing}
                aria-label={
                  syncing ? "正在同步" : dirtyCount > 0 ? `${dirtyCount} 个待同步` : syncUnavailable || "立即同步"
                }
                onClick={onSync}
              >
                <SyncIcon syncing={syncing} syncUnavailable={syncUnavailable} />
                {dirtyCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-foreground bg-pastel-yellow" />
                ) : null}
              </button>
            ) : null}
          </div>
        </header>
      ) : null}

      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          lock && "overflow-hidden",
          session
            ? "p-0"
            : lock
              ? "px-4 pb-3 pt-1 sm:px-6"
              : showTabBar
                ? "px-4 pb-28 pt-1 sm:px-6 sm:pt-3"
                : "px-4 py-4 sm:px-6 sm:py-6"
        )}
      >
        {children}
      </main>

      {showTabBar ? (
        <div
          className={cn(
            "pointer-events-none z-50 px-3",
            lock
              ? "shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              : "fixed inset-x-0 bottom-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          )}
        >
          <nav
            className="pointer-events-auto mx-auto grid max-w-md grid-cols-3 rounded-[28px] bg-[#fffdf9]/95 p-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.42)] ring-1 ring-black/5 backdrop-blur-2xl dark:bg-card/95 dark:ring-white/10"
            aria-label="主要导航"
          >
            {PRIMARY_NAV.map((item) => {
              const Icon = NAV_ICONS[item.id]
              const selected = primaryNavActive(pathname, item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-semibold transition-all",
                    selected
                      ? "bg-foreground text-background shadow-sm"
                      : "text-foreground/45 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
                  )}
                  aria-current={selected ? "page" : undefined}
                >
                  <Icon className="size-[18px]" />
                  <span>{item.label}</span>
                  {item.id === "study" && dueCount > 0 ? (
                    <span
                      className={cn(
                        "absolute right-[20%] top-1 flex min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] leading-4",
                        selected ? "bg-pastel-yellow text-black" : "bg-foreground text-background"
                      )}
                    >
                      {dueCount > 99 ? "99+" : dueCount}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>
      ) : null}
    </div>
  )
}
