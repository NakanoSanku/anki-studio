"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  applyTextImport,
  type ImportMode,
  type ImportPreview,
} from "@/lib/import-preview"
import type { Deck } from "@/lib/deck"

const MODES: { id: ImportMode; label: string; hint: string }[] = [
  { id: "merge", label: "合并到当前", hint: "按首字段去重后追加" },
  { id: "replace", label: "替换当前", hint: "覆盖当前卡包内容" },
  { id: "new", label: "新建卡包", hint: "导入为独立卡包并切换过去" },
]

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

  const confirm = () => {
    onConfirm(applyTextImport(preview, current, mode))
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel() }}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>导入校验</DialogTitle>
          <DialogDescription>
            {preview.filename} · {preview.encodingLabel}
            {preview.kind === "json" ? ` · ${preview.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="字段" value={String(preview.fields.length)} />
            <Stat label="数据行" value={String(preview.rowCount)} />
            <Stat label="空首字段" value={String(preview.emptyFirstField)} />
            <Stat label="与当前重复" value={String(preview.duplicateInCurrent)} />
          </div>

          {preview.fields.length > 0 ? (
            <p className="text-muted-foreground">
              字段：{preview.fields.join("、")}
            </p>
          ) : null}

          {errors.length > 0 ? (
            <IssueList title="错误，无法导入" tone="error" items={errors.map((item) => item.message)} />
          ) : null}
          {warnings.length > 0 ? (
            <IssueList title="警告" tone="warning" items={warnings.map((item) => item.message)} />
          ) : null}

          {sampleFields.length > 0 && preview.sample.length > 0 ? (
            <div>
              <p className="mb-1 text-muted-foreground">预览前 {preview.sample.length} 行</p>
              <ScrollArea className="max-h-40 rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {sampleFields.map((field) => (
                        <th key={field} className="px-2 py-1.5 font-medium">
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, index) => (
                      <tr key={index} className="border-b last:border-0">
                        {sampleFields.map((field) => (
                          <td key={field} className="max-w-32 truncate px-2 py-1.5">
                            {row[field] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          ) : null}

          {preview.canImport ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-muted-foreground">导入方式</legend>
              {MODES.map((item) => (
                <Label key={item.id} className="flex items-start gap-2 font-normal">
                  <input
                    type="radio"
                    name="import-mode"
                    className="mt-0.5"
                    checked={mode === item.id}
                    disabled={busy}
                    onChange={() => onModeChange(item.id)}
                  />
                  <span>
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-2 text-muted-foreground">{item.hint}</span>
                  </span>
                </Label>
              ))}
            </fieldset>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {preview.canImport ? "取消" : "关闭"}
          </Button>
          {preview.canImport ? (
            <Button type="button" disabled={busy} onClick={confirm}>
              确认导入
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function IssueList({
  title,
  tone,
  items,
}: {
  title: string
  tone: "error" | "warning"
  items: string[]
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2"
          : "rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2"
      }
    >
      <p className="mb-1 font-medium">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
