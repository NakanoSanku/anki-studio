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
    eyebrow: "your library",
    description: "导入、导出、切换和整理你的学习内容。",
    icon: FolderCog,
    tone: "bg-[#cfe6ff] text-[#194f83] dark:bg-[#244d74] dark:text-[#dceeff]",
  },
  {
    value: "study",
    shortLabel: "复习",
    label: "复习参数",
    eyebrow: "study rhythm",
    description: "调整每日上限、FSRS 参数和学习节奏。",
    icon: Gauge,
    tone: "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]",
  },
  {
    value: "ai",
    shortLabel: "AI",
    label: "AI 设置",
    eyebrow: "smart helper",
    description: "配置生成模型、提示词和智能补全能力。",
    icon: BrainCircuit,
    tone: "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]",
  },
  {
    value: "sync",
    shortLabel: "同步",
    label: "同步与帐号",
    eyebrow: "stay in sync",
    description: "连接 Google 帐号和表格，在设备之间同步卡包。",
    icon: Table2,
    tone: "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]",
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
    <div className={cn("relative mb-4 overflow-hidden rounded-[2rem] p-5 sm:p-6", item.tone)}>
      <div className="absolute -right-10 -top-10 size-32 rounded-[46%_54%_56%_44%/52%_42%_58%_48%] bg-white/28" aria-hidden="true" />
      <div className="absolute -bottom-12 right-20 size-24 rounded-[58%_42%_43%_57%/44%_55%_45%_56%] bg-white/20" aria-hidden="true" />
      <div className="relative flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-black text-white shadow-[0_14px_30px_-22px_rgba(0,0,0,0.75)] dark:bg-white dark:text-black">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-55">{item.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] sm:text-3xl">{item.label}</h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 opacity-70">{item.description}</p>
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
          <TabsList className="grid h-12 w-full grid-cols-4 rounded-full p-1 shadow-[0_12px_28px_-24px_rgba(0,0,0,0.65)] lg:h-auto lg:grid-cols-1 lg:gap-1 lg:rounded-[1.6rem] lg:bg-card lg:p-2 lg:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.65)]">
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
            <div className="rounded-[2rem] bg-card p-8 text-center text-sm font-medium text-muted-foreground shadow-[0_18px_44px_-36px_rgba(0,0,0,0.65)]">
              当前没有可管理的卡包。
            </div>
          )}
        </TabsContent>

        <TabsContent value="study" className="mt-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <SectionIntro value="study" />
          {fsrsSettings && deck && onDeckChange ? (
            <StudySettingsPanel
              deck={deck}
              fsrsSettings={fsrsSettings}
              onDeckChange={onDeckChange}
            />
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

              <div className="relative overflow-hidden rounded-[2rem] bg-[#cfe6ff] p-4 shadow-[0_18px_44px_-34px_rgba(0,0,0,0.65)] dark:bg-[#244d74] sm:p-5">
                <div className="absolute -right-8 -bottom-12 size-28 rounded-full bg-white/25" aria-hidden="true" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-black text-white shadow-[0_12px_28px_-20px_rgba(0,0,0,0.75)] dark:bg-white dark:text-black",
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
                        <p className="text-base font-black tracking-[-0.025em] text-current">{sync.message}</p>
                        {sync.dirtyCount > 0 ? (
                          <Badge className="border-0 bg-black/10 text-[10px] font-black text-current shadow-none">
                            {sync.dirtyCount} 条本地更改
                          </Badge>
                        ) : sync.unavailable ? (
                          <Badge className="border-0 bg-black/10 text-[10px] font-black text-current shadow-none">离线</Badge>
                        ) : (
                          <Badge className="border-0 bg-black/10 text-[10px] font-black text-current shadow-none">已是最新</Badge>
                        )}
                      </div>
                      {sync.lastSyncAt ? (
                        <p className="mt-1 text-xs font-semibold opacity-60">
                          上次完成：{new Date(sync.lastSyncAt).toLocaleString()}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-semibold opacity-60">支持离线使用；联网且绑定后自动双向同步</p>
                      )}
                      {sync.unavailable ? (
                        <p className="mt-1 text-xs font-semibold leading-relaxed opacity-70">{sync.unavailable}</p>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="h-12 w-full shrink-0 rounded-full bg-black px-5 text-xs font-black text-white shadow-[0_12px_28px_-20px_rgba(0,0,0,0.8)] hover:bg-black/85 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-white/90"
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
