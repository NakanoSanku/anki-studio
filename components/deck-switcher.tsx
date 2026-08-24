"use client"

import Link from "next/link"
import { Check } from "lucide-react"

import { PATHS } from "@/lib/app-paths"
import type { Library } from "@/lib/library"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
}

export function DeckSwitcher({
  open,
  library,
  activeName,
  onOpenChange,
  onSwitch,
}: DeckSwitcherProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>选择卡包</SheetTitle>
          <SheetDescription>当前：{activeName}</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-1 px-2 pb-2">
          {library.decks.map((entry) => {
            const active = entry.id === library.activeId
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
                    active && "bg-muted"
                  )}
                  onClick={() => {
                    onSwitch(entry.id)
                    onOpenChange(false)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{entry.cardCount}</span>
                  {active ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="px-4 pb-2">
          <Button asChild variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            <Link href={PATHS.settingsDeck}>管理卡包</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
