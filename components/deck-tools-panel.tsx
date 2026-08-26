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
    <div className="mx-auto w-full max-w-xl space-y-4 pb-12" aria-label="卡包">
      <section className="relative overflow-hidden rounded-[2.25rem] bg-[#c8f889] p-5 text-black shadow-[0_24px_64px_-44px_rgba(0,0,0,0.72)] sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-[44%_56%_54%_46%/53%_44%_56%_47%] bg-[#ffe08d]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-14 right-20 size-28 rounded-[58%_42%_46%_54%/48%_58%_42%_52%] bg-[#9dceff]" aria-hidden="true" />

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-black/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              active deck
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 bg-white/55 px-3 text-xs font-black text-black hover:bg-white/80 hover:text-black"
              onClick={onSwitchDeck}
            >
              切换卡包
              <ChevronRight className="size-3.5" />
            </Button>
          </div>

          <h2 className="mt-6 max-w-[85%] break-words text-3xl font-black tracking-[-0.06em] sm:text-4xl">
            {deckName}
          </h2>
          <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-black/55">
            把内容、模板和导出都放在一个地方管理。
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <div className="rounded-[1.5rem] bg-white/65 px-4 py-3 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/40">cards</span>
              <p className="mt-1 text-2xl font-black tracking-[-0.045em]">{cardCount}</p>
            </div>
            <div className="rounded-[1.5rem] bg-black px-4 py-3 text-white">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">decks</span>
              <p className="mt-1 text-2xl font-black tracking-[-0.045em]">{deckCount}</p>
            </div>
          </div>
        </div>
      </section>

      <Link
        href={PATHS.settingsTemplates}
        className="group flex items-center gap-4 rounded-[1.8rem] bg-[#dff1ff] p-4 text-[#123f67] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.68)] transition-transform active:scale-[0.99] dark:bg-[#1e3b55] dark:text-[#e0f1ff]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-white/65 shadow-sm dark:bg-black/15">
          <Palette className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-45">design</span>
          <span className="mt-0.5 block text-base font-black tracking-[-0.035em]">{DECK_TEMPLATES_LABEL}</span>
          <span className="mt-0.5 block text-xs font-medium opacity-55">正反面、CSS 与多模板设计</span>
        </span>
        <ChevronRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <section>
        <div className="mb-2.5 flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">move your data</p>
            <h3 className="mt-0.5 text-xl font-black tracking-[-0.045em]">导入与导出</h3>
          </div>
          {hasTts ? (
            <Badge className="border-0 bg-[#ff9bd6]/25 px-2.5 py-1 text-[10px] font-black text-foreground shadow-none">
              <Sparkles className="mr-1 size-3" />语音已开启
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={actionsDisabled}
            className="group flex min-h-36 flex-col items-start justify-between rounded-[1.8rem] bg-[#ffe39a] p-4 text-left text-[#5b4200] transition-transform active:scale-[0.985] disabled:opacity-50 dark:bg-[#68551f] dark:text-[#ffedb8]"
            onClick={onImport}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-white/60 dark:bg-black/15">
              <ArrowDownToLine className="size-4.5" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-[-0.04em]">导入</span>
              <span className="mt-1 block text-[11px] font-semibold leading-4 opacity-55">CSV · JSON · APKG · COLPKG</span>
            </span>
          </button>

          {exporting ? (
            <button
              type="button"
              onClick={onCancelExport}
              className="relative flex min-h-36 flex-col items-start justify-between overflow-hidden rounded-[1.8rem] bg-black p-4 text-left text-white transition-transform active:scale-[0.985]"
            >
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#9dceff]/35 transition-[height]"
                style={{ height: `${Math.max(12, exportPercent)}%` }}
                aria-hidden="true"
              />
              <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-white/15">
                <Loader2 className="size-4.5 animate-spin" />
              </span>
              <span className="relative z-10">
                <span className="block text-lg font-black tracking-[-0.04em]">{exportPercent || "…"}%</span>
                <span className="mt-1 block text-[11px] font-semibold leading-4 text-white/55">
                  {exportProgress && exportProgress.total > 0
                    ? `${exportProgress.done} / ${exportProgress.total} · 点击取消`
                    : "正在准备导出 · 点击取消"}
                </span>
              </span>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="group flex min-h-36 w-full flex-col items-start justify-between rounded-[1.8rem] bg-[#ffc7b8] p-4 text-left text-[#6c2d1e] transition-transform active:scale-[0.985] disabled:opacity-50 dark:bg-[#64362d] dark:text-[#ffdcd2]"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-white/60 dark:bg-black/15">
                    <ArrowUpFromLine className="size-4.5" />
                  </span>
                  <span className="w-full">
                    <span className="flex items-center justify-between gap-2 text-lg font-black tracking-[-0.04em]">
                      导出
                      <ChevronDown className="size-4" />
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold leading-4 opacity-55">APKG · CSV · JSON</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={onExportApkg}>
                  <PackageOpen />
                  <span className="font-bold">{hasTts ? "APKG · 包含语音" : "APKG · Anki 卡包"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv}>
                  <Layers3 />
                  CSV · 表格文本
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportJson}>
                  <ArrowUpFromLine />
                  JSON · 完整工程备份
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>
    </div>
  )
}
