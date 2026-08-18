"use client"

import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import type { Library, LibraryEntry } from "@/lib/library"
import { cn } from "@/lib/utils"

type DeckLibraryDialogProps = {
  open: boolean
  library: Library
  activeName: string
  onOpenChange: (open: boolean) => void
  onSwitch: (id: string) => void
  onCreate: () => void
  onDuplicate: () => void
  onDelete: (id: string) => void
}

export function DeckLibraryDialog({
  open,
  library,
  activeName,
  onOpenChange,
  onSwitch,
  onCreate,
  onDuplicate,
  onDelete,
}: DeckLibraryDialogProps) {
  const [pendingDelete, setPendingDelete] = useState<LibraryEntry | null>(null)
  const canDelete = library.decks.length > 1

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>卡包管理</DialogTitle>
            <DialogDescription>
              当前：{activeName} · 共 {library.decks.length} 个卡包
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-80">
            <ul className="grid gap-2">
              {library.decks.map((entry) => {
                const active = entry.id === library.activeId
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2",
                      active ? "border-foreground/20 bg-muted/50" : "border-transparent bg-muted/20"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {active ? activeName : entry.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.cardCount} 张
                        {active ? " · 当前" : ""}
                      </p>
                    </div>
                    {!active ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => onSwitch(entry.id)}>
                        打开
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canDelete}
                      onClick={() => setPendingDelete(entry)}
                    >
                      删除
                    </Button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onDuplicate}>
              复制当前
            </Button>
            <Button type="button" onClick={onCreate}>
              新建卡包
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(next) => { if (!next) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除卡包</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{pendingDelete?.name}」？本机数据无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
