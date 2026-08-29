"use client"

import { useEffect, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { productSyncMessage } from "@/lib/product-copy"
import { RefreshCw } from "lucide-react"

import { fsrsOf, type Deck } from "@/lib/deck"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AiSettingsPanel } from "@/components/ai-settings-panel"
import { GeminiLiveSetup } from "@/components/gemini-live-setup"
import { GoogleAccountPanel } from "@/components/google-account-panel"
import { GoogleSheetPickerPanel } from "@/components/google-sheet-picker-panel"
import { StudySettingsPanel } from "@/components/study-settings-panel"

export type SyncPanelState = {
  syncing: boolean
  message: string
  lastSyncAt?: number
  dirtyCount: number
  unavailable?: string
}

const SETTINGS_SECTIONS = [
  { value: "deck", shortLabel: "Deck" },
  { value: "study", shortLabel: "Study" },
  { value: "ai", shortLabel: "AI" },
  { value: "sync", shortLabel: "Sync" },
] as const

export type SettingsSection = "deck" | "study" | "ai" | "sync"

function useDesktopSettingsLayout() {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)")
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return desktop
}

function formatLastSync(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

export function SettingsForm({
  section,
  deckTools,
  deck,
  onDeckChange,
  sync,
  onSyncNow,
}: {
  section?: SettingsSection
  deckTools?: ReactNode
  deck?: Deck
  onDeckChange?: (deck: Deck) => void
  sync?: SyncPanelState
  onSyncNow?: () => Promise<void> | void
}) {
  const [googleReady, setGoogleReady] = useState<boolean | undefined>()
  const [sheetConnected, setSheetConnected] = useState(false)
  const desktopLayout = useDesktopSettingsLayout()
  const fsrsSettings = deck ? fsrsOf(deck) : null
  const defaultSection: SettingsSection = section ?? (deckTools ? "deck" : fsrsSettings ? "study" : "ai")
  const shownSyncMessage = sync ? productSyncMessage(sync.message) : ""
  const syncHeadline = sync
    ? sync.syncing
      ? "Syncing…"
      : sync.unavailable
        ? "Sync unavailable"
        : sync.dirtyCount > 0
          ? `${sync.dirtyCount} local ${sync.dirtyCount === 1 ? "change" : "changes"} waiting`
          : sync.lastSyncAt
            ? "Up to date"
            : shownSyncMessage === "Not synced yet"
              ? "Ready to sync"
              : shownSyncMessage
    : ""

  return (
    <Tabs
      defaultValue={defaultSection}
      value={section}
      orientation={desktopLayout && !section ? "vertical" : "horizontal"}
      className={cn(
        "min-w-0 gap-4",
        !section && "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6"
      )}
    >
      {section ? null : (
        <div className="sticky top-14 z-20 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-xl sm:top-16 sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <TabsList className="grid h-12 w-full grid-cols-4 lg:h-auto lg:grid-cols-1 lg:gap-1 lg:p-1.5">
            {SETTINGS_SECTIONS.map((item) => {
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="h-10 min-w-0 px-1 text-xs lg:h-12 lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
                >
                  <span className="min-w-0 truncate text-left">{item.shortLabel}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      )}

      <div className="min-w-0">
        <TabsContent value="deck" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {deckTools ?? (
            <div className="rounded-[20px] border border-black/[0.065] bg-card p-8 text-center text-sm font-medium text-muted-foreground dark:border-white/[0.09]">
              No deck is available to manage.
            </div>
          )}
        </TabsContent>

        <TabsContent value="study" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {fsrsSettings && deck && onDeckChange ? (
            <StudySettingsPanel deck={deck} fsrsSettings={fsrsSettings} onDeckChange={onDeckChange} />
          ) : null}
        </TabsContent>

        <TabsContent value="ai" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <div className="space-y-5">
            <AiSettingsPanel />
            <GeminiLiveSetup />
          </div>
        </TabsContent>

        <TabsContent value="sync" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {sync ? (
            <div className="mx-auto max-w-2xl space-y-2.5">
              <GoogleAccountPanel onReadyChange={setGoogleReady} />
              <GoogleSheetPickerPanel
                enabled={googleReady === true}
                onConnectionChange={setSheetConnected}
                onConnected={onSyncNow}
              />

              <section className="rounded-[18px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.4)] dark:border-white/[0.09] sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <span className={cn("size-2 rounded-full", sync.unavailable ? "bg-muted-foreground/40" : "bg-energy")} />
                      Sync status
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em]">{syncHeadline}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {sync.lastSyncAt ? `Last sync · ${formatLastSync(sync.lastSyncAt)}` : "Your changes are saved locally until the first sync."}
                    </p>
                    {sync.unavailable ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{sync.unavailable}</p> : null}
                  </div>
                </div>

                <Button
                  type="button"
                  className="mt-4 h-12 w-full justify-center text-xs"
                  disabled={sync.syncing || googleReady !== true || !sheetConnected}
                  onClick={onSyncNow}
                >
                  <RefreshCw className={sync.syncing ? "size-3.5 animate-spin" : "size-3.5"} />
                  {sync.syncing
                    ? "Syncing…"
                    : googleReady !== true
                      ? "Connect Google first"
                      : !sheetConnected
                        ? "Choose a sync sheet"
                        : "Sync now"}
                </Button>
              </section>
            </div>
          ) : null}
        </TabsContent>
      </div>
    </Tabs>
  )
}
