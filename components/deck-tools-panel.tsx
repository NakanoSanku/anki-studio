"use client"

import Link from "next/link"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { DECK_TEMPLATES_LABEL, PATHS } from "@/lib/app-paths"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type DeckToolsPanelProps = {
  deckName: string
  cardCount: number
  deckCount: number
  busy: boolean
  exporting: boolean
  exportProgress: { done: number; total: number } | null
  hasTts: boolean
  onImport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onExportApkg: () => void
  onCancelExport: () => void
  onSwitchDeck: () => void
}

export function DeckToolsPanel({
  deckName,
  cardCount,
  deckCount,
  busy,
  exporting,
  exportProgress,
  hasTts,
  onImport,
  onExportJson,
  onExportCsv,
  onExportApkg,
  onCancelExport,
  onSwitchDeck,
}: DeckToolsPanelProps) {
  const actionsDisabled = busy || exporting

  return (
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-10" aria-label="卡包">
      {/* Card 1: Active Deck & Templates */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">当前卡包</h2>
        </div>

        <div className="divide-y divide-border/60">
          {/* Deck Switcher */}
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
            onClick={onSwitchDeck}
          >
            <div className="min-w-0 flex-1 pr-2">
              <span className="block truncate text-xs font-semibold text-foreground">{deckName}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {cardCount} 张卡片 · 共 {deckCount} 个卡包
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" className="text-[11px] font-normal">
                切换
              </Badge>
              <ChevronRight className="size-3.5 text-muted-foreground/60" />
            </div>
          </button>

          {/* Templates */}
          <Link
            href={PATHS.settingsTemplates}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
          >
            <div className="min-w-0 flex-1 pr-2">
              <span className="block text-xs font-medium text-foreground">{DECK_TEMPLATES_LABEL}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                正面与背面 HTML/CSS 模板定制
              </span>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
          </Link>
        </div>
      </div>

      {/* Card 2: Data Management & Export */}
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70 shadow-xs">
        <div className="border-b border-border/70 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">数据管理</h2>
        </div>

        <div className="divide-y divide-border/60">
          {/* Import */}
          <button
            type="button"
            disabled={actionsDisabled}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50 disabled:opacity-50"
            onClick={onImport}
          >
            <div className="min-w-0 flex-1 pr-2">
              <span className="block text-xs font-medium text-foreground">导入</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                支持 CSV、JSON、APKG、COLPKG
              </span>
            </div>
            <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
          </button>

          {/* Export */}
          {exporting ? (
            <button
              type="button"
              onClick={onCancelExport}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50"
            >
              <div className="min-w-0 flex-1 pr-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Loader2 className="size-3 animate-spin" />
                  正在导出…
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {exportProgress && exportProgress.total > 0
                    ? `${exportProgress.done}/${exportProgress.total} 张 · 点击取消`
                    : "点击取消导出"}
                </span>
              </div>
              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                取消
              </Badge>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50 disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block text-xs font-medium text-foreground">导出</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      导出为 APKG、CSV、JSON 格式
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                    <span>选择格式</span>
                    <ChevronDown className="size-3.5 text-muted-foreground/60" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                <DropdownMenuItem onClick={onExportApkg} className="text-xs">
                  <span className="font-semibold">{hasTts ? "APKG · 包含语音" : "APKG (Anki 卡包)"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv} className="text-xs">
                  CSV (表格文本)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportJson} className="text-xs">
                  JSON (完整工程备份)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}
