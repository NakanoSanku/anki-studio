"use client"

import { Cloud, Copy, Laptop, Pause } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ConflictChoice, SyncConflict } from "@/lib/sync-types"

function formatTime(value: number): string {
  if (!value) return "未知时间"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "未知时间"
  }
}

export function SyncConflictDialog({
  conflict,
  onChoose,
}: {
  conflict: SyncConflict | null
  onChoose: (choice: ConflictChoice) => void
}) {
  return (
    <Dialog open={Boolean(conflict)} onOpenChange={(open) => { if (!open) onChoose("defer") }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            <span className="size-2 rounded-full bg-destructive/70" />
            Sync conflict
          </div>
          <DialogTitle className="text-2xl">两边都改过了</DialogTitle>
          <DialogDescription>
            「{conflict?.name}」在本机和云端都有新修改。选择保留的版本，或者先把本机复制一份。
          </DialogDescription>
        </DialogHeader>

        {conflict ? (
          <div className="grid grid-cols-2 gap-2.5">
            <VersionCard
              icon={<Laptop className="size-4" />}
              eyebrow="This device"
              title="本机版本"
              line1={conflict.localDeleted ? "本机已删除" : "有未同步修改"}
              line2={formatTime(conflict.localUpdatedAt)}
            />
            <VersionCard
              icon={<Cloud className="size-4" />}
              eyebrow="Cloud"
              title="云端版本"
              line1={conflict.remoteDeleted ? "云端已删除" : conflict.remoteName}
              line2={`版本 ${conflict.remoteRev}`}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-12 text-xs" onClick={() => onChoose("remote")}>
            <Cloud className="size-3.5" />
            用云端
          </Button>
          <Button type="button" className="h-12 text-xs" onClick={() => onChoose("local")}>
            <Laptop className="size-3.5" />
            用本机
          </Button>
        </div>

        <DialogFooter className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto]">
          <Button type="button" variant="outline" className="h-11 justify-start px-4 text-xs" onClick={() => onChoose("copy")}>
            <Copy className="size-3.5" />
            本机另存为新卡包
          </Button>
          <Button type="button" variant="ghost" className="h-11 px-4 text-xs text-muted-foreground" onClick={() => onChoose("defer")}>
            <Pause className="size-3.5" />
            稍后
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VersionCard({
  icon,
  eyebrow,
  title,
  line1,
  line2,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  line1: string
  line2: string
}) {
  return (
    <div className="rounded-[16px] border border-black/[0.065] bg-card p-4 dark:border-white/[0.09]">
      <span className="flex size-9 items-center justify-center rounded-[11px] bg-muted text-foreground">{icon}</span>
      <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-1 text-sm font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        {line1}<br />{line2}
      </p>
    </div>
  )
}
