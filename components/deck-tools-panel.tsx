"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"

import { DECK_TEMPLATES_LABEL, PATHS } from "@/lib/app-paths"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type DeckToolsPanelProps = {
  deckName: string
  cardCount: number
  deckCount: number
  busy: boolean
  exporting: boolean
  exportProgress: { done: number; total: number } | null
  pushLabel: string
  hasTts: boolean
  onImport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onExportApkg: () => void
  onPushAnki: () => void
  onCancelExport: () => void
  onSwitchDeck: () => void
}

function RowButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium disabled:opacity-50"
      onClick={onClick}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  )
}

export function DeckToolsPanel({
  deckName,
  cardCount,
  deckCount,
  busy,
  exporting,
  exportProgress,
  pushLabel,
  hasTts,
  onImport,
  onExportJson,
  onExportCsv,
  onExportApkg,
  onPushAnki,
  onCancelExport,
  onSwitchDeck,
}: DeckToolsPanelProps) {
  const actionsDisabled = busy || exporting

  return (
    <section className="mx-auto w-full max-w-lg" aria-label="卡包">
      <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
        <li>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            onClick={onSwitchDeck}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{deckName}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {cardCount} · {deckCount}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
        <li className="border-t border-border/70">
          <Link
            href={PATHS.settingsTemplates}
            className="flex items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="min-w-0 flex-1 text-sm font-medium">{DECK_TEMPLATES_LABEL}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
        <li className="border-t border-border/70">
          <RowButton disabled={actionsDisabled} onClick={onImport}>
            导入
          </RowButton>
        </li>
        <li className="border-t border-border/70">
          {exporting ? (
            <RowButton onClick={onCancelExport}>
              {exportProgress && exportProgress.total > 0
                ? `${exportProgress.done}/${exportProgress.total} · 取消`
                : "取消导出"}
            </RowButton>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">导出</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onExportJson}>JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={onExportApkg}>{hasTts ? "APKG · 语音" : "APKG"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </li>
        <li className="border-t border-border/70">
          <button
            type="button"
            disabled={actionsDisabled}
            aria-label={pushLabel}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium disabled:opacity-50"
            )}
            onClick={onPushAnki}
          >
            <span className="min-w-0 flex-1">{pushLabel}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      </ul>
    </section>
  )
}
