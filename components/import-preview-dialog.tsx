"use client"

import { AlertTriangle, Check, FileInput, Merge, PackagePlus, Replace } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  applyTextImport,
  type ImportMode,
  type ImportPreview,
} from "@/lib/import-preview"
import type { Deck } from "@/lib/deck"
import { cn } from "@/lib/utils"

const MODES = [
  { id: "merge", label: "合并到当前", hint: "按首字段去重后追加", icon: Merge, color: "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]" },
  { id: "replace", label: "替换当前", hint: "覆盖当前卡包内容", icon: Replace, color: "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]" },
  { id: "new", label: "新建卡包", hint: "独立导入并切换过去", icon: PackagePlus, color: "bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]" },
] as const satisfies ReadonlyArray<{ id: ImportMode; label: string; hint: string; icon: typeof Merge; color: string }>

type ImportPreviewDialogProps = {
  preview: ImportPreview | null
  current: Deck
  mode: ImportMode
  busy?: boolean
  onModeChange: (mode: ImportMode) => void
  onCancel: () => void
  onConfirm: (result: ReturnType<typeof applyTextImport>) => void
}

export function ImportPreviewDialog({
  preview,
  current,
  mode,
  busy,
  onModeChange,
  onCancel,
  onConfirm,
}: ImportPreviewDialogProps) {
  if (!preview) return null

  const errors = preview.issues.filter((item) => item.level === "error")
  const warnings = preview.issues.filter((item) => item.level === "warning")
  const sampleFields = preview.fields.slice(0, 4)

  const confirm = () => onConfirm(applyTextImport(preview, current, mode))

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader className="pr-8">
          <div className="mb-1 flex size-11 items-center justify-center rounded-[1.15rem] bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]">
            <FileInput className="size-5" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">import preview</p>
          <DialogTitle className="text-2xl">先看看再导入</DialogTitle>
          <DialogDescription className="font-medium">
            {preview.filename} · {preview.encodingLabel}{preview.kind === "json" ? ` · ${preview.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="字段" value={String(preview.fields.length)} color="blue" />
          <Stat label="数据行" value={String(preview.rowCount)} color="green" />
          <Stat label="空首字段" value={String(preview.emptyFirstField)} color="yellow" />
          <Stat label="当前重复" value={String(preview.duplicateInCurrent)} color="pink" />
        </div>

        {preview.fields.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.fields.map((field) => (
              <span key={field} className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black text-muted-foreground">{field}</span>
            ))}
          </div>
        ) : null}

        {errors.length > 0 ? <IssueList title="这些问题会阻止导入" tone="error" items={errors.map((item) => item.message)} /> : null}
        {warnings.length > 0 ? <IssueList title="导入前提醒" tone="warning" items={warnings.map((item) => item.message)} /> : null}

        {sampleFields.length > 0 && preview.sample.length > 0 ? (
          <div className="rounded-[1.6rem] bg-card p-3 shadow-[0_16px_44px_-38px_rgba(0,0,0,0.7)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-black">数据预览</span>
              <span className="text-[10px] font-bold text-muted-foreground">前 {preview.sample.length} 行</span>
            </div>
            <ScrollArea className="max-h-44 rounded-[1.2rem] bg-muted/45">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-black text-white dark:bg-white dark:text-black">
                    {sampleFields.map((field) => <th key={field} className="px-3 py-2 font-black">{field}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, index) => (
                    <tr key={index} className="border-b border-black/[0.04] last:border-0 dark:border-white/[0.06]">
                      {sampleFields.map((field) => <td key={field} className="max-w-36 truncate px-3 py-2 font-medium">{row[field] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        ) : null}

        {preview.canImport ? (
          <fieldset>
            <legend className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">choose import mode</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((item) => {
                const Icon = item.icon
                const active = mode === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() => onModeChange(item.id)}
                    className={cn(
                      "relative min-h-28 rounded-[1.5rem] p-3.5 text-left transition-transform active:scale-[0.985]",
                      item.color,
                      active && "ring-4 ring-black dark:ring-white"
                    )}
                  >
                    <Icon className="size-4.5" />
                    <span className="mt-4 block text-sm font-black tracking-[-0.03em]">{item.label}</span>
                    <span className="mt-1 block text-[10px] font-semibold leading-4 opacity-55">{item.hint}</span>
                    {active ? <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black"><Check className="size-3" /></span> : null}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null}

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={onCancel}>
            {preview.canImport ? "取消" : "关闭"}
          </Button>
          {preview.canImport ? (
            <Button type="button" className="h-12 bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black" disabled={busy} onClick={confirm}>
              确认导入
            </Button>
          ) : <div />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: "blue" | "green" | "yellow" | "pink" }) {
  const classes = {
    blue: "bg-[#dff1ff] text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]",
    green: "bg-[#d8f4aa] text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]",
    yellow: "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]",
    pink: "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]",
  }
  return (
    <div className={cn("rounded-[1.4rem] px-3.5 py-3", classes[color])}>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] opacity-45">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-[-0.045em]">{value}</p>
    </div>
  )
}

function IssueList({ title, tone, items }: { title: string; tone: "error" | "warning"; items: string[] }) {
  return (
    <div className={cn(
      "rounded-[1.4rem] px-4 py-3.5",
      tone === "error"
        ? "bg-[#ffd8df] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]"
        : "bg-[#ffe39a] text-[#654600] dark:bg-[#68551f] dark:text-[#ffedb8]"
    )}>
      <p className="flex items-center gap-1.5 text-xs font-black"><AlertTriangle className="size-3.5" />{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] font-semibold leading-4 opacity-65">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}
