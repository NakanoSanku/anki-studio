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
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>卡包有冲突</DialogTitle>
          <DialogDescription>
            「{conflict?.name}」在本机和云端都被改过。选一边，或把本机另存为新卡包。
          </DialogDescription>
        </DialogHeader>
        {conflict ? (
          <div className="space-y-1 text-sm text-foreground/70">
            <p>本机：{conflict.localDeleted ? "已删除" : "有未同步的修改"} · {formatTime(conflict.localUpdatedAt)}</p>
            <p>
              云端：{conflict.remoteDeleted ? "已删除" : conflict.remoteName} · 版本 {conflict.remoteRev}
            </p>
          </div>
        ) : null}
        <DialogFooter className="sm:flex-col sm:items-stretch">
          <Button type="button" onClick={() => onChoose("remote")}>
            用云端
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoose("local")}>
            用本机
          </Button>
          <Button type="button" variant="outline" onClick={() => onChoose("copy")}>
            本机另存为新卡包
          </Button>
          <Button type="button" variant="ghost" onClick={() => onChoose("defer")}>
            稍后
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
