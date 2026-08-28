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
  { id: "merge", label: "Merge into current", hint: "Append after deduplicating by the first field", icon: Merge },
  { id: "replace", label: "Replace current", hint: "Overwrite the current deck content", icon: Replace },
  { id: "new", label: "Create new deck", hint: "Import separately and switch to it", icon: PackagePlus },
] as const satisfies ReadonlyArray<{ id: ImportMode; label: string; hint: string; icon: typeof Merge }>

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
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <span className="flex size-8 items-center justify-center rounded-[11px] bg-muted text-foreground"><FileInput className="size-4" /></span>
            Import preview
          </div>
          <DialogTitle className="text-2xl">Review before importing</DialogTitle>
          <DialogDescription>
            {preview.filename} · {preview.encodingLabel}{preview.kind === "json" ? ` · ${preview.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 overflow-hidden rounded-[18px] border border-black/[0.06] bg-card sm:grid-cols-4 dark:border-white/[0.08]">
          <Stat label="Fields" value={String(preview.fields.length)} />
          <Stat label="Rows" value={String(preview.rowCount)} divider />
          <Stat label="Empty keys" value={String(preview.emptyFirstField)} divider />
          <Stat label="Duplicates" value={String(preview.duplicateInCurrent)} divider />
        </div>

        {preview.fields.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.fields.map((field) => (
              <span key={field} className="rounded-[9px] border border-black/[0.055] bg-muted/55 px-2.5 py-1 text-[10px] font-medium text-muted-foreground dark:border-white/[0.07]">{field}</span>
            ))}
          </div>
        ) : null}

        {errors.length > 0 ? <IssueList title="These issues block the import" tone="error" items={errors.map((item) => item.message)} /> : null}
        {warnings.length > 0 ? <IssueList title="Review these warnings first" tone="warning" items={warnings.map((item) => item.message)} /> : null}

        {sampleFields.length > 0 && preview.sample.length > 0 ? (
          <div className="rounded-[18px] border border-black/[0.06] bg-card p-3 dark:border-white/[0.08]">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold">Data preview</span>
              <span className="text-[10px] font-medium text-muted-foreground">First {preview.sample.length} rows</span>
            </div>
            <ScrollArea className="max-h-44 rounded-[13px] border border-black/[0.05] bg-background/55 dark:border-white/[0.07]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-foreground text-background">
                    {sampleFields.map((field) => <th key={field} className="px-3 py-2 font-semibold">{field}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, index) => (
                    <tr key={index} className="border-b border-black/[0.045] last:border-0 dark:border-white/[0.06]">
                      {sampleFields.map((field) => <td key={field} className="max-w-36 truncate px-3 py-2 font-medium text-foreground/75">{row[field] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        ) : null}

        {preview.canImport ? (
          <fieldset>
            <legend className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Choose import mode</legend>
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
                      "relative min-h-28 rounded-[16px] border p-3.5 text-left transition-[background-color,border-color,transform] active:scale-[0.99] disabled:opacity-50",
                      active
                        ? "border-energy/40 bg-energy/15"
                        : "border-black/[0.065] bg-card hover:bg-muted/45 dark:border-white/[0.09]"
                    )}
                  >
                    <span className={cn("flex size-9 items-center justify-center rounded-[11px]", active ? "bg-energy text-black" : "bg-muted text-foreground")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="mt-3 block text-sm font-semibold tracking-[-0.02em]">{item.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{item.hint}</span>
                    {active ? <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-foreground text-background"><Check className="size-3" /></span> : null}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null}

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={onCancel}>
            {preview.canImport ? "Cancel" : "Close"}
          </Button>
          {preview.canImport ? <Button type="button" className="h-12 text-sm" disabled={busy} onClick={confirm}>Import</Button> : <div />}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, divider = false }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={cn("px-3.5 py-3", divider && "border-l border-black/[0.055] dark:border-white/[0.07]")}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  )
}

function IssueList({ title, tone, items }: { title: string; tone: "error" | "warning"; items: string[] }) {
  return (
    <div className={cn(
      "rounded-[15px] border px-4 py-3.5",
      tone === "error"
        ? "border-destructive/20 bg-destructive/8 text-destructive"
        : "border-black/[0.06] bg-muted/55 text-foreground dark:border-white/[0.08]"
    )}>
      <p className="flex items-center gap-1.5 text-xs font-semibold"><AlertTriangle className="size-3.5" />{title}</p>
      <ul className={cn("mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4", tone === "error" ? "text-destructive/75" : "text-muted-foreground")}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}
