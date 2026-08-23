"use client"

import type { ReactNode } from "react"
import {
  BookOpen,
  Cloud,
  CloudOff,
  FileText,
  Layers3,
  LoaderCircle,
  Settings2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type StudioView = "study" | "notes" | "templates" | "settings"

type StudioShellProps = {
  view: StudioView
  dueCount: number
  dirtyCount: number
  syncing: boolean
  syncUnavailable?: string
  studySessionActive?: boolean
  studyImmersive?: boolean
  title: string
  status?: string
  onViewChange: (view: StudioView) => void
  onSync: () => void
  children: ReactNode
}

const NAV_ITEMS = [
  { id: "study", label: "学习", icon: BookOpen },
  { id: "notes", label: "笔记", icon: FileText },
  { id: "templates", label: "模板", icon: Layers3 },
  { id: "settings", label: "设置", icon: Settings2 },
] as const

function BrandMark() {
  return (
    <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
      <span className="absolute h-3.5 w-4 translate-x-0.5 -translate-y-0.5 rounded-[4px] border border-current opacity-45" />
      <span className="absolute h-3.5 w-4 -translate-x-0.5 translate-y-0.5 rounded-[4px] border border-current" />
    </span>
  )
}

function SyncIcon({ syncing, syncUnavailable }: { syncing: boolean; syncUnavailable?: string }) {
  if (syncing) return <LoaderCircle className="size-4 animate-spin" />
  if (syncUnavailable) return <CloudOff className="size-4 text-amber-600" />
  return <Cloud className="size-4 text-emerald-600" />
}

function FocusRail({
  view,
  dueCount,
  dirtyCount,
  syncing,
  syncUnavailable,
  onViewChange,
  onSync,
}: Pick<
  StudioShellProps,
  | "view"
  | "dueCount"
  | "dirtyCount"
  | "syncing"
  | "syncUnavailable"
  | "onViewChange"
  | "onSync"
>) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center justify-center">
        <BrandMark />
      </div>

      <Separator className="mt-1 mb-4 w-9" />

      <nav className="flex flex-col gap-2" aria-label="主要导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const selected = item.id === view
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-lg"
                  variant="ghost"
                  className={cn(
                    "relative rounded-xl text-muted-foreground",
                    selected && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--primary)] hover:bg-sidebar-accent"
                  )}
                  aria-label={item.label}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onViewChange(item.id)}
                >
                  <Icon className="size-[18px]" />
                  {item.id === "study" && dueCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] leading-4 text-primary-foreground">
                      {dueCount > 99 ? "99+" : dueCount}
                    </span>
                  ) : null}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <div className="mt-auto pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-lg"
              variant="ghost"
              className="relative rounded-xl"
              disabled={syncing}
              aria-label={syncing ? "正在同步" : "立即同步"}
              onClick={onSync}
            >
              <SyncIcon syncing={syncing} syncUnavailable={syncUnavailable} />
              {dirtyCount > 0 ? (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500" />
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {syncing ? "正在同步" : dirtyCount > 0 ? `${dirtyCount} 个待同步` : syncUnavailable || "已保存到云端"}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  )
}

export function StudioShell({
  view,
  dueCount,
  dirtyCount,
  syncing,
  syncUnavailable,
  studySessionActive = false,
  studyImmersive = false,
  title,
  status,
  onViewChange,
  onSync,
  children,
}: StudioShellProps) {
  const activeStudy = view === "study" && studySessionActive

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {activeStudy ? (
        studyImmersive ? null : (
          <FocusRail
            view={view}
            dueCount={dueCount}
            dirtyCount={dirtyCount}
            syncing={syncing}
            syncUnavailable={syncUnavailable}
            onViewChange={onViewChange}
            onSync={onSync}
          />
        )
      ) : (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex h-18 items-center gap-3 px-5">
            <BrandMark />
            <div>
              <p className="font-semibold tracking-tight">Anki Studio</p>
              <p className="text-[11px] text-muted-foreground">专注、生成、记住</p>
            </div>
          </div>

          <nav className="mt-3 flex flex-col gap-1 px-3" aria-label="主要导航">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const selected = item.id === view
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "h-10 justify-start gap-3 rounded-xl px-3 text-muted-foreground",
                    selected && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--primary)] hover:bg-sidebar-accent"
                  )}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onViewChange(item.id)}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.id === "study" && dueCount > 0 ? (
                    <Badge className="ml-auto min-w-6 justify-center px-1.5" variant={selected ? "default" : "secondary"}>
                      {dueCount > 99 ? "99+" : dueCount}
                    </Badge>
                  ) : null}
                </Button>
              )
            })}
          </nav>

          <div className="mt-auto p-3">
            <Separator className="mb-3" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2 text-left"
                  disabled={syncing}
                  onClick={onSync}
                >
                  <SyncIcon syncing={syncing} syncUnavailable={syncUnavailable} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">
                      {syncing ? "正在同步" : dirtyCount > 0 ? `${dirtyCount} 个待同步` : syncUnavailable ? "仅保存在本机" : "已保存到云端"}
                    </span>
                    <span className="block truncate text-[10px] font-normal text-muted-foreground">
                      点击立即同步
                    </span>
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{syncUnavailable || "同步卡包、模板与学习记录"}</TooltipContent>
            </Tooltip>
          </div>
        </aside>
      )}

      <div
        className={cn(
          "min-h-[100dvh] transition-[padding] duration-300 motion-reduce:transition-none",
          activeStudy ? (studyImmersive ? "lg:pl-0" : "lg:pl-20") : "lg:pl-60"
        )}
      >
        {status ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-3 left-1/2 z-[70] max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-full border border-border/70 bg-popover/95 px-4 py-2 text-center text-xs text-popover-foreground shadow-lg backdrop-blur"
          >
            {status}
          </div>
        ) : null}

        {!activeStudy ? (
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-xl" aria-label="应用顶栏">
            <div className="flex h-14 items-center px-4 sm:h-16 sm:px-6 lg:h-18 lg:px-8">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
            </div>
          </header>
        ) : null}

        <main
          className={cn(
            activeStudy
              ? "min-h-[100dvh] p-0"
              : "px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:pb-8"
          )}
        >
          {children}
        </main>
      </div>

      {!activeStudy ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-border/80 bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_-24px_rgba(28,25,23,0.6)] backdrop-blur-xl lg:hidden"
          aria-label="移动端导航"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const selected = item.id === view
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] text-muted-foreground",
                  selected && "bg-primary/8 font-medium text-primary"
                )}
                aria-current={selected ? "page" : undefined}
                onClick={() => onViewChange(item.id)}
              >
                <Icon className="size-[18px]" />
                <span>{item.label}</span>
                {item.id === "study" && dueCount > 0 ? (
                  <span className="absolute top-1 left-1/2 ml-2 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] leading-4 text-primary-foreground">
                    {dueCount > 99 ? "99+" : dueCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      ) : null}
    </div>
  )
}
