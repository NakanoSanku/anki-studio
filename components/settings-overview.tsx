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
    if (sheet) return { value: sheet.name, subtitle: "Google Sheets connected" }
    if (googleUser?.email) return { value: "Signed in", subtitle: "Choose a sheet to enable cross-device sync" }
    if (syncMessage && syncMessage !== "Not synced yet") {
      return { value: syncMessage, subtitle: "Google Sheets data sync" }
    }
    return { value: "Not connected", subtitle: "Google Sheets data sync" }
  }, [googleUser, syncMessage])

  const rowDetails: Record<string, RowDetail> = {
    [PATHS.settingsDeck]: {
      subtitle: "Manage, import, export, and templates",
      value: deck ? `${deck.cards.length} notes` : "",
      icon: FolderCog,
    },
    [PATHS.settingsStudy]: {
      subtitle: "FSRS scheduling and daily limits",
      value: `${retentionPercent}%`,
      icon: Gauge,
    },
    [PATHS.settingsAi]: {
      subtitle: "Model, endpoint, and prompts",
      value: aiModel,
      icon: BrainCircuit,
    },
    [PATHS.settingsSync]: {
      subtitle: syncInfo.subtitle,
      value: syncInfo.value,
      icon: Table2,
    },
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10" aria-label="Settings overview">
      <section className="px-1 pb-1 pt-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="size-2 rounded-full bg-energy" />
          Preferences
        </div>
        <h2 className="mt-3 text-[30px] font-semibold leading-[1.03] tracking-[-0.045em]">Tune the way you learn</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Keep the important controls close and everything else quiet. Manage your deck, FSRS, AI, and sync here.
        </p>
      </section>

      <div className="overflow-hidden rounded-[22px] border border-black/[0.065] bg-card shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09]">
        {SETTINGS_ROWS.map((row, index) => {
          const detail = rowDetails[row.href]
          const Icon = detail.icon
          return (
            <Link
              key={row.href}
              href={row.href}
              className={`group flex min-h-[78px] items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/55 active:bg-muted/80 ${index > 0 ? "border-t border-black/[0.055] dark:border-white/[0.07]" : ""}`}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-muted text-foreground">
                <Icon className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold tracking-[-0.02em]">{row.label}</span>
                  <span className="max-w-[45%] truncate text-right text-[11px] font-medium text-muted-foreground">{detail.value}</span>
                </div>
                <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">{detail.subtitle}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-foreground/22 transition-transform duration-150 group-active:translate-x-0.5" />
            </Link>
          )
        })}
      </div>

      <div className="rounded-[22px] border border-black/[0.065] bg-card p-4 dark:border-white/[0.09]">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-energy text-black">
            <Cloud className="size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tracking-[-0.015em]">Local first</p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Private by default</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Decks are saved to IndexedDB first. Connect Google Sheets only when you want the same data on other devices.
            </p>
          </div>
        </div>
      </div>

      <div className="px-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
        anki studio · v0.1.0 · FSRS-v5
      </div>
    </div>
  )
}
