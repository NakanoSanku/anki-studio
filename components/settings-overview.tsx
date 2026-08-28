"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { BrainCircuit, ChevronRight, Cloud, FolderCog, Gauge, Table2 } from "lucide-react"

import { PATHS, SETTINGS_ROWS } from "@/lib/app-paths"
import { fsrsOf, type Deck } from "@/lib/deck"
import { readAiSettings } from "@/lib/ai-settings"
import { readGoogleSheetConnection } from "@/lib/google-sheet-connection"
import { productSyncMessage } from "@/lib/product-copy"

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
    const message = productSyncMessage(syncMessage)
    if (message !== "Not synced yet") {
      return { value: message, subtitle: "Google Sheets data sync" }
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
    <div className="mx-auto w-full max-w-xl space-y-6 pb-10" aria-label="Settings overview">
      <section className="px-0.5 pb-1 pt-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="h-1.5 w-5 rounded-full bg-signal" />
          Preferences
        </div>
        <h2 className="mt-3 text-[31px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[34px]">Make the system yours.</h2>
        <p className="mt-2.5 max-w-md text-sm leading-6 text-muted-foreground">
          Scheduling, deck tools, AI, and sync — organized by what you actually need to change.
        </p>
      </section>

      <section aria-label="Preference groups">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
          <span className="text-[10px] font-medium text-muted-foreground/65">4 sections</span>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-foreground/[0.07] bg-card/84 backdrop-blur-xl">
          {SETTINGS_ROWS.map((row, index) => {
            const detail = rowDetails[row.href]
            const Icon = detail.icon
            return (
              <Link
                key={row.href}
                href={row.href}
                className={`group flex min-h-[76px] items-center gap-3.5 px-4 py-3.5 transition-[background-color] hover:bg-muted/48 active:bg-muted/72 ${index > 0 ? "border-t border-foreground/[0.055]" : ""}`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-muted/72 text-foreground/68 transition-colors group-hover:text-foreground">
                  <Icon className="size-[17px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold tracking-[-0.018em]">{row.label}</span>
                    <span className="max-w-[46%] truncate text-right font-mono text-[10px] font-medium text-muted-foreground">{detail.value}</span>
                  </div>
                  <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">{detail.subtitle}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-foreground/20 transition-[color,transform] duration-150 group-hover:text-foreground/38 group-active:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      </section>

      <section className="rounded-[16px] border border-foreground/[0.06] bg-muted/34 px-4 py-3.5" aria-label="Local first storage">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-signal">
            <Cloud className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-[-0.015em]">Local first</p>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Private by default</span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Your deck lives in IndexedDB first. Connect Google Sheets only when you want the same data on other devices.
            </p>
          </div>
        </div>
      </section>

      <div className="px-2 text-center font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground/55">
        anki studio · v0.1.0 · FSRS-v5
      </div>
    </div>
  )
}
