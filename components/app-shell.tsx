"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
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
  onSync: () => void
  onDeckClick: () => void
  children: ReactNode
}

function SyncIcon({ syncing, syncUnavailable }: { syncing: boolean; syncUnavailable?: string }) {
  if (syncing) return <LoaderCircle className="size-4 animate-spin" />
  if (syncUnavailable) return <CloudOff className="size-4 text-amber-600" />
  return <Cloud className="size-4" />
}

function headerMeta(pathname: string): { backHref?: string; title: string; showDeck: boolean } {
  if (pathname === PATHS.home || pathname === PATHS.notes) {
    return { title: "", showDeck: true }
  }
  if (noteIdFromPath(pathname)) {
    return { backHref: PATHS.notes, title: "笔记", showDeck: false }
  }
  if (pathname === PATHS.settings) {
    return { title: "设置", showDeck: false }
  }
  const row = SETTINGS_ROWS.find((item) => item.href === pathname)
  if (row) {
    return { backHref: PATHS.settings, title: row.label, showDeck: false }
  }
  return { title: "", showDeck: true }
}

export function AppShell({
  dueCount,
  dirtyCount,
  syncing,
  syncUnavailable,
  deckName,
  status,
  onSync,
  onDeckClick,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? PATHS.home
  const router = useRouter()
  const showTabBar = tabBarVisible(pathname)
  const session = pathname === PATHS.studySession
  const header = headerMeta(pathname)
  const name = deckName.trim() || "未命名卡包"

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {status ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 z-[70] max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-full border border-border/70 bg-popover/95 px-4 py-2 text-center text-xs text-popover-foreground shadow-lg"
        >
          {status}
        </div>
      ) : null}

      {!session ? (
        <header
          className="sticky top-0 z-30 border-b border-border/80 bg-background/95 pt-[env(safe-area-inset-top)]"
          aria-label="应用顶栏"
        >
          <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:px-4">
            {header.backHref ? (
              <button
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground"
                aria-label="返回"
                onClick={() => router.push(header.backHref!)}
              >
                <ChevronLeft className="size-5" />
              </button>
            ) : null}

            {header.showDeck ? (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-base font-semibold tracking-tight"
                onClick={onDeckClick}
              >
                {name}
              </button>
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{header.title}</h1>
            )}

            {header.showDeck || pathname === PATHS.notes || pathname === PATHS.home ? (
              <button
                type="button"
                className="relative flex size-10 shrink-0 items-center justify-center rounded-full"
                disabled={syncing}
                aria-label={syncing ? "正在同步" : dirtyCount > 0 ? `${dirtyCount} 个待同步` : syncUnavailable || "立即同步"}
                onClick={onSync}
              >
                <SyncIcon syncing={syncing} syncUnavailable={syncUnavailable} />
                {dirtyCount > 0 ? (
                  <span className="absolute top-2 right-2 size-1.5 rounded-full bg-amber-500" />
                ) : null}
              </button>
            ) : null}
          </div>
        </header>
      ) : null}

      <main className={cn(session ? "p-0" : showTabBar ? "px-4 py-5 pb-28 sm:px-6" : "px-4 py-5 sm:px-6")}>
        {children}
      </main>

      {showTabBar ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border/80 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
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
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] text-muted-foreground",
                  selected && "font-medium text-foreground"
                )}
                aria-current={selected ? "page" : undefined}
              >
                <Icon className="size-[18px]" />
                <span>{item.label}</span>
                {item.id === "study" && dueCount > 0 ? (
                  <span className="absolute top-1 left-1/2 ml-2 flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[9px] leading-4 text-background">
                    {dueCount > 99 ? "99+" : dueCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      ) : null}
    </div>
  )
}
