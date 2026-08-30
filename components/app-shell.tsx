"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
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
import { productStatusMessage } from "@/lib/product-copy"
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

type HeaderMeta = {
  backHref?: string
  title: string
  primary: boolean
}

const SYNC_ICON_DURATION_S = 0.15
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable=true], .cm-content"
const AppHeaderActionContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null)

export function useAppHeaderAction(action: ReactNode) {
  const setHeaderAction = useContext(AppHeaderActionContext)

  useEffect(() => {
    if (!setHeaderAction) return
    setHeaderAction(action)
    return () => setHeaderAction(null)
  }, [action, setHeaderAction])
}

function StudioMark() {
  return (
    <span
      data-testid="studio-mark"
      aria-hidden="true"
      className="relative flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-foreground text-background shadow-[0_12px_28px_-20px_rgba(0,0,0,0.85)]"
    >
      <svg viewBox="0 0 32 32" className="size-6" fill="none">
        <rect
          x="5.5"
          y="7.5"
          width="13"
          height="17"
          rx="3.5"
          transform="rotate(-8 12 16)"
          className="stroke-background/55"
          strokeWidth="2"
        />
        <rect x="12.5" y="7.5" width="13" height="17" rx="3.5" className="fill-background" />
        <path
          d="M16.5 12.5h5M16.5 16h5M16.5 19.5h3"
          className="stroke-foreground"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-[3px] border-background bg-energy" />
    </span>
  )
}

function SyncIcon({ syncing, syncUnavailable }: { syncing: boolean; syncUnavailable?: string }) {
  const state = syncing ? "syncing" : syncUnavailable ? "unavailable" : "idle"
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={state}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: SYNC_ICON_DURATION_S }}
        className="flex"
      >
        {syncing ? (
          <LoaderCircle className="size-[17px] animate-spin" />
        ) : syncUnavailable ? (
          <CloudOff className="size-[17px] text-amber-500" />
        ) : (
          <Cloud className="size-[17px]" />
        )}
      </motion.span>
    </AnimatePresence>
  )
}

function headerMeta(pathname: string): HeaderMeta {
  if (pathname === PATHS.home) return { title: "Study", primary: true }
  if (pathname === PATHS.notes) return { title: "Notes", primary: true }
  if (pathname === PATHS.settings) return { title: "Settings", primary: true }
  if (noteIdFromPath(pathname)) return { backHref: PATHS.notes, title: "Edit note", primary: false }
  if (pathname === PATHS.settingsTemplates) return { backHref: PATHS.settingsDeck, title: "Templates", primary: false }
  if (pathname === PATHS.settingsDeck) return { backHref: PATHS.settings, title: "Deck", primary: false }
  const row = SETTINGS_ROWS.find((item) => item.href === pathname)
  if (row) return { backHref: PATHS.settings, title: row.label, primary: false }
  return { title: "", primary: false }
}

function viewName(pathname: string) {
  if (pathname === PATHS.studySession) return "study-session"
  if (noteIdFromPath(pathname)) return "note-detail"
  if (pathname === PATHS.notes) return "notes"
  if (pathname === PATHS.home) return "home"
  if (pathname === PATHS.settingsTemplates) return "templates"
  if (pathname === PATHS.settingsDeck) return "settings-deck"
  if (pathname === PATHS.settingsStudy) return "settings-study"
  if (pathname === PATHS.settingsAi) return "settings-ai"
  if (pathname === PATHS.settingsSync) return "settings-sync"
  if (pathname === PATHS.settings) return "settings"
  return "other"
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
  const noteDetail = Boolean(noteIdFromPath(pathname))
  const lock = lockViewport || pathname === PATHS.notes || noteDetail
  const header = headerMeta(pathname)
  const name = deckName.trim() || "Untitled deck"
  const view = viewName(pathname)
  const shownStatus = productStatusMessage(status)
  const shownSyncUnavailable = syncUnavailable ? productStatusMessage(syncUnavailable) : undefined
  const [softKeyboardActive, setSoftKeyboardActive] = useState(false)
  const [headerAction, setHeaderAction] = useState<ReactNode>(null)
  const showBottomNavigation = showTabBar && !softKeyboardActive
  const previousPathRef = useRef(pathname)
  const noteReturnPathRef = useRef<typeof PATHS.home | typeof PATHS.notes>(PATHS.notes)

  useEffect(() => {
    if (noteDetail) {
      const previous = previousPathRef.current
      if (previous === PATHS.home || previous === PATHS.notes) {
        noteReturnPathRef.current = previous
      }
    }
    previousPathRef.current = pathname
  }, [noteDetail, pathname])

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

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)")
    const visualViewport = window.visualViewport

    const update = () => {
      const active = document.activeElement as HTMLElement | null
      const editing = Boolean(active?.matches(EDITABLE_SELECTOR) || active?.closest(EDITABLE_SELECTOR))
      const viewportCompressed = visualViewport
        ? visualViewport.height < window.innerHeight - 96
        : false
      setSoftKeyboardActive(coarsePointer.matches && editing && (viewportCompressed || document.hasFocus()))
    }

    const onFocusOut = () => window.setTimeout(update, 0)
    update()
    document.addEventListener("focusin", update)
    document.addEventListener("focusout", onFocusOut)
    visualViewport?.addEventListener("resize", update)
    visualViewport?.addEventListener("scroll", update)
    coarsePointer.addEventListener("change", update)
    return () => {
      document.removeEventListener("focusin", update)
      document.removeEventListener("focusout", onFocusOut)
      visualViewport?.removeEventListener("resize", update)
      visualViewport?.removeEventListener("scroll", update)
      coarsePointer.removeEventListener("change", update)
    }
  }, [])

  const goBack = () => {
    if (noteDetail) {
      router.replace(noteReturnPathRef.current)
      return
    }
    if (onBack) {
      onBack()
      return
    }
    if (header.backHref) router.push(header.backHref)
  }

  return (
    <AppHeaderActionContext.Provider value={setHeaderAction}>
      <div
        data-testid={lock ? "notes-shell" : undefined}
        data-app-view={view}
        data-soft-keyboard={softKeyboardActive ? "active" : undefined}
        className={cn(
          "flex flex-col bg-background text-foreground",
          lock ? "fixed inset-0 overflow-hidden overscroll-none" : "min-h-[100dvh]"
        )}
      >
        <a
          href="#app-main"
          className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[90] -translate-y-24 rounded-[14px] bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-3 focus:ring-energy/50"
        >
          Skip to content
        </a>

        <AnimatePresence initial={false}>
          {shownStatus ? (
            <motion.div
              key="status-toast"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.65rem)] z-[70] mx-auto flex w-fit max-w-[min(30rem,calc(100vw-1.5rem))] items-center gap-2 rounded-[14px] border border-black/[0.07] bg-card/95 px-3.5 py-2.5 text-center text-xs font-semibold text-foreground shadow-[0_16px_36px_-24px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:inset-x-4 sm:top-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-white/[0.1]"
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-energy" />
              {shownStatus}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!session ? (
          <header
            data-header-mode={header.primary ? "primary" : "detail"}
            className={cn(
              "z-30 border-b border-black/[0.045] bg-background/92 pt-[env(safe-area-inset-top)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/82 dark:border-white/[0.07]",
              lock ? "shrink-0" : "sticky top-0"
            )}
            aria-label="App header"
          >
            <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center gap-2 px-3 min-[390px]:h-[72px] min-[390px]:gap-2.5 min-[390px]:px-4 sm:h-[76px] sm:px-6">
              {header.primary ? (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <StudioMark />
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground min-[390px]:text-[10px]">
                        Anki Studio
                      </p>
                      <h1
                        data-testid="header-section-title"
                        className="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.025em] min-[390px]:text-[17px]"
                      >
                        {header.title}
                      </h1>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="header-deck-switcher"
                    className="group flex h-9 min-w-0 max-w-[34vw] shrink items-center gap-1.5 rounded-[12px] border border-black/[0.065] bg-card px-2.5 text-left text-[11px] font-semibold text-foreground shadow-[0_10px_24px_-24px_rgba(0,0,0,0.5)] transition-[background-color,transform] hover:bg-muted/65 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-energy/45 min-[390px]:max-w-[40vw] min-[390px]:px-3 min-[390px]:text-xs sm:max-w-xs dark:border-white/[0.09]"
                    onClick={onDeckClick}
                    aria-label={`Switch deck. Current deck: ${name}`}
                  >
                    <span className="truncate">{name}</span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-active:translate-y-0.5" />
                  </button>

                  <button
                    type="button"
                    data-testid="header-sync"
                    className="relative flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-[14px] border border-black/[0.065] bg-card text-foreground transition-[background-color,transform] [-webkit-tap-highlight-color:transparent] hover:bg-muted/70 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-energy/45 disabled:opacity-50 dark:border-white/[0.09]"
                    disabled={syncing}
                    aria-label={
                      syncing ? "Syncing" : dirtyCount > 0 ? `${dirtyCount} changes waiting to sync` : shownSyncUnavailable || "Sync now"
                    }
                    onClick={onSync}
                  >
                    <SyncIcon syncing={syncing} syncUnavailable={shownSyncUnavailable} />
                    {dirtyCount > 0 ? (
                      <span className="absolute right-1 top-1 size-2.5 rounded-full border-2 border-card bg-energy min-[390px]:right-1.5 min-[390px]:top-1.5" />
                    ) : null}
                  </button>
                </>
              ) : (
                <>
                  {header.backHref ? (
                    <button
                      type="button"
                      className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-[14px] border border-black/[0.065] bg-card text-foreground transition-[background-color,transform] [-webkit-tap-highlight-color:transparent] hover:bg-muted/70 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-energy/45 dark:border-white/[0.09]"
                      aria-label="Back"
                      onClick={goBack}
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                  ) : null}

                  {header.title ? (
                    <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.03em] min-[390px]:text-[20px]">
                      {header.title}
                    </h1>
                  ) : <div className="flex-1" />}

                  {headerAction}
                </>
              )}
            </div>
          </header>
        ) : null}

        <main
          id="app-main"
          tabIndex={-1}
          className={cn(
            "flex min-h-0 flex-1 flex-col focus:outline-none",
            lock && "overflow-hidden",
            session
              ? "p-0"
              : lock
                ? "px-3 pb-2 pt-1 min-[390px]:px-4 min-[390px]:pb-3 sm:px-6"
                : showBottomNavigation
                  ? "px-3 pb-28 pt-2 min-[390px]:px-4 sm:px-6 sm:pt-4"
                  : "px-3 py-3 min-[390px]:px-4 min-[390px]:py-4 sm:px-6 sm:py-6"
          )}
        >
          {children}
        </main>

        {showBottomNavigation ? (
          <div
            className={cn(
              "pointer-events-none z-50 px-2.5 min-[390px]:px-3",
              lock
                ? "shrink-0 pb-[max(0.4rem,env(safe-area-inset-bottom))] min-[390px]:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
                : "fixed inset-x-0 bottom-0 pb-[max(0.4rem,env(safe-area-inset-bottom))] min-[390px]:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            )}
          >
            <nav
              className="pointer-events-auto mx-auto grid max-w-md grid-cols-3 rounded-[22px] border border-black/[0.065] bg-card/94 p-1.5 shadow-[0_18px_46px_-30px_rgba(0,0,0,0.35)] backdrop-blur-2xl min-[390px]:p-2 dark:border-white/[0.09] dark:bg-card/94"
              aria-label="Primary navigation"
            >
              {PRIMARY_NAV.map((item) => {
                const Icon = NAV_ICONS[item.id]
                const selected = primaryNavActive(pathname, item.href)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "relative flex min-h-11 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[16px] text-[10px] font-medium transition-[background-color,color,transform] duration-150 [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-energy/45 min-[390px]:min-h-12 min-[390px]:text-[11px]",
                      selected
                        ? "bg-foreground text-background"
                        : "text-foreground/45 hover:bg-muted/70 hover:text-foreground/70 active:scale-[0.98]"
                    )}
                    aria-current={selected ? "page" : undefined}
                  >
                    <Icon className="size-[17px] min-[390px]:size-[18px]" />
                    <span className="leading-none">{item.label}</span>
                    {item.id === "study" && dueCount > 0 ? (
                      <span className="absolute right-[18%] top-0.5 flex min-w-4 items-center justify-center rounded-full bg-energy px-1 font-mono text-[8px] font-bold leading-4 text-black min-[390px]:right-[20%] min-[390px]:top-1 min-[390px]:text-[9px]">
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
    </AppHeaderActionContext.Provider>
  )
}
