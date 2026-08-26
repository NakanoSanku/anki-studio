"use client"

import { Cloud, Copy, Laptop, Pause, Sparkles } from "lucide-react"

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
          <span className="mb-1 inline-flex w-fit items-center rounded-full bg-[#ffd8df] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]">
            <Sparkles className="mr-1 size-3" />sync conflict
          </span>
          <DialogTitle className="text-2xl">两边都改过了</DialogTitle>
          <DialogDescription className="font-medium leading-5">
            「{conflict?.name}」在本机和云端都有新修改。选你想保留的版本，或者先把本机复制一份。
          </DialogDescription>
        </DialogHeader>

        {conflict ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[1.6rem] bg-[#dff1ff] p-4 text-[#174f85] dark:bg-[#244d74] dark:text-[#dceeff]">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/55 dark:bg-black/15"><Laptop className="size-4" /></span>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] opacity-45">this device</p>
              <h3 className="mt-1 text-base font-black tracking-[-0.035em]">本机版本</h3>
              <p className="mt-2 text-[11px] font-semibold leading-4 opacity-55">
                {conflict.localDeleted ? "本机已删除" : "有未同步修改"}<br />{formatTime(conflict.localUpdatedAt)}
              </p>
            </div>

            <div className="rounded-[1.6rem] bg-[#d8f4aa] p-4 text-[#315f18] dark:bg-[#385528] dark:text-[#e4f8c5]">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/55 dark:bg-black/15"><Cloud className="size-4" /></span>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] opacity-45">cloud</p>
              <h3 className="mt-1 text-base font-black tracking-[-0.035em]">云端版本</h3>
              <p className="mt-2 text-[11px] font-semibold leading-4 opacity-55">
                {conflict.remoteDeleted ? "云端已删除" : conflict.remoteName}<br />版本 {conflict.remoteRev}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-12 bg-[#d8f4aa] text-xs font-black text-[#315f18] hover:bg-[#c9ed91] dark:bg-[#385528] dark:text-[#e4f8c5] dark:hover:bg-[#42612f]" onClick={() => onChoose("remote")}>
            <Cloud className="size-3.5" />用云端
          </Button>
          <Button type="button" className="h-12 bg-[#dff1ff] text-xs font-black text-[#174f85] hover:bg-[#cae7ff] dark:bg-[#244d74] dark:text-[#dceeff] dark:hover:bg-[#2b5a86]" onClick={() => onChoose("local")}>
            <Laptop className="size-3.5" />用本机
          </Button>
        </div>

        <DialogFooter className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto]">
          <Button type="button" variant="outline" className="h-11 justify-start px-4 text-xs font-black" onClick={() => onChoose("copy")}>
            <Copy className="size-3.5" />本机另存为新卡包
          </Button>
          <Button type="button" variant="ghost" className="h-11 px-4 text-xs font-black" onClick={() => onChoose("defer")}>
            <Pause className="size-3.5" />稍后
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
