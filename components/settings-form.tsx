"use client"

import { useEffect, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BrainCircuit, Cloud, CloudOff, FolderCog, Gauge, RefreshCw, Table2 } from "lucide-react"

import { fsrsOf, type Deck } from "@/lib/deck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AiSettingsPanel } from "@/components/ai-settings-panel"
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
  { value: "deck", shortLabel: "卡包", label: "卡包", icon: FolderCog },
  { value: "study", shortLabel: "复习参数", label: "复习参数", icon: Gauge },
  { value: "ai", shortLabel: "AI", label: "AI", icon: BrainCircuit },
  { value: "sync", shortLabel: "同步", label: "同步", icon: Table2 },
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

  return (
    <Tabs
      defaultValue={section ?? (deckTools ? "deck" : fsrsSettings ? "study" : "ai")}
      value={section}
      orientation={desktopLayout && !section ? "vertical" : "horizontal"}
      className={cn("min-w-0 gap-4", !section && "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6")}
    >
      {section ? null : (
      <div className="sticky top-14 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-2 backdrop-blur-xl sm:top-16 sm:-mx-6 sm:px-6 lg:top-24 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <TabsList className="grid h-11 w-full grid-cols-4 p-1 shadow-sm group-data-horizontal/tabs:h-11 lg:h-auto lg:grid-cols-1 lg:gap-1 lg:rounded-xl lg:bg-card lg:p-2 lg:ring-1 lg:ring-foreground/10 lg:shadow-none">
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="h-9 min-w-0 px-1 text-xs text-foreground/75 dark:text-foreground/75 lg:h-auto lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-sm"
              >
                <Icon className="size-4" />
                <span className="min-w-0 truncate text-left">{section.shortLabel}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>
      )}

      <div className="min-w-0">
        <TabsContent value="deck" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {deckTools ?? (
            <Card className="shadow-none">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">当前没有可管理的卡包。</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="study" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {fsrsSettings && deck && onDeckChange ? (
            <StudySettingsPanel
              deck={deck}
              fsrsSettings={fsrsSettings}
              onDeckChange={onDeckChange}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="ai" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <AiSettingsPanel />
        </TabsContent>

        <TabsContent value="sync" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          {sync ? (
            <div className="max-w-3xl space-y-3">
              <GoogleAccountPanel onReadyChange={setGoogleReady} />
              <GoogleSheetPickerPanel
                enabled={googleReady === true}
                onConnectionChange={setSheetConnected}
                onConnected={onSyncNow}
                inventoryKey={sync.lastSyncAt}
              />
              
              {/* PWA Sync Status Card */}
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors sm:size-10 sm:rounded-2xl",
                    sync.syncing
                      ? "bg-primary/10 text-primary animate-pulse"
                      : sync.unavailable
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : sync.dirtyCount > 0
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  )}>
                    {sync.syncing ? (
                      <RefreshCw className="size-4.5 animate-spin" />
                    ) : sync.unavailable ? (
                      <CloudOff className="size-4.5" />
                    ) : (
                      <Cloud className="size-4.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{sync.message}</p>
                      {sync.dirtyCount > 0 ? (
                        <Badge variant="secondary" className="border-sky-500/30 bg-sky-50/50 text-[10px] font-medium text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                          {sync.dirtyCount} 条本地更改
                        </Badge>
                      ) : sync.unavailable ? (
                        <Badge variant="secondary" className="border-amber-500/30 bg-amber-50/50 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                          离线
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50/50 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          已是最新
                        </Badge>
                      )}
                    </div>
                    {sync.lastSyncAt ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        上次完成：{new Date(sync.lastSyncAt).toLocaleString()}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        支持离线使用；联网且绑定后自动双向同步
                      </p>
                    )}
                    {sync.unavailable ? (
                      <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">{sync.unavailable}</p>
                    ) : null}
                  </div>
                </div>

                <div className="pt-0.5 shrink-0 sm:pt-0">
                  <Button
                    type="button"
                    className="h-9 w-full rounded-xl px-4 text-xs font-semibold shadow-xs sm:w-auto"
                    disabled={sync.syncing || googleReady !== true || !sheetConnected}
                    onClick={onSyncNow}
                  >
                    <RefreshCw className={sync.syncing ? "mr-1.5 size-3.5 animate-spin" : "mr-1.5 size-3.5"} />
                    {sync.syncing
                      ? "正在双向同步…"
                      : googleReady !== true
                        ? "授权帐号后同步"
                        : !sheetConnected
                          ? "绑定表格后同步"
                          : "立即同步"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </div>
    </Tabs>
  )
}
