"use client"

import { useState } from "react"
import { Check, MoreHorizontal } from "lucide-react"

import { isDeckNameReady, type Library, type LibraryEntry } from "@/lib/library"
import { Button } from "@/components/ui/button"
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
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

type NestedStep =
  | { kind: "create" }
  | { kind: "rename"; entry: LibraryEntry }
  | { kind: "delete"; entry: LibraryEntry }

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
  const [step, setStep] = useState<NestedStep | null>(null)
  const [nameValue, setNameValue] = useState("")
  const canDelete = library.decks.length > 1
  const nameReady = isDeckNameReady(nameValue)

  const displayName = (entry: LibraryEntry) =>
    entry.id === library.activeId ? activeName : entry.name

  const closeNested = () => {
    setStep(null)
    setNameValue("")
  }

  const nestedTitle = step?.kind === "create" ? "新建" : step?.kind === "rename" ? "改名" : "删除"

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeNested()
        onOpenChange(next)
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                      onClick={() => {
                        setNameValue(displayName(entry))
                        setStep({ kind: "rename", entry })
                      }}
                    >
                      改名
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(entry.id)}>复制</DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={!canDelete}
                      onClick={() => setStep({ kind: "delete", entry })}
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
            onClick={() => {
              setNameValue("")
              setStep({ kind: "create" })
            }}
          >
            新建
          </Button>
        </div>

        {step ? (
          <div
            data-slot="deck-nested-sheet"
            className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/20"
          >
            <div className="rounded-t-2xl border-t border-border/70 bg-popover pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
              <SheetHeader>
                <SheetTitle>{nestedTitle}</SheetTitle>
              </SheetHeader>
              {step.kind === "delete" ? (
                <div className="space-y-4 px-4 pb-4">
                  <p className="text-sm">确定删除「{displayName(step.entry)}」？本机数据无法恢复。</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={closeNested}>
                      取消
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        onDelete(step.entry.id)
                        closeNested()
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 px-4 pb-4">
                  <Input
                    value={nameValue}
                    autoFocus
                    aria-label={nestedTitle}
                    onChange={(event) => setNameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || !nameReady) return
                      if (step.kind === "create") onCreate(nameValue.trim())
                      if (step.kind === "rename") onRename(step.entry.id, nameValue.trim())
                      closeNested()
                    }}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={closeNested}>
                      取消
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={!nameReady}
                      onClick={() => {
                        if (!nameReady) return
                        if (step.kind === "create") onCreate(nameValue.trim())
                        if (step.kind === "rename") onRename(step.entry.id, nameValue.trim())
                        closeNested()
                      }}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
