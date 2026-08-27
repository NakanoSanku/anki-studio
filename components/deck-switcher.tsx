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
          className="max-h-[86dvh] rounded-t-[28px] border-x-0 border-b-0 border-t border-black/[0.07] bg-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-22px_60px_-42px_rgba(0,0,0,0.55)] dark:border-white/[0.1]"
          onInteractOutside={blockSheetDismiss}
          onFocusOutside={blockSheetDismiss}
          onEscapeKeyDown={blockSheetDismiss}
        >
          <SheetHeader className="pb-3">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="size-2 rounded-full bg-energy" />
              Library
            </div>
            <div className="flex items-end justify-between gap-4">
              <SheetTitle className="text-[28px] font-semibold tracking-[-0.045em]">卡包</SheetTitle>
              <span className="pb-1 text-xs text-muted-foreground">{library.decks.length} 个</span>
            </div>
          </SheetHeader>

          <ul className="grid gap-2 overflow-y-auto px-3 pb-3">
            {library.decks.map((entry) => {
              const active = entry.id === library.activeId
              return (
                <li key={entry.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className={cn(
                      "group flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border px-4 py-3.5 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.99]",
                      active
                        ? "border-foreground/12 bg-foreground text-background"
                        : "border-black/[0.065] bg-background/45 text-foreground hover:bg-muted/55 dark:border-white/[0.09]"
                    )}
                    onClick={() => {
                      if (active) onOpenChange(false)
                      else onSwitch(entry.id)
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        active ? "bg-energy" : "bg-foreground/18"
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em]">
                      {displayName(entry)}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[11px] font-medium tabular-nums",
                        active ? "text-background/55" : "text-muted-foreground"
                      )}
                    >
                      {entry.cardCount}
                    </span>
                    {active ? (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-energy text-black">
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
                        className="my-auto shadow-none"
                        aria-label="更多"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-32 rounded-[16px] p-1.5">
                      <DropdownMenuItem
                        className="rounded-[12px]"
                        onSelect={(event) => {
                          event.preventDefault()
                          startNameStep({ kind: "rename", entry }, displayName(entry))
                        }}
                      >
                        改名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-[12px]"
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
                        className="rounded-[12px]"
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
              className="h-[52px] w-full rounded-[16px] bg-foreground text-sm font-semibold text-background hover:bg-foreground/90"
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
          className="rounded-[22px] border border-black/[0.07] bg-card p-5 dark:border-white/[0.1]"
        >
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span className="size-2 rounded-full bg-energy" />
              Deck name
            </div>
            <DialogTitle className="text-[24px] font-semibold tracking-[-0.04em]">
              {step ? nameTitle(step.kind) : ""}
            </DialogTitle>
          </DialogHeader>
          <Input
            key={step?.kind === "duplicate" || step?.kind === "rename" ? `${step.kind}:${step.entry.id}` : step?.kind}
            value={nameValue}
            autoFocus
            data-testid="deck-name-input"
            aria-label={step ? nameTitle(step.kind) : "名称"}
            className="h-12 bg-background text-base font-medium"
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
              className="h-12 flex-1"
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
          className="rounded-[22px] border border-black/[0.07] bg-card dark:border-white/[0.1]"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive/75">Careful</div>
            <AlertDialogTitle className="text-[24px] font-semibold tracking-[-0.04em]">删除卡包？</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              {step?.kind === "delete"
                ? `确定删除「${displayName(step.entry)}」？本机数据无法恢复。`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="h-12 flex-1 rounded-[14px]">取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-12 flex-1 rounded-[14px]"
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
