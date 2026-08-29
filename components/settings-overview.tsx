"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { PATHS, SETTINGS_ROWS } from "@/lib/app-paths"
import { fsrsOf, type Deck } from "@/lib/deck"
import { readAiSettings } from "@/lib/ai-settings"
import { readGoogleSheetConnection } from "@/lib/google-sheet-connection"
import { productSyncMessage } from "@/lib/product-copy"

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

  const retentionPercent = useMemo(() => (deck ? Math.round(fsrsOf(deck).requestRetention * 100) : 90), [deck])
  const aiModel = useMemo(() => {
    try {
      return readAiSettings().model.trim() || "gpt-4o-mini"
    } catch {
      return "gpt-4o-mini"
    }
  }, [])

  const syncValue = useMemo(() => {
    const sheet = readGoogleSheetConnection()
    if (sheet) return sheet.name
    if (googleUser?.email) return "Choose a sheet"
    const message = productSyncMessage(syncMessage)
    return message === "Not synced yet" ? "Not connected" : message
  }, [googleUser, syncMessage])

  const values: Record<string, string> = {
    [PATHS.settingsDeck]: deck ? `${deck.cards.length} ${deck.cards.length === 1 ? "note" : "notes"}` : "",
    [PATHS.settingsStudy]: `${retentionPercent}%`,
    [PATHS.settingsAi]: aiModel,
    [PATHS.settingsSync]: syncValue,
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-10" aria-label="Settings overview">
      <div className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-card dark:border-white/[0.09]">
        {SETTINGS_ROWS.map((row, index) => (
          <Link
            key={row.href}
            href={row.href}
            className={`group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/55 active:bg-muted/80 ${index > 0 ? "border-t border-black/[0.055] dark:border-white/[0.07]" : ""}`}
          >
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em]">{row.label}</span>
            <span className="max-w-[52%] truncate text-right text-xs font-medium text-muted-foreground">{values[row.href]}</span>
            <ChevronRight className="size-4 shrink-0 text-foreground/20 transition-transform duration-150 group-active:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
