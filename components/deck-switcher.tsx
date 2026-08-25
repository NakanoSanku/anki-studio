"use client"

import { useState } from "react"
import { Check, MoreHorizontal } from "lucide-react"

import {
  isDeckNameReady,
  nextCopyDeckName,
  type Library,
  type LibraryEntry,
} from "@/lib/library"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type DeckSwitcherProps = {
  open: boolean
  library: Library
  activeName: string
  onOpenChange: (open: boolean) => void
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onDuplicate: (id: string, name: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

type DeckStep =
  | { kind: "create" }
  | { kind: "rename"; entry: LibraryEntry }
  | { kind: "duplicate"; entry: LibraryEntry }
  | { kind: "delete"; entry: LibraryEntry }

function nameTitle(kind: DeckStep["kind"]): string {
  if (kind === "create") return "新建"
  if (kind === "rename") return "改名"
  if (kind === "duplicate") return "复制"
  return "删除"
}

export function DeckSwitcher({
  open,
  library,
  activeName,
  onOpenChange,
  onSwitch,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
}: DeckSwitcherProps) {
  const [step, setStep] = useState<DeckStep | null>(null)
  const [nameValue, setNameValue] = useState("")
  const canDelete = library.decks.length > 1
  const nameReady = isDeckNameReady(nameValue)
  const nameOpen =
    open && (step?.kind === "create" || step?.kind === "rename" || step?.kind === "duplicate")
  const deleteOpen = open && step?.kind === "delete"

  const displayName = (entry: LibraryEntry) =>
    entry.id === library.activeId ? activeName : entry.name

  const visibleNames = () => library.decks.map((entry) => displayName(entry))

  const closeStep = () => {
    setStep(null)
    setNameValue("")
  }

  const startNameStep = (next: Exclude<DeckStep, { kind: "delete" }>, value: string) => {
    setNameValue(value)
    setStep(next)
  }

  const submitName = () => {
    if (!nameReady || !step) return
    const name = nameValue.trim()
    if (step.kind === "create") onCreate(name)
    else if (step.kind === "rename") onRename(step.entry.id, name)
    else if (step.kind === "duplicate") onDuplicate(step.entry.id, name)
    closeStep()
  }

  const blockSheetDismiss = (event: { preventDefault: () => void }) => {
    if (step) event.preventDefault()
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next && step) return
          if (!next) closeStep()
          onOpenChange(next)
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
          onInteractOutside={blockSheetDismiss}
          onFocusOutside={blockSheetDismiss}
          onEscapeKeyDown={blockSheetDismiss}
        >
          <SheetHeader>
            <SheetTitle>卡包</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-1 px-2 pb-2">
            {library.decks.map((entry) => {
              const active = entry.id === library.activeId
              return (
                <li key={entry.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left",
                      active && "bg-muted"
                    )}
                    onClick={() => {
                      if (active) onOpenChange(false)
                      else onSwitch(entry.id)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(entry)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.cardCount}</span>
                    {active ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="更多">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          startNameStep({ kind: "rename", entry }, displayName(entry))
                        }}
                      >
                        改名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault()
                          startNameStep(
                            { kind: "duplicate", entry },
                            nextCopyDeckName(visibleNames(), displayName(entry))
                          )
                        }}
                      >
                        复制
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!canDelete}
                        onSelect={(event) => {
                          event.preventDefault()
                          setStep({ kind: "delete", entry })
                        }}
                      >
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
          <div className="px-4 pb-2">
            <Button
              type="button"
              className="w-full"
              onClick={() => startNameStep({ kind: "create" }, "")}
            >
              新建
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={nameOpen}
        onOpenChange={(next) => {
          if (!next) closeStep()
        }}
      >
        <DialogContent showCloseButton={false} aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{step ? nameTitle(step.kind) : ""}</DialogTitle>
          </DialogHeader>
          <Input
            key={step?.kind === "duplicate" || step?.kind === "rename" ? `${step.kind}:${step.entry.id}` : step?.kind}
            value={nameValue}
            autoFocus
            data-testid="deck-name-input"
            aria-label={step ? nameTitle(step.kind) : "名称"}
            onChange={(event) => setNameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !nameReady) return
              submitName()
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeStep}>
              取消
            </Button>
            <Button type="button" disabled={!nameReady} onClick={submitName}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) closeStep()
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>删除</AlertDialogTitle>
            <AlertDialogDescription>
              {step?.kind === "delete"
                ? `确定删除「${displayName(step.entry)}」？本机数据无法恢复。`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (step?.kind === "delete") onDelete(step.entry.id)
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
