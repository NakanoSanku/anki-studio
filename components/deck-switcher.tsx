"use client"

import { useState } from "react"
import { Check, MoreHorizontal, Plus } from "lucide-react"

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

const deckPastels = [
  "bg-[#cfe6ff] text-[#194f83]",
  "bg-[#d8f4aa] text-[#315f18]",
  "bg-[#ffe39a] text-[#654600]",
  "bg-[#ffd8df] text-[#761c31]",
  "bg-[#ffc7b8] text-[#743421]",
] as const

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
          className="max-h-[86dvh] rounded-t-[2.25rem] border-0 bg-[#fffaf5] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-24px_70px_-42px_rgba(0,0,0,0.65)] dark:bg-[#171512]"
          onInteractOutside={blockSheetDismiss}
          onFocusOutside={blockSheetDismiss}
          onEscapeKeyDown={blockSheetDismiss}
        >
          <SheetHeader className="pb-2">
            <div className="mb-1 inline-flex w-fit rounded-full bg-[#cfe6ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#194f83] dark:bg-[#244d74] dark:text-[#dceeff]">
              your decks
            </div>
            <SheetTitle className="text-3xl font-black tracking-[-0.055em]">卡包</SheetTitle>
          </SheetHeader>

          <ul className="grid gap-2 overflow-y-auto px-3 pb-3">
            {library.decks.map((entry, index) => {
              const active = entry.id === library.activeId
              return (
                <li key={entry.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className={cn(
                      "group flex min-w-0 flex-1 items-center gap-3 rounded-[1.45rem] px-4 py-4 text-left transition-transform active:scale-[0.985]",
                      active
                        ? "bg-black text-white shadow-[0_18px_42px_-30px_rgba(0,0,0,0.85)] dark:bg-white dark:text-black"
                        : deckPastels[index % deckPastels.length]
                    )}
                    onClick={() => {
                      if (active) onOpenChange(false)
                      else onSwitch(entry.id)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-base font-black tracking-[-0.025em]">
                      {displayName(entry)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums",
                        active ? "bg-white/15 text-white dark:bg-black/10 dark:text-black" : "bg-white/45 text-current"
                      )}
                    >
                      {entry.cardCount}
                    </span>
                    {active ? (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-black dark:bg-black dark:text-white">
                        <Check className="size-3.5" />
                      </span>
                    ) : null}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="outline"
                        className="my-auto border-0 bg-white shadow-[0_10px_28px_-22px_rgba(0,0,0,0.75)] dark:bg-white/10"
                        aria-label="更多"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-32 rounded-2xl p-1.5">
                      <DropdownMenuItem
                        className="rounded-xl"
                        onSelect={(event) => {
                          event.preventDefault()
                          startNameStep({ kind: "rename", entry }, displayName(entry))
                        }}
                      >
                        改名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-xl"
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
                        className="rounded-xl"
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

          <div className="px-4 pb-2 pt-1">
            <Button
              type="button"
              className="h-14 w-full rounded-full bg-black text-sm font-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
              onClick={() => startNameStep({ kind: "create" }, "")}
            >
              <Plus className="size-4" />
              新建卡包
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
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="rounded-[2rem] border-0 bg-[#fffaf5] p-5 dark:bg-[#171512]"
        >
          <DialogHeader>
            <div className="mb-1 inline-flex w-fit rounded-full bg-[#ff9bd6]/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
              deck name
            </div>
            <DialogTitle className="text-2xl font-black tracking-[-0.04em]">
              {step ? nameTitle(step.kind) : ""}
            </DialogTitle>
          </DialogHeader>
          <Input
            key={step?.kind === "duplicate" || step?.kind === "rename" ? `${step.kind}:${step.entry.id}` : step?.kind}
            value={nameValue}
            autoFocus
            data-testid="deck-name-input"
            aria-label={step ? nameTitle(step.kind) : "名称"}
            className="h-12 bg-white text-base font-semibold dark:bg-white/[0.06]"
            onChange={(event) => setNameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !nameReady) return
              submitName()
            }}
          />
          <DialogFooter className="flex-row gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={closeStep}>
              取消
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black"
              disabled={!nameReady}
              onClick={submitName}
            >
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
          className="rounded-[2rem] border-0 bg-[#fffaf5] dark:bg-[#171512]"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <div className="mb-1 inline-flex w-fit rounded-full bg-[#ffd8df] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#761c31] dark:bg-[#6a2835] dark:text-[#ffdce3]">
              careful
            </div>
            <AlertDialogTitle className="text-2xl font-black tracking-[-0.04em]">删除卡包？</AlertDialogTitle>
            <AlertDialogDescription className="font-medium leading-6">
              {step?.kind === "delete"
                ? `确定删除「${displayName(step.entry)}」？本机数据无法恢复。`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="h-12 flex-1 rounded-full">取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-12 flex-1 rounded-full"
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
