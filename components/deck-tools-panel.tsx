"use client"

import Link from "next/link"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  Layers3,
  Loader2,
  Palette,
  PackageOpen,
  Sparkles,
} from "lucide-react"

import { DECK_TEMPLATES_LABEL, PATHS } from "@/lib/app-paths"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  const exportPercent = exportProgress && exportProgress.total > 0
    ? Math.min(100, Math.round((exportProgress.done / exportProgress.total) * 100))
    : 0

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-12" aria-label="卡包">
      <section className="rounded-[22px] border border-black/[0.065] bg-card p-5 shadow-[0_18px_46px_-42px_rgba(0,0,0,0.45)] dark:border-white/[0.09] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="size-2 rounded-full bg-energy" />
            Active deck
          </span>
          <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={onSwitchDeck}>
            切换卡包
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

        <h2 className="mt-5 max-w-[90%] break-words text-[30px] font-semibold leading-[1.03] tracking-[-0.045em] sm:text-[34px]">{deckName}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">内容、模板与导出都集中在这里管理。</p>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-black/[0.055] pt-4 dark:border-white/[0.07]">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cards</span>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{cardCount}</p>
          </div>
          <div className="border-l border-black/[0.055] pl-4 dark:border-white/[0.07]">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Decks</span>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{deckCount}</p>
          </div>
        </div>
      </section>

      <Link href={PATHS.settingsTemplates} className="group flex items-center gap-4 rounded-[20px] border border-black/[0.065] bg-card p-4 transition-colors hover:bg-muted/45 active:bg-muted/70 dark:border-white/[0.09]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-muted text-foreground"><Palette className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Design</span>
          <span className="mt-1 block text-[15px] font-semibold tracking-[-0.025em]">{DECK_TEMPLATES_LABEL}</span>
          <span className="mt-1 block text-xs text-muted-foreground">正反面、CSS 与多模板设计</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-foreground/25 transition-transform group-active:translate-x-0.5" />
      </Link>

      <section>
        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Data</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.035em]">导入与导出</h3>
          </div>
          {hasTts ? <Badge className="border border-energy/25 bg-energy/15 px-2.5 py-1 text-[10px] font-medium text-foreground shadow-none"><Sparkles className="mr-1 size-3" />语音已开启</Badge> : null}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" disabled={actionsDisabled} className="group flex min-h-36 flex-col items-start justify-between rounded-[20px] border border-black/[0.065] bg-card p-4 text-left transition-[background-color,transform] hover:bg-muted/45 active:scale-[0.99] disabled:opacity-50 dark:border-white/[0.09]" onClick={onImport}>
            <span className="flex size-10 items-center justify-center rounded-[12px] bg-muted"><ArrowDownToLine className="size-4.5" /></span>
            <span><span className="block text-lg font-semibold tracking-[-0.035em]">导入</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">CSV · JSON · APKG · COLPKG</span></span>
          </button>

          {exporting ? (
            <button type="button" onClick={onCancelExport} className="relative flex min-h-36 flex-col items-start justify-between overflow-hidden rounded-[20px] bg-foreground p-4 text-left text-background transition-transform active:scale-[0.99]">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-energy/25 transition-[height]" style={{ height: `${Math.max(12, exportPercent)}%` }} aria-hidden="true" />
              <span className="relative z-10 flex size-10 items-center justify-center rounded-[12px] bg-background/10"><Loader2 className="size-4.5 animate-spin" /></span>
              <span className="relative z-10"><span className="block text-lg font-semibold tracking-[-0.035em]">{exportPercent || "…"}%</span><span className="mt-1 block text-[11px] leading-4 text-background/55">{exportProgress && exportProgress.total > 0 ? `${exportProgress.done} / ${exportProgress.total} · 点击取消` : "正在准备导出 · 点击取消"}</span></span>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" disabled={busy} className="group flex min-h-36 w-full flex-col items-start justify-between rounded-[20px] border border-black/[0.065] bg-card p-4 text-left transition-[background-color,transform] hover:bg-muted/45 active:scale-[0.99] disabled:opacity-50 dark:border-white/[0.09]">
                  <span className="flex size-10 items-center justify-center rounded-[12px] bg-energy text-black"><ArrowUpFromLine className="size-4.5" /></span>
                  <span className="w-full"><span className="flex items-center justify-between gap-2 text-lg font-semibold tracking-[-0.035em]">导出<ChevronDown className="size-4 text-muted-foreground" /></span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">APKG · CSV · JSON</span></span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={onExportApkg}><PackageOpen /><span className="font-medium">{hasTts ? "APKG · 包含语音" : "APKG · Anki 卡包"}</span></DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv}><Layers3 />CSV · 表格文本</DropdownMenuItem>
                <DropdownMenuItem onClick={onExportJson}><ArrowUpFromLine />JSON · 完整工程备份</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>
    </div>
  )
}
