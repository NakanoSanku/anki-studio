"use client"

import { useEffect, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BrainCircuit, Cloud, CloudOff, FolderCog, Gauge, RefreshCw, Table2 } from "lucide-react"

import { fsrsOf, type Deck } from "@/lib/deck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  {
    value: "deck",
    shortLabel: "卡包",
    label: "卡包管理",
    eyebrow: "Your library",
    description: "导入、导出、切换和整理你的学习内容。",
    icon: FolderCog,
  },
  {
    value: "study",
    shortLabel: "复习",
    label: "复习参数",
    eyebrow: "Study rhythm",
    description: "调整每日上限、FSRS 参数和学习节奏。",
    icon: Gauge,
  },
  {
    value: "ai",
    shortLabel: "AI",
    label: "AI 设置",
    eyebrow: "Smart helper",
    description: "配置生成模型、提示词和智能补全能力。",
    icon: BrainCircuit,
  },
  {
    value: "sync",
    shortLabel: "同步",
    label: "同步与帐号",
    eyebrow: "Stay in sync",
    description: "连接 Google 帐号和表格，在设备之间同步卡包。",
    icon: Table2,
  },
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

function SectionIntro({ value }: { value: SettingsSection }) {
  const item = SETTINGS_SECTIONS.find((section) => section.value === value)!
  const Icon = item.icon
  return (
    <div className="mb-5 rounded-[20px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted text-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-2 rounded-full bg-energy" />
            {item.eyebrow}
          </div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] sm:text-[28px]">{item.label}</h2>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </div>
  )
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
              const Icon = item.icon
              return (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="h-10 min-w-0 px-1 text-xs lg:h-12 lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
                >
                  <Icon className="size-4" />
                  <span className="min-w-0 truncate text-left">{item.shortLabel}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      )}

      <div className="min-w-0">
        <TabsContent value="deck" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <SectionIntro value="deck" />
          {deckTools ?? (
            <div className="rounded-[20px] border border-black/[0.065] bg-card p-8 text-center text-sm font-medium text-muted-foreground dark:border-white/[0.09]">
              当前没有可管理的卡包。
            </div>
          )}
        </TabsContent>

        <TabsContent value="study" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <SectionIntro value="study" />
          {fsrsSettings && deck && onDeckChange ? (
            <StudySettingsPanel deck={deck} fsrsSettings={fsrsSettings} onDeckChange={onDeckChange} />
          ) : null}
        </TabsContent>

        <TabsContent value="ai" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <SectionIntro value="ai" />
          <AiSettingsPanel />
        </TabsContent>

        <TabsContent value="sync" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <SectionIntro value="sync" />
          {sync ? (
            <div className="max-w-3xl space-y-3">
              <GoogleAccountPanel onReadyChange={setGoogleReady} />
              <GoogleSheetPickerPanel
                enabled={googleReady === true}
                onConnectionChange={setSheetConnected}
                onConnected={onSyncNow}
                inventoryKey={sync.lastSyncAt}
              />

              <div className="rounded-[20px] border border-black/[0.065] bg-card p-4 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted text-foreground",
                        sync.syncing && "animate-pulse"
                      )}
                    >
                      {sync.syncing ? (
                        <RefreshCw className="size-4.5 animate-spin" />
                      ) : sync.unavailable ? (
                        <CloudOff className="size-4.5" />
                      ) : (
                        <Cloud className="size-4.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold tracking-[-0.02em]">{sync.message}</p>
                        {sync.dirtyCount > 0 ? (
                          <Badge className="border border-energy/25 bg-energy/15 text-[10px] font-medium text-foreground shadow-none">{sync.dirtyCount} 条本地更改</Badge>
                        ) : sync.unavailable ? (
                          <Badge className="border border-black/[0.06] bg-muted text-[10px] font-medium text-muted-foreground shadow-none dark:border-white/[0.08]">离线</Badge>
                        ) : (
                          <Badge className="border border-energy/25 bg-energy/15 text-[10px] font-medium text-foreground shadow-none">已是最新</Badge>
                        )}
                      </div>
                      {sync.lastSyncAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">上次完成：{new Date(sync.lastSyncAt).toLocaleString()}</p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">支持离线使用；联网且绑定后自动双向同步</p>
                      )}
                      {sync.unavailable ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sync.unavailable}</p> : null}
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="h-11 w-full shrink-0 px-5 text-xs sm:w-auto"
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
