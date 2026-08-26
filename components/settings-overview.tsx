"use client"
 
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  BrainCircuit,
  ChevronRight,
  FolderCog,
  Gauge,
  Table2,
} from "lucide-react"

import { PATHS, SETTINGS_ROWS } from "@/lib/app-paths"
import { fsrsOf, type Deck } from "@/lib/deck"
import { readAiSettings } from "@/lib/ai-settings"
import { readGoogleSheetConnection } from "@/lib/google-sheet-connection"
import { Badge } from "@/components/ui/badge"

type SettingsOverviewProps = {
  deck?: Deck
  syncMessage?: string
}

export function SettingsOverview({ deck, syncMessage }: SettingsOverviewProps) {
  const [googleUser, setGoogleUser] = useState<{ email?: string | null } | null>(null)

  useEffect(() => {
    void fetch("/api/auth/account", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { authenticated?: boolean; user?: { email?: string | null } }) => {
        if (data?.authenticated && data.user) {
          setGoogleUser(data.user)
        }
      })
      .catch(() => {})
  }, [])

  const retentionPercent = useMemo(() => {
    if (!deck) return 90
    return Math.round(fsrsOf(deck).requestRetention * 100)
  }, [deck])

  const aiModel = useMemo(() => {
    try {
      const settings = readAiSettings()
      return settings.model.trim() || "gpt-4o-mini"
    } catch {
      return "gpt-4o-mini"
    }
  }, [])

  const syncInfo = useMemo(() => {
    const sheet = readGoogleSheetConnection()
    if (sheet) {
      return {
        badge: sheet.name,
        subtitle: `已绑定表格：${sheet.name}`,
      }
    }
    if (googleUser?.email) {
      return {
        badge: "已登录",
        subtitle: `已登录 Google (${googleUser.email})，未绑定表格`,
      }
    }
    if (syncMessage && !syncMessage.includes("请先选择") && syncMessage !== "尚未同步") {
      return {
        badge: syncMessage,
        subtitle: "Google Sheets 与多端数据同步",
      }
    }
    return {
      badge: "未绑定",
      subtitle: "Google Sheets 与多端数据同步",
    }
  }, [googleUser, syncMessage])

  const rowDetails: Record<
    string,
    { subtitle: string; badge: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    [PATHS.settingsDeck]: {
      subtitle: "卡包管理、导入导出与模板",
      badge: deck ? `${deck.name} (${deck.cards.length})` : "",
      icon: FolderCog,
    },
    [PATHS.settingsStudy]: {
      subtitle: "FSRS 记忆算法、目标保留率与配额",
      badge: `${retentionPercent}% 保留率`,
      icon: Gauge,
    },
    [PATHS.settingsAi]: {
      subtitle: "接口地址、模型选择与智能提示词",
      badge: aiModel,
      icon: BrainCircuit,
    },
    [PATHS.settingsSync]: {
      subtitle: syncInfo.subtitle,
      badge: syncInfo.badge,
      icon: Table2,
    },
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-12" aria-labelledby="settings-title">
      <h2 id="settings-title" className="sr-only">
        设置
      </h2>

      {/* Group 1: Core Navigation */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <ul className="divide-y divide-border/60">
          {SETTINGS_ROWS.map((row) => {
            const detail = rowDetails[row.href]
            const Icon = detail?.icon

            return (
              <li key={row.href}>
                <Link
                  href={row.href}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {Icon ? (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/40 text-foreground/80 ring-1 ring-border/50">
                        <Icon className="size-4" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {row.label}
                      </span>
                      {detail?.subtitle ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {detail.subtitle}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {detail?.badge ? (
                      <Badge variant="secondary" className="font-mono text-[10px] font-normal text-muted-foreground">
                        {detail.badge}
                      </Badge>
                    ) : null}
                    <ChevronRight className="size-3.5 text-muted-foreground/60" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Group 2: App & System Info */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="border-b border-border/70 px-4 py-2.5">
          <h3 className="text-xs font-semibold text-muted-foreground">关于应用</h3>
        </div>

        <ul className="divide-y divide-border/60 text-xs">
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">版本</span>
            <span className="font-mono text-[11px] text-foreground">v0.1.0 (PWA)</span>
          </li>
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">存储架构</span>
            <span className="text-[11px] text-foreground">离线优先 (IndexedDB 本地存储)</span>
          </li>
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-muted-foreground">记忆算法</span>
            <span className="font-mono text-[11px] text-foreground">FSRS-v5 (ts-fsrs)</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
