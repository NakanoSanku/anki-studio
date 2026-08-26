"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { BrainCircuit, ChevronRight, Cloud, FolderCog, Gauge, Table2 } from "lucide-react"

import { PATHS, SETTINGS_ROWS } from "@/lib/app-paths"
import { fsrsOf, type Deck } from "@/lib/deck"
import { readAiSettings } from "@/lib/ai-settings"
import { readGoogleSheetConnection } from "@/lib/google-sheet-connection"

type SettingsOverviewProps = { deck?: Deck; syncMessage?: string }

type RowDetail = {
  subtitle: string
  value: string
  icon: ComponentType<{ className?: string }>
  tone: string
}

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

  const retentionPercent = useMemo(() => (deck ? Math.round(fsrsOf(deck).requestRetention * 100) : 90), [deck])
  const aiModel = useMemo(() => {
    try {
      return readAiSettings().model.trim() || "gpt-4o-mini"
    } catch {
      return "gpt-4o-mini"
    }
  }, [])

  const syncInfo = useMemo(() => {
    const sheet = readGoogleSheetConnection()
    if (sheet) return { value: sheet.name, subtitle: "Google Sheets 已连接" }
    if (googleUser?.email) return { value: "已登录", subtitle: "选择表格以开启多端同步" }
    if (syncMessage && !syncMessage.includes("请先选择") && syncMessage !== "尚未同步") {
      return { value: syncMessage, subtitle: "Google Sheets 数据同步" }
    }
    return { value: "未连接", subtitle: "Google Sheets 数据同步" }
  }, [googleUser, syncMessage])

  const rowDetails: Record<string, RowDetail> = {
    [PATHS.settingsDeck]: {
      subtitle: "管理、导入导出与模板",
      value: deck ? `${deck.cards.length} 张` : "",
      icon: FolderCog,
      tone: "bg-[#ffe49a]",
    },
    [PATHS.settingsStudy]: {
      subtitle: "FSRS 算法与学习配额",
      value: `${retentionPercent}%`,
      icon: Gauge,
      tone: "bg-[#cce9ff]",
    },
    [PATHS.settingsAi]: {
      subtitle: "模型、接口与提示词",
      value: aiModel,
      icon: BrainCircuit,
      tone: "bg-[#ffcfdc]",
    },
    [PATHS.settingsSync]: {
      subtitle: syncInfo.subtitle,
      value: syncInfo.value,
      icon: Table2,
      tone: "bg-[#d8f6bd]",
    },
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-10" aria-label="设置总览">
      <div className="relative overflow-hidden rounded-[32px] bg-[#fff0b8] px-5 py-6 text-black ring-1 ring-black/[0.035] dark:bg-card dark:text-foreground dark:ring-white/[0.08]">
        <div className="relative z-10 max-w-[72%]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/45 dark:text-muted-foreground">make it yours</p>
          <h2 className="mt-2 text-[30px] font-black leading-[1.05] tracking-[-0.045em]">按你的方式学习</h2>
          <p className="mt-2 text-sm font-medium leading-5 text-black/55 dark:text-muted-foreground">
            从卡包、FSRS 到 AI 和同步，都可以慢慢调成顺手的样子。
          </p>
        </div>
        <div aria-hidden="true" className="absolute -right-5 -top-3 size-24 rotate-12 rounded-[45%_55%_50%_50%/52%_44%_56%_48%] bg-[#ff9f96]">
          <span className="absolute left-[30%] top-[36%] size-2.5 rounded-full bg-black" />
          <span className="absolute right-[30%] top-[36%] size-2.5 rounded-full bg-black" />
          <span className="absolute bottom-[26%] left-1/2 h-3 w-6 -translate-x-1/2 rounded-b-full border-b-4 border-black" />
        </div>
        <div aria-hidden="true" className="absolute -bottom-8 right-16 size-16 -rotate-12 rounded-[48%_52%_45%_55%/50%_45%_55%_50%] bg-[#84c4ff]" />
      </div>

      <div className="space-y-2.5">
        {SETTINGS_ROWS.map((row) => {
          const detail = rowDetails[row.href]
          const Icon = detail.icon
          return (
            <Link
              key={row.href}
              href={row.href}
              className="group flex min-h-[78px] items-center gap-3 rounded-[27px] bg-card px-3.5 py-3.5 shadow-[0_16px_42px_-34px_rgba(0,0,0,0.55)] ring-1 ring-black/[0.04] transition-transform active:scale-[0.985] dark:ring-white/[0.08]"
            >
              <div className={`flex size-12 shrink-0 items-center justify-center rounded-[20px] text-black ${detail.tone}`}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-black tracking-[-0.015em]">{row.label}</span>
                  <span className="max-w-[43%] truncate rounded-full bg-black/[0.045] px-2.5 py-1 text-right text-[11px] font-bold text-muted-foreground dark:bg-white/10">
                    {detail.value}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{detail.subtitle}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-foreground/25 transition-transform group-active:translate-x-0.5" />
            </Link>
          )
        })}
      </div>

      <div className="rounded-[30px] bg-black p-4 text-white shadow-[0_18px_42px_-28px_rgba(0,0,0,0.7)] dark:bg-white dark:text-black">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#b8f57b] text-black">
            <Cloud className="size-[19px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">离线优先，联网再同步</p>
            <p className="mt-1 text-xs font-medium leading-5 text-white/60 dark:text-black/55">
              卡包先保存在本机 IndexedDB，连接 Google Sheets 后再同步到其他设备。
            </p>
          </div>
        </div>
      </div>

      <div className="px-2 text-center text-[11px] font-semibold text-muted-foreground">anki studio · v0.1.0 · FSRS-v5</div>
    </div>
  )
}
