"use client"

import { ChevronDown, Download, FolderCog, LibraryBig, Send, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type DeckToolsPanelProps = {
  deckName: string
  cardCount: number
  deckCount: number
  busy: boolean
  exporting: boolean
  exportProgress: { done: number; total: number } | null
  pushLabel: string
  hasTts: boolean
  onOpenLibrary: () => void
  onImport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onExportApkg: () => void
  onPushAnki: () => void
  onCancelExport: () => void
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
  onOpenLibrary,
  onImport,
  onExportJson,
  onExportCsv,
  onExportApkg,
  onPushAnki,
  onCancelExport,
}: DeckToolsPanelProps) {
  const actionsDisabled = busy || exporting

  return (
    <Card className="border-border/70 bg-card/80 shadow-none">
      <CardHeader className="pb-1">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <FolderCog className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm">卡包与 Anki</CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">
              在需要时管理卡包、迁移数据或将变更发送到 Anki。
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 rounded-xl border border-border/60 bg-muted/45 px-3.5 py-3 md:min-w-64">
          <p className="truncate text-sm font-medium">{deckName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cardCount} 张卡片 · 共 {deckCount} 个卡包
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" disabled={actionsDisabled} onClick={onOpenLibrary}>
            <LibraryBig className="size-4" />
            管理卡包
          </Button>
          <Button type="button" variant="outline" disabled={actionsDisabled} onClick={onImport}>
            <Upload className="size-4" />
            导入
          </Button>

          {exporting ? (
            <Button type="button" variant="outline" onClick={onCancelExport}>
              {exportProgress && exportProgress.total > 0
                ? `${exportProgress.done}/${exportProgress.total} · 取消`
                : "取消导出"}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  <Download className="size-4" />
                  导出
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>导出当前卡包</DropdownMenuLabel>
                <DropdownMenuItem onClick={onExportJson}>
                  <Download className="size-4" />
                  JSON 备份
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv}>
                  <Download className="size-4" />
                  CSV 数据
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportApkg}>
                  <Download className="size-4" />
                  {hasTts ? "APKG（包含语音）" : "APKG 卡包"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            type="button"
            disabled={actionsDisabled}
            aria-label={pushLabel}
            onClick={onPushAnki}
          >
            <Send className="size-4" />
            <span className="sm:hidden">推送 Anki</span>
            <span className="hidden sm:inline">{pushLabel}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
