"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BrainCircuit, ChevronRight, Cloud, FolderCog, Gauge, Table2 } from "lucide-react"

import { PATHS, SETTINGS_ROWS } from "@/lib/app-paths"
import { fsrsOf, type Deck } from "@/lib/deck"
import { readAiSettings } from "@/lib/ai-settings"
import { readGoogleSheetConnection } from "@/lib/google-sheet-connection"

type SettingsOverviewProps = { deck?: Deck; syncMessage?: string }

export function SettingsOverview({ deck, syncMessage }: SettingsOverviewProps) {
  const [googleUser, setGoogleUser] = useState<{ email?: string | null } | null>(null)

  useEffect(() => {
    void fetch("/api/auth/account", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { authenticated?: boolean; user?: { email?: string | null } }) => {
        if (data?.authenticated && data.user) setGoogleUser(data.user)
      })
      .catch(() => {})
  }, [])

  const retentionPercent = useMemo(() => deck ? Math.round(fsrsOf(deck).requestRetention * 100) : 90, [deck])
  const aiModel = useMemo(() => {
    try { return readAiSettings().model.trim() || "gpt-4o-mini" } catch { return "gpt-4o-mini" }
  }, [])

  const syncInfo = useMemo(() => {
    const sheet = readGoogleSheetConnection()
    if (sheet) return { value: sheet.name, subtitle: "Google Sheets 已连接" }
    if (googleUser?.email) return { value: "已登录", subtitle: "选择表格以开启多端同步" }
    if (syncMessage && !syncMessage.includes("请先选择") && syncMessage !== "尚未同步") return { value: syncMessage, subtitle: "Google Sheets 数据同步" }
    return { value: "未连接", subtitle: "Google Sheets 数据同步" }
  }, [googleUser, syncMessage])

  const rowDetails: Record<string, { subtitle: string; value: string; icon: React.ComponentType<{ className?: string }> }> = {
    [PATHS.settingsDeck]: { subtitle: "管理、导入导出与模板", value: deck ? `${deck.cards.length} 张` : "", icon: FolderCog },
    [PATHS.settingsStudy]: { subtitle: "FSRS 算法与学习配额", value: `${retentionPercent}%`, icon: Gauge },
    [PATHS.settingsAi]: { subtitle: "模型、接口与提示词", value: aiModel, icon: BrainCircuit },
    [PATHS.settingsSync]: { subtitle: syncInfo.subtitle, value: syncInfo.value, icon: Table2 },
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10" aria-labelledby="settings-title">
      <div className="px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Anki Studio</p>
        <h2 id="settings-title" className="mt-1 text-2xl font-bold tracking-tight">设置</h2>
        <p className="mt-1 text-sm text-muted-foreground">让学习、生成和同步更符合你的习惯。</p>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-border/60 bg-card shadow-xs">
        {SETTINGS_ROWS.map((row, index) => {
          const detail = rowDetails[row.href]
          const Icon = detail.icon
          return (
            <Link key={row.href} href={row.href} className={"flex min-h-[72px] items-center gap-3 px-4 transition-colors active:bg-muted/70 " + (index ? "border-t border-border/60" : "")}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground ring-1 ring-border/40"><Icon className="size-[18px]" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{row.label}</span>
                  <span className="max-w-[45%] truncate text-right text-xs font-medium text-muted-foreground">{detail.value}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{detail.subtitle}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </Link>
          )
        })}
      </div>

      <div className="rounded-[24px] border border-border/60 bg-card p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted"><Cloud className="size-[18px]" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">离线优先</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">卡包先保存在本机 IndexedDB，连接 Google Sheets 后再同步到其他设备。</p>
          </div>
        </div>
      </div>

      <div className="px-2 text-center text-[11px] text-muted-foreground">Anki Studio v0.1.0 · FSRS-v5</div>
    </div>
  )
}
